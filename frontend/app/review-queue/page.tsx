"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { getJobSummaries, pct, shortId, type JobSummary } from "@/lib/api";
import { JsonBlock } from "@/components/ui/json-block";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ReviewQueuePage() {
  const [summaries, setSummaries] = useState<JobSummary[]>([]);
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected">>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJobSummaries().then(setSummaries).catch((err) => setError(err instanceof Error ? err.message : "Unable to load review queue."));
  }, []);

  const items = useMemo(
    () =>
      summaries
        .filter(({ job, quality }) => job.status === "review_required" || quality?.human_review_required)
        .map(({ job, quality, assets }) => ({
          id: job.id,
          job,
          quality,
          asset: assets[0],
          reason: quality?.quality_explanation || "Low confidence extraction requires review.",
        })),
    [summaries],
  );

  return (
    <Panel>
      <PanelHeader title="Human Review Queue" />
      {error ? <div className="border-b border-border bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="grid gap-4 p-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">Job {shortId(item.job.id)}</div>
                  <div className="text-xs text-muted">File {shortId(item.job.file_id)}</div>
                </div>
                <StatusBadge value={resolved[item.id] ?? "review_required"} />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Parser" value={item.asset?.parser_used ?? item.job.parser_id ?? "--"} />
                <Field label="Skill" value={item.asset?.skill_used ?? item.job.skill_id ?? "--"} />
                <Field label="Quality score" value={pct(item.quality?.extraction_confidence)} />
                <Field label="Fallback" value={item.asset?.fallback_used ? "Yes" : "No"} />
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {item.reason}
              </div>
              <div className="flex gap-2">
                <button
                  className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-strong"
                  onClick={() => setResolved((current) => ({ ...current, [item.id]: "approved" }))}
                  type="button"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Approve
                </button>
                <button
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-ink hover:bg-surface"
                  onClick={() => setResolved((current) => ({ ...current, [item.id]: "rejected" }))}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Reject
                </button>
              </div>
            </div>
            <JsonBlock value={item.asset?.structured_data || item.asset?.entities || {}} title="Extracted fields" />
          </div>
        ))}
        {!items.length && !error ? <div className="p-4 text-sm text-muted">No low-confidence items are waiting for review.</div> : null}
      </div>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-1 truncate font-medium text-ink" title={value}>{value}</div>
    </div>
  );
}
