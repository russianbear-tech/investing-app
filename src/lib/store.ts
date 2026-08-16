import fs from "fs/promises";
import path from "path";
import {
  CashAccount,
  Database,
  DEFAULT_DB,
  ExpenseEntry,
  Holding,
  IncomeEntry,
  LegacyHolding,
  Liability,
  Lot,
  Subscription,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "portfolio.json");
const BACKUP_PATH = path.join(DATA_DIR, "portfolio.backup.json");

/**
 * Serializes writes within this process. Next.js route handlers can run
 * concurrently, and two overlapping read-modify-write cycles would silently
 * drop one of the changes.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Converts a pre-v2 holding (one purchase stored flat on the record) into the
 * lots shape. Runs on every read, so an older file is upgraded transparently
 * and nothing is lost if the app is rolled back and forward again.
 */
function migrateHolding(raw: LegacyHolding): Holding {
  const {
    quantity,
    costPerUnit,
    purchaseDate,
    lots: existing,
    ...rest
  } = raw;

  let lots: Lot[];
  if (Array.isArray(existing) && existing.length > 0) {
    lots = existing;
  } else {
    lots = [
      {
        id: newId(),
        date: (purchaseDate ?? rest.createdAt ?? new Date().toISOString()).slice(0, 10),
        quantity: Number(quantity) || 0,
        costPerUnit: Number(costPerUnit) || 0,
        createdAt: rest.createdAt ?? new Date().toISOString(),
      },
    ];
  }

  return {
    ...rest,
    // Oldest first, so "first purchase" and the contribution list read naturally.
    lots: [...lots].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Cash used to live in the portfolio as a `cash`-kind holding. It now belongs
 * on the net worth side, so anything recorded the old way is converted rather
 * than dropped.
 */
function holdingToCashAccount(h: Holding): CashAccount {
  const units = h.lots.reduce((sum, l) => sum + l.quantity, 0);
  const balance = units * (h.manualPrice ?? 1);
  const opened =
    h.lots.length > 0
      ? h.lots.reduce((e, l) => (l.date < e ? l.date : e), h.lots[0].date)
      : h.createdAt.slice(0, 10);

  return {
    id: h.id,
    name: h.name || "Cash",
    institution: h.platform || undefined,
    kind: "savings",
    currency: h.purchaseCurrency,
    balance,
    notes: h.notes,
    history: [{ date: opened, balance }],
    updatedAt: h.createdAt,
    createdAt: h.createdAt,
  };
}

function migrate(raw: unknown): Database {
  const db = raw as Partial<Database> | null;
  if (!db || typeof db !== "object") return { ...DEFAULT_DB };

  const all = Array.isArray(db.holdings)
    ? (db.holdings as unknown as LegacyHolding[]).map(migrateHolding)
    : [];

  return {
    version: 5,
    settings: { ...DEFAULT_DB.settings, ...(db.settings ?? {}) },
    holdings: all.filter((h) => h.kind !== "cash"),
    watchlist: Array.isArray(db.watchlist) ? db.watchlist : [],
    cashAccounts: [
      ...(Array.isArray(db.cashAccounts) ? (db.cashAccounts as CashAccount[]) : []),
      ...all.filter((h) => h.kind === "cash").map(holdingToCashAccount),
    ],
    // v5 added payment tracking; a debt written before then has no payments
    // array, and code downstream iterates it unconditionally.
    liabilities: Array.isArray(db.liabilities)
      ? (db.liabilities as Liability[]).map((l) => ({
          ...l,
          payments: Array.isArray(l.payments) ? l.payments : [],
        }))
      : [],
    // Added in v4. A file written before then simply has none of these, and
    // defaulting to empty means an older file opens without complaint.
    income: Array.isArray(db.income) ? (db.income as IncomeEntry[]) : [],
    expenses: Array.isArray(db.expenses) ? (db.expenses as ExpenseEntry[]) : [],
    subscriptions: Array.isArray(db.subscriptions)
      ? (db.subscriptions as Subscription[])
      : [],
  };
}

export async function readDb(): Promise<Database> {
  try {
    const text = await fs.readFile(DB_PATH, "utf-8");
    return migrate(JSON.parse(text));
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { ...DEFAULT_DB };

    // Corrupt or half-synced file — fall back to the last good copy rather
    // than handing the caller an empty portfolio.
    try {
      const backup = await fs.readFile(BACKUP_PATH, "utf-8");
      console.warn("[store] portfolio.json unreadable, recovered from backup");
      return migrate(JSON.parse(backup));
    } catch {
      console.error("[store] portfolio.json unreadable and no backup:", err);
      return { ...DEFAULT_DB };
    }
  }
}

async function writeAtomic(db: Database): Promise<void> {
  await ensureDir();
  const text = JSON.stringify(db, null, 2);
  const tmp = `${DB_PATH}.${process.pid}.tmp`;

  // Keep the previous version around before overwriting it.
  try {
    await fs.copyFile(DB_PATH, BACKUP_PATH);
  } catch {
    /* first write — nothing to back up */
  }

  await fs.writeFile(tmp, text, "utf-8");

  // rename() is atomic, but OneDrive briefly locks files while syncing and
  // Windows surfaces that as EPERM/EBUSY. Retry, then fall back to a direct
  // write so a sync blip can never lose the user's edit.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await fs.rename(tmp, DB_PATH);
      return;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const retryable = code === "EPERM" || code === "EBUSY" || code === "EACCES";
      if (!retryable || attempt === 3) {
        await fs.writeFile(DB_PATH, text, "utf-8");
        await fs.rm(tmp, { force: true });
        return;
      }
      await sleep(60 * (attempt + 1));
    }
  }
}

/** Read-modify-write under the process lock. Returns the updated database. */
export async function updateDb(
  mutate: (db: Database) => Database | Promise<Database>
): Promise<Database> {
  const run = writeChain.then(async () => {
    const current = await readDb();
    const next = await mutate(current);
    await writeAtomic(next);
    return next;
  });
  // Keep the chain alive even if this update throws.
  writeChain = run.catch(() => undefined);
  return run;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
