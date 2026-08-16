"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square, Trash2, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import StatusLine from "@/components/StatusLine";
import { useClaudeStream } from "@/lib/useClaudeStream";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "research:thread";

const STARTERS = [
  "How is my portfolio actually doing?",
  "What does P/E ratio mean?",
  "Why did the market move today?",
  "What makes a stock a good long-term buy?",
  "Explain ETFs like I'm new to this",
  "What's the risk of holding both USD and CAD investments?",
];

export default function ResearchPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const stream = useClaudeStream();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as Message[]);
    } catch {
      /* ignore malformed history */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage blocked — chat still works for this session */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, stream.text]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || stream.busy) return;

    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");

    await stream.run(
      "/api/chat",
      { messages: next },
      {
        onDone: (finalText) => {
          setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
          stream.reset();
        },
      }
    );
  }

  function clear() {
    if (messages.length > 0 && !confirm("Clear this conversation?")) return;
    setMessages([]);
    stream.reset();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const empty = messages.length === 0 && !stream.text;

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Research</h2>
          <p className="text-xs text-zinc-500">
            Ask anything about investing. Answers come back in plain English.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4">
        {empty && hydrated && (
          <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center">
            <MessageCircleQuestion size={28} className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-300">
              What do you want to understand?
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-zinc-500">
              No question is too basic. Claude can see your holdings, searches the
              web for current news, and explains things without assuming you know
              any finance jargon.
            </p>
            <div className="mx-auto mt-5 flex max-w-lg flex-wrap justify-center gap-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-700/90 px-4 py-2.5 text-sm leading-relaxed text-white">
                {m.content}
              </p>
            </div>
          ) : (
            <div
              key={i}
              className="rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3.5"
            >
              <Markdown>{m.content}</Markdown>
            </div>
          )
        )}

        {stream.text && (
          <div className="rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3.5">
            <div className="streaming-caret">
              <Markdown>{stream.text}</Markdown>
            </div>
          </div>
        )}

        {stream.busy && !stream.text && (
          <div className="rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3.5">
            <StatusLine status={stream.status} />
          </div>
        )}

        {stream.error && (
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {stream.error}
            {stream.error.toLowerCase().includes("api key") && (
              <Link
                href="/settings"
                className="ml-2 underline underline-offset-2 hover:text-rose-200"
              >
                Open Settings
              </Link>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-16 mt-4 md:bottom-0 md:pb-4">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-lg shadow-black/40">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                  if (inputRef.current) inputRef.current.style.height = "auto";
                }
              }}
              placeholder="Ask anything — “why is my Apple stock down?”"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            {stream.busy ? (
              <button
                onClick={stream.stop}
                className="shrink-0 rounded-lg bg-zinc-700 p-2 text-zinc-200 transition-colors hover:bg-zinc-600"
                aria-label="Stop"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={() => {
                  send(input);
                  if (inputRef.current) inputRef.current.style.height = "auto";
                }}
                disabled={!input.trim()}
                className="shrink-0 rounded-lg bg-emerald-600 p-2 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-zinc-600">
          Educational only — not financial advice.
        </p>
      </div>
    </div>
  );
}
