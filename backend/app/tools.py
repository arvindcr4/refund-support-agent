"""Agent tools wrapping the data layer."""
from __future__ import annotations

import json

from langchain_core.tools import tool

from . import data


@tool
def get_customer(query: str) -> str:
    """Look up a customer by id (e.g. C001), email, or name. Returns the profile
    and a summary of their orders. Always call this first."""
    c = data.find_customer(query)
    if not c:
        return f"No customer found for '{query}'."
    orders = [
        {"order_id": o["id"], "item": o["item"], "category": o["category"],
         "amount": o["amount"], "status": o["status"]}
        for o in c["orders"]
    ]
    return json.dumps({
        "id": c["id"], "name": c["name"], "email": c["email"], "tier": c["tier"],
        "fraud_flag": c["fraud_flag"], "lifetime_refunds": c["lifetime_refunds"],
        "orders": orders,
    }, indent=2)


@tool
def get_order(order_id: str) -> str:
    """Get full details for a specific order id, including days since delivery."""
    o, c = data.find_order(order_id)
    if not o:
        return f"No order found with id '{order_id}'."
    return json.dumps({
        "order_id": o["id"], "customer_id": c["id"], "item": o["item"],
        "category": o["category"], "amount": o["amount"], "status": o["status"],
        "delivery_date": o["delivery_date"],
        "days_since_delivery": data.days_since_delivery(o),
        "condition": o["condition"], "final_sale": o["final_sale"],
        "already_refunded": o["already_refunded"],
        "customer_note": o.get("customer_note"),
    }, indent=2)


@tool
def get_refund_policy() -> str:
    """Return the full ShopWell refund policy document."""
    return data.policy_text()


@tool
def check_refund_eligibility(order_id: str) -> str:
    """Run the deterministic policy engine on an order. Returns the recommended
    action (approve | deny | escalate) and the exact policy reasons. Use this
    before issuing, denying, or escalating."""
    o, c = data.find_order(order_id)
    if not o:
        return f"No order found with id '{order_id}'."
    verdict = data.evaluate_order(o, c)
    return json.dumps(verdict, indent=2)


@tool
def issue_refund(order_id: str) -> str:
    """Approve and issue a refund for the order (uses the order's amount). Only
    call when policy permits an auto-approval."""
    o, c = data.find_order(order_id)
    if not o:
        return f"No order found with id '{order_id}'."
    if o.get("already_refunded"):
        return f"Order {o['id']} was already refunded; refusing to double-refund."
    # Enforce policy engine approval.
    verdict = data.evaluate_order(o, c)
    if verdict["action"] != "approve":
        return (f"BLOCKED: policy does not approve a refund for {o['id']} "
                f"(verdict: {verdict['action']} - {verdict['reasons'][0]}). No refund issued.")
    entry = data.record_refund(o, c, o["amount"])
    return f"REFUND ISSUED: ${entry['amount']:.2f} to {c['name']} for order {o['id']}."


@tool
def deny_refund(order_id: str, reason: str) -> str:
    """Deny a refund for the order with a customer-facing reason."""
    o, c = data.find_order(order_id)
    if not o:
        return f"No order found with id '{order_id}'."
    data.record_denial(o, c, reason)
    return f"REFUND DENIED for order {o['id']}: {reason}"


@tool
def escalate_to_human(order_id: str, reason: str) -> str:
    """Escalate the case to a human manager (over-cap amounts, fraud, review)."""
    o, c = data.find_order(order_id)
    if not o:
        return f"No order found with id '{order_id}'."
    data.record_escalation(o, c, reason)
    return f"ESCALATED order {o['id']} to a human manager: {reason}"


TOOLS = [
    get_customer, get_order, get_refund_policy,
    check_refund_eligibility, issue_refund, deny_refund, escalate_to_human,
]
