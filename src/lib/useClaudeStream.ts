"use client";

import { useCallback, useRef, useState } from "react";

export type StreamStatus = "idle" | "thinking" | "searching" | "streaming" | "error";

interface StreamEvent {
  type: "thinking" | "searching" | "text" | "done" | "error";
  text?: string;
  message?: string;
}

/**
 * Consumes the newline-delimited JSON stream from the AI routes.
 *
 * Surfaces thinking/searching as distinct states so the UI can explain the
 * pause instead of showing a frozen screen — Claude often spends several
 * seconds reasoning and searching before the first token arrives.
 */
export function useClaudeStream() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setText("");
    setError(null);
    setStatus("idle");
  }, []);

  const run = useCallback(
    async (
      url: string,
      body: unknown,
      opts: { onDone?: (finalText: string) => void } = {}
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setText("");
      setError(null);
      setStatus("thinking");

      let accumulated = "";

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the trailing partial line for the next chunk.
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line) as StreamEvent;
            } catch {
              continue;
            }

            if (event.type === "text" && event.text) {
              accumulated += event.text;
              setText(accumulated);
              setStatus("streaming");
            } else if (event.type === "thinking") {
              setStatus((s) => (s === "streaming" ? s : "thinking"));
            } else if (event.type === "searching") {
              setStatus((s) => (s === "streaming" ? s : "searching"));
            } else if (event.type === "error") {
              setError(event.message ?? "Something went wrong.");
              setStatus("error");
            }
          }
        }

        if (accumulated) opts.onDone?.(accumulated);
        setStatus((s) => (s === "error" ? s : "idle"));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      } finally {
        abortRef.current = null;
      }

      return accumulated;
    },
    []
  );

  const busy = status === "thinking" || status === "searching" || status === "streaming";

  return { text, status, error, busy, run, stop, reset, setText };
}
