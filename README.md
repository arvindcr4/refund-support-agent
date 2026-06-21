# ShopWell Refund Agent

**Demo video (10 min walkthrough):** https://drive.google.com/file/d/15oSbKMzwFBa8x6vM0MVSx_DNqtxBhbCc/view

An AI customer-support agent that approves, denies, or escalates e-commerce refund requests. A support manager opens a two-pane console, picks a customer/order, and chats with the agent as if they were the shopper. The agent looks up the customer and order in a mock CRM, runs a deterministic policy engine to get a verdict, executes the matching action (issue, deny, or escalate), and replies with the policy rule cited. Every reasoning step (each tool call, tool result, and final answer) streams live into an admin reasoning log for human auditing.

---

## Architecture

```
Next.js two-pane console (localhost:3000)
  LEFT  chat with the agent           RIGHT  admin dashboard
    - scenario / order picker           - live reasoning log (tool_call / tool_result)
    - shopper-style messages            - CRM state + action log
        |                                   |
        | POST /api/chat                    | GET /api/state, /api/customers
        | (fetch + ReadableStream,          | POST /api/reset
        |  SSE parsed manually)             |
        v                                   v
FastAPI server (uvicorn app.main:app, localhost:8000)
  streams Server-Sent Events via sse-starlette
        |
        v
LangGraph ReAct agent (create_react_agent; gpt-oss-120b via OpenRouter, temperature 0)
  reason -> call tool -> observe -> repeat
        |
        v
7 tools (app/tools.py)
  read:     get_customer, get_order, get_refund_policy, check_refund_eligibility
  terminal: issue_refund, deny_refund, escalate_to_human
        |
        v
Deterministic policy engine (app/data.py: evaluate_order)
  Pure Python rules mirroring refund_policy.md sections 1-7, over a mock CRM
  (data/customers.json: 15 customers / 16 orders)
```

### Why the policy is a deterministic engine the agent calls

The refund rules reside in `evaluate_order()` as Python logic with a fixed precedence (hard denies, escalations, then approval) rather than being determined by the LLM. The agent's `check_refund_eligibility` tool is a wrapper over that function. This structure provides:

- **Auditable & reproducible**: Given the same order, the engine returns the same verdict and reasons. `TODAY` is pinned to `2026-06-21` for consistency.
- **Enforced policy**: Shoppers cannot bypass refund rules. The agent is instructed to defer to the deterministic engine's verdict. The LLM manages the conversation, while the policy engine governs refund approval.
- **Safe terminal actions**: `issue_refund` independently refuses to double-refund an order, enforcing the policy at the tool layer.

---

## Refund policy (summary)

Full text: [`backend/data/refund_policy.md`](backend/data/refund_policy.md). Verdict
precedence in `evaluate_order`: **hard denies first, then escalations, then approve.**

| Rule | Condition | Verdict |
|------|-----------|---------|
| §1 Window | Within **30 days** of delivery (standard) | eligible |
| §6 VIP grace | `vip` tier, **31-45 days** | eligible (one-time courtesy) |
| §1 Window | Day 31+ (standard) / day 46+ (VIP) | **deny** |
| §1 Status | Not yet `delivered` (e.g. `in_transit`) - nothing to refund | **deny** |
| §2 Category | `digital`, `gift_card`, `perishable`, or `final_sale: true` | **deny** |
| §3 Condition | `damaged_by_customer` | **deny** |
| §4 Amount cap | Refund **> $500** exceeds auto-approve authority | **escalate** |
| §5 Fraud | `fraud_flag: true` | **escalate** (deny + human) |
| §5 Already refunded | `already_refunded: true` (one refund per order) | **deny** |
| §5 Repeat refunds | **> 3** lifetime refunds on the account | **escalate** |

VIP grace never overrides §2 (categories), §4 ($500 cap), or §5 (fraud).

---

## Quickstart

Prereqs: Python 3.11+ and Node 18+. An **OpenRouter** API key is required for the agent.

### 1. Backend (FastAPI + LangGraph)

```bash
cd backend

# config: copy the template and add your key
cp .env.example .env
#   OPENROUTER_API_KEY=sk-or-...
#   OPENROUTER_MODEL=openai/gpt-oss-120b   (optional; any tool-calling model)

# deps: create a virtualenv and install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# run the API on http://localhost:8000
uvicorn app.main:app --reload
```

Sanity check: `curl http://localhost:8000/api/health` returns `{"status":"ok"}`.

### 2. Frontend (Next.js console)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Open **http://localhost:3000**, pick an order in the left pane, and chat. The right pane streams the agent's reasoning and the resulting CRM action log. Hit **Reset** (`POST /api/reset`) to restore the seed data and re-run the demo.

### API contract (backend)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | `{status:"ok"}` |
| GET  | `/api/customers` | Lightweight list for the scenario picker |
| GET  | `/api/state` | Full CRM + `action_log` for the admin dashboard |
| POST | `/api/reset` | Reload seed data, clear the action log |
| POST | `/api/chat` | `{message, history}` - **SSE** stream (see below) |

`/api/chat` is a **POST** that returns `text/event-stream`, so the browser cannot use the native `EventSource` (which is GET-only). The client uses `fetch()` and `response.body.getReader()` to parse the stream manually by splitting on double newlines and reading `event:` and `data:`. Event kinds: `tool_call`, `tool_result`, `final`, `error`, `done`.

### Tests & evaluation

```bash
cd backend && source .venv/bin/activate
pip install -r requirements-dev.txt          # pytest (dev only)

python -m pytest tests/ -q                    # 21 unit tests on the policy engine
python -m eval.run_eval                       # live agent eval over all 16 orders
```

`eval/run_eval.py` runs every order through the real LLM agent and asserts the agent's
terminal action (`issue_refund` / `deny_refund` / `escalate_to_human`) matches the
deterministic policy verdict. It needs `OPENROUTER_API_KEY` set; latest run: **16/16**.

---

## Tech choices & tradeoffs

- **LangGraph `create_react_agent`**: A standard ReAct loop. The backend streams graph updates via SSE to the admin reasoning log. *Tradeoff*: Less control than a custom loop, but reduces boilerplate code.
- **Deterministic engine over LLM judgment**: The policy engine governs the refund decision, while the LLM acts as the conversational layer. *Tradeoff*: Policy changes require updating Python code, keeping changes reviewable via PRs.
- **OpenRouter and `langchain-openai`**: Configures one OpenAI-compatible endpoint. Swap models via `OPENROUTER_MODEL`. Defaults to `openai/gpt-oss-120b` with `temperature=0` for reproducibility.
- **SSE via `sse-starlette`**: Streams data with no WebSocket overhead. *Tradeoff*: POST requests with SSE require manual client parsing.
- **In-memory CRM**: `customers.json` is loaded into memory and mutated. The reset endpoint reloads the state from disk. *Tradeoff*: Not persistent, but simplifies running reproducible scenarios.
- **Next.js two-pane console**: Displays customer chat and live audit log side-by-side to show the reasoning stream.

---

## Project structure

```
workpodd-refund-agent/
├── README.md                      - This file
├── LOOM_SCRIPT.md                 - Video walkthrough script
├── backend/
│   ├── .env.example               - Configuration template
│   ├── requirements.txt
│   └── app/
│       ├── main.py                - FastAPI server
│       ├── agent.py               - LangGraph ReAct agent
│       ├── tools.py               - Agent tools
│       ├── data.py                - Deterministic policy engine
│       └── llm.py                 - OpenRouter LLM factory
│   └── data/
│       ├── customers.json         - Mock CRM database
│       └── refund_policy.md       - Strict policy, §1-§7
└── frontend/                      - Next.js 15 two-pane console
    ├── package.json
    ├── next.config.mjs
    ├── postcss.config.mjs
    └── tsconfig.json
```

---

## Demo scenarios

All verdicts are produced by `evaluate_order` and are reproducible (`TODAY = 2026-06-21`).

| Order | Customer | Item | Expected | Driving rule |
|-------|----------|------|----------|--------------|
| O1001 | Maya Chen (standard) | Wireless Headphones $129.99 | **APPROVE** | Within window, refundable, <= cap |
| O1002 | James Okoro (premium) | Running Shoes $89.50 | **APPROVE** | Within window |
| O1003 | Sofia Rossi (standard) | Coffee Maker $64 (used, defective) | **APPROVE** | §3 used and defect - eligible |
| O1012 | Hiro Tanaka (**vip**) | Mechanical Keyboard $142 | **APPROVE** | §6 VIP 45-day grace (38 days) |
| O1015 | Zara Ahmed (premium) | Backpack $79 | **APPROVE** | Within window |
| O1004 | Liam Walsh (standard) | Desk Lamp $45 | **DENY** | §1 outside 30-day window (~67 days) |
| O1005 | Aisha Khan (premium) | Photo Editing License $199 | **DENY** | §2 digital / final sale |
| O1006 | Noah Schmidt (standard) | $50 Gift Card | **DENY** | §2 gift_card final sale |
| O1007 | Emma Dubois (standard) | Ceramic Vase $38 | **DENY** | §3 damaged_by_customer |
| O1010 | Lucas Meyer (standard) | Bluetooth Speaker $75 | **DENY** | §5 already refunded |
| O1011 | Grace Lee (premium) | Standing Desk $310 | **DENY** | §1 in_transit (not delivered) |
| O1014 | Ben Carter (standard) | Gourmet Cheese Box $54 | **DENY** | §2 perishable |
| O1016 | Zara Ahmed (premium) | Water Bottle $24 | **DENY** | §1 outside window (~40 days) |
| O1008 | Daniel Park (premium) | OLED Television $1299 | **ESCALATE** | §4 > $500 cap |
| O1009 | Olivia Brown (standard) | Smartwatch $220 | **ESCALATE** | §5 fraud_flag |
| O1013 | Fatima Ali (standard) | Yoga Mat $29.99 | **ESCALATE** | §5 > 3 lifetime refunds (5) |

---

## Bonus: voice

The customer chat has an optional voice mode built on the browser's Web Speech API,
so the agent supports a fully spoken interaction with no extra services or keys:

- **Speech to text**: the mic button captures a spoken request (`SpeechRecognition`),
  transcribes it, and sends it through the same `/api/chat` stream as typed input.
- **Text to speech**: when "Voice on" is enabled, the agent's final reply is read aloud
  (`SpeechSynthesis`). The toggle and mic feature-detect and hide where unsupported
  (works in Chrome and Safari).

Because input and output both flow through the existing streaming endpoint, swapping in a
hosted pipeline (OpenAI Realtime, ElevenLabs, or LiveKit) is a client-side change to
`frontend/lib/useVoice.ts` only - the backend agent is unchanged.

---

## Next steps

- **Persistence** for the CRM/action log (SQLite/Postgres) so decisions survive restarts.
- **Per-decision audit export** (JSON of every tool_call/result) for compliance review.
- **Policy-as-data**: lift §1-§7 thresholds into a config so non-engineers can tune the
  window, cap, and review thresholds without touching the engine logic.
