"""Data layer and deterministic refund-policy engine."""
from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any, Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TODAY = date(2026, 6, 21)  # Fixed date for reproducibility

NON_REFUNDABLE_CATEGORIES = {"digital", "gift_card", "perishable"}
STANDARD_WINDOW_DAYS = 30
VIP_GRACE_DAYS = 45
AUTO_APPROVE_CAP = 500.0
LIFETIME_REFUND_REVIEW = 3

# In-memory state.
_CUSTOMERS: list[dict[str, Any]] = []
_ACTION_LOG: list[dict[str, Any]] = []


def _load() -> None:
    global _CUSTOMERS
    raw = json.loads((DATA_DIR / "customers.json").read_text())
    _CUSTOMERS = copy.deepcopy(raw)


def reset() -> None:
    """Reset CRM + action log to the on-disk seed (used by /api/reset)."""
    _ACTION_LOG.clear()
    _load()


_load()


def policy_text() -> str:
    return (DATA_DIR / "refund_policy.md").read_text()


def all_customers() -> list[dict[str, Any]]:
    return _CUSTOMERS


def action_log() -> list[dict[str, Any]]:
    return _ACTION_LOG


def find_customer(query: str) -> Optional[dict[str, Any]]:
    """Resolve a customer by id, email, or (case-insensitive) name substring."""
    q = (query or "").strip().lower()
    if not q:
        return None
    for c in _CUSTOMERS:
        if c["id"].lower() == q or c["email"].lower() == q:
            return c
    for c in _CUSTOMERS:
        if q in c["name"].lower():
            return c
    return None


def find_order(order_id: str) -> tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
    """Return (order, owning_customer) for an order id, or (None, None)."""
    oid = (order_id or "").strip().lower()
    for c in _CUSTOMERS:
        for o in c["orders"]:
            if o["id"].lower() == oid:
                return o, c
    return None, None


def days_since_delivery(order: dict[str, Any]) -> Optional[int]:
    dd = order.get("delivery_date")
    if not dd:
        return None
    return (TODAY - date.fromisoformat(dd)).days


def evaluate_order(order: dict[str, Any], customer: dict[str, Any]) -> dict[str, Any]:
    """Evaluate order refund eligibility."""
    reasons: list[str] = []

    # §1 must be delivered to refund
    if order["status"] != "delivered":
        return _verdict("deny", [f"Order status is '{order['status']}', not delivered - nothing to refund (§1)."])

    # §5 one refund per order
    if order.get("already_refunded"):
        return _verdict("deny", ["Order was already refunded; one refund per order (§5)."])

    # §5 fraud
    if customer.get("fraud_flag"):
        return _verdict("escalate", ["Customer is flagged for fraud - deny and escalate to human (§5)."])

    # §2 non-refundable category / final sale
    if order["category"] in NON_REFUNDABLE_CATEGORIES:
        return _verdict("deny", [f"Category '{order['category']}' is final sale and never refundable (§2)."])
    if order.get("final_sale"):
        return _verdict("deny", ["Item is flagged final_sale - non-refundable (§2)."])

    # §3 condition
    if order["condition"] == "damaged_by_customer":
        return _verdict("deny", ["Item was damaged by the customer - not eligible (§3)."])
    if order["condition"] == "used" and not _defect_reported(order):
        return _verdict("deny", ["Used item with no reported defect or 'not as described' - not eligible (§3)."])

    # §1 window (with §6 VIP grace)
    days = days_since_delivery(order)
    if days is None:
        return _verdict("escalate",
                        ["Delivered order is missing its delivery date - cannot verify the window; escalate (§1)."])
    is_vip = customer.get("tier") == "vip"
    limit = VIP_GRACE_DAYS if is_vip else STANDARD_WINDOW_DAYS
    if days > limit:
        note = " VIP 45-day grace already exceeded (§6)." if is_vip else ""
        return _verdict("deny", [f"Delivered {days} days ago; outside the {limit}-day window (§1).{note}"])
    if is_vip and days > STANDARD_WINDOW_DAYS:
        reasons.append(f"VIP one-time courtesy: {days} days is within the 45-day grace (§6).")

    # §4 amount authority
    if order["amount"] > AUTO_APPROVE_CAP:
        return _verdict("escalate",
                        [f"Amount ${order['amount']:.2f} exceeds the ${AUTO_APPROVE_CAP:.0f} auto-approve cap - escalate (§4)."])

    # §5 lifetime refund review
    if customer.get("lifetime_refunds", 0) > LIFETIME_REFUND_REVIEW:
        return _verdict("escalate",
                        [f"{customer['lifetime_refunds']} lifetime refunds (> {LIFETIME_REFUND_REVIEW}) - escalate for review (§5)."])

    reasons.append(f"Within window ({days} days), refundable category, ${order['amount']:.2f} <= cap - eligible (§1, §4).")
    return _verdict("approve", reasons)


def _verdict(action: str, reasons: list[str]) -> dict[str, Any]:
    return {"action": action, "eligible": action == "approve", "reasons": reasons}


_DEFECT_KEYWORDS = ("defect", "not as described", "broken", "faulty", "leak",
                    "damaged on arrival", "doesn't work", "stopped working", "missing part")


def _defect_reported(order: dict[str, Any]) -> bool:
    note = (order.get("customer_note") or "").lower()
    return any(k in note for k in _DEFECT_KEYWORDS)


# Mutating actions recorded for the admin dashboard

def record_refund(order: dict[str, Any], customer: dict[str, Any], amount: float) -> dict[str, Any]:
    order["already_refunded"] = True
    customer["lifetime_refunds"] = customer.get("lifetime_refunds", 0) + 1
    entry = {"action": "refund_issued", "order_id": order["id"], "customer_id": customer["id"],
             "amount": amount}
    _ACTION_LOG.append(entry)
    return entry


def record_denial(order: dict[str, Any], customer: dict[str, Any], reason: str) -> dict[str, Any]:
    entry = {"action": "refund_denied", "order_id": order["id"], "customer_id": customer["id"],
             "reason": reason}
    _ACTION_LOG.append(entry)
    return entry


def record_escalation(order: dict[str, Any], customer: dict[str, Any], reason: str) -> dict[str, Any]:
    entry = {"action": "escalated", "order_id": order["id"], "customer_id": customer["id"],
             "reason": reason}
    _ACTION_LOG.append(entry)
    return entry
