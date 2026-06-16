from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.graph import agent_graph
import asyncio
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = {}
graph_states = {}

class TopicRequest(BaseModel):
    topic: str
    language: str = "English"

class RejectRequest(BaseModel):
    thread_id: str
    feedback: str

@app.post("/start")
async def start_run(request: TopicRequest):
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
        "human_approved": False
    }
    
    config = {"configurable": {"thread_id": thread_id}}
    graph_states[thread_id] = config
    
    asyncio.create_task(run_graph(thread_id, initial_state, config))
    
    return {"thread_id": thread_id}

async def run_graph(thread_id: str, initial_state: dict, config: dict):
    await send_update(thread_id, {"event": "started", "agent": "researcher"})
    
    for event in agent_graph.stream(initial_state, config):
        for node_name, node_output in event.items():
            await send_update(thread_id, {
                "event": "agent_done",
                "agent": node_name,
                "data": node_output
            })
            await asyncio.sleep(0.1)
    
    state = agent_graph.get_state(config)
    if state.next and "critic" in state.next:
        await send_update(thread_id, {
            "event": "human_review",
            "draft": state.values.get("draft", "")
        })

@app.post("/approve")
async def approve(thread_id: str):
    config = graph_states.get(thread_id)
    if not config:
        return {"error": "Thread not found"}
    
    asyncio.create_task(resume_graph(thread_id, config))
    return {"status": "approved"}

@app.post("/reject")
async def reject(request: RejectRequest):
    config = graph_states.get(request.thread_id)
    if not config:
        return {"error": "Thread not found"}
    
    agent_graph.update_state(
        config,
        {"critique": request.feedback, "score": 0}
    )
    
    asyncio.create_task(resume_graph(request.thread_id, config))
    return {"status": "rejected"}

async def resume_graph(thread_id: str, config: dict):
    for event in agent_graph.stream(None, config):
        for node_name, node_output in event.items():
            await send_update(thread_id, {
                "event": "agent_done",
                "agent": node_name,
                "data": node_output
            })
            await asyncio.sleep(0.1)
    
    state = agent_graph.get_state(config)
    if state.next and "critic" in state.next:
        await send_update(thread_id, {
            "event": "human_review",
            "draft": state.values.get("draft", "")
        })
    else:
        final = agent_graph.get_state(config).values
        await send_update(thread_id, {
            "event": "completed",
            "final_output": final.get("final_output", ""),
            "citations": final.get("citations", ""),
            "bias_report": final.get("bias_report", ""),
            "fact_check": final.get("fact_check", ""),
            "score": final.get("score", 0)
        })

@app.websocket("/ws/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    await websocket.accept()
    active_connections[thread_id] = websocket
    try:
        while True:
            await asyncio.sleep(1)
    except:
        del active_connections[thread_id]

async def send_update(thread_id: str, data: dict):
    ws = active_connections.get(thread_id)
    if ws:
        await ws.send_text(json.dumps(data))