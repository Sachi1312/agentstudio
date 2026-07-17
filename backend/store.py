import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "runs.db"))

def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            thread_id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            language TEXT NOT NULL,
            score INTEGER,
            sources_count INTEGER,
            created_at TEXT NOT NULL,
            final_output TEXT,
            citations TEXT,
            bias_report TEXT,
            fact_check TEXT
        )
    """)
    # CREATE TABLE IF NOT EXISTS doesn't retroactively add columns to a
    # runs.db that already exists from before usage tracking was added.
    for column, col_type in (("tokens_used", "INTEGER DEFAULT 0"), ("cost_usd", "REAL DEFAULT 0")):
        try:
            conn.execute(f"ALTER TABLE runs ADD COLUMN {column} {col_type}")
        except sqlite3.OperationalError:
            pass  # column already exists
    conn.commit()
    conn.close()

def save_run(thread_id, topic, language, score, sources_count, final_output, citations, bias_report, fact_check, tokens_used=0, cost_usd=0.0):
    conn = _connect()
    conn.execute("""
        INSERT INTO runs (thread_id, topic, language, score, sources_count, created_at, final_output, citations, bias_report, fact_check, tokens_used, cost_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
            score=excluded.score,
            sources_count=excluded.sources_count,
            final_output=excluded.final_output,
            citations=excluded.citations,
            bias_report=excluded.bias_report,
            fact_check=excluded.fact_check,
            tokens_used=excluded.tokens_used,
            cost_usd=excluded.cost_usd
    """, (
        thread_id, topic, language, score, sources_count,
        datetime.now(timezone.utc).isoformat(),
        final_output, citations, bias_report, fact_check,
        tokens_used, cost_usd
    ))
    conn.commit()
    conn.close()

def list_runs(limit=100):
    conn = _connect()
    rows = conn.execute("""
        SELECT thread_id, topic, language, score, sources_count, created_at, tokens_used, cost_usd
        FROM runs ORDER BY created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_run(thread_id):
    conn = _connect()
    row = conn.execute("SELECT * FROM runs WHERE thread_id = ?", (thread_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_run(thread_id):
    conn = _connect()
    conn.execute("DELETE FROM runs WHERE thread_id = ?", (thread_id,))
    conn.commit()
    conn.close()
