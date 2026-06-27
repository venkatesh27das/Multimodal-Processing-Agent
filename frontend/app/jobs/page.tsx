"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatMs, getJobSummaries, pct, shortId, type JobSummary } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs() {
    setLoading(true);
    setError(null);
    try {
      setJobs(await getJobSummaries());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <Panel>
      <PanelHeader
        title="Parse Jobs"
        action={
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-ink hover:bg-surface"
            onClick={loadJobs}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        }
      />
      {error ? <div className="border-b border-border bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Job</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Parser selected</th>
              <th className="px-4 py-3 font-semibold">Skill selected</th>
              <th className="px-4 py-3 font-semibold">Quality score</th>
              <th className="px-4 py-3 font-semibold">Fallback</th>
              <th className="px-4 py-3 font-semibold">Review</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map(({ job, quality, assets }) => {
              const firstAsset = assets[0];
              return (
                <tr key={job.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link className="font-semibold text-ink hover:text-accent-strong" href={`/jobs/${job.id}`}>
                      {shortId(job.id)}
                    </Link>
                    <div className="text-xs text-muted">{shortId(job.file_id)}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={job.status} /></td>
                  <td className="px-4 py-3 text-muted">{job.parser_id ?? firstAsset?.parser_used ?? "--"}</td>
                  <td className="px-4 py-3 text-muted">{job.skill_id ?? firstAsset?.skill_used ?? "--"}</td>
                  <td className="px-4 py-3 font-medium">{pct(quality?.extraction_confidence)}</td>
                  <td className="px-4 py-3 text-muted">{firstAsset?.fallback_used ? "Yes" : "No"}</td>
                  <td className="px-4 py-3"><StatusBadge value={quality?.human_review_required ? "review_required" : "passed"} /></td>
                  <td className="px-4 py-3 text-muted">{formatMs(firstAsset?.latency_ms)}</td>
                </tr>
              );
            })}
            {!loading && !jobs.length ? (
              <tr><td className="px-4 py-10 text-center text-sm text-muted" colSpan={8}>No parse jobs have been created yet.</td></tr>
            ) : null}
            {loading ? (
              <tr><td className="px-4 py-10 text-center text-sm text-muted" colSpan={8}>Loading jobs...</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
