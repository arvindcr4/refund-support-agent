"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { ChatTurn, StreamEvent } from "@/lib/types";
import { useVoice } from "@/lib/useVoice";
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
  const voice = useVoice();

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
          voice.speak(event.content);
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
          <div className="flex items-center gap-2">
            {voice.ttsSupported && (
              <button
                type="button"
                onClick={() => voice.setSpeakEnabled(!voice.speakEnabled)}
                title="Toggle spoken replies"
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                  voice.speakEnabled
                    ? "bg-sky-600/20 text-sky-300"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                Voice {voice.speakEnabled ? "on" : "off"}
              </button>
            )}
            <span className="text-[11px] text-slate-500">
              {streaming
                ? "agent thinking..."
                : voice.listening
                  ? "listening..."
                  : "ready"}
            </span>
          </div>
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
          <button
            type="button"
            onClick={() =>
              voice.listening
                ? voice.stopListening()
                : voice.startListening((t) => {
                    setInput(t);
                    send(t);
                  })
            }
            disabled={streaming || !voice.sttSupported}
            title={
              voice.sttSupported
                ? "Speak your request"
                : "Voice input needs Chrome or Safari"
            }
            className={`shrink-0 rounded-lg border px-3 py-2 transition disabled:opacity-40 ${
              voice.listening
                ? "animate-pulse border-red-500 bg-red-500/20 text-red-300"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500"
            }`}
          >
            <MicIcon />
          </button>
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

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2a2 2 0 0 0-2 2v6a2 2 0 1 0 4 0V4a2 2 0 0 0-2-2Z" />
      <path d="M5 10a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 17 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0Z" />
    </svg>
  );
}
