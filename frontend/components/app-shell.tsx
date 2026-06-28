"use client";

import { Bell, ChevronDown, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { titleForPath } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = titleForPath(pathname);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Sidebar />
      <div className="min-h-screen lg:pl-[220px] 2xl:pl-[232px]">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-[60px] items-center justify-between gap-3 px-4 2xl:px-5">
            <div className="flex min-w-0 items-center gap-5 2xl:gap-6">
              <button className="hidden min-w-[180px] text-left lg:block 2xl:min-w-[190px]" type="button">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Workspace</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold text-ink">Enterprise Workspace</span>
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              </button>
              <div className="hidden h-8 border-l border-border lg:block" />
              <h1 className="truncate text-xl font-bold text-ink">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden h-9 w-[300px] items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel xl:flex 2xl:w-[340px]">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">Search files, runs, parsers...</span>
                <kbd className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">⌘ K</kbd>
              </div>
              <button
                className="relative grid h-9 w-9 place-items-center rounded-lg bg-white text-muted transition hover:text-ink"
                type="button"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-1.5 top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  3
                </span>
              </button>
              <button className="relative h-9 w-9 rounded-full border border-border bg-orange-100 text-sm font-bold text-accent shadow-panel" type="button" aria-label="User profile">
                EA
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-success" />
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-4 2xl:px-5">{children}</main>
      </div>
    </div>
  );
}
