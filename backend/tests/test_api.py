import asyncio
import pytest
from fastapi.testclient import TestClient
from backend import store
from backend import main

@pytest.fixture
def client(tmp_path, monkeypatch):
    # Isolate from the real runs.db so tests can't see/clobber real history.
    monkeypatch.setattr(store, "DB_PATH", str(tmp_path / "test_runs.db"))
    store.init_db()
    # Reset the concurrency counter between tests — it's process-global state.
    monkeypatch.setattr(main, "_active_run_count", 0)
    return TestClient(main.app)

def test_list_runs_empty(client):
    res = client.get("/runs")
    assert res.status_code == 200
    assert res.json() == []

def test_get_unknown_run_is_404(client):
    res = client.get("/runs/does-not-exist")
    assert res.status_code == 404

def test_delete_unknown_run_does_not_error(client):
    res = client.delete("/runs/does-not-exist")
    assert res.status_code == 200

def test_get_run_returns_saved_data(client):
    store.save_run("t1", "Topic", "English", 8, 3, "body", "", "", "")
    res = client.get("/runs/t1")
    assert res.status_code == 200
    assert res.json()["topic"] == "Topic"

def test_start_rejects_past_concurrency_limit(client, monkeypatch):
    # Stub out the real graph so /start never touches the LLM — this test
    # is only about the concurrency gate, not agent behavior. The stub
    # never completes, so it holds its slot for the life of the test.
    async def hang_forever(*args, **kwargs):
        await asyncio.Event().wait()

    monkeypatch.setattr(main, "run_graph", hang_forever)

    for i in range(main.MAX_CONCURRENT_RUNS):
        res = client.post("/start", json={"topic": f"topic {i}", "language": "English"})
        assert res.status_code == 200, res.text

    res = client.post("/start", json={"topic": "one too many", "language": "English"})
    assert res.status_code == 429
    assert "max" in res.json()["detail"].lower() or str(main.MAX_CONCURRENT_RUNS) in res.json()["detail"]

def test_approve_and_reject_on_unknown_thread_return_error_not_crash(client):
    res = client.post("/approve", json={"thread_id": "does-not-exist"})
    assert res.status_code == 200  # not a raised HTTPException, but a soft error body
    assert "error" in res.json()

    res = client.post("/reject", json={"thread_id": "does-not-exist", "feedback": "x"})
    assert res.status_code == 200
    assert "error" in res.json()
