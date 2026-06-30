"use client";

import { Bell, ChevronDown, FileText, FolderOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult, SearchResultType } from "@/api/search";
import { searchApi } from "@/api/search";
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
              <GlobalSearchBox />
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

function GlobalSearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedQuery = query.trim();
  const groupedResults = useMemo(() => groupResults(results), [results]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchApi
        .search(trimmedQuery, 12)
        .then((payload) => setResults(payload.results))
        .catch((err: unknown) => {
          setResults([]);
          setError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [open, trimmedQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        document.getElementById("global-search-input")?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closeSoon() {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function keepOpen() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  return (
    <div className="relative hidden xl:block" onBlur={closeSoon} onFocus={keepOpen}>
      <div className="flex h-9 w-[330px] items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel 2xl:w-[380px]">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          id="global-search-input"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted"
          placeholder="Search tasks, files, runs, assets..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
        />
        <kbd className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">⌘ K</kbd>
      </div>

      {open ? (
        <div
          className="absolute right-0 top-11 z-50 max-h-[520px] w-[520px] overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          onMouseDown={keepOpen}
        >
          <div className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
            Global Search
          </div>
          <div className="max-h-[470px] overflow-y-auto p-2">
            {loading ? <SearchState text="Searching workspace..." /> : null}
            {error ? <SearchState text={error} tone="danger" /> : null}
            {!loading && !error && !results.length ? (
              <SearchState
                text={
                  trimmedQuery
                    ? "No matching tasks, files, runs, assets, parsers, skills, or reviews."
                    : "Type to search, or browse recent workspace records."
                }
              />
            ) : null}
            {!loading && !error
              ? groupedResults.map(([type, items]) => (
                  <SearchGroup key={type} items={items} type={type} onSelect={() => setOpen(false)} />
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({
  items,
  onSelect,
  type,
}: {
  items: SearchResult[];
  onSelect: () => void;
  type: SearchResultType;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        {typeLabel(type)}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={`${item.type}-${item.id}`}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface"
            href={item.href}
            onClick={onSelect}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-white text-muted">
              {item.type === "asset" || item.type === "file" ? (
                <FileText className="h-4 w-4" aria-hidden="true" />
              ) : (
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{item.title}</span>
              <span className="block truncate text-xs text-muted">{item.subtitle ?? item.id}</span>
            </span>
            {item.status ? (
              <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-bold text-muted">
                {item.status.replaceAll("_", " ")}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SearchState({ text, tone = "muted" }: { text: string; tone?: "muted" | "danger" }) {
  return (
    <div className={`px-3 py-6 text-center text-sm ${tone === "danger" ? "text-danger" : "text-muted"}`}>
      {text}
    </div>
  );
}

function groupResults(results: SearchResult[]): Array<[SearchResultType, SearchResult[]]> {
  const order: SearchResultType[] = [
    "agent_task",
    "job",
    "file",
    "asset",
    "review_item",
    "parser",
    "skill",
  ];
  return order
    .map((type) => [type, results.filter((result) => result.type === type)] as [SearchResultType, SearchResult[]])
    .filter(([, items]) => items.length > 0);
}

function typeLabel(type: SearchResultType) {
  const labels: Record<SearchResultType, string> = {
    agent_task: "Agent Tasks",
    file: "Files",
    job: "Runs",
    asset: "Assets",
    parser: "Parsers",
    skill: "Skills",
    review_item: "Review Items",
  };
  return labels[type];
}
