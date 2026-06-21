"""Generate mock CRM data: 15 customers with orders spanning approve + edge-case scenarios.

Run:  python generate_data.py   ->  writes customers.json next to this file.
Dates are stored as ISO; days-since-delivery is computed at request time by the policy tool.
"""
import json
from datetime import date, timedelta
from pathlib import Path

TODAY = date(2026, 6, 21)


def d(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


# Each order: id, item, category, amount, status, delivery_date, condition,
# final_sale, already_refunded.  Scenarios are designed so the policy yields a
# clear, defensible verdict (good for the Loom "hold the line" demo).
CUSTOMERS = [
    # --- straightforward APPROVE cases ---
    {"id": "C001", "name": "Maya Chen", "email": "maya.chen@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1001", "item": "Wireless Headphones", "category": "electronics", "amount": 129.99,
          "status": "delivered", "delivery_date": d(8), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    {"id": "C002", "name": "James Okoro", "email": "james.okoro@example.com", "tier": "premium",
     "fraud_flag": False, "lifetime_refunds": 1,
     "orders": [
         {"id": "O1002", "item": "Running Shoes", "category": "apparel", "amount": 89.50,
          "status": "delivered", "delivery_date": d(3), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    {"id": "C003", "name": "Sofia Rossi", "email": "sofia.rossi@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1003", "item": "Coffee Maker", "category": "home", "amount": 64.00,
          "status": "delivered", "delivery_date": d(20), "condition": "used",
          "final_sale": False, "already_refunded": False,
          "customer_note": "Arrived defective, leaks water"},
     ]},
    # --- DENY: outside 30-day window ---
    {"id": "C004", "name": "Liam Walsh", "email": "liam.walsh@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1004", "item": "Desk Lamp", "category": "home", "amount": 45.00,
          "status": "delivered", "delivery_date": d(67), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- DENY: digital / non-refundable category ---
    {"id": "C005", "name": "Aisha Khan", "email": "aisha.khan@example.com", "tier": "premium",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1005", "item": "Photo Editing License", "category": "digital", "amount": 199.00,
          "status": "delivered", "delivery_date": d(5), "condition": "new",
          "final_sale": True, "already_refunded": False},
     ]},
    # --- DENY: gift card ---
    {"id": "C006", "name": "Noah Schmidt", "email": "noah.schmidt@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1006", "item": "$50 Gift Card", "category": "gift_card", "amount": 50.00,
          "status": "delivered", "delivery_date": d(2), "condition": "new",
          "final_sale": True, "already_refunded": False},
     ]},
    # --- DENY: damaged by customer ---
    {"id": "C007", "name": "Emma Dubois", "email": "emma.dubois@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1007", "item": "Ceramic Vase", "category": "home", "amount": 38.00,
          "status": "delivered", "delivery_date": d(6), "condition": "damaged_by_customer",
          "final_sale": False, "already_refunded": False,
          "customer_note": "I dropped it but want a refund"},
     ]},
    # --- ESCALATE: amount over $500 ---
    {"id": "C008", "name": "Daniel Park", "email": "daniel.park@example.com", "tier": "premium",
     "fraud_flag": False, "lifetime_refunds": 1,
     "orders": [
         {"id": "O1008", "item": "OLED Television", "category": "electronics", "amount": 1299.00,
          "status": "delivered", "delivery_date": d(10), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- DENY + ESCALATE: fraud flag ---
    {"id": "C009", "name": "Olivia Brown", "email": "olivia.brown@example.com", "tier": "standard",
     "fraud_flag": True, "lifetime_refunds": 4,
     "orders": [
         {"id": "O1009", "item": "Smartwatch", "category": "electronics", "amount": 220.00,
          "status": "delivered", "delivery_date": d(4), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- DENY: already refunded ---
    {"id": "C010", "name": "Lucas Meyer", "email": "lucas.meyer@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 1,
     "orders": [
         {"id": "O1010", "item": "Bluetooth Speaker", "category": "electronics", "amount": 75.00,
          "status": "delivered", "delivery_date": d(9), "condition": "new",
          "final_sale": False, "already_refunded": True},
     ]},
    # --- DENY: not yet delivered ---
    {"id": "C011", "name": "Grace Lee", "email": "grace.lee@example.com", "tier": "premium",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1011", "item": "Standing Desk", "category": "furniture", "amount": 310.00,
          "status": "in_transit", "delivery_date": None, "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- VIP courtesy: 38 days, within 45-day VIP grace ---
    {"id": "C012", "name": "Hiro Tanaka", "email": "hiro.tanaka@example.com", "tier": "vip",
     "fraud_flag": False, "lifetime_refunds": 1,
     "orders": [
         {"id": "O1012", "item": "Mechanical Keyboard", "category": "electronics", "amount": 142.00,
          "status": "delivered", "delivery_date": d(38), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- ESCALATE: >3 lifetime refunds ---
    {"id": "C013", "name": "Fatima Ali", "email": "fatima.ali@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 5,
     "orders": [
         {"id": "O1013", "item": "Yoga Mat", "category": "fitness", "amount": 29.99,
          "status": "delivered", "delivery_date": d(7), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- APPROVE: perishable is non-refundable though (DENY) ---
    {"id": "C014", "name": "Ben Carter", "email": "ben.carter@example.com", "tier": "standard",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1014", "item": "Gourmet Cheese Box", "category": "perishable", "amount": 54.00,
          "status": "delivered", "delivery_date": d(2), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
    # --- APPROVE: clean premium case, two orders ---
    {"id": "C015", "name": "Zara Ahmed", "email": "zara.ahmed@example.com", "tier": "premium",
     "fraud_flag": False, "lifetime_refunds": 0,
     "orders": [
         {"id": "O1015", "item": "Backpack", "category": "apparel", "amount": 79.00,
          "status": "delivered", "delivery_date": d(12), "condition": "new",
          "final_sale": False, "already_refunded": False},
         {"id": "O1016", "item": "Water Bottle", "category": "fitness", "amount": 24.00,
          "status": "delivered", "delivery_date": d(40), "condition": "new",
          "final_sale": False, "already_refunded": False},
     ]},
]


def main() -> None:
    out = Path(__file__).parent / "customers.json"
    out.write_text(json.dumps(CUSTOMERS, indent=2))
    n_orders = sum(len(c["orders"]) for c in CUSTOMERS)
    print(f"wrote {len(CUSTOMERS)} customers, {n_orders} orders -> {out}")


if __name__ == "__main__":
    main()
