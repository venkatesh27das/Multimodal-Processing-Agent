"use client";

import {
  AlertCircle,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { formatQuality, type Job, type JobsStatusFilter } from "@/api/jobs";
import {
  ActionButton,
  Card,
  DataTable,
  EmptyState,
  FileTypeIcon,
  MetricCard,
  PageHeader,
  StatusPill,
  Tag,
  Toggle,
} from "@/components/design-system";
import { useJobActions } from "@/hooks/useJobActions";
import { useJobs } from "@/hooks/useJobs";

const statusOptions: Array<{ label: string; value: JobsStatusFilter }> = [
  { label: "All Statuses", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Running", value: "running" },
  { label: "Review Required", value: "review_required" },
  { label: "Failed", value: "failed" },
  { label: "Queued", value: "queued" },
];

const dateOptions = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
] as const;

export default function JobsPage() {
  const {
    jobs,
    filtered,
    filters,
    fileTypeOptions,
    parserOptions,
    loading,
    error,
    loadJobs,
    updateFilters,
  } = useJobs();
  const actions = useJobActions({ onRefresh: loadJobs });

  const completed = jobs.filter((job) => job.statusKey === "completed").length;
  const review = jobs.filter((job) => job.reviewRequired).length;
  const avgQuality = averageQuality(jobs);
  const avgLatency = averageLatency(jobs);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Monitor parsing jobs, review routing decisions, and inspect output quality."
        action={
          <>
            <ActionButton
              icon={actions.busyAction === "export" ? Loader2 : Download}
              variant="secondary"
              onClick={actions.exportJobs}
              title="Backend export endpoint is not available yet."
              disabled={actions.busyAction === "export"}
            >
              Export
            </ActionButton>
            <Link href="/parse">
              <ActionButton icon={Plus}>New Parse Job</ActionButton>
            </Link>
          </>
        }
      />

      {actions.toast ? (
        <Toast tone={actions.toast.tone} message={actions.toast.message} onClose={actions.clearToast} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={FileCheck2}
          label="Total Jobs"
          value={String(jobs.length)}
          delta={`${completed} completed`}
          tone="info"
          data={[8, 10, 9, 12, 14, 13, 15]}
        />
        <MetricCard
          icon={Star}
          label="Avg Quality"
          value={avgQuality}
          delta="Quality across current jobs"
          tone="success"
          data={[7, 8, 7, 10, 9, 11, 10]}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Review Required"
          value={String(review)}
          delta="Human-in-the-loop items"
          tone="warning"
          data={[5, 4, 6, 4, 3, 5, 3]}
        />
        <MetricCard
          icon={Clock3}
          label="Avg Latency"
          value={avgLatency}
          delta="Published asset latency"
          tone="purple"
          data={[9, 8, 10, 7, 9, 10, 11]}
        />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex h-11 min-w-[320px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              placeholder="Search jobs, files, parsers..."
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
            />
          </label>
          <FilterSelect
            ariaLabel="Status filter"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value as JobsStatusFilter })}
            options={statusOptions}
          />
          <FilterSelect
            ariaLabel="File type filter"
            value={filters.fileType}
            onChange={(value) => updateFilters({ fileType: value })}
            options={[
              { label: "All File Types", value: "all" },
              ...fileTypeOptions.map((type) => ({ label: type.toUpperCase(), value: type })),
            ]}
          />
          <FilterSelect
            ariaLabel="Parser filter"
            value={filters.parser}
            onChange={(value) => updateFilters({ parser: value })}
            options={[
              { label: "All Parsers", value: "all" },
              ...parserOptions.map((parser) => ({ label: parser, value: parser })),
            ]}
          />
          <FilterSelect
            ariaLabel="Date range filter"
            value={filters.dateRange}
            onChange={(value) => updateFilters({ dateRange: value as typeof filters.dateRange })}
            options={dateOptions}
          />
          <button
            className="flex h-11 items-center gap-3 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-ink shadow-panel"
            type="button"
            onClick={() => updateFilters({ reviewOnly: !filters.reviewOnly })}
          >
            Review only
            <Toggle checked={filters.reviewOnly} />
          </button>
          <ActionButton icon={RefreshCw} variant="secondary" onClick={loadJobs}>
            Refresh
          </ActionButton>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <DataTable
          columns={[
            "Job / File",
            "Objective",
            "Parser",
            "Status",
            "Quality",
            "Fallback",
            "Started",
            "Duration",
            "Updated",
            "Actions",
          ]}
          minWidth="1180px"
        >
          {loading ? <SkeletonRows /> : null}
          {!loading && filtered.jobs.map((job) => (
            <JobRow key={job.id} job={job} actions={actions} />
          ))}
          {!loading && !filtered.jobs.length ? (
            <tr>
              <td colSpan={10} className="p-4">
                <EmptyState
                  icon={Search}
                  title="No jobs match these filters"
                  description="Try clearing the search, status, parser, file type, date range, or review-only filter."
                />
              </td>
            </tr>
          ) : null}
        </DataTable>

        <div className="flex items-center justify-between border-t border-border px-1 pt-4">
          <p className="text-sm text-muted">
            Showing{" "}
            <span className="font-semibold text-ink">
              {filtered.total ? (filtered.page - 1) * filtered.pageSize + 1 : 0}
              –
              {Math.min(filtered.page * filtered.pageSize, filtered.total)}
            </span>{" "}
            of <span className="font-semibold text-ink">{filtered.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-sm font-bold text-muted disabled:opacity-40"
              type="button"
              disabled={filtered.page <= 1}
              onClick={() => updateFilters({ page: filtered.page - 1 })}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, filtered.totalPages) }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                className={`grid h-9 w-9 place-items-center rounded-lg border text-sm font-bold ${
                  page === filtered.page
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-transparent bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => updateFilters({ page })}
              >
                {page}
              </button>
            ))}
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-sm font-bold text-muted disabled:opacity-40"
              type="button"
              disabled={filtered.page >= filtered.totalPages}
              onClick={() => updateFilters({ page: filtered.page + 1 })}
            >
              ›
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function JobRow({
  job,
  actions,
}: {
  job: Job;
  actions: ReturnType<typeof useJobActions>;
}) {
  const busyRetry = actions.busyAction === `retry-${job.id}`;
  const busyReview = actions.busyAction === `review-${job.id}`;

  return (
    <tr className="hover:bg-surface">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileTypeIcon type={job.fileType} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{job.fileName}</p>
            <p className="text-xs text-muted">{job.fileSizeLabel} • {job.fileType.toUpperCase()}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-ink">{job.objective}</td>
      <td className="px-4 py-3 text-muted">{job.parser}</td>
      <td className="px-4 py-3"><JobStatusPill job={job} /></td>
      <td className="px-4 py-3">
        <span className={job.quality !== null && job.quality < 0.8 ? "font-bold text-warning" : "font-bold text-success"}>
          {formatQuality(job.quality)}
        </span>
      </td>
      <td className="px-4 py-3">
        {job.fallback ? <Tag tone="warning">{job.fallbackParser ?? "Used"}</Tag> : <span className="text-muted">No</span>}
      </td>
      <td className="px-4 py-3 text-muted">{job.startedAtLabel}</td>
      <td className="px-4 py-3 text-muted">{job.durationLabel}</td>
      <td className="px-4 py-3 text-muted">{job.updatedAtLabel}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"
            type="button"
            title="View job"
            onClick={() => actions.viewJob(job)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-50"
            type="button"
            title="Retry endpoint is not available yet if backend returns 404."
            disabled={busyRetry}
            onClick={() => actions.retryJob(job)}
          >
            {busyRetry ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-50"
            type="button"
            title="Send to Review endpoint is not available yet if backend returns 404."
            disabled={busyReview}
            onClick={() => actions.sendToReview(job)}
          >
            {busyReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-muted opacity-50"
            type="button"
            title="Export/download endpoint is not available yet."
            disabled
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function JobStatusPill({ job }: { job: Job }) {
  if (job.status === "Completed") return <StatusPill status="completed">Completed</StatusPill>;
  if (job.status === "Review Required") return <StatusPill status="review">Review Required</StatusPill>;
  if (job.status === "Failed") return <StatusPill status="failed">Failed</StatusPill>;
  if (job.status === "Running" || job.status === "In Progress") {
    return <span className="inline-flex h-6 items-center rounded-full border border-blue-200 bg-info-soft px-2 text-xs font-bold text-info">{job.status}</span>;
  }
  return <StatusPill status="queued">{job.status}</StatusPill>;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={index}>
          {Array.from({ length: 10 }, (_, cell) => (
            <td key={cell} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FilterSelect({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <select
        aria-label={ariaLabel}
        className="h-11 min-w-[150px] appearance-none rounded-lg border border-border bg-white px-3 pr-9 text-sm font-semibold text-ink shadow-panel outline-none transition focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">⌄</span>
    </label>
  );
}

function Toast({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "warning" | "error";
  message: string;
  onClose: () => void;
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

function averageQuality(jobs: Job[]) {
  const values = jobs.map((job) => job.quality).filter((value): value is number => value !== null);
  if (!values.length) return "--";
  return `${Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100)}%`;
}

function averageLatency(jobs: Job[]) {
  const values = jobs.map((job) => job.durationMs).filter((value): value is number => value !== null);
  if (!values.length) return "--";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average < 1000 ? `${Math.round(average)} ms` : `${(average / 1000).toFixed(1)}s`;
}
