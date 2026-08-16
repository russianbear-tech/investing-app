"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import type { StreamStatus } from "@/lib/useClaudeStream";

/**
 * Explains what the model is doing during the pause before the first token.
 * Without this the UI just looks frozen while Claude thinks and searches.
 */
export default function StatusLine({ status }: { status: StreamStatus }) {
  if (status === "thinking") {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Sparkles size={14} className="animate-pulse" />
        Thinking it through…
      </p>
    );
  }
  if (status === "searching") {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Search size={14} className="animate-pulse" />
        Searching the web for the latest…
      </p>
    );
  }
  if (status === "streaming") {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-600">
        <Loader2 size={14} className="animate-spin" />
        Writing…
      </p>
    );
  }
  return null;
}
