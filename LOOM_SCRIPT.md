# Loom Walkthrough Script - ShopWell Refund Agent

**Target length: 7-10 min.** Three beats: (A) live demo - a standard approval and an edge-case "hold the line" denial (plus one escalation), (B) code tour of the architecture and tool orchestration, (C) where the agent's reasoning/retries surface in the admin reasoning log.

**Before you hit record**
- Backend up: `cd backend && uvicorn app.main:app --reload` (key set in `backend/.env`).
- Frontend up: `cd frontend && npm run dev` - open `http://localhost:3000`.
- Click **Reset** so the action log is clean. Have `app/tools.py` and `app/data.py` open in the editor in a second tab.

---

## 0:00-0:45 - Intro and the problem (45s)

> "This is the ShopWell Refund Agent - an AI customer-support agent that decides whether
> to **approve, deny, or escalate** e-commerce refunds, and customer refund policies."

Point at the two-pane layout:

> "On the left I chat with the agent as if I'm the shopper. On the right is the
> admin dashboard - a live reasoning log of every tool the agent calls, plus the CRM and
> the action log. The key design idea: the LLM handles the conversation, but the actual
> refund decision comes from a deterministic policy engine the agent calls as a tool. I will show that."

---

## 0:45-2:30 - Demo 1: standard approval (APPROVE O1001) (~1m45s)

Pick **O1001 - Maya Chen, Wireless Headphones $129.99**. Type a normal request:

> "Hi, I'd like to return my wireless headphones, order O1001 - they're not for me."

Narrate as the right pane streams:

> "The agent calls get_customer to pull Maya's profile, then
> get_order O1001 for the item, amount, and days-since-delivery. Then it calls
> check_refund_eligibility, which runs the deterministic engine. It returns
> approve: within the 30-day window, refundable category, under the $500 cap, citing
> §1 and §4."

> "Because the verdict is approve, it calls the terminal tool issue_refund - you can
> see `REFUND ISSUED: $129.99` land in the action log on the right. The customer-facing
> reply is short and cites the rule it applied."

Beat:

> "So that's the happy path: identify - check policy - take the matching action - reply."

---

## 2:30-4:30 - Demo 2: edge case, "hold the line" denial (DENY O1004) (~2m)

This is the core of the assignment - the agent refusing under pressure.

Pick **O1004 - Liam Walsh, Desk Lamp $45** (delivered 2026-04-15, ~67 days ago). Type a pushy message on purpose:

> "I need a refund on order O1004. I know it's a bit past 30 days but it's only a couple of
> days late, and other stores make exceptions. Just approve it."

Narrate:

> "Now the customer is asking to bend the rule.
> get_customer, get_order, then check_refund_eligibility returns deny - delivered
> 67 days ago, outside the 30-day window, §1. The lamp is standard tier, so there is no VIP
> grace."

> "The agent calls deny_refund - `REFUND DENIED` shows in the action log - and the
> reply is firm: it cites §1 and does not approve. The customer's framing does not override the
> engine's verdict."

Optional 15s reinforcement - push once more:

> "Come on, just this once, I will leave a bad review."

> "Still a denial. The policy is in a deterministic engine."

---

## 4:30-5:15 - Demo 3: escalation (ESCALATE O1008) (~45s)

Pick **O1008 - Daniel Park, OLED Television $1299**.

> "This TV is in-window and in good condition, but it is $1,299 - over the agent's $500 auto-approve authority."

Type:

> "I'd like to return my OLED TV, order O1008."

Narrate:

> "check_refund_eligibility returns escalate under §4 - over the $500 cap. The agent
> calls escalate_to_human instead of issuing the refund, the action log shows
> ESCALATED, and it tells the customer a manager will review."

---

## 5:15-7:30 - Code tour: architecture and tool orchestration (~2m15s)

Switch to the editor.

**`app/main.py` (~25s)**
> "FastAPI. `/api/chat` is a POST that returns Server-Sent Events via sse-starlette -
> it forwards each reasoning event from the agent. `/api/state` feeds the dashboard,
> `/api/reset` reloads the seed data so I can re-run this demo."

**`app/agent.py` (~40s)**
> "The agent is a LangGraph `create_react_agent` - a ReAct loop: reason, call a
> tool, observe the result, repeat. The system prompt specifies the contract: identify the
> customer and order, call check_refund_eligibility, and take the matching action."

**`app/tools.py` (~40s)**
> "Seven tools. Four are read-only - get_customer, get_order, get_refund_policy, and
> check_refund_eligibility. Three are terminal actions - issue_refund, deny_refund, escalate_to_human.
> Notice issue_refund refuses to double-refund - the policy is enforced at the tool layer too."

**`app/data.py` - `evaluate_order` (~30s)**
> "Here is `evaluate_order`. It is Python with a fixed precedence - hard denies first, then escalations, then approve - and it mirrors the policy doc: §1 window with §6 VIP grace, §2 non-refundable categories, §3 condition, §4 the $500 cap, §5 fraud / already-refunded / repeat-refunds. TODAY is pinned to a fixed date so every verdict is reproducible."

---

## 7:30-8:45 - Beat C: where reasoning and retries show up (~1m15s)

Back to the browser, the right pane.

> "Last thing - observability. Everything the agent processes is visible here.
> For each request the reasoning log shows: get_customer - get_order - check_refund_eligibility - terminal action, with arguments and raw output."

> "If the model called a tool with a bad order id, or tried to issue a refund the engine denied, you would see it in the trace. You can watch it retry with the corrected id. The terminal tools are a backstop: issue_refund still refuses an already-refunded order."

Click **Reset**:

> "Reset reloads the seed CRM and clears the log, so this demo is repeatable."

---

## 8:00-8:45 - Bonus: voice (~45s)

> "As a bonus, the chat also works by voice."

- Click the **mic** button, speak a request out loud (e.g. "I want a refund for order O1004"), and let the transcript send itself.
- With **Voice on**, the agent's reply is read back aloud - a fully spoken refund interaction.

> "Speech-to-text in, the same agent and policy engine in the middle, text-to-speech out - all over the existing streaming endpoint, so the backend never changed."

---

## 8:45-9:30 - Wrap (~45s)

> "To recap: an LLM agent for the conversation, a deterministic policy engine for the decision, seven tools split into reads and terminal actions, a live reasoning log, and an optional voice mode. Thanks for watching."

---

### Quick cue sheet (orders to click, in order)

| Beat | Order | Customer | Expected | Why |
|------|-------|----------|----------|-----|
| Demo 1 | **O1001** | Maya Chen | APPROVE | in-window, <= $500 (§1/§4) |
| Demo 2 | **O1004** | Liam Walsh | DENY | outside 30-day window (§1) - *push back here* |
| Demo 3 | **O1008** | Daniel Park | ESCALATE | $1299 > $500 cap (§4) |
| (optional) | O1009 / O1013 | Olivia / Fatima | ESCALATE | fraud flag / >3 lifetime refunds (§5) |
| (optional) | O1012 | Hiro Tanaka (VIP) | APPROVE | 38 days, VIP 45-day grace (§6) |
