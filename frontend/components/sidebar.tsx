"use client";

import clsx from "clsx";
import { Building2, ChevronDown, Hexagon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const groups = {
    main: navigationItems.filter((item) => item.section !== "admin"),
    admin: navigationItems.filter((item) => item.section === "admin"),
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-border bg-white lg:flex lg:flex-col">
      <div className="flex h-[74px] items-center gap-3 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white shadow-panel">
          <Hexagon className="h-5 w-5 fill-current" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink">Multimodal Agent</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 px-3 py-3" aria-label="Primary navigation">
        <NavGroup items={groups.main} pathname={pathname} />
        <div className="mx-1 border-t border-border" />
        <NavGroup items={groups.admin} pathname={pathname} />
      </nav>
      <div className="p-3">
        <button
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-white p-3 text-left shadow-panel"
          type="button"
        >
          <div className="relative grid h-9 w-9 place-items-center rounded-md bg-info-soft text-info">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted">Workspace</p>
            <p className="truncate text-sm font-semibold text-ink">Enterprise Workspace</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
}: {
  items: typeof navigationItems;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/"
            ? pathname === "/" || pathname === "/home"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
              active
                ? "bg-accent-soft text-accent"
                : "text-slate-600 hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
