"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  Scale,
  Receipt,
  Repeat,
  Star,
  MessageCircleQuestion,
  Sunrise,
  Settings as SettingsIcon,
} from "lucide-react";

// `short` is what the mobile tab bar shows: eight full labels don't fit across
// a phone, and a truncated "Subscri…" reads worse than a deliberate "Subs".
const LINKS = [
  { href: "/", label: "Portfolio", short: "Portfolio", icon: Wallet },
  { href: "/networth", label: "Net worth", short: "Worth", icon: Scale },
  { href: "/cashflow", label: "Income & bills", short: "Income", icon: Receipt },
  { href: "/subscriptions", label: "Subscriptions", short: "Subs", icon: Repeat },
  { href: "/watchlist", label: "Watchlist", short: "Watch", icon: Star },
  { href: "/briefing", label: "Briefing", short: "Brief", icon: Sunrise },
  { href: "/research", label: "Research", short: "Ask", icon: MessageCircleQuestion },
  { href: "/settings", label: "Settings", short: "Settings", icon: SettingsIcon },
];

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop / tablet */}
      <header className="hidden items-center justify-between border-b border-zinc-800/70 py-4 md:flex">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
          Portfolio
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActive(href)
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile: title bar plus a fixed bottom tab bar, thumb-reachable. */}
      <header className="flex items-center justify-between py-4 md:hidden">
        <span className="text-base font-semibold tracking-tight text-zinc-100">
          {LINKS.find((l) => isActive(l.href))?.label ?? "Portfolio"}
        </span>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {LINKS.map(({ href, label, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[9px] transition-colors ${
                isActive(href) ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="w-full truncate text-center leading-none">{short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
