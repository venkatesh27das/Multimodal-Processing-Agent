"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  Timer,
  Workflow,
  X,
} from "lucide-react";
import {
  ActionButton,
  Card,
  DataTable,
  EmptyState,
  MetricCard,
  MiniBar,
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Parsers</h2>
          <p className="mt-1 text-sm text-muted">Manage parser registry, health, benchmarking, and routing readiness across the workspace.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ActionButton
            variant="secondary"
            icon={actions.busyAction === "benchmark-all" ? Loader2 : Gauge}
            disabled={actions.busyAction === "benchmark-all"}
            onClick={actions.runBenchmark}
          >
            Run Benchmark
          </ActionButton>
          <ActionButton icon={Plus} onClick={actions.registerParser}>Register Parser</ActionButton>
        </div>
      </div>

      {actions.toast ? <Toast tone={actions.toast.tone} message={actions.toast.message} onClose={actions.clearToast} /> : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel">
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
            label="Modality"
            value={filters.modality}
            onChange={(value) => updateFilters({ modality: value })}
            options={[{ label: "All Modalities", value: "all" }, ...modalityOptions.map((item) => ({ label: item.toUpperCase(), value: item }))]}
          />
          <FilterSelect
            ariaLabel="Provider filter"
            label="Provider"
            value={filters.provider}
            onChange={(value) => updateFilters({ provider: value })}
            options={[{ label: "All Providers", value: "all" }, ...providerOptions.map((item) => ({ label: item, value: item }))]}
          />
          <FilterSelect
            ariaLabel="Status filter"
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value as ParserFilters["status"] })}
            options={statusOptions}
          />
          <FilterSelect
            ariaLabel="Environment filter"
            label="Environment"
            value={filters.environment}
            onChange={(value) => updateFilters({ environment: value })}
            options={[{ label: "All Environments", value: "all" }, ...environmentOptions.map((item) => ({ label: item.toUpperCase(), value: item }))]}
          />
          <button
            className="ml-auto flex h-10 items-center gap-3 px-2 text-sm font-semibold text-ink"
            type="button"
            onClick={() => updateFilters({ degradedOnly: !filters.degradedOnly })}
          >
            Show degraded only
            <Toggle checked={filters.degradedOnly} />
          </button>
        </div>
        {error ? <InlineError message={error} /> : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
            <MetricCard icon={FileText} label="Total Parsers" value={String(kpis.totalParsers)} delta="From backend registry" tone="info" data={[5, 7, 8, 10, 9, 13, Math.max(1, kpis.totalParsers)]} />
            <MetricCard icon={CheckCircle2} label="Active" value={String(kpis.activeParsers)} delta="Healthy or active" tone="success" data={[7, 8, 7, 9, 12, 10, Math.max(1, kpis.activeParsers)]} />
            <MetricCard icon={AlertTriangle} label="Degraded" value={String(kpis.degradedParsers)} delta="Backend status" tone="warning" data={[8, 6, 7, 5, 4, 3, Math.max(1, kpis.degradedParsers)]} />
            <MetricCard icon={Workflow} label="Avg Success" value={formatPercent(kpis.avgSuccessRate)} delta="From parser metrics" tone="info" data={[6, 8, 7, 10, 9, 11, Math.max(1, Math.round((kpis.avgSuccessRate ?? 0.9) * 10))]} />
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
        {!loading && filteredParsers.length ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
            <span>Showing {filteredParsers.length} of {filteredParsers.length}</span>
            <span>{kpis.totalParsers} parser{kpis.totalParsers === 1 ? "" : "s"} loaded from backend</span>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[1fr_1.1fr]">
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Routing Policy Summary</h3>
            <span className="grid h-4 w-4 place-items-center rounded-full border border-border text-[10px] font-bold text-muted">i</span>
          </div>
          {loading ? (
            <PanelSkeleton columns={4} />
          ) : routingPolicy.items.length ? (
            <>
              <div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
                {routingPolicy.items.slice(0, 4).map((item, index) => (
                  <div key={item.title} className="border-b border-border p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                    <div className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-surface text-accent">
                      {index === 0 ? <ShieldCheck className="h-4 w-4" /> : index === 1 ? <Layers3 className="h-4 w-4" /> : index === 2 ? <GitBranch className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <p className="text-sm font-bold text-ink">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-muted">{item.body}</p>
                  </div>
                ))}
              </div>
              <button className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-accent" type="button">
                View routing rules <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">No routing policy summary is available yet.</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-ink">Recent Parser Changes</h3>
            <button className="inline-flex items-center gap-2 text-sm font-bold text-accent" type="button">
              View all activity <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <PanelSkeleton columns={1} />
          ) : activity.length ? (
            <div className="space-y-1">
              {activity.slice(0, 4).map((item, index) => (
                <div key={item.id} className="grid grid-cols-[28px_1fr_130px_120px] items-center gap-3 rounded-lg px-1 py-2 text-sm">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${activityIconTone(item)}`}>
                    {index === 0 ? <ArrowRight className="h-4 w-4" /> : index === 1 ? <Gauge className="h-4 w-4" /> : index === 2 ? <GitBranch className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <span className="font-semibold text-ink">{item.message}</span>
                  <span className="text-xs capitalize text-muted">{item.tone}</span>
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
      <td className="whitespace-pre-line px-4 py-3 text-muted">{parser.lastUpdated}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-4 text-sm font-bold text-accent">
          <button type="button" onClick={() => actions.viewParser(parser)}>View</button>
          {parser.status === "degraded" || parser.status === "warning" ? (
            <button type="button" disabled={benchmarkBusy} onClick={() => actions.benchmarkParser(parser)}>
              {benchmarkBusy ? "Running..." : "Retry benchmark"}
            </button>
          ) : (
            <button type="button" onClick={() => actions.configureParser()}>Configure</button>
          )}
          <button type="button" aria-label={`More actions for ${parser.name}`} className="text-muted">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function FilterSelect({
  ariaLabel,
  label,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="relative flex h-10 min-w-[170px] flex-col justify-center rounded-lg border border-border bg-white px-3 pr-9 shadow-panel">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <select
        aria-label={ariaLabel}
        className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none"
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

function activityIconTone(activity: ParserActivity): string {
  if (activity.tone === "success") return "bg-success-soft text-success";
  if (activity.tone === "info") return "bg-info-soft text-info";
  if (activity.tone === "purple") return "bg-purple-soft text-purple";
  return "bg-warning-soft text-warning";
}
