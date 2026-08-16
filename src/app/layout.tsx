import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Track every investment across every platform, in one currency.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 sm:px-6 md:pb-8">
          <Nav />
          <main className="flex-1 pt-4">{children}</main>
          <footer className="mt-10 hidden border-t border-zinc-800/70 py-5 text-xs text-zinc-600 md:block">
            Prices from Yahoo Finance, delayed up to 15 minutes. This app is for
            tracking and learning — it isn&apos;t financial advice.
          </footer>
        </div>
      </body>
    </html>
  );
}
