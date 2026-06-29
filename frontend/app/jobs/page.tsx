"use client";

import {
  AlertCircle,
  Calendar,
  Clock3,
  Columns3,
  Download,
  FileCheck2,
  Loader2,
  PlayCircle,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Trash2,
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
  StatusPill,
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
  const failed = jobs.filter((job) => job.statusKey === "failed").length;
  const running = jobs.filter((job) => job.statusKey === "running").length;
  const avgLatency = averageLatency(jobs);
  const completionRate = jobs.length ? Math.round((completed / jobs.length) * 1000) / 10 : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Jobs</h2>
          <p className="mt-1 text-sm text-muted">Track and manage all parsing jobs across your workspace.</p>
        </div>
        <Link href="/create-run">
          <ActionButton icon={Plus}>New Parse Job</ActionButton>
        </Link>
      </div>

      {actions.toast ? (
        <Toast tone={actions.toast.tone} message={actions.toast.message} onClose={actions.clearToast} />
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-10 min-w-[250px] flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-muted shadow-panel">
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              placeholder="Search jobs, files, objectives..."
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
            />
            <Search className="h-4 w-4" aria-hidden="true" />
          </label>
          <FilterSelect
            label="Status"
            ariaLabel="Status filter"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value as JobsStatusFilter })}
            options={statusOptions}
          />
          <FilterSelect
            label="File Type"
            ariaLabel="File type filter"
            value={filters.fileType}
            onChange={(value) => updateFilters({ fileType: value })}
            options={[
              { label: "All Types", value: "all" },
              ...fileTypeOptions.map((type) => ({ label: type.toUpperCase(), value: type })),
            ]}
          />
          <FilterSelect
            label="Parser"
            ariaLabel="Parser filter"
            value={filters.parser}
            onChange={(value) => updateFilters({ parser: value })}
            options={[
              { label: "All Parsers", value: "all" },
              ...parserOptions.map((parser) => ({ label: parser, value: parser })),
            ]}
          />
          <label className="flex h-10 min-w-[210px] items-center gap-2 rounded-md border border-border bg-white px-3 text-sm shadow-panel">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold text-muted">Date Range</span>
              <span className="block truncate font-semibold text-ink">{dateRangeLabel(filters.dateRange)}</span>
            </span>
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
          </label>
          <button
            className="ml-auto flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted"
            type="button"
            onClick={() => updateFilters({ reviewOnly: !filters.reviewOnly })}
          >
            Only review-required
            <Toggle checked={filters.reviewOnly} />
          </button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={FileCheck2}
          label="Total Jobs"
          value={String(jobs.length)}
          delta="Loaded from backend"
          tone="info"
          data={sparklineFromCount(jobs.length)}
        />
        <MetricCard
          icon={PlayCircle}
          label="Running"
          value={String(running)}
          delta="Currently active"
          tone="success"
          data={sparklineFromCount(running)}
        />
        <MetricCard
          icon={Star}
          label="Completed"
          value={String(completed)}
          delta="Backend job status"
          tone="success"
          data={sparklineFromCount(completed)}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Review Required"
          value={String(review)}
          delta="Pending human review"
          tone="warning"
          data={sparklineFromCount(review)}
        />
        <MetricCard
          icon={Clock3}
          label="Failed"
          value={String(failed)}
          delta="Backend job status"
          tone="danger"
          data={sparklineFromCount(failed)}
        />
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs font-bold text-muted">Job Health <AlertCircle className="h-3 w-3 text-subtle" /></p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Completion Rate</p>
              <p className="mt-1 text-lg font-bold text-ink">{completionRate === null ? "--" : `${completionRate}%`}</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-success" style={{ width: `${completionRate ?? 0}%` }} /></div>
            </div>
            <div>
              <p className="text-xs text-muted">Avg. Duration</p>
              <p className="mt-1 text-lg font-bold text-ink">{avgLatency}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex justify-end gap-2 border-b border-border p-3">
          <ActionButton icon={Columns3} variant="secondary">Columns</ActionButton>
          <ActionButton
            icon={actions.busyAction === "export" ? Loader2 : Download}
            variant="secondary"
            onClick={actions.exportJobs}
            title={actions.exportUnsupported ? "Export endpoint is not available yet." : "Export jobs"}
            disabled={actions.busyAction === "export" || actions.exportUnsupported}
          >
            Export
          </ActionButton>
        </div>

        {error ? (
          <div className="m-3 rounded-lg border border-amber-200 bg-warning-soft p-3 text-sm text-amber-800">
            Live jobs could not be loaded: {error}
          </div>
        ) : null}

        <DataTable
          columns={[
            "Run / File",
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
                  title="No runs match these filters"
                  description="Try clearing the search, status, parser, file type, date range, or review-only filter."
                />
              </td>
            </tr>
          ) : null}
        </DataTable>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
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
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-sm font-bold text-muted disabled:opacity-40"
              type="button"
              disabled={filtered.page <= 1}
              onClick={() => updateFilters({ page: filtered.page - 1 })}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, filtered.totalPages) }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                className={`grid h-8 w-8 place-items-center rounded-md border text-sm font-bold ${
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
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-sm font-bold text-muted disabled:opacity-40"
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
  const busyDelete = actions.busyAction === `delete-${job.id}`;

  return (
    <tr className="hover:bg-surface">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <FileTypeIcon type={job.fileType} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{job.fileName}</p>
            <p className="text-xs text-muted">{job.fileSizeLabel} • {job.fileType.toUpperCase()}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm font-semibold text-ink">{job.objective}</td>
      <td className="px-4 py-2.5 text-muted">{job.parser}</td>
      <td className="px-4 py-2.5"><JobStatusPill job={job} /></td>
      <td className="px-4 py-2.5">
        <span className={job.quality !== null && job.quality < 0.8 ? "font-bold text-warning" : "font-bold text-success"}>
          {job.quality !== null ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current" /> : null}
          {formatQuality(job.quality)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {job.fallback ? <span className="text-muted">{job.fallbackParser ?? "Used"}</span> : <span className="text-muted">--</span>}
      </td>
      <td className="whitespace-pre-line px-4 py-2.5 text-muted">{job.startedAtLabel}</td>
      <td className="px-4 py-2.5 text-muted">{job.durationLabel}</td>
      <td className="px-4 py-2.5 text-muted">{job.updatedAtLabel}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-3">
          <button
            className="text-sm font-bold text-accent"
            type="button"
            title="View run"
            onClick={() => actions.viewJob(job)}
          >
            View
          </button>
          {job.statusKey === "failed" ? (
            <button
              className="text-sm font-bold text-accent disabled:opacity-50"
              type="button"
              title="Retry endpoint is not available yet if backend returns 404."
              disabled={busyRetry}
              onClick={() => actions.retryJob(job)}
            >
              {busyRetry ? "Retrying" : "Retry"}
            </button>
          ) : null}
          {job.reviewRequired ? (
            <button
              className="text-sm font-bold text-accent disabled:opacity-50"
              type="button"
              title="Send to Review endpoint is not available yet if backend returns 404."
              disabled={busyReview}
              onClick={() => actions.sendToReview(job)}
            >
              {busyReview ? "Sending" : "Send to Review"}
            </button>
          ) : null}
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            type="button"
            title="Delete run"
            disabled={busyDelete}
            onClick={() => actions.deleteJob(job)}
          >
            {busyDelete ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function JobStatusPill({ job }: { job: Job }) {
  if (job.status === "Completed") return <StatusPill status="completed">Completed</StatusPill>;
  if (job.status === "Review Required") return <StatusPill status="review">Review Required</StatusPill>;
  if (job.status === "Failed" || job.status === "Cancelled") return <StatusPill status="failed">{job.status}</StatusPill>;
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
  label,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1.5 text-[11px] font-bold text-muted">{label}</span>
      <select
        aria-label={ariaLabel}
        className="h-10 min-w-[145px] appearance-none rounded-md border border-border bg-white px-3 pb-1.5 pt-5 text-sm font-semibold text-ink shadow-panel outline-none transition focus:border-accent"
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

function averageLatency(jobs: Job[]) {
  const values = jobs.map((job) => job.durationMs).filter((value): value is number => value !== null);
  if (!values.length) return "--";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average < 1000 ? `${Math.round(average)} ms` : `${(average / 1000).toFixed(1)}s`;
}

function dateRangeLabel(value: string) {
  if (value === "today") return "Today";
  if (value === "7d") return "Last 7 days";
  if (value === "30d") return "Last 30 days";
  return "All dates";
}

function sparklineFromCount(count: number) {
  if (count <= 0) return [0, 0, 0, 0, 0, 0, 0];
  return [0, 0, 0, 0, 0, 0, count];
}
