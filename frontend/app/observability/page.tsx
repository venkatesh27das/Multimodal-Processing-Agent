"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, DollarSign, FileCheck2, Gauge, RotateCcw, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatMs, getJobSummaries, pct, shortId, type JobSummary } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ObservabilityPage() {
  const [summaries, setSummaries] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJobSummaries().then(setSummaries).catch((err) => setError(err instanceof Error ? err.message : "Unable to load observability metrics."));
  }, []);

  const metrics = useMemo(() => {
    const total = summaries.length;
    const completed = summaries.filter(({ job }) => job.status === "complete").length;
    const assets = summaries.flatMap((summary) => summary.assets);
    const fallback = assets.filter((asset) => asset.fallback_used).length;
    const review = summaries.filter(({ job, quality }) => job.status === "review_required" || quality?.human_review_required).length;
    const qualityValues = summaries.map(({ quality }) => quality?.extraction_confidence).filter((value): value is number => typeof value === "number");
    const latencyValues = assets.map((asset) => asset.latency_ms).filter((value): value is number => typeof value === "number");
    const costs = assets
      .map((asset) => Number(asset.cost_estimate?.estimated_cost_usd ?? asset.cost_estimate?.estimated_cost ?? 0))
      .filter((value) => Number.isFinite(value));
    return {
      total,
      successRate: total ? completed / total : 0,
      fallbackRate: assets.length ? fallback / assets.length : 0,
      reviewRate: total ? review / total : 0,
      averageQuality: qualityValues.length ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : 0,
      averageLatency: latencyValues.length ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length : 0,
      estimatedCost: costs.reduce((sum, value) => sum + value, 0),
      events: assets.flatMap((asset) => asset.audit_trail.map((event) => ({ asset, event }))).slice(-8).reverse(),
    };
  }, [summaries]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileCheck2} label="Total jobs" value={String(metrics.total)} />
        <Metric icon={Gauge} label="Success rate" value={pct(metrics.successRate)} />
        <Metric icon={RotateCcw} label="Fallback rate" value={pct(metrics.fallbackRate)} />
        <Metric icon={ShieldAlert} label="Review rate" value={pct(metrics.reviewRate)} />
        <Metric icon={Activity} label="Average quality" value={pct(metrics.averageQuality)} />
        <Metric icon={Clock} label="Average latency" value={formatMs(Math.round(metrics.averageLatency))} />
        <Metric icon={DollarSign} label="Estimated cost" value={`$${metrics.estimatedCost.toFixed(4)}`} />
      </div>

      <Panel>
        <PanelHeader title="Recent Audit Events" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Parser</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics.events.map(({ asset, event }, index) => (
                <tr key={`${asset.asset_id}-${index}`} className="hover:bg-surface">
                  <td className="px-4 py-3 font-medium text-ink">{shortId(asset.asset_id)}</td>
                  <td className="px-4 py-3 text-muted">{String(event.event_type ?? event.action ?? "asset_event")}</td>
                  <td className="px-4 py-3 text-muted">{asset.parser_used}</td>
                  <td className="px-4 py-3"><StatusBadge value={String(event.status ?? "complete")} /></td>
                </tr>
              ))}
              {!metrics.events.length ? <tr><td className="px-4 py-8 text-sm text-muted" colSpan={4}>No audit events are available yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-muted">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent-strong">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
