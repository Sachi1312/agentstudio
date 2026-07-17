from backend.certs import ensure_trusted_ca_bundle
ensure_trusted_ca_bundle()  # must run before any HTTPS client is constructed below

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.graph import agent_graph
from backend import store, broadcast
import asyncio
import json
import os

store.init_db()

app = FastAPI()

# The frontend now derives its API base from window.location so it's
# same-origin whenever possible (see frontend/src/lib/api.js), but this
# stays broad as a fallback for local dev — localhost and 127.0.0.1 are
# different origins to a browser, and someone will type either one.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):(5173|8000)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = {}
graph_states = {}
pending_messages = {}

# Each run makes ~8+ paid LLM calls plus search requests. With no cap,
# nothing stops a page full of rapid clicks (or a bug/bot) from firing off
# dozens of concurrent runs and burning through API credits. This limits
# how many can be in flight at once; /start returns a clear error past that.
MAX_CONCURRENT_RUNS = 3
_active_run_count = 0
_run_count_lock = asyncio.Lock()

class TopicRequest(BaseModel):
    topic: str
    language: str = "English"

class RejectRequest(BaseModel):
    thread_id: str
    feedback: str

class ApproveRequest(BaseModel):
    thread_id: str
    draft: str | None = None

@app.get("/runs")
async def list_runs():
    return store.list_runs()

@app.get("/runs/{thread_id}")
async def get_run(thread_id: str):
    run = store.get_run(thread_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@app.delete("/runs/{thread_id}")
async def delete_run(thread_id: str):
    store.delete_run(thread_id)
    return {"status": "deleted"}

@app.post("/start")
async def start_run(request: TopicRequest):
    global _active_run_count
    async with _run_count_lock:
        if _active_run_count >= MAX_CONCURRENT_RUNS:
            raise HTTPException(
                status_code=429,
                detail=f"Too many research runs in progress ({MAX_CONCURRENT_RUNS} max). Wait for one to finish and try again."
            )
        _active_run_count += 1

    thread_id = request.topic.replace(" ", "_")[:20]

    initial_state = {
        "topic": request.topic,
        "language": request.language,
        "search_results": "",
        "summary": "",
        "draft": "",
        "critique": "",
        "score": 0,
        "fact_check": "",
        "bias_report": "",
        "citations": "",
        "final_output": "",
        "revision_count": 0,
        "human_approved": False,
        "tokens_used": 0,
        "cost_usd": 0.0
    }

    config = {"configurable": {"thread_id": thread_id}}
    graph_states[thread_id] = config

    asyncio.create_task(run_graph(thread_id, initial_state, config))

    return {"thread_id": thread_id, "topic": request.topic}

async def _release_run_slot():
    global _active_run_count
    async with _run_count_lock:
        _active_run_count = max(0, _active_run_count - 1)

async def _stream_graph(thread_id: str, stream_input, config: dict):
    # agent_graph.stream() and every node function underneath it (LLM calls,
    # DuckDuckGo/Wikipedia requests) are synchronous and block the event
    # loop for the duration of each call. Run the whole blocking iteration
    # in a worker thread so FastAPI can keep accepting connections (like
    # the frontend's websocket) while agents are running, and hop back onto
    # the event loop for each send via run_coroutine_threadsafe.
    loop = asyncio.get_running_loop()

    def on_writer_token(text):
        fut = asyncio.run_coroutine_threadsafe(
            send_update(thread_id, {"event": "writer_token", "text": text}),
            loop
        )
        fut.result()

    broadcast.register(thread_id, on_writer_token)

    def worker():
        for event in agent_graph.stream(stream_input, config):
            for node_name, node_output in event.items():
                if node_name == "__interrupt__":
                    continue
                fut = asyncio.run_coroutine_threadsafe(
                    send_update(thread_id, {
                        "event": "agent_done",
                        "agent": node_name,
                        "data": node_output
                    }),
                    loop
                )
                fut.result()

    try:
        await asyncio.to_thread(worker)
    finally:
        broadcast.unregister(thread_id)

async def _send_pause_or_completion(thread_id: str, config: dict):
    state = agent_graph.get_state(config)
    if state.next and "critic" in state.next:
        await send_update(thread_id, {
            "event": "human_review",
            "draft": state.values.get("draft", "")
        })
    elif not state.next:
        final = state.values
        # search_results holds the researcher's LLM-written prose summary, not
        # the raw "URL:"-formatted search hits, so counting it undercounts
        # (usually to 0). citations is generated in a fixed "URL: ..." per
        # source format, so it reflects the real source count reliably.
        sources_count = final.get("citations", "").count("URL:")
        store.save_run(
            thread_id=thread_id,
            topic=final.get("topic", ""),
            language=final.get("language", "English"),
            score=final.get("score", 0),
            sources_count=sources_count,
            final_output=final.get("final_output", ""),
            citations=final.get("citations", ""),
            bias_report=final.get("bias_report", ""),
            fact_check=final.get("fact_check", ""),
            tokens_used=final.get("tokens_used", 0),
            cost_usd=final.get("cost_usd", 0.0)
        )
        await send_update(thread_id, {
            "event": "completed",
            "topic": final.get("topic", ""),
            "final_output": final.get("final_output", ""),
            "citations": final.get("citations", ""),
            "bias_report": final.get("bias_report", ""),
            "fact_check": final.get("fact_check", ""),
            "score": final.get("score", 0),
            "tokens_used": final.get("tokens_used", 0),
            "cost_usd": final.get("cost_usd", 0.0)
        })
        await _release_run_slot()

async def run_graph(thread_id: str, initial_state: dict, config: dict):
    await send_update(thread_id, {"event": "started", "agent": "researcher"})
    try:
        await _stream_graph(thread_id, initial_state, config)
        await _send_pause_or_completion(thread_id, config)
    except Exception as e:
        await send_update(thread_id, {"event": "error", "message": str(e)})
        await _release_run_slot()

@app.post("/approve")
async def approve(request: ApproveRequest):
    config = graph_states.get(request.thread_id)
    if not config:
        return {"error": "Thread not found"}

    # Optional inline edit: the human can tweak the draft in the review step
    # before sending it on to the critic, rather than only being able to
    # approve as-is or reject with a text note.
    if request.draft is not None:
        agent_graph.update_state(config, {"draft": request.draft})

    asyncio.create_task(resume_graph(request.thread_id, config))
    return {"status": "approved"}

@app.post("/reject")
async def reject(request: RejectRequest):
    config = graph_states.get(request.thread_id)
    if not config:
        return {"error": "Thread not found"}

    # The graph is paused *before* the critic node. Resuming normally would
    # run critic_agent next, which unconditionally overwrites `critique`/
    # `score` with its own LLM output — discarding the human's feedback
    # before the writer ever sees it. Writing the update `as_node="critic"`
    # makes the checkpoint look like critic already ran with these values,
    # so the conditional edge routes straight to the writer with the human's
    # actual feedback intact, and without wasting a critic LLM call.
    agent_graph.update_state(
        config,
        {"critique": request.feedback, "score": 0},
        as_node="critic"
    )

    asyncio.create_task(resume_graph(request.thread_id, config))
    return {"status": "rejected"}

async def resume_graph(thread_id: str, config: dict):
    try:
        await _stream_graph(thread_id, None, config)
        await _send_pause_or_completion(thread_id, config)
    except Exception as e:
        await send_update(thread_id, {"event": "error", "message": str(e)})
        await _release_run_slot()

@app.websocket("/ws/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    await websocket.accept()
    active_connections[thread_id] = websocket

    # The graph can start (and emit events) before the frontend finishes
    # opening this socket. Anything sent while nobody was connected gets
    # buffered in send_update(); flush it now so no early events are lost.
    pending = pending_messages.pop(thread_id, [])
    for message in pending:
        await websocket.send_text(json.dumps(message))

    # graph_states only lives in memory — a backend restart forgets every
    # in-progress run. Without this, a stale tab's socket just connects
    # successfully and then nothing ever happens, leaving the UI stuck on
    # "agents working..." forever with no indication why.
    if thread_id not in graph_states and not pending:
        await websocket.send_text(json.dumps({
            "event": "error",
            "message": "This run is no longer active (the server may have restarted). Please start a new one."
        }))

    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        if active_connections.get(thread_id) is websocket:
            active_connections.pop(thread_id, None)

async def send_update(thread_id: str, data: dict):
    ws = active_connections.get(thread_id)
    if ws:
        await ws.send_text(json.dumps(data))
    else:
        pending_messages.setdefault(thread_id, []).append(data)

# Serves the built frontend (frontend/dist, built via `npm run build`) so
# `uvicorn backend.main:app` alone is enough to run the whole app — no
# separate `npm run dev` needed. Falls back silently to API-only if the
# frontend hasn't been built (e.g. local dev with Vite's own dev server).
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    @app.get("/{full_path:path}")
    @app.head("/{full_path:path}")
    async def serve_spa(full_path: str):
        # A plain StaticFiles(html=True) mount only serves index.html for
        # the exact "/" path — directly loading or refreshing a client-side
        # route like /run/:id or /output/:id (not a real file on disk) 404s
        # instead of reaching React Router. Serve the matching built file if
        # one exists (JS/CSS/favicon), otherwise fall back to index.html so
        # the SPA loads and its own router takes over. Registered last, so
        # every real API route above still matches first.
        candidate = os.path.join(_frontend_dist, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_frontend_dist, "index.html"))
