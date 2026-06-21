"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { ChatTurn, StreamEvent } from "@/lib/types";
import ScenarioPicker from "./ScenarioPicker";
import { SectionTitle } from "./ui";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

export default function ChatPane({
  onStreamEvent,
  onStreamStart,
}: {
  // Forward SSE events.
  onStreamEvent?: (event: StreamEvent) => void;
  onStreamStart?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm ShopWell's refund agent. Tell me which order you'd like refunded (e.g. \"refund O1004\"), or use a scenario button below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chat history excluding initial greeting.
  const historyRef = useRef<ChatTurn[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setError(null);
    setInput("");

    const history = [...historyRef.current];
    setMessages((m) => [
      ...m,
      { role: "user", content: message },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);
    onStreamStart?.();

    let finalContent = "";

    try {
      await streamChat(message, history, (event: StreamEvent) => {
        onStreamEvent?.(event);
        if (event.kind === "final") {
          finalContent = event.content;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              role: "assistant",
              content: finalContent,
            };
            return copy;
          });
        } else if (event.kind === "error") {
          setError(event.message);
        }
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setStreaming(false);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.pending) {
          copy[copy.length - 1] = {
            role: "assistant",
            content:
              finalContent ||
              "(No final response received - check the reasoning log.)",
          };
        }
        return copy;
      });
      // Save message pair to history.
      if (finalContent) {
        historyRef.current = [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: finalContent },
        ];
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SectionTitle
        right={
          <span className="text-[11px] text-slate-500">
            {streaming ? "agent thinking..." : "ready"}
          </span>
        }
      >
        Customer Chat
      </SectionTitle>

      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-sky-600 text-white"
                  : "rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100"
              }`}
            >
              {m.pending && !m.content ? (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="border-t border-slate-800 px-4 py-3">
        <div className="mb-3">
          <ScenarioPicker onPick={send} disabled={streaming} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a refund request..."
            disabled={streaming}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}
