# ShopWell Refund Agent - Frontend

Next.js 15 (App Router, TypeScript, Tailwind) two-pane "agent console".

## Run

```bash
# 1. Start the backend (separate terminal, from ../backend)
#    uvicorn app.main:app --reload  (serves http://localhost:8000)

# 2. Frontend
npm install
npm run dev        # http://localhost:3000
```

Set `NEXT_PUBLIC_API_BASE` if the backend is not on `http://localhost:8000`
(see `.env.local.example`).

## Pages

- `/` - two-pane console. **Left:** customer chat (streams `POST /api/chat` via
  `fetch` + `getReader()`, manual SSE parse). **Right:** live admin dashboard -
  agent reasoning timeline (tool calls + results as they stream), action log,
  and CRM table polled every 2s. Includes a scenario picker with one-click
  APPROVE / DENY / ESCALATE quick-actions.
- `/admin` - the same `AdminPane` component, full-screen.

## Key files

- `lib/api.ts` - API client + manual SSE stream parser (`streamChat`).
- `lib/types.ts` - shared types for API + SSE events.
- `components/Console.tsx` - owns the shared live reasoning-timeline state.
- `components/ChatPane.tsx`, `components/AdminPane.tsx`, `components/ScenarioPicker.tsx`.
