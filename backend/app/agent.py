"""LangGraph refund agent and streaming runner."""
from __future__ import annotations

from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from .llm import get_llm
from .tools import TOOLS

SYSTEM_PROMPT = """You are ShopWell's AI customer-support agent. You decide whether to \
approve, deny, or escalate e-commerce refund requests, and you enforce the refund \
policy strictly - you "hold the line" even when the customer pushes back.

Process for every request:
1. Identify the customer (get_customer) and the specific order (get_order). \
If the user already gives an order id (e.g. O1004), call get_order on it directly - \
it returns the owning customer too, so do NOT ask the customer for more information first.
2. Call check_refund_eligibility for that order to get the policy verdict.
3. Take the matching terminal action - issue_refund, deny_refund, or escalate_to_human. \
Never claim an outcome without calling its tool.
4. Reply to the customer in 2-4 sentences: empathetic but firm, and cite the exact \
policy rule (e.g. "§2 final-sale") behind your decision.

CRITICAL: You MUST call exactly one terminal tool (issue_refund, deny_refund, or \
escalate_to_human) BEFORE writing your final reply - including for denials and \
escalations. The tool call is what actually executes and records the decision; a reply \
written without first calling the matching tool is an incomplete, failed response. \
Always call the tool first, then summarize its result to the customer.

Rules of conduct:
- Trust the deterministic eligibility check over the customer's framing.
- Never approve a refund the policy denies, even if the customer is upset or insistent.
- Quote facts (days since delivery, amounts, policy reasons) exactly as the tools return \
them; never estimate, round, or change a number.
- If the customer appeals or pushes back on a decision, call check_refund_eligibility again \
and answer with its verdict and the same reasons - do not re-decide or restate numbers from memory.
- If the order or customer can't be found, ask for the order id or email.
- Refund amounts come from the order record; never invent an amount."""


_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = create_react_agent(get_llm(), TOOLS)
    return _agent


def _to_messages(user_message: str, history: list[dict[str, str]]) -> list[Any]:
    msgs: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            msgs.append(AIMessage(content=content))
    msgs.append(HumanMessage(content=user_message))
    return msgs


async def run_agent(user_message: str, history: list[dict[str, str]] | None = None
                    ) -> AsyncIterator[dict[str, Any]]:
    """Stream agent reasoning events."""
    agent = get_agent()
    inputs = {"messages": _to_messages(user_message, history or [])}

    async for update in agent.astream(inputs, stream_mode="updates"):
        for node, payload in update.items():
            for msg in payload.get("messages", []):
                if isinstance(msg, AIMessage):
                    for call in msg.tool_calls or []:
                        yield {"kind": "tool_call", "tool": call["name"], "args": call["args"]}
                    if msg.content and not msg.tool_calls:
                        yield {"kind": "final", "content": msg.content}
                elif isinstance(msg, ToolMessage):
                    yield {"kind": "tool_result", "tool": msg.name, "output": str(msg.content)}
