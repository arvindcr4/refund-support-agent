"use client";

import { useEffect, useState } from "react";
import { getCustomers } from "@/lib/api";
import type { CustomerSummary } from "@/lib/types";
import { Pill } from "./ui";

// Expected outcomes per order ID.
const VERDICTS: Record<string, "APPROVE" | "DENY" | "ESCALATE"> = {
  O1001: "APPROVE",
  O1002: "APPROVE",
  O1003: "APPROVE",
  O1012: "APPROVE",
  O1015: "APPROVE",
  O1004: "DENY",
  O1005: "DENY",
  O1006: "DENY",
  O1007: "DENY",
  O1010: "DENY",
  O1011: "DENY",
  O1014: "DENY",
  O1016: "DENY",
  O1008: "ESCALATE",
  O1009: "ESCALATE",
  O1013: "ESCALATE",
};

const HEADLINE: {
  order: string;
  label: string;
  verdict: "APPROVE" | "DENY" | "ESCALATE";
  note: string;
}[] = [
  { order: "O1001", label: "Refund O1001", verdict: "APPROVE", note: "in window, clean" },
  { order: "O1004", label: "Refund O1004", verdict: "DENY", note: "outside 30-day window" },
  { order: "O1008", label: "Refund O1008", verdict: "ESCALATE", note: ">$500 cap" },
  { order: "O1009", label: "Refund O1009", verdict: "ESCALATE", note: "fraud flag" },
  { order: "O1013", label: "Refund O1013", verdict: "ESCALATE", note: ">3 lifetime refunds" },
  { order: "O1012", label: "Refund O1012", verdict: "APPROVE", note: "VIP 45-day grace" },
];

function verdictTone(v: "APPROVE" | "DENY" | "ESCALATE") {
  return v === "APPROVE" ? "green" : v === "DENY" ? "red" : "amber";
}

export default function ScenarioPicker({
  onPick,
  disabled,
}: {
  onPick: (message: string) => void;
  disabled?: boolean;
}) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomers()
      .then((cs) => alive && setCustomers(cs))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const send = (order: string) => {
    if (disabled) return;
    onPick(`I want a refund for order ${order}.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {HEADLINE.map((h) => (
          <button
            key={h.order}
            onClick={() => send(h.order)}
            disabled={disabled}
            title={`${h.note} -> ${h.verdict}`}
            className="group flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:opacity-50"
          >
            <span>{h.label}</span>
            <Pill tone={verdictTone(h.verdict)}>{h.verdict}</Pill>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-50"
        >
          <option value="">Pick any customer order...</option>
          {customers.map((c) =>
            c.orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} - {c.name} - {o.item} (${o.amount.toFixed(2)})
                {VERDICTS[o.id] ? ` - ${VERDICTS[o.id]}` : ""}
              </option>
            ))
          )}
        </select>
        <button
          onClick={() => selected && send(selected)}
          disabled={disabled || !selected}
          className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {selected && (
        <p className="text-[11px] text-slate-500">
          Sends: &ldquo;I want a refund for order {selected}.&rdquo;
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-400">
          Could not load customers ({error}). Is the backend running on{" "}
          {process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"}?
        </p>
      )}
    </div>
  );
}
