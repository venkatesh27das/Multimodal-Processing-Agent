"use client";

import Link from "next/link";
import { Clock3, FileCheck2, RefreshCw, Search, ShieldAlert, Star } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ActionButton,
  Card,
  DataTable,
  FileTypeIcon,
  MetricCard,
  MiniBar,
  PageHeader,
  SearchFilterBar,
  SelectField,
  StatusPill,
} from "@/components/design-system";
import { getJobs, type RecentJobView } from "@/lib/enterprise-data";

export default function JobsPage() {
  const [jobs, setJobs] = useState<RecentJobView[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setJobs(await getJobs());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Monitor parsing jobs, review routing decisions, and inspect output quality."
        action={<ActionButton icon={RefreshCw} variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard icon={FileCheck2} label="Total Jobs" value={String(jobs.length || 50)} delta="↑ 12% vs last 7 days" tone="info" data={[8, 10, 9, 12, 14, 13, 15]} />
        <MetricCard icon={Star} label="Avg Quality" value="91.8%" delta="↑ 2.6% vs last 7 days" tone="success" data={[7, 8, 7, 10, 9, 11, 10]} />
        <MetricCard icon={ShieldAlert} label="Review Required" value={String(jobs.filter((job) => job.status === "review").length || 3)} delta="↓ 8 vs last week" tone="warning" data={[5, 4, 6, 4, 3, 5, 3]} />
        <MetricCard icon={Clock3} label="Avg Latency" value="3.2s" delta="↓ 0.3s vs last week" tone="purple" data={[9, 8, 10, 7, 9, 10, 11]} />
      </div>

      <Card className="p-4">
        <SearchFilterBar placeholder="Search jobs, files, parsers...">
          <SelectField value="All Statuses" options={["All Statuses"]} />
          <SelectField value="All Parsers" options={["All Parsers"]} />
          <SelectField value="Last 7 days" options={["Last 7 days"]} />
        </SearchFilterBar>
        <DataTable columns={["Job / File", "Parser", "Status", "Usage", "Quality", "Last Updated", "Actions"]}>
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
              <td className="px-4 py-3">
                <StatusPill status={job.status === "completed" ? "completed" : job.status === "review" ? "review" : job.status === "failed" ? "failed" : "queued"}>
                  {job.status === "review" ? "Review Required" : job.status}
                </StatusPill>
              </td>
              <td className="px-4 py-3"><MiniBar value={Number.parseInt(job.quality, 10) || 12} /></td>
              <td className="px-4 py-3 font-bold text-ink">{job.quality}</td>
              <td className="px-4 py-3 text-muted">{job.updated}</td>
              <td className="px-4 py-3">
                <Link className="font-bold text-accent" href={job.id.startsWith("job-") ? "/jobs" : `/jobs/${job.id}`}>View</Link>
              </td>
            </tr>
          ))}
          {!loading && !jobs.length ? (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No parsing jobs found.</td></tr>
          ) : null}
          {loading ? (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">Loading jobs...</td></tr>
          ) : null}
        </DataTable>
      </Card>
    </div>
  );
}
