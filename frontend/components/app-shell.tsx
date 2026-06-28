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
      <div className="min-h-screen lg:pl-[248px] 2xl:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-[74px] items-center justify-between gap-4 px-5 2xl:px-6">
            <div className="flex min-w-0 items-center gap-6 2xl:gap-8">
              <button className="hidden min-w-[205px] text-left lg:block 2xl:min-w-[215px]" type="button">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Workspace</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate text-base font-bold text-ink">Enterprise Workspace</span>
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              </button>
              <div className="hidden h-9 border-l border-border lg:block" />
              <h1 className="truncate text-2xl font-bold tracking-[-0.02em] text-ink">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden h-10 w-[320px] items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel xl:flex 2xl:w-[360px]">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">Search files, runs, parsers...</span>
                <kbd className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">⌘ K</kbd>
              </div>
              <button
                className="relative grid h-10 w-10 place-items-center rounded-lg bg-white text-muted transition hover:text-ink"
                type="button"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-1.5 top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  3
                </span>
              </button>
              <button className="relative h-10 w-10 rounded-full border border-border bg-orange-100 text-sm font-bold text-accent shadow-panel" type="button" aria-label="User profile">
                EA
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-success" />
              </button>
            </div>
          </div>
        </header>
        <main className="px-5 py-5 2xl:px-6">{children}</main>
      </div>
    </div>
  );
}
