# ShopWell Refund Policy (v2.4 - strict, agent-enforced)

The support agent MUST apply every rule below. Rules are hard gates unless marked *(judgment)*. When two rules conflict, **deny** and escalate.

## 1. Eligibility window
- Refunds are allowed only within **30 calendar days of the delivery date**.
- Day 31 onward: **not eligible**. No exceptions for standard tier.
- Orders not yet `delivered` (status `in_transit`, `processing`, `cancelled`) are **not eligible** - there is nothing to refund yet.

## 2. Non-refundable categories (hard deny)
The following categories are **final sale** and never refundable, regardless of window:
- `digital` (software, e-books, downloads)
- `gift_card`
- `perishable` (food, flowers)
- Any line item flagged `final_sale: true`.

## 3. Item condition
- `new` / unopened -> eligible (within window).
- `used` -> eligible **only** if the customer reports a defect or "not as described".
- `damaged_by_customer` -> **not eligible** (hard deny).

## 4. Amount authority
- The agent may auto-approve refunds up to **$500**.
- Refunds **above $500** require manager approval: the agent must **escalate to a human**, not approve.

## 5. Fraud & abuse
- Customers with `fraud_flag: true`: **deny and escalate**, no refund.
- An order that has `already_refunded: true`: **deny** (one refund per order).
- More than **3 lifetime refunds** on an account: escalate for review before any further refund.

## 6. Tier courtesy *(judgment)*
- `vip` customers may be granted a **one-time courtesy exception** to the 30-day window (up to 45 days), but never to categories in §2, fraud in §5, or the $500 cap in §4.
- Standard/premium tiers get **no** window exceptions.

## 7. Required behavior
- Always look up the customer and the specific order before deciding.
- State the **exact rule** that drives the decision.
- Approvals must call `issue_refund`. Denials must call `deny_refund`. Escalations must call `escalate_to_human`. Never claim an action without calling its tool.