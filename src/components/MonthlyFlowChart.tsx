"use client";

import { Currency, MonthSummary } from "@/lib/types";
import { formatMoney } from "@/lib/format";

// Held to the same contrast checks as the net worth colours, against #09090b.
const C_INCOME = "#34b27b";
const C_EXPENSE = "#d55181";

interface Props {
  months: MonthSummary[];
  currency: Currency;
  /** How many of the most recent months to draw. */
  limit?: number;
  /** Month key currently opened in the breakdown, so it can be highlighted. */
  selected?: string | null;
  onSelect?: (month: string) => void;
}

/**
 * Income against spending, one column pair per month.
 *
 * Both bars share a scale so the taller one is genuinely the bigger number —
 * scaling each to its own maximum would make a £200 month and a £2,000 month
 * look identical.
 */
export default function MonthlyFlowChart({
  months,
  currency,
  limit = 12,
  selected = null,
  onSelect,
}: Props) {
  const shown = months.slice(-limit);
  if (shown.length === 0) return null;

  const peak = Math.max(...shown.map((m) => Math.max(m.income, m.expenses)), 1);

  return (
    <div>
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {shown.map((m) => {
          const empty = m.income === 0 && m.expenses === 0;
          const isSelected = selected === m.month;
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => onSelect?.(m.month)}
              aria-pressed={isSelected}
              className={`flex min-w-[34px] flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-md py-1 transition-colors ${
                isSelected ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"
              }`}
              title={`${m.label} — in ${formatMoney(m.income, currency)}, out ${formatMoney(m.expenses, currency)}, net ${formatMoney(m.net, currency)}. Click for the breakdown.`}
            >
              <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                <div
                  className="w-1/2 max-w-[14px] rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max((m.income / peak) * 100, m.income > 0 ? 2 : 0)}%`,
                    background: C_INCOME,
                    opacity: selected && !isSelected ? 0.45 : 1,
                  }}
                />
                <div
                  className="w-1/2 max-w-[14px] rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max((m.expenses / peak) * 100, m.expenses > 0 ? 2 : 0)}%`,
                    background: C_EXPENSE,
                    opacity: selected && !isSelected ? 0.45 : 1,
                  }}
                />
              </div>
              <span
                className={`text-[9px] leading-none ${
                  isSelected
                    ? "text-zinc-200"
                    : empty
                      ? "text-zinc-700"
                      : "text-zinc-500"
                }`}
              >
                {m.month.slice(5)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: C_INCOME }}
          />
          Money in
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: C_EXPENSE }}
          />
          Money out
        </span>
        <span className="ml-auto text-zinc-600">
          Tap a month for its breakdown
        </span>
      </div>
    </div>
  );
}
