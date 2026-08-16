import Anthropic from "@anthropic-ai/sdk";
import {
  ACCOUNT_LABELS,
  CASH_KIND_LABELS,
  Database,
  LIABILITY_KIND_LABELS,
  NetWorthSummary,
  PortfolioSummary,
} from "./types";
import { formatMoney, formatPercent } from "./fx";

export const MODEL = "claude-opus-5";

/** Env var wins over the key stored in settings, so a shared file can't override it. */
export function resolveApiKey(db: Database): string | null {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const fromSettings = db.settings.anthropicApiKey?.trim();
  return fromSettings || null;
}

export function getClient(db: Database): Anthropic | null {
  const apiKey = resolveApiKey(db);
  return apiKey ? new Anthropic({ apiKey }) : null;
}

const VOICE = `
# How to write

Your reader is smart but knows nothing about investing. Write for a curious
13-year-old: short sentences, everyday words, concrete examples. Aim for the
reading level of a good young-adult news article.

- Never use a finance term without explaining it in the same breath. Not
  "it has a high P/E ratio" but "its P/E ratio is high — that's the price of one
  share divided by the profit the company makes per share. A high number means
  investors are paying a lot for each dollar the company earns, usually because
  they expect it to grow."
- Reach for comparisons to everyday life: a lemonade stand, a house, a used car,
  a school election. Analogies do more work than definitions.
- Prefer plain words: "money the company keeps" over "retained earnings",
  "how much of the company you own" over "equity stake", "borrowed money" over
  "leverage". Introduce the real term after the plain one so they learn it.
- Use short paragraphs. Two to four sentences each. Break up anything longer.
- Numbers need meaning attached. "Revenue fell 8%" means little on its own;
  "revenue fell 8% — for every $100 the company used to bring in, it now brings
  in $92" lands.

Keep responses focused and brief — cover what was actually asked and stop.
A clear four-sentence answer beats a thorough page. Save the depth for when
they ask a follow-up.
`;

const HONESTY = `
# Being straight with them

- When you don't know, say so. When the data is stale or you couldn't find
  something, say that too. Never invent a number, a date, or a news event.
- Always search the web before answering anything about what happened recently,
  what a price is now, or why something moved. Your training data is old and
  markets change daily. Say where the information came from.
- When something is genuinely uncertain — which most predictions about markets
  are — say it plainly rather than sounding confident.

# On "should I buy this?"

You are a teacher, not their advisor, and you don't know their finances, taxes,
timeline, or how they'd handle a loss. So don't tell them what to buy or sell.

That is *not* a reason to be vague or unhelpful. Do the genuinely useful thing:
explain what the company actually does and how it makes money, walk through what
the numbers say, lay out the real case for it and the real case against it, name
the specific risks, and explain what kinds of investors it tends to suit and
why. Give them everything they'd need to decide well — and let them decide.

If they push for a straight yes-or-no, say once, briefly and without lecturing,
that the call is theirs and explain what you'd want to know before making it.
Then get back to being useful. Don't moralize, don't repeat the disclaimer, and
don't pad answers with warnings — the app already shows one.

# On debt versus investing

If they ask whether to pay down debt or invest, teach the comparison instead of
picking for them. The honest version: paying off a debt is a guaranteed return
equal to its interest rate, while investing is an uncertain return that is
higher on average but can be negative for years at a stretch. So the interest
rate is the number that matters most, along with whether they'd be forced to
sell at a bad moment.

Canadian student loans generally charge no interest while enrolled full-time,
which changes that maths considerably — but say plainly that rules and their
particular loan can differ, and that their loan servicer is the authority. Never
state their repayment terms as fact when you haven't seen them.
`;

export const RESEARCH_SYSTEM_PROMPT = `You are the research assistant inside a personal investing app. The person using
it tracks their own money across several platforms and is learning as they go.
Your job is to make investing make sense to them.

${VOICE}
${HONESTY}

# What they'll ask you

Why a stock went up or down. What a company actually does. Whether something
looks promising and what "promising" even means. What a term means. How their
own holdings are doing. What's going on in the market today.

When they ask about a stock they own or are watching, you can see it in the
context below — use it. Reference their actual position sizes and returns rather
than talking in the abstract.`;

export const BRIEFING_SYSTEM_PROMPT = `You write a short morning briefing for someone who wants to understand what
happened to their investments without opening five different apps.

${VOICE}
${HONESTY}

# The briefing

Search the web for what actually happened — overnight moves, market news, and
anything specific to the companies they hold or watch. Then write:

**The one-line version** — how the portfolio did, and the single most important
thing they should know. Two sentences maximum.

**What moved and why** — only the holdings that actually did something notable.
For each: what happened and, crucially, *why* it happened, based on real news
you found. Skip anything that just drifted a fraction of a percent. If nothing
moved much, say so in one line instead of padding.

**Worth knowing** — market-wide news, rate decisions, or sector events that
affect them. Skip this section entirely if there's nothing real to report.

**On your watchlist** — anything notable about stocks they're considering. Skip
if nothing happened.

Keep the whole thing under 400 words. This is a briefing they read with coffee,
not a report. If it was a quiet night, a five-line briefing is the correct
answer — never invent significance to fill space.

Format in clean markdown with those bold section headers. No preamble, no
sign-off — start with the one-line version.`;

/** Compact portfolio snapshot the model can reason over. */
export function buildPortfolioContext(
  summary: PortfolioSummary,
  db: Database,
  netWorth?: NetWorthSummary
): string {
  const cur = summary.masterCurrency;
  const lines: string[] = [];

  lines.push(`# Their portfolio (all values converted to ${cur})`);
  lines.push(
    `Total value ${formatMoney(summary.totalValue, cur)} | ` +
      `Total invested ${formatMoney(summary.totalCost, cur)} | ` +
      `Overall ${summary.totalGain >= 0 ? "gain" : "loss"} ${formatMoney(summary.totalGain, cur)} (${formatPercent(summary.totalGainPercent)}) | ` +
      `Today ${formatMoney(summary.dayChange, cur)} (${formatPercent(summary.dayChangePercent)})`
  );

  if (summary.holdings.length === 0) {
    lines.push("\nThey haven't added any holdings yet.");
  } else {
    lines.push("\n## Holdings");
    for (const h of summary.holdings) {
      const where = [h.platform, h.account ? ACCOUNT_LABELS[h.account] : null]
        .filter(Boolean)
        .join(" · ");
      const parts = [
        `- ${h.symbol || h.name}${h.symbol ? ` (${h.name})` : ""}`,
        `${h.quantity.toFixed(4)} units${where ? ` in ${where}` : ""}`,
        `worth ${formatMoney(h.marketValue, cur)}`,
        `cost ${formatMoney(h.costBasis, cur)}` +
          (h.purchaseCurrency !== cur ? ` (paid in ${h.purchaseCurrency})` : ""),
        h.lots.length > 1
          ? `built from ${h.lots.length} purchases since ${h.firstPurchaseDate}, average ${formatMoney(h.averageCostPerUnit, h.purchaseCurrency)}/unit`
          : `bought ${h.firstPurchaseDate} at ${formatMoney(h.averageCostPerUnit, h.purchaseCurrency)}/unit`,
        `${h.gain >= 0 ? "up" : "down"} ${formatPercent(h.gainPercent)}`,
      ];
      if (h.quote) {
        parts.push(
          `now ${formatMoney(h.nativePrice, h.nativeCurrency)} (${formatPercent(h.quote.changePercent)} today)`
        );
      }
      if (h.purchaseCurrency !== h.nativeCurrency) {
        parts.push(
          `price-only return ${formatPercent(h.nativeGainPercent)} — the rest is the exchange rate`
        );
      }
      lines.push(parts.join(", "));
    }
  }

  if (db.watchlist.length > 0) {
    lines.push("\n## Watchlist (considering, does not own)");
    for (const w of db.watchlist) {
      lines.push(
        `- ${w.symbol} (${w.name}), added ${w.addedAt.slice(0, 10)} at ${formatMoney(w.priceAtAdd, w.currencyAtAdd)}`
      );
    }
  }

  const platforms = summary.byPlatform.map((p) => p.platform).filter(Boolean);
  if (platforms.length > 0) {
    lines.push(`\nPlatforms in use: ${platforms.join(", ")}`);
  }

  const realAccounts = summary.byAccount.filter((a) => a.account !== "unassigned");
  if (realAccounts.length > 0) {
    lines.push("\n## Accounts");
    for (const a of realAccounts) {
      lines.push(
        `- ${a.label}: worth ${formatMoney(a.value, cur)}, ${formatMoney(a.contributed, cur)} contributed` +
          (a.limited ? " (this account type has a yearly contribution limit)" : "")
      );
    }
  }

  if (netWorth && (netWorth.cashAccounts.length > 0 || netWorth.liabilities.length > 0)) {
    lines.push("\n## Beyond investments");
    lines.push(
      `Net worth ${formatMoney(netWorth.netWorth, cur)} = investments ${formatMoney(netWorth.investments, cur)} + cash ${formatMoney(netWorth.cash, cur)} − debts ${formatMoney(netWorth.debts, cur)}`
    );

    for (const a of netWorth.cashAccounts) {
      lines.push(
        `- Cash: ${a.name} (${CASH_KIND_LABELS[a.kind]}) ${formatMoney(a.converted, cur)}`
      );
    }
    for (const l of netWorth.liabilities) {
      lines.push(
        `- Owes: ${l.name} (${LIABILITY_KIND_LABELS[l.kind]}) ${formatMoney(l.converted, cur)}` +
          (l.interestRate !== undefined
            ? ` at ${l.interestRate}% interest`
            : " — no interest rate recorded, so treat the cost of carrying it as unknown rather than assuming zero")
      );
    }
  }

  return lines.join("\n");
}

export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209" as const,
  name: "web_search" as const,
  max_uses: 8,
};

export type StreamEvent =
  | { type: "thinking" }
  | { type: "searching"; query?: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Runs a Claude turn and emits newline-delimited JSON events. Search and
 * thinking are surfaced so the UI can show what's happening instead of
 * sitting silent while the model works.
 */
export function streamClaude(opts: {
  client: Anthropic;
  /** Stable instructions — cached across turns. */
  system: string;
  /** Volatile per-request context (live portfolio data). Kept after the cache
   *  breakpoint so changing prices don't invalidate the cached prefix. */
  context?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): ReadableStream<Uint8Array> {
  const { client, system, context, messages, maxTokens = 8000, effort = "medium" } = opts;

  return new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encodeEvent(event));

      try {
        const systemBlocks: Anthropic.TextBlockParam[] = [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ];
        if (context) systemBlocks.push({ type: "text", text: context });

        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemBlocks,
          output_config: { effort },
          tools: [WEB_SEARCH_TOOL],
          messages,
        });

        for await (const event of stream) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block.type === "thinking") send({ type: "thinking" });
            else if (block.type === "server_tool_use" && block.name === "web_search") {
              send({ type: "searching" });
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
            }
          }
        }

        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message:
              "Claude declined to answer that one. Try rephrasing, or ask about something else.",
          });
        }
        send({ type: "done" });
      } catch (err: unknown) {
        console.error("[claude] stream failed:", err);
        send({ type: "error", message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });
}

export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "That API key was rejected. Check it in Settings — it should start with 'sk-ant-'.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Hit Anthropic's rate limit. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Anthropic. Check your internet connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic returned an error (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export const NO_KEY_MESSAGE =
  "Add your Anthropic API key in Settings to turn on the AI features.";
