"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  FileCheck2,
  Gauge,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  api,
  formatMs,
  pct,
  shortId,
  type AuditEvent,
  type ObservabilitySummary,
  type ParserUsageMetric,
  type QualityMetrics,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type ObservabilityState = {
  summary: ObservabilitySummary;
  parserUsage: ParserUsageMetric[];
  quality: QualityMetrics;
  auditEvents: AuditEvent[];
};

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [summary, parserUsage, quality, audit] = await Promise.all([
          api.getObservabilitySummary(),
          api.getParserUsage(),
          api.getQualityMetrics(),
          api.getAuditEvents(25),
        ]);
        setError(null);
        setData({ summary, parserUsage, quality, auditEvents: audit.events });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load observability metrics.");
      }
    }
    load();
  }, []);

  const summary = data?.summary;
  const quality = data?.quality;

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileCheck2} label="Total jobs" value={String(summary?.jobs.total_jobs ?? 0)} />
        <Metric icon={Gauge} label="Success rate" value={pct(summary?.jobs.success_rate ?? 0)} />
        <Metric icon={RotateCcw} label="Fallback rate" value={pct(summary?.fallback.rate ?? 0)} detail={`${summary?.fallback.count ?? 0} fallback assets`} />
        <Metric icon={ShieldAlert} label="Review rate" value={pct(summary?.review.rate ?? 0)} detail={`${summary?.review.count ?? 0} review items`} />
        <Metric icon={Activity} label="Average quality" value={pct(quality?.average_quality ?? 0)} />
        <Metric icon={Clock} label="Average latency" value={formatMs(Math.round(summary?.latency.average_ms ?? 0))} detail={`p95 ${formatMs(Math.round(summary?.latency.p95_ms ?? 0))}`} />
        <Metric icon={DollarSign} label="Estimated cost" value={`$${(summary?.cost.estimated_cost ?? 0).toFixed(4)}`} />
        <Metric icon={AlertTriangle} label="Error logs" value={String(summary?.error_logs.length ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader title="Parser Usage" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Parser</th>
                  <th className="px-4 py-3 font-semibold">Executions</th>
                  <th className="px-4 py-3 font-semibold">Jobs</th>
                  <th className="px-4 py-3 font-semibold">Success</th>
                  <th className="px-4 py-3 font-semibold">Fallback</th>
                  <th className="px-4 py-3 font-semibold">Confidence</th>
                  <th className="px-4 py-3 font-semibold">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.parserUsage.map((parser) => (
                  <tr key={parser.parser_id} className="hover:bg-surface">
                    <td className="px-4 py-3 font-medium text-ink">{parser.parser_id}</td>
                    <td className="px-4 py-3 text-muted">{parser.execution_count}</td>
                    <td className="px-4 py-3 text-muted">{parser.job_count}</td>
                    <td className="px-4 py-3 text-muted">{parser.success_count}</td>
                    <td className="px-4 py-3 text-muted">{parser.fallback_asset_count}</td>
                    <td className="px-4 py-3 text-muted">{pct(parser.average_confidence)}</td>
                    <td className="px-4 py-3 text-muted">{formatMs(Math.round(parser.average_latency_ms ?? 0))}</td>
                  </tr>
                ))}
                {!data?.parserUsage.length ? <tr><td className="px-4 py-8 text-sm text-muted" colSpan={7}>No parser usage has been recorded yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Quality Distribution" />
          <div className="space-y-4 p-4">
            {quality?.buckets.map((bucket) => {
              const total = quality.buckets.reduce((sum, item) => sum + item.count, 0);
              const width = total ? `${Math.round((bucket.count / total) * 100)}%` : "0%";
              return (
                <div key={bucket.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{bucket.label}</span>
                    <span className="text-muted">{bucket.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full bg-accent" style={{ width }} />
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <Field label="Passed" value={String(quality?.passed ?? 0)} />
              <Field label="Review required" value={String(quality?.review_required ?? 0)} />
              <Field label="Failed" value={String(quality?.failed ?? 0)} />
              <Field label="Not evaluated" value={String(quality?.not_evaluated ?? 0)} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Recent Audit Events" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Entity</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.auditEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{event.entity_type}</div>
                      <div className="text-xs text-muted">{shortId(event.entity_id)}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={event.action} /></td>
                    <td className="px-4 py-3 text-muted">{event.actor}</td>
                    <td className="px-4 py-3 text-muted">{new Date(event.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!data?.auditEvents.length ? <tr><td className="px-4 py-8 text-sm text-muted" colSpan={4}>No audit events are available yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Error Logs" />
          <div className="divide-y divide-border">
            {summary?.error_logs.map((log, index) => (
              <div key={`${log.execution_result_id ?? log.created_at}-${index}`} className="p-4 text-sm">
                <div className="font-medium text-ink">{log.message}</div>
                <div className="mt-1 text-xs text-muted">
                  {log.parser_id ?? "system"} - {log.job_id ? `Job ${shortId(log.job_id)}` : "No job"} - {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {!summary?.error_logs.length ? <div className="p-4 text-sm text-muted">No parser or audit errors recorded.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
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
      {detail ? <div className="mt-1 text-xs text-muted">{detail}</div> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}
