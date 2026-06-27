"use client";

import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { navigationItems } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeItem =
    navigationItems.find((item) =>
      item.href === "/" ? pathname === item.href : pathname.startsWith(item.href),
    ) ?? navigationItems[0];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div>
              <p className="text-xs font-medium uppercase text-muted">Workspace</p>
              <h1 className="text-lg font-semibold">{activeItem.label}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-muted md:flex">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Search files, jobs, parsers</span>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-white text-muted shadow-panel transition hover:text-ink"
                type="button"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
