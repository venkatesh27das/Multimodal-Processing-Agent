"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Gauge, Loader2, Plus, Search, Timer, Workflow, X } from "lucide-react";
import {
  ActionButton,
  Card,
  DataTable,
  EmptyState,
  MetricCard,
  MiniBar,
  PageHeader,
  StatusPill,
  Tag,
  Toggle,
} from "@/components/design-system";
import {
  formatLatency,
  formatPercent,
  type ParserActivity,
  type ParserDefinition,
  type ParserFilters,
  type ParserStatus,
} from "@/api/parsers";
import { useParserActions } from "@/hooks/useParserActions";
import { useParsers } from "@/hooks/useParsers";

const statusOptions: Array<{ label: string; value: string }> = [
  { label: "All Statuses", value: "all" },
  { label: "Healthy", value: "healthy" },
  { label: "Active", value: "active" },
  { label: "Degraded", value: "degraded" },
  { label: "Warning", value: "warning" },
  { label: "Disabled", value: "disabled" },
];

export default function ParsersPage() {
  const {
    activity,
    environmentOptions,
    error,
    filteredParsers,
    filters,
    kpis,
    loading,
    loadParsers,
    modalityOptions,
    providerOptions,
    routingPolicy,
    updateFilters,
  } = useParsers();
  const actions = useParserActions({ onRefresh: loadParsers });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parsers"
        description="Manage parser registry, health, benchmarking, and routing readiness across the workspace."
        action={
          <>
            <ActionButton
              variant="secondary"
              icon={actions.busyAction === "benchmark-all" ? Loader2 : Gauge}
              disabled={actions.busyAction === "benchmark-all"}
              onClick={actions.runBenchmark}
            >
              Run Benchmark
            </ActionButton>
            <ActionButton icon={Plus} onClick={actions.registerParser}>Register Parser</ActionButton>
          </>
        }
      />

      {actions.toast ? <Toast tone={actions.toast.tone} message={actions.toast.message} onClose={actions.clearToast} /> : null}

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex h-11 min-w-[300px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              placeholder="Search parsers, providers, modalities..."
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
            />
          </label>
          <FilterSelect
            ariaLabel="Modality filter"
            value={filters.modality}
            onChange={(value) => updateFilters({ modality: value })}
            options={[{ label: "All Modalities", value: "all" }, ...modalityOptions.map((item) => ({ label: item.toUpperCase(), value: item }))]}
          />
          <FilterSelect
            ariaLabel="Provider filter"
            value={filters.provider}
            onChange={(value) => updateFilters({ provider: value })}
            options={[{ label: "All Providers", value: "all" }, ...providerOptions.map((item) => ({ label: item, value: item }))]}
          />
          <FilterSelect
            ariaLabel="Status filter"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value as ParserFilters["status"] })}
            options={statusOptions}
          />
          <FilterSelect
            ariaLabel="Environment filter"
            value={filters.environment}
            onChange={(value) => updateFilters({ environment: value })}
            options={[{ label: "All Environments", value: "all" }, ...environmentOptions.map((item) => ({ label: item.toUpperCase(), value: item }))]}
          />
          <button
            className="flex h-11 items-center gap-3 px-2 text-sm font-semibold text-ink"
            type="button"
            onClick={() => updateFilters({ degradedOnly: !filters.degradedOnly })}
          >
            Show degraded only
            <Toggle checked={filters.degradedOnly} />
          </button>
        </div>
        {error ? <InlineError message={error} /> : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        {loading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard icon={FileText} label="Total Parsers" value={String(kpis.totalParsers)} delta="From registry" tone="info" data={[5, 7, 8, 10, 9, 13, Math.max(1, kpis.totalParsers)]} />
            <MetricCard icon={CheckCircle2} label="Active" value={String(kpis.activeParsers)} delta="Healthy or active" tone="success" data={[7, 8, 7, 9, 12, 10, Math.max(1, kpis.activeParsers)]} />
            <MetricCard icon={AlertTriangle} label="Degraded" value={String(kpis.degradedParsers)} delta="Needs attention" tone="warning" data={[8, 6, 7, 5, 4, 3, Math.max(1, kpis.degradedParsers)]} />
            <MetricCard icon={Workflow} label="Avg Success" value={formatPercent(kpis.avgSuccessRate)} delta="Derived from metrics" tone="info" data={[6, 8, 7, 10, 9, 11, Math.max(1, Math.round((kpis.avgSuccessRate ?? 0.9) * 10))]} />
            <MetricCard icon={Timer} label="Avg Latency" value={formatLatency(kpis.avgLatencyMs)} delta="From parser metrics" tone="purple" data={[9, 8, 10, 7, 9, 10, Math.max(1, Math.round((kpis.avgLatencyMs ?? 3200) / 1000))]} />
          </>
        )}
      </div>

      <Card>
        <DataTable columns={["Parser", "Supported Modalities", "Provider / Type", "Version", "Usage %", "Success Rate", "Avg Quality", "Avg Latency", "Cost Tier", "Status", "Last Updated", "Actions"]} minWidth="1180px">
          {loading ? <SkeletonRows /> : null}
          {!loading && filteredParsers.map((parser) => (
            <ParserRow key={parser.parserId} parser={parser} actions={actions} />
          ))}
          {!loading && !filteredParsers.length ? (
            <tr>
              <td colSpan={12} className="p-4">
                <EmptyState
                  icon={Search}
                  title="No parsers match these filters"
                  description="Try clearing search, modality, provider, status, environment, or degraded-only filters."
                />
              </td>
            </tr>
          ) : null}
        </DataTable>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[1fr_1.1fr]">
        <Card className="p-5">
          <PageHeader title="Routing Policy Summary" />
          {loading ? (
            <PanelSkeleton columns={4} />
          ) : routingPolicy.items.length ? (
            <div className="grid gap-3 md:grid-cols-4">
              {routingPolicy.items.slice(0, 4).map((item) => (
                <div key={item.title} className="border-r border-border last:border-r-0">
                  <p className="text-sm font-bold text-ink">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-muted">{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No routing policy summary is available yet.</p>
          )}
        </Card>
        <Card className="p-5">
          <PageHeader title="Recent Parser Changes" action={<span className="text-sm font-bold text-accent">View all activity →</span>} />
          {loading ? (
            <PanelSkeleton columns={1} />
          ) : activity.length ? (
            <div className="space-y-3">
              {activity.slice(0, 4).map((item) => (
                <div key={item.id} className="grid grid-cols-[24px_1fr_120px] items-center gap-3 text-sm">
                  <span className={`h-2 w-2 rounded-full ${activityTone(item)}`} />
                  <span className="font-semibold text-ink">{item.message}</span>
                  <span className="text-xs text-muted">{item.timestampLabel}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No recent parser activity is available yet.</p>
          )}
        </Card>
      </div>

      {actions.detailOpen && actions.selectedParser ? (
        <ParserDetailDrawer parser={actions.selectedParser} onClose={actions.closeDetail} />
      ) : null}
    </div>
  );
}

function ParserRow({
  actions,
  parser,
}: {
  actions: ReturnType<typeof useParserActions>;
  parser: ParserDefinition;
}) {
  const benchmarkBusy = actions.busyAction === `benchmark-${parser.parserId}`;
  return (
    <tr className="hover:bg-surface">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted" />
          <span className="font-bold text-ink">{parser.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set([...parser.supportedFileTypes, ...parser.supportedModalities])).slice(0, 5).map((item) => <Tag key={item}>{item.toUpperCase()}</Tag>)}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-ink">{parser.provider}</p>
        <p className="text-xs capitalize text-muted">{parser.parserType}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-ink">{parser.version}</td>
      <td className="px-4 py-3"><span className="mr-2 text-xs font-semibold text-ink">{parser.usagePercent}%</span><MiniBar value={parser.usagePercent} /></td>
      <td className="px-4 py-3 font-bold text-success">{formatPercent(parser.successRate)}</td>
      <td className="px-4 py-3 font-semibold text-ink">{formatPercent(parser.avgQuality)}</td>
      <td className="px-4 py-3 text-muted">{formatLatency(parser.avgLatencyMs)}</td>
      <td className="px-4 py-3 font-semibold text-ink">{parser.costTier}</td>
      <td className="px-4 py-3"><StatusPill status={statusPillTone(parser.status)}>{statusLabel(parser.status)}</StatusPill></td>
      <td className="px-4 py-3 text-muted">{parser.lastUpdated}</td>
      <td className="px-4 py-3">
        <div className="flex gap-4 text-sm font-bold text-accent">
          <button type="button" onClick={() => actions.viewParser(parser)}>View</button>
          <button type="button" onClick={() => actions.configureParser()}>Configure</button>
          <button type="button" disabled={benchmarkBusy} onClick={() => actions.benchmarkParser(parser)}>
            {benchmarkBusy ? "Running..." : "Retry"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function FilterSelect({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="relative block">
      <select
        aria-label={ariaLabel}
        className="h-11 min-w-[150px] appearance-none rounded-lg border border-border bg-white px-3 pr-9 text-sm font-semibold text-ink shadow-panel outline-none transition focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">⌄</span>
    </label>
  );
}

function ParserDetailDrawer({ onClose, parser }: { onClose: () => void; parser: ParserDefinition }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{parser.name}</h2>
            <p className="mt-1 text-sm text-muted">{parser.parserId}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface" type="button" onClick={onClose} aria-label="Close parser details">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Provider" value={parser.provider} />
          <Field label="Type" value={parser.parserType} />
          <Field label="Version" value={parser.version} />
          <Field label="Status" value={statusLabel(parser.status)} />
          <Field label="Environment" value={parser.deploymentMode} />
          <Field label="Cost Tier" value={parser.costTier} />
          <Field label="Success Rate" value={formatPercent(parser.successRate)} />
          <Field label="Avg Quality" value={formatPercent(parser.avgQuality)} />
          <Field label="Avg Latency" value={formatLatency(parser.avgLatencyMs)} />
          <Field label="Enabled" value={parser.enabled ? "Yes" : "No"} />
        </div>
        <div className="mt-5">
          <p className="text-sm font-bold text-ink">Supported Modalities</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set([...parser.supportedFileTypes, ...parser.supportedModalities])).map((item) => <Tag key={item}>{item.toUpperCase()}</Tag>)}
          </div>
        </div>
        <DetailList title="Strengths" values={parser.strengths} />
        <DetailList title="Weaknesses" values={parser.weaknesses} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-ink">{value}</p>
    </div>
  );
}

function DetailList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-ink">{title}</p>
      <div className="mt-2 space-y-2">
        {values.length ? values.map((value) => (
          <p key={value} className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">{value}</p>
        )) : <p className="text-sm text-muted">No {title.toLowerCase()} listed.</p>}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: 12 }, (_, cell) => (
            <td key={cell} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MetricSkeleton() {
  return (
    <Card className="flex min-h-[92px] items-center gap-4 p-4">
      <span className="h-12 w-12 animate-pulse rounded-xl bg-surface" />
      <span className="flex-1 space-y-3">
        <span className="block h-3 w-24 animate-pulse rounded bg-surface" />
        <span className="block h-7 w-16 animate-pulse rounded bg-surface" />
        <span className="block h-3 w-28 animate-pulse rounded bg-surface" />
      </span>
    </Card>
  );
}

function PanelSkeleton({ columns }: { columns: number }) {
  return (
    <div className={`grid gap-3 ${columns === 4 ? "md:grid-cols-4" : ""}`}>
      {Array.from({ length: columns === 4 ? 4 : 3 }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded bg-surface" />
      ))}
    </div>
  );
}

function Toast({
  message,
  onClose,
  tone,
}: {
  message: string;
  onClose: () => void;
  tone: "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-success-soft text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-warning-soft text-amber-800"
        : "border-red-200 bg-danger-soft text-red-800";
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 text-sm ${toneClass}`}>
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-3 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm text-red-700">{message}</div>;
}

function statusPillTone(status: ParserStatus): "healthy" | "active" | "warning" | "degraded" | "queued" {
  if (status === "healthy") return "healthy";
  if (status === "active") return "active";
  if (status === "warning") return "warning";
  if (status === "degraded") return "degraded";
  return "queued";
}

function statusLabel(status: ParserStatus): string {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function activityTone(activity: ParserActivity): string {
  if (activity.tone === "success") return "bg-success";
  if (activity.tone === "info") return "bg-info";
  if (activity.tone === "purple") return "bg-purple";
  return "bg-warning";
}
