# Portfolio

One place for every investment you hold, across every platform, converted into a
single currency.

---

## Starting it up

Open a terminal in this folder and run:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. Press `Ctrl+C` in the
terminal to stop it.

### Using it on your phone

The app is built to work on a phone screen, but the phone needs a computer to
talk to — this runs on your PC, not on the internet.

1. Make sure your phone and your PC are on the same Wi-Fi.
2. Find your PC's local address: open a terminal and run `ipconfig`, then look
   for **IPv4 Address** (it looks like `192.168.1.42`).
3. On your phone, go to `http://192.168.1.42:3000` (with your own number).

The PC has to be awake and running `npm run dev` for this to work. If you want
it available anywhere, any time, that means putting it online — a separate step
we can do later.

---

## Turning on the AI features

Three features need an Anthropic API key: the research chat, the morning
briefing, and the watchlist explanations. Everything else works without one.

Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys),
then either:

- **Recommended** — copy `.env.local.example` to `.env.local` and paste your key
  in. Restart the app afterwards.
- **Or** — paste it into the Settings screen.

Either way the key ends up inside this OneDrive folder, so it syncs to your
laptop and you only have to set it once. `.env.local` is the tidier of the two:
it keeps the key out of `portfolio.json` (the file you'd most likely copy, back
up, or screenshot) and out of version control if you ever put this in git.

Neither option is a secret vault. If you ever need the key off these machines
entirely, delete it from both places and revoke it in the Anthropic console.

Cost is small at personal scale — a briefing or a few questions runs a handful of
cents. The chat uses Claude Opus 5 with live web search.

---

## The eight tabs

**Portfolio** — Everything you own. Add a holding, pick which platform it's on,
and enter what you paid in whichever currency you actually paid in. The
USD/CAD toggle at the top switches what everything is displayed in.

**Net worth** — Everything you own minus everything you owe. Your bank balances
and your debts live here, and the tab adds them to your investments to give one
real number. See below for why cash is kept out of the Portfolio tab.

**Income & bills** — What comes in against what goes out, month by month, with
a running total so you can see whether you're ahead overall. **Click any month**
— either its bar on the chart or its row in the table — to open it up: income
split by stream, spending split by category, and every entry behind those
totals. Click it again to close. Credit cards show up here with their due
dates. Money in a foreign currency is converted once, on the day it moved, and
then never recalculated — see below.

**Subscriptions** — Everything that bills you automatically, and what it adds
up to per month and per year. Deliberately *not* counted as spending; see
below.

**Watchlist** — Stocks you're considering but don't own. Adding one records
today's price as a baseline, so from then on you can see exactly how far it's
moved since you got interested. The ✨ button gets you a plain-English breakdown
of what the company does and what's been happening to it.

**Briefing** — Your morning read. One button, and you get a short summary of what
happened to your holdings overnight and why, based on real news.

**Research** — Ask anything. It knows what you own and searches the web for
current information. It's told to explain things at roughly a junior-high
reading level, so there's no such thing as too basic a question here.

**Settings** — Master currency, API key, and where your data lives.

---

## How the currency conversion works

This is the part that's easy to get wrong, so it's worth knowing what the app
does.

When you buy something in CAD and view your portfolio in USD, the app converts
your **cost** using the exchange rate **from the day you bought it** — not
today's rate. Using today's rate would quietly fold currency movement into what
you "paid" and misreport every gain.

Because of that, you get an honest split. Open any cross-currency holding and
you'll see something like:

> The price itself moved **+120.18%**; your actual return in USD is **+115.42%**.
> The difference is the exchange rate.

So you can always tell how much of a gain is the investment doing well versus the
dollar moving.

---

## Buying the same thing every month

If you put a set amount into a fund on a schedule — $500 a month into a TFSA,
say — you don't need a separate entry each time. Add the fund **once**, then
record each deposit against it.

Tap the holding to expand it, then **Add contribution**. Two ways to enter one:

- **By amount** (the easy way) — type `500` and the date. The app looks up what
  the fund was actually worth that day and works out how many units you bought.
- **Exact units** — type the units and price straight from your statement, if
  you'd rather match your official records exactly.

The holding stays as one row showing your total units and average cost, but
underneath, every deposit keeps its own date, its own price, and — if you paid
in a different currency than you're viewing — **its own exchange rate**. Six
monthly $500 deposits get six separate conversions, so a year of currency
movement doesn't smear across your cost basis.

Contributions marked with a ✨ had their unit count worked out automatically
rather than typed in.

## Getting paid in another currency

Enter income in the currency you were actually paid in — roubles, euros,
whatever. Type the amount, pick the currency, give the date it landed, and the
app looks up the rate **for that day** and converts it.

**That figure is then frozen.** It is written into your file and never worked
out again. If the rouble halves next month, what you earned in May still reads
exactly what it read in May. This is the whole point: a currency that moves
shouldn't be able to rewrite your income history behind your back.

The form shows you the locked figure before you save it, along with the rate
used, so there's no mystery about what's being recorded.

A few details worth knowing:

- **Both currencies are stored.** Flipping the USD/CAD toggle reads back a
  second frozen number, not a fresh conversion. Either way you get the value as
  it stood on the day.
- **Editing.** Changing the name, category or notes leaves the locked figure
  alone. Changing the **amount, currency or date** takes a fresh rate — because
  that's a correction to when or what was actually paid.
- **Spending is locked the same way**, for the same reason.
- **Future dates are refused.** There's no exchange rate for a day that hasn't
  happened, so record the payment once the money has moved.
- **Rare currencies.** Most currencies have no direct pair against the Canadian
  dollar, so the app converts through USD. If no rate can be found at all, the
  entry is saved and clearly flagged rather than quietly showing an unconverted
  number as though it were converted.

## Why subscriptions aren't spending

Subscriptions get their own tab and are kept out of your spending totals on
purpose.

A subscription is charged to a credit card. Paying that card off is already
recorded as an expense. If Netflix also counted as spending, you'd be charged
for it twice in your own numbers — once as the subscription and once inside the
card payment.

So the Subscriptions tab is a picture of what's running and what it costs, not
a ledger. Those costs use **today's** rate, unlike income and expenses: a
subscription is a standing future cost, not a payment already made, so what
matters is what it would cost you now.

## Cash, debt, and why they're separate

The **Net worth** tab holds two things the Portfolio tab deliberately doesn't:

- **Cash & savings** — chequing, savings, TFSA cash, GICs. Any currency; USD
  balances are converted at today's rate like everything else.
- **Debts** — student loans, credit cards, whatever you owe. Entered as a
  positive number and subtracted.

Net worth is then simply **investments + cash − debts**.

**Why cash isn't in the Portfolio tab:** cash doesn't grow. Folding a savings
balance into your investment return would drag the percentage down and make your
actual picks look worse than they are. Keeping them apart gives two honest
numbers instead of one muddled one — how your investments are performing, and
what you're worth overall.

There's an interest-rate field on debts, left blank by default. Canadian student
loans generally don't accrue interest while you're enrolled full time, so
there's nothing to record yet — fill it in when repayment starts and the app
will show what the debt costs you per year. Check your own loan terms; rules
differ and your servicer is the authority.

Balances are whatever you last typed — the app can't see your bank. Update them
when you check, and each change is recorded so a debt shows how far you've paid
it down.

The research chat and morning briefing can see all of this, so you can ask
things like "what does my loan cost me compared to what my investments earned?"
and get a plain-English answer.

## Going deeper on a debt

Click any debt on the Net worth tab and it opens up.

**What you see:** how much of it you've cleared and how much is left, drawn as
a progress bar; the interest rate; what that rate actually costs you per year
and per month; what you've paid in total and how much of that went to interest
rather than to the debt; and — once there's something to go on — when it clears
and what the interest will come to between now and then.

**Recording a payment.** Enter what you paid. If you have the statement to
hand, enter the balance it left you at too, and the split between interest and
principal becomes arithmetic rather than guesswork. If you don't, and the debt
has a rate, the app works the interest out from the rate and the time since
your last payment — and labels that payment as **estimated**, so an approximation
never sits in your history looking like a fact.

Each payment comes off the balance, which is the same balance net worth
subtracts. It is *not* added to your spending on the Income & bills tab; log it
there as well if you want it counted as money out.

**Payoff projection.** It uses your scheduled monthly payment if you've set
one, and otherwise the average of your last three payments — it says which. If
the payment doesn't cover the interest, it tells you the debt never clears at
that rate instead of quietly projecting a date decades out.

**Deleting a payment.** Removing the most recent one puts the balance back
exactly where it was. Removing an older one takes the record away but leaves
the balance alone, because rewinding it would misstate every payment made
after it — the app says so rather than silently doing something surprising.

**For a mortgage,** fill in the original amount, the rate and the monthly
payment, and the projection is a real amortisation: it works month by month,
so a $400,000 mortgage at 5% with a $2,147.29 payment comes out at exactly 360
months, like the textbook.

**For a student loan with no interest** — the usual case while you're enrolled
full time — leave the rate blank. Every payment then goes straight against the
balance, nothing is estimated, and the projection is simply what's left divided
by what you pay.

## The growth chart

The dashboard draws two lines, and the difference between them is the whole
point:

- **Blue — what it's worth.** Your portfolio's value on each day, rebuilt from
  what you owned that day and what those things were actually trading at.
- **Orange — what you put in.** Cumulative money contributed, stepping up each
  time you bought something.

Why two lines: if you're adding $500 a month, a plain value chart climbs even
when every investment is falling — the line goes up because you're feeding it,
not because it's growing. Plotting contributions alongside makes that
impossible to misread. **The gap between the lines is what your investments
actually earned.**

Hover (or drag a finger on your phone) anywhere on the chart to read that day's
value, contributions, and gain. Range buttons go from one month to your entire
history.

A note on the percentage: it can fall on a day the market rose, because adding
new money increases what you've put in without changing what you've earned yet.
That's arithmetic, not a loss.

Nothing here is stored — the whole history is recomputed from your purchase
records and live price data each time, so correcting an old purchase instantly
fixes the entire curve behind it.

## Accounts

Each holding can be tagged with the account it lives in — **TFSA, RRSP, FHSA,
RESP, RRIF, Non-registered**, or Other. It's separate from platform, because one
brokerage can hold several accounts.

The **By account** view on the dashboard then shows what each account is worth
and how much you've put into it. Useful for the ones with yearly limits.

One caveat: the "put in" figure only counts holdings you've entered here. It is
**not** your official CRA contribution room — it doesn't know about withdrawals,
past years, or anything you haven't logged.

## Tickers worth knowing

- Canadian listings end in `.TO` — `TD.TO`, `VFV.TO`, `SHOP.TO`
- US listings are plain — `AAPL`, `VOO`, `NVDA`
- Gold is `GC=F` (spot price per ounce, in USD); silver is `SI=F`
- Bitcoin is `BTC-USD`

Just type a company name into the search box and it'll find the ticker for you.

### Mutual funds (TD, RBC, Mawer…)

Canadian mutual funds are sold under **fund codes** — `TDB888`, `RBF556`,
`MAW104`. Those codes aren't searchable here, because Yahoo files mutual funds
under its own IDs instead (`0P0000IUYH.TO`).

**Search the fund's name, not its code.** If you don't know the name off-hand,
search the web for "TDB888 fund" — the name comes straight up — then type that
into the app. It'll find it and price it normally. The app now spots when
you've typed something that looks like a fund code and reminds you.

Worth checking the **series** when you pick from the results — funds are often
listed as Investor / I / D / F series with slightly different fees and prices.
Match whatever your TD statement says.

Already looked up:

| Fund code | Fund | Use this |
| --- | --- | --- |
| `TDB888` | TD Comfort Growth Portfolio – I | `0P0000IUYH.TO` |

For **cash and GICs**, pick "Cash / GIC" as the type — no ticker needed. Enter
what you deposited, and optionally what it's worth now if it's grown.

---

## Setting it up on your laptop

OneDrive brings the folder across on its own, but the app won't run until you do
two things on the laptop.

**1. Install Node.js** — get the LTS build from
[nodejs.org](https://nodejs.org). Without it, `npm run dev` won't be a command
the laptop recognises.

**2. Stop OneDrive syncing the machine-generated folders.** Two folders here are
built by the computer, not written by you:

| Folder | Size | What it is |
| --- | --- | --- |
| `node_modules` | ~474 MB, 23,000 files | Downloaded code libraries |
| `.next` | ~265 MB | Build cache |

That's roughly **740 MB of files that should never sync.** They'll slow OneDrive
to a crawl, and worse, they contain Windows-specific binaries compiled for *this*
PC — if your laptop is a different type (an ARM Surface, say), copies of them
will actively break the app rather than help it.

To exclude them: right-click the OneDrive cloud icon in your taskbar →
**Settings** → **Account** → **Choose folders**, expand `investing app`, and
untick `node_modules` and `.next`.

**3. Then, on the laptop**, open a terminal in the folder and run:

```bash
npm install
```

That rebuilds `node_modules` correctly for that machine. It takes a minute or
two, and you only do it once. After that, `npm run dev` works exactly as it does
here.

Your `portfolio.json` — the only file that actually holds *your* data — is a few
kilobytes and syncs instantly.

---

## Your data

Everything lives in one file: `data/portfolio.json`. It's plain text you can open
and read. Because this folder is in OneDrive, it syncs to your laptop
automatically.

**One thing to avoid:** don't run the app on two computers at once. OneDrive
would see two versions of the same file and make a "conflict copy". Close it on
one machine before opening it on the other.

The app keeps a `portfolio.backup.json` alongside it, and if the main file ever
gets damaged mid-sync it recovers from the backup automatically.

---

## What's under the hood

- **Next.js 16** + React 19 + Tailwind 4
- **Prices** from Yahoo Finance (free, no key, delayed up to 15 min)
- **AI** via Claude Opus 5 with the server-side web search tool
- **Storage** a JSON file — no database to install, nothing to run

---

Prices are delayed and can be wrong. Claude can be wrong too. This app is for
tracking and learning — it is not financial advice.
