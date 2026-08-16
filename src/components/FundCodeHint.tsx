"use client";

import { Lightbulb } from "lucide-react";

/**
 * Canadian mutual funds are sold by fund code (TDB888, RBF556, MAW104), but
 * Yahoo indexes them under opaque Morningstar IDs like 0P0000IUYH.TO. Typing
 * the code returns nothing at all, which reads as "my fund isn't supported"
 * when it actually is — so catch that case and point at the fix.
 */
export function looksLikeFundCode(query: string): boolean {
  return /^[A-Za-z]{2,5}\s?\d{3,5}$/.test(query.trim());
}

export default function FundCodeHint({ query }: { query: string }) {
  const code = query.trim().toUpperCase();
  return (
    <div className="mt-2 flex gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-xs leading-relaxed text-amber-200/85">
      <Lightbulb size={14} className="mt-0.5 shrink-0" />
      <span>
        <strong className="font-medium">{code}</strong> looks like a fund code.
        Those aren&apos;t searchable directly — search the fund&apos;s{" "}
        <strong className="font-medium">name</strong> instead.
        <br />
        <span className="text-amber-200/60">
          Not sure of the name? Search the web for &ldquo;{code} fund&rdquo; — it
          takes one look. Then type that name here.
        </span>
      </span>
    </div>
  );
}
