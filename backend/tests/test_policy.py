"""Unit tests for the refund policy engine and agent tools."""
from __future__ import annotations

import copy

import pytest

from app import data
from app import tools


# Expected action mapping for order IDs.
APPROVE = ["O1001", "O1002", "O1003", "O1012", "O1015"]
DENY = ["O1004", "O1005", "O1006", "O1007", "O1010", "O1011", "O1014", "O1016"]
ESCALATE = ["O1008", "O1009", "O1013"]

EXPECTED = (
    [(oid, "approve") for oid in APPROVE]
    + [(oid, "deny") for oid in DENY]
    + [(oid, "escalate") for oid in ESCALATE]
)


@pytest.fixture(autouse=True)
def _reset_state():
    """Reset state before and after each test."""
    data.reset()
    yield
    data.reset()


@pytest.mark.parametrize("order_id,expected", EXPECTED)
def test_evaluate_order_verdict(order_id, expected):
    order, customer = data.find_order(order_id)
    assert order is not None, f"order {order_id} not found in CRM"
    assert customer is not None, f"customer for {order_id} not found"
    verdict = data.evaluate_order(order, customer)
    assert verdict["action"] == expected, (
        f"{order_id}: expected {expected}, got {verdict['action']} "
        f"({verdict['reasons']})"
    )
    # Verify eligibility matches action
    assert verdict["eligible"] is (expected == "approve")


def _reasons_text(order_id: str) -> str:
    order, customer = data.find_order(order_id)
    verdict = data.evaluate_order(order, customer)
    return " ".join(verdict["reasons"]).lower()


def test_o1004_reason_mentions_window():
    assert "window" in _reasons_text("O1004")


def test_o1009_reason_mentions_fraud():
    assert "fraud" in _reasons_text("O1009")


def test_o1012_reason_mentions_vip():
    assert "vip" in _reasons_text("O1012")


def test_tools_module_has_seven_tools():
    assert len(tools.TOOLS) == 7
    names = {t.name for t in tools.TOOLS}
    assert names == {
        "get_customer", "get_order", "get_refund_policy",
        "check_refund_eligibility", "issue_refund", "deny_refund",
        "escalate_to_human",
    }


def test_evaluate_order_is_pure():
    """Verify evaluate_order is deterministic and side-effect free."""
    order, customer = data.find_order("O1001")
    order_before = copy.deepcopy(order)
    customer_before = copy.deepcopy(customer)

    first = data.evaluate_order(order, customer)
    second = data.evaluate_order(order, customer)

    assert first == second
    assert order == order_before, "evaluate_order mutated the order"
    assert customer == customer_before, "evaluate_order mutated the customer"
