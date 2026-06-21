"""Agent evaluation: runs orders through the agent and matches decisions against policy."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))
load_dotenv(_BACKEND / ".env")

from app import data  # noqa: E402
from app.agent import run_agent  # noqa: E402

TERMINAL = {"issue_refund": "approve", "deny_refund": "deny", "escalate_to_human": "escalate"}


def all_order_ids() -> list[str]:
    return [o["id"] for c in data.all_customers() for o in c["orders"]]


def expected_verdict(order_id: str) -> str:
    o, c = data.find_order(order_id)
    return data.evaluate_order(o, c)["action"]


async def eval_order(order_id: str) -> dict:
    data.reset()
    expected = expected_verdict(order_id)
    actions: list[str] = []
    final = ""
    msg = f"Hi, I'd like a refund for order {order_id}."
    async for ev in run_agent(msg):
        if ev["kind"] == "tool_call" and ev["tool"] in TERMINAL:
            actions.append(TERMINAL[ev["tool"]])
        elif ev["kind"] == "final":
            final = ev["content"]
        elif ev["kind"] == "error":
            return {"order": order_id, "expected": expected, "got": "ERROR",
                    "ok": False, "final": ev["message"][:120]}
    got = actions[-1] if actions else "no_action"
    return {"order": order_id, "expected": expected, "got": got,
            "ok": got == expected, "final": final[:90].replace("\n", " ")}


async def main() -> None:
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise SystemExit("OPENROUTER_API_KEY not set.")
    ids = all_order_ids()
    # Limit concurrency
    sem = asyncio.Semaphore(4)

    async def guarded(oid: str) -> dict:
        async with sem:
            return await eval_order(oid)

    results = await asyncio.gather(*(guarded(o) for o in ids))
    results.sort(key=lambda r: r["order"])

    passed = sum(r["ok"] for r in results)
    print(f"\n{'order':6} {'expected':9} {'got':9} {'ok':3}  final")
    print("-" * 90)
    for r in results:
        mark = "OK " if r["ok"] else "XX "
        print(f"{r['order']:6} {r['expected']:9} {r['got']:9} {mark:3}  {r['final']}")
    print("-" * 90)
    print(f"PASS {passed}/{len(results)}  (model={os.environ.get('OPENROUTER_MODEL','default')})")
    if passed != len(results):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
