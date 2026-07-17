import pytest
from backend import store

@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    # Points store at a throwaway DB file instead of the real runs.db so
    # tests can't clobber actual run history.
    monkeypatch.setattr(store, "DB_PATH", str(tmp_path / "test_runs.db"))
    store.init_db()
    return store

def test_save_and_get_run_round_trips(isolated_db):
    isolated_db.save_run(
        thread_id="t1", topic="Test topic", language="English",
        score=8, sources_count=3, final_output="body", citations="",
        bias_report="", fact_check="", tokens_used=500, cost_usd=0.01
    )
    run = isolated_db.get_run("t1")
    assert run["topic"] == "Test topic"
    assert run["score"] == 8
    assert run["tokens_used"] == 500
    assert run["cost_usd"] == 0.01

def test_get_run_returns_none_for_unknown_thread(isolated_db):
    assert isolated_db.get_run("does-not-exist") is None

def test_list_runs_orders_most_recent_first(isolated_db):
    isolated_db.save_run("t1", "First", "English", 5, 1, "", "", "", "")
    isolated_db.save_run("t2", "Second", "English", 5, 1, "", "", "", "")
    runs = isolated_db.list_runs()
    assert [r["thread_id"] for r in runs] == ["t2", "t1"]

def test_save_run_upserts_existing_thread(isolated_db):
    isolated_db.save_run("t1", "Topic", "English", 5, 1, "old", "", "", "")
    isolated_db.save_run("t1", "Topic", "English", 9, 4, "new", "", "", "")
    run = isolated_db.get_run("t1")
    assert run["score"] == 9
    assert run["final_output"] == "new"
    assert len(isolated_db.list_runs()) == 1

def test_delete_run_removes_it(isolated_db):
    isolated_db.save_run("t1", "Topic", "English", 5, 1, "", "", "", "")
    isolated_db.delete_run("t1")
    assert isolated_db.get_run("t1") is None
    assert isolated_db.list_runs() == []

def test_delete_run_on_unknown_thread_is_a_no_op(isolated_db):
    isolated_db.delete_run("does-not-exist")  # should not raise
