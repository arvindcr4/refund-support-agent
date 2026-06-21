"""FastAPI server for refund agent endpoints."""
from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from sse_starlette.sse import EventSourceResponse  # noqa: E402

from . import data  # noqa: E402
from .agent import run_agent  # noqa: E402

app = FastAPI(title="Workpodd Refund Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Turn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[Turn] = []


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/customers")
def customers() -> list[dict]:
    """Lightweight customer list for the admin scenario picker."""
    return [
        {"id": c["id"], "name": c["name"], "email": c["email"], "tier": c["tier"],
         "fraud_flag": c["fraud_flag"], "lifetime_refunds": c["lifetime_refunds"],
         "orders": [{"id": o["id"], "item": o["item"], "amount": o["amount"],
                     "status": o["status"]} for o in c["orders"]]}
        for c in data.all_customers()
    ]


@app.get("/api/state")
def state() -> dict:
    """Full CRM + action log for the admin dashboard."""
    return {"customers": data.all_customers(), "action_log": data.action_log()}


@app.post("/api/reset")
def reset() -> dict[str, str]:
    data.reset()
    return {"status": "reset"}


@app.post("/api/chat")
async def chat(req: ChatRequest) -> EventSourceResponse:
    history = [t.model_dump() for t in req.history]

    async def event_stream():
        try:
            async for event in run_agent(req.message, history):
                yield {"event": event["kind"], "data": json.dumps(event)}
        except Exception as exc:  # surface config/LLM errors to the UI
            yield {"event": "error", "data": json.dumps({"kind": "error", "message": str(exc)})}
        finally:
            yield {"event": "done", "data": json.dumps({"kind": "done"})}

    return EventSourceResponse(event_stream())
