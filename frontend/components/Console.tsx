"use client";

import { useCallback, useState } from "react";
import type { StreamEvent, TimelineItem } from "@/lib/types";
import ChatPane from "./ChatPane";
import AdminPane from "./AdminPane";

let _seq = 0;
const nextId = () => `t${Date.now()}-${_seq++}`;

export default function Console() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  const handleStreamStart = useCallback(() => {}, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    if (event.kind === "done") return;
    setTimeline((prev) => {
      const base = { id: nextId(), ts: Date.now() };
      if (event.kind === "tool_call") {
        return [
          ...prev,
          { ...base, type: "tool_call", tool: event.tool, args: event.args },
        ];
      }
      if (event.kind === "tool_result") {
        return [
          ...prev,
          {
            ...base,
            type: "tool_result",
            tool: event.tool,
            output: event.output,
          },
        ];
      }
      if (event.kind === "final") {
        return [...prev, { ...base, type: "final", content: event.content }];
      }
      if (event.kind === "error") {
        return [...prev, { ...base, type: "error", message: event.message }];
      }
      return prev;
    });
  }, []);

  const clearTimeline = useCallback(() => setTimeline([]), []);

  return (
    <div className="grid h-[calc(100vh-3.25rem)] grid-cols-1 lg:grid-cols-2">
      <section className="min-h-0 border-b border-slate-800 lg:border-b-0 lg:border-r">
        <ChatPane
          onStreamEvent={handleStreamEvent}
          onStreamStart={handleStreamStart}
        />
      </section>
      <section className="min-h-0">
        <AdminPane timeline={timeline} onClearTimeline={clearTimeline} />
      </section>
    </div>
  );
}
