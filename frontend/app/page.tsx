"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gauge,
  Network,
  Play,
  ShieldCheck,
  Star,
  TimerReset,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ActionButton,
  ArrowLink,
  Card,
  DataTable,
  FileTypeIcon,
  MetricCard,
  SectionHeader,
  Sparkline,
  StatusPill,
} from "@/components/design-system";
import type { DashboardSummary, NeedsAttentionSummary, RecentJob, SystemInsights } from "@/api/dashboard";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useNeedsAttention } from "@/hooks/useNeedsAttention";
import { useRecentJobs } from "@/hooks/useRecentJobs";

const quickTemplates: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  className: string;
  href: string;
}> = [
  { title: "General Parsing", description: "Extract text, tables, entities", icon: FileText, className: "bg-accent-soft text-accent", href: "/create-run?objective=general&template=general" },
  { title: "Invoice Extraction", description: "Invoices, receipts, bills", icon: ShieldCheck, className: "bg-success-soft text-success", href: "/create-run?objective=structured&template=invoice_extraction" },
  { title: "Contract Parsing", description: "Contracts and agreements", icon: FileText, className: "bg-info-soft text-info", href: "/create-run?objective=structured&template=contract_parsing" },
  { title: "Research Paper", description: "Papers, journals, articles", icon: FileText, className: "bg-purple-soft text-purple", href: "/create-run?objective=structured&template=research_paper_parsing" },
  { title: "Audio/Video Transcript", description: "Transcribe and summarize", icon: Gauge, className: "bg-info-soft text-info", href: "/create-run?objective=transcript&template=audio_meeting_parsing" },
  { title: "Graph-ready Extraction", description: "Entities and relationships", icon: Network, className: "bg-warning-soft text-warning", href: "/create-run?objective=graph&template=knowledge_graph_preparation" },
];

export default function HomePage() {
  const dashboard = useDashboardSummary();
  const recentJobs = useRecentJobs(6);
  const attention = useNeedsAttention();

  return (
    <div className="space-y-5">
      {dashboard.error ? <ErrorNotice message={dashboard.error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {dashboard.loading || !dashboard.summary ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <KpiRow summary={dashboard.summary} />
        )}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
        <Card className="border-accent/50 p-5">
          <SectionHeader title="Start Parsing" description="Upload any document, image, audio, or video to extract structured insights." />
          <Link href="/create-run" className="mt-5 flex min-h-[158px] flex-col items-center justify-center rounded-lg border border-dashed border-accent/50 bg-orange-50/40 p-5 text-center">
            <FileText className="h-8 w-8 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-ink">Drag & drop files here</p>
            <p className="mt-1 text-xs text-muted">or click to browse</p>
            <p className="mt-3 text-xs text-muted">Supports PDF, DOCX, TXT, PNG, JPG, MP3, MP4 and more</p>
          </Link>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/create-run">
              <ActionButton className="w-full" icon={Play}>Start Parsing</ActionButton>
            </Link>
            <Link href="/create-run?template=general">
              <ActionButton className="w-full" variant="secondary">Use Template</ActionButton>
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Quick Templates" description="Jumpstart common parsing workflows." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickTemplates.map(({ title, description, icon: Icon, className, href }) => (
              <Link key={title} className="flex items-center justify-between rounded-lg border border-border bg-white p-3 text-left hover:bg-surface" href={href}>
                <span className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${className}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{title}</span>
                    <span className="block text-xs text-muted">{description}</span>
                  </span>
                </span>
                <span className="text-lg text-muted">›</span>
              </Link>
            ))}
          </div>
        </Card>

        <NeedsAttentionCard summary={attention.summary} loading={attention.loading} error={attention.error} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_380px]">
        <RecentJobsCard jobs={recentJobs.jobs} loading={recentJobs.loading} error={recentJobs.error} />
        <SystemInsightsCard insights={dashboard.insights} loading={dashboard.loading} error={dashboard.error} />
      </div>
    </div>
  );
}

function KpiRow({ summary }: { summary: DashboardSummary }) {
  return (
    <>
      <MetricCard icon={FileText} label="Runs Today" value={formatCount(summary.jobsToday)} delta={summary.deltas.jobsToday ?? undefined} tone="accent" data={summary.sparklines.jobsToday} />
      <MetricCard icon={CheckCircle2} label="Success Rate" value={formatPercent(summary.successRate)} delta={summary.deltas.successRate ?? undefined} tone="success" data={summary.sparklines.successRate} />
      <MetricCard icon={AlertTriangle} label="Review Required" value={formatCount(summary.reviewRequired)} delta={summary.deltas.reviewRequired ?? undefined} tone="warning" data={summary.sparklines.reviewRequired} />
      <MetricCard icon={Star} label="Avg Quality" value={formatPercent(summary.avgQuality)} delta={summary.deltas.avgQuality ?? undefined} tone="info" data={summary.sparklines.avgQuality} />
    </>
  );
}

function NeedsAttentionCard({
  error,
  loading,
  summary,
}: {
  error: string | null;
  loading: boolean;
  summary: NeedsAttentionSummary | null;
}) {
  const items = [
    { title: "Pending Review", description: "Human-in-the-loop items", count: summary?.pendingReview, icon: AlertTriangle, className: "bg-warning-soft text-warning", href: "/review-queue" },
    { title: "Failed Runs", description: "Runs that need attention", count: summary?.failedJobs, icon: AlertTriangle, className: "bg-danger-soft text-danger", href: "/run-monitor?status=failed" },
    { title: "Parser Health", description: "Degraded or unhealthy parsers", count: summary?.degradedParsers, icon: TimerReset, className: "bg-warning-soft text-warning", href: "/parsers?status=degraded" },
  ];

  return (
    <Card className="p-5">
      <SectionHeader title="Needs Attention" action={<span className="rounded-full bg-danger-soft px-2 py-1 text-xs font-bold text-danger">{loading ? "..." : summary?.totalAttentionItems ?? 0}</span>} />
      {error ? <InlineError message={error} /> : null}
      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            <AttentionSkeleton />
            <AttentionSkeleton />
            <AttentionSkeleton />
          </>
        ) : (
          items.map(({ title, description, count, icon: Icon, className, href }) => (
            <Link key={title} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface" href={href}>
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${className}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{title}</p>
                  <p className="text-xs text-muted">{description}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-ink">{formatCount(count ?? null)}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

function RecentJobsCard({
  error,
  jobs,
  loading,
}: {
  error: string | null;
  jobs: RecentJob[];
  loading: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <SectionHeader title="Recent Runs" />
        <Link href="/run-monitor"><ArrowLink>View all runs</ArrowLink></Link>
      </div>
      {error ? <InlineError message={error} /> : null}
      <DataTable columns={["Run / File", "Parser", "Status", "Quality", "Last Updated", "Actions"]} minWidth="860px">
        {loading ? (
          <>
            <RecentJobSkeleton />
            <RecentJobSkeleton />
            <RecentJobSkeleton />
          </>
        ) : jobs.length ? (
          jobs.map((job) => (
            <tr key={job.id} className="hover:bg-surface">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileTypeIcon type={job.fileType} />
                  <div>
                    <p className="font-bold text-ink">{job.fileName}</p>
                    <p className="text-xs text-muted">{job.meta}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{job.parser}</td>
              <td className="px-4 py-3"><StatusPill status={statusTone(job.status)}>{job.statusLabel}</StatusPill></td>
              <td className="px-4 py-3 font-semibold text-ink">{job.quality}</td>
              <td className="px-4 py-3 text-muted">{job.updated}</td>
              <td className="px-4 py-3"><Link className="font-bold text-accent" href={job.detailHref || "/jobs"}>View</Link></td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-4 py-8 text-center text-sm text-muted" colSpan={6}>No recent runs yet.</td>
          </tr>
        )}
      </DataTable>
    </Card>
  );
}

function SystemInsightsCard({
  error,
  insights,
  loading,
}: {
  error: string | null;
  insights: SystemInsights | null;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <SectionHeader title="System Insights" action={<span className="text-xs text-muted">Last 7 days</span>} />
      {error ? <InlineError message={error} /> : null}
      {loading || !insights ? (
        <div className="mt-5 grid grid-cols-[1fr_1px_1fr] gap-5">
          <InsightSkeleton />
          <div className="bg-border" />
          <InsightSkeleton />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-[1fr_1px_1fr] gap-5">
            <div>
              <p className="text-xs font-bold text-muted">Throughput</p>
              <p className="mt-3 text-2xl font-bold text-ink">{formatCount(insights.throughput)}</p>
              <p className="text-xs text-muted">runs processed</p>
              <div className="mt-4"><Sparkline data={insights.sparkline} tone="info" /></div>
            </div>
            <div className="bg-border" />
            <div>
              <p className="text-xs font-bold text-muted">Top File Types</p>
              <div className="mt-4 space-y-2">
                {insights.topFileTypes.length ? insights.topFileTypes.map((item, index) => (
                  <div key={item.type} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink"><span className={`h-2 w-2 rounded-full ${dotTone(index)}`} />{item.type}</span>
                    <span className="font-semibold text-muted">{item.percent}%</span>
                  </div>
                )) : <p className="text-sm text-muted">No file type data yet.</p>}
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-200 bg-success-soft p-3 text-sm text-emerald-800">
            <span className="font-bold">System recommendations enabled</span>
            <p className="text-xs">{insights.recommendationText}</p>
          </div>
        </>
      )}
    </Card>
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

function AttentionSkeleton() {
  return <div className="h-[66px] animate-pulse rounded-lg border border-border bg-surface" />;
}

function RecentJobSkeleton() {
  return (
    <tr>
      <td className="px-4 py-4" colSpan={6}>
        <div className="h-8 animate-pulse rounded bg-surface" />
      </td>
    </tr>
  );
}

function InsightSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-3 w-24 animate-pulse rounded bg-surface" />
      <div className="h-8 w-20 animate-pulse rounded bg-surface" />
      <div className="h-3 w-28 animate-pulse rounded bg-surface" />
      <div className="h-10 animate-pulse rounded bg-surface" />
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm font-semibold text-red-700">{message}</div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-3 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm text-red-700">{message}</div>;
}

function formatCount(value: number | null): string {
  return value === null ? "--" : value.toLocaleString();
}

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${Math.round(value * 1000) / 10}%`;
}

function statusTone(status: RecentJob["status"]): "completed" | "review" | "failed" | "queued" {
  if (status === "completed") return "completed";
  if (status === "review") return "review";
  if (status === "failed") return "failed";
  return "queued";
}

function dotTone(index: number): string {
  if (index === 0) return "bg-accent";
  if (index === 1) return "bg-success";
  if (index === 2) return "bg-info";
  if (index === 3) return "bg-purple";
  return "bg-slate-400";
}
