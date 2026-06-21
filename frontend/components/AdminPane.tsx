"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getState, resetDemo } from "@/lib/api";
import type { StateResponse, TimelineItem } from "@/lib/types";
import { ActionBadge, Pill, SectionTitle, TierBadge } from "./ui";

function prettyArgs(args?: Record<string, unknown>) {
  if (!args || Object.keys(args).length === 0) return "";
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
}

function truncate(s: string, n = 320) {
  return s.length > n ? s.slice(0, n) + " ..." : s;
}

export default function AdminPane({
  timeline = [],
  onClearTimeline,
}: {
  timeline?: TimelineItem[];
  onClearTimeline?: () => void;
}) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const s = await getState(signal);
      setState(s);
      setPollError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setPollError(String(e));
    }
  }, []);


  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    const id = setInterval(() => refresh(), 2000);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [refresh]);


  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [timeline]);

  async function handleReset() {
    setResetting(true);
    try {
      await resetDemo();
      onClearTimeline?.();
      await refresh();
    } catch (e) {
      setPollError(String(e));
    } finally {
      setResetting(false);
    }
  }

  const log = state?.action_log ?? [];
  const customers = state?.customers ?? [];
  const custName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="flex h-full flex-col">
      <SectionTitle
        right={
          <button
            onClick={handleReset}
            disabled={resetting}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset demo"}
          </button>
        }
      >
        Admin Dashboard
      </SectionTitle>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {/* Agent reasoning log */}
        <div className="border-b border-slate-800">
          <div className="flex items-center justify-between px-4 pt-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Agent Reasoning Log
            </h3>
            <span className="text-[10px] text-slate-600">
              {timeline.length} step{timeline.length === 1 ? "" : "s"}
            </span>
          </div>
          <div
            ref={timelineRef}
            className="scroll-thin max-h-72 overflow-y-auto px-4 py-3"
          >
            {timeline.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">
                Send a message in the chat to watch the agent reason step by
                step.
              </p>
            ) : (
              <ol className="space-y-2">
                {timeline.map((t) => (
                  <TimelineRow key={t.id} item={t} />
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Action log */}
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Action Log
          </h3>
          {log.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-600">
              No terminal actions yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...log].reverse().map((e, i) => (
                <li
                  key={`${e.order_id}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ActionBadge action={e.action} />
                    <span className="font-mono text-xs text-slate-300">
                      {e.order_id}
                    </span>
                    <span className="truncate text-xs text-slate-500">
                      {custName(e.customer_id)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {typeof e.amount === "number" ? (
                      <span className="font-mono text-xs text-green-300">
                        ${e.amount.toFixed(2)}
                      </span>
                    ) : (
                      <span
                        className="max-w-[14rem] truncate text-[11px] text-slate-500"
                        title={e.reason}
                      >
                        {e.reason}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CRM table */}
        <div className="px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            CRM - Customers &amp; Orders
          </h3>
          <div className="overflow-hidden rounded-md border border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-1.5 font-semibold">Order</th>
                  <th className="px-2 py-1.5 font-semibold">Customer</th>
                  <th className="px-2 py-1.5 font-semibold">Item</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Amt</th>
                  <th className="px-2 py-1.5 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody>
                {customers.flatMap((c) =>
                  c.orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-t border-slate-800/70 odd:bg-slate-900/30"
                    >
                      <td className="px-2 py-1.5 font-mono text-slate-300">
                        {o.id}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{c.name}</span>
                          <TierBadge tier={c.tier} />
                        </div>
                      </td>
                      <td className="max-w-[9rem] truncate px-2 py-1.5 text-slate-400">
                        {o.item}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-300">
                        ${o.amount.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {o.already_refunded && (
                            <Pill tone="green">refunded</Pill>
                          )}
                          {c.fraud_flag && <Pill tone="red">fraud</Pill>}
                          {c.lifetime_refunds > 3 && (
                            <Pill tone="amber">
                              {c.lifetime_refunds} refunds
                            </Pill>
                          )}
                          {o.status !== "delivered" && (
                            <Pill tone="sky">{o.status}</Pill>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pollError && (
        <div className="border-t border-red-500/40 bg-red-500/10 px-4 py-2 text-[11px] text-red-300">
          State poll failed: {pollError}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  if (item.type === "tool_call") {
    return (
      <li className="rounded-md border border-sky-500/30 bg-sky-500/5 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            call
          </span>
          <span className="font-mono text-xs text-sky-200">{item.tool}</span>
        </div>
        {item.args && Object.keys(item.args).length > 0 && (
          <p className="mt-1 break-words font-mono text-[11px] text-slate-400">
            {prettyArgs(item.args)}
          </p>
        )}
      </li>
    );
  }
  if (item.type === "tool_result") {
    return (
      <li className="rounded-md border border-slate-700 bg-slate-800/50 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-600/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            result
          </span>
          <span className="font-mono text-xs text-slate-300">{item.tool}</span>
        </div>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-400">
          {truncate(item.output ?? "")}
        </pre>
      </li>
    );
  }
  if (item.type === "error") {
    return (
      <li className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-300">
          error
        </span>
        <p className="mt-1 break-words text-[11px] text-red-300">
          {item.message}
        </p>
      </li>
    );
  }
  // final
  return (
    <li className="rounded-md border border-green-500/30 bg-green-500/5 px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-green-300">
        final answer
      </span>
      <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-200">
        {item.content}
      </p>
    </li>
  );
}
