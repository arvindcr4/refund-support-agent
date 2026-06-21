import type { ActionKind } from "@/lib/types";

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    vip: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    premium: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    standard: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  };
  const cls = map[tier] ?? map.standard;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {tier}
    </span>
  );
}

const ACTION_META: Record<
  ActionKind,
  { label: string; cls: string; dot: string }
> = {
  refund_issued: {
    label: "Refund issued",
    cls: "bg-green-500/15 text-green-300 border-green-500/40",
    dot: "bg-green-400",
  },
  refund_denied: {
    label: "Denied",
    cls: "bg-red-500/15 text-red-300 border-red-500/40",
    dot: "bg-red-400",
  },
  escalated: {
    label: "Escalated",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    dot: "bg-amber-400",
  },
};

export function ActionBadge({ action }: { action: ActionKind }) {
  const meta = ACTION_META[action] ?? {
    label: action,
    cls: "bg-slate-500/15 text-slate-300 border-slate-500/40",
    dot: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "red" | "amber" | "sky";
}) {
  const map: Record<string, string> = {
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    green: "bg-green-500/15 text-green-300 border-green-500/40",
    red: "bg-red-500/15 text-red-300 border-red-500/40",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {children}
      </h2>
      {right}
    </div>
  );
}
