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
import { useEffect, useState } from "react";
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
  Tag,
} from "@/components/design-system";
import { getHomeMetrics, getRecentJobs, type HomeMetrics, type RecentJobView } from "@/lib/enterprise-data";

const spark = [12, 18, 16, 22, 20, 25, 23, 27, 26];

export default function HomePage() {
  const [metrics, setMetrics] = useState<HomeMetrics>({
    jobsToday: 128,
    successRate: 0.926,
    reviewRequired: 23,
    avgQuality: 0.87,
  });
  const [jobs, setJobs] = useState<RecentJobView[]>([]);

  useEffect(() => {
    getHomeMetrics().then(setMetrics);
    getRecentJobs().then(setJobs);
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard icon={FileText} label="Jobs Today" value={String(metrics.jobsToday)} delta="↑ 18% vs yesterday" tone="accent" data={spark} />
        <MetricCard icon={CheckCircle2} label="Success Rate" value={`${Math.round(metrics.successRate * 1000) / 10}%`} delta="↑ 4.3% vs yesterday" tone="success" data={[8, 11, 14, 10, 16, 9, 13, 12, 15]} />
        <MetricCard icon={AlertTriangle} label="Review Required" value={String(metrics.reviewRequired)} delta="↓ 8 vs yesterday" tone="warning" data={[7, 9, 8, 11, 9, 10, 11, 10, 12]} />
        <MetricCard icon={Star} label="Avg Quality" value={`${Math.round(metrics.avgQuality * 100)}%`} delta="↑ 2.1% vs yesterday" tone="info" data={[6, 7, 6, 9, 7, 8, 10, 9, 11]} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
        <Card className="border-accent/50 p-5">
          <SectionHeader title="Start Parsing" description="Upload any document, image, audio, or video to extract structured insights." />
          <Link href="/parse" className="mt-5 flex min-h-[158px] flex-col items-center justify-center rounded-lg border border-dashed border-accent/50 bg-orange-50/40 p-5 text-center">
            <FileText className="h-8 w-8 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-ink">Drag & drop files here</p>
            <p className="mt-1 text-xs text-muted">or click to browse</p>
            <p className="mt-3 text-xs text-muted">Supports PDF, DOCX, TXT, PNG, JPG, MP3, MP4 and more</p>
          </Link>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/parse">
              <ActionButton className="w-full" icon={Play}>Start Parsing</ActionButton>
            </Link>
            <ActionButton className="w-full" variant="secondary">Use Template</ActionButton>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Quick Templates" description="Jumpstart common parsing workflows." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { title: "General Parsing", description: "Extract text, tables, entities", icon: FileText, className: "bg-accent-soft text-accent" },
              { title: "Invoice Extraction", description: "Invoices, receipts, bills", icon: ShieldCheck, className: "bg-success-soft text-success" },
              { title: "Contract Parsing", description: "Contracts and agreements", icon: FileText, className: "bg-info-soft text-info" },
              { title: "Research Paper", description: "Papers, journals, articles", icon: FileText, className: "bg-purple-soft text-purple" },
              { title: "Audio/Video Transcript", description: "Transcribe and summarize", icon: Gauge, className: "bg-info-soft text-info" },
              { title: "Graph-ready Extraction", description: "Entities and relationships", icon: Network, className: "bg-warning-soft text-warning" },
            ].map(({ title, description, icon: Icon, className }) => (
              <button key={String(title)} className="flex items-center justify-between rounded-lg border border-border bg-white p-3 text-left hover:bg-surface" type="button">
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
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Needs Attention" action={<span className="rounded-full bg-danger-soft px-2 py-1 text-xs font-bold text-danger">3</span>} />
          <div className="mt-4 space-y-3">
            {[
              { title: "Pending Review", description: "Human-in-the-loop items", count: "23", icon: AlertTriangle, className: "bg-warning-soft text-warning" },
              { title: "Failed Jobs", description: "Jobs that need attention", count: "7", icon: AlertTriangle, className: "bg-danger-soft text-danger" },
              { title: "Parser Health", description: "Degraded or unhealthy parsers", count: "2", icon: TimerReset, className: "bg-warning-soft text-warning" },
            ].map(({ title, description, count, icon: Icon, className }) => (
              <div key={String(title)} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-lg ${className}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{title}</p>
                    <p className="text-xs text-muted">{description}</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-ink">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <SectionHeader title="Recent Jobs" />
            <Link href="/jobs"><ArrowLink>View all jobs</ArrowLink></Link>
          </div>
          <DataTable columns={["Job / File", "Parser", "Status", "Quality", "Last Updated", "Actions"]} minWidth="860px">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileTypeIcon type={job.meta} />
                    <div>
                      <p className="font-bold text-ink">{job.name}</p>
                      <p className="text-xs text-muted">{job.meta}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{job.parser}</td>
                <td className="px-4 py-3"><StatusPill status={job.status === "completed" ? "completed" : job.status === "review" ? "review" : job.status === "failed" ? "failed" : "queued"}>{job.status === "review" ? "Review Required" : job.status}</StatusPill></td>
                <td className="px-4 py-3 font-semibold text-ink">{job.quality}</td>
                <td className="px-4 py-3 text-muted">{job.updated}</td>
                <td className="px-4 py-3"><Link className="font-bold text-accent" href="/jobs">View</Link></td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card className="p-5">
          <SectionHeader title="System Insights" action={<span className="text-xs text-muted">Last 7 days</span>} />
          <div className="mt-5 grid grid-cols-[1fr_1px_1fr] gap-5">
            <div>
              <p className="text-xs font-bold text-muted">Throughput</p>
              <p className="mt-3 text-2xl font-bold text-ink">1,248</p>
              <p className="text-xs text-muted">jobs processed</p>
              <div className="mt-4"><Sparkline data={[12, 16, 15, 18, 20, 18, 17, 21, 24]} tone="info" /></div>
            </div>
            <div className="bg-border" />
            <div>
              <p className="text-xs font-bold text-muted">Top File Types</p>
              <div className="mt-4 space-y-2">
                {["PDF 45%", "DOCX 24%", "PNG/JPG 15%", "XLSX 8%", "Other 8%"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink"><span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-accent" : index === 1 ? "bg-success" : index === 2 ? "bg-info" : index === 3 ? "bg-purple" : "bg-slate-400"}`} />{item.split(" ")[0]}</span>
                    <span className="font-semibold text-muted">{item.split(" ")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-200 bg-success-soft p-3 text-sm text-emerald-800">
            <span className="font-bold">System recommendations enabled</span>
            <p className="text-xs">We are optimizing quality and latency automatically.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
