"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-white lg:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <div>
          <p className="text-sm font-semibold text-ink">Multimodal Agent</p>
          <p className="text-xs text-muted">Parsing orchestration</p>
        </div>
      </div>
      <nav className="space-y-1 px-3 py-4" aria-label="Primary navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                active
                  ? "bg-[#E8F3F1] text-accent-strong"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

