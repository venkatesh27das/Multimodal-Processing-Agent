"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import {
  api,
  formatBytes,
  formatMs,
  pct,
  shortId,
  type FileProfile,
  type FileRecord,
  type ParsedAsset,
  type ParseJob,
  type ParsingPlan,
  type QualityReport,
} from "@/lib/api";
import { JsonBlock } from "@/components/ui/json-block";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type DetailState = {
  job: ParseJob;
  plan: ParsingPlan | null;
  quality: QualityReport | null;
  assets: ParsedAsset[];
  file: FileRecord | null;
  profile: FileProfile | null;
};

export default function JobDetailPage({ params }: { params: { job_id: string } }) {
  const [data, setData] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const job = await api.getJob(params.job_id);
        const [plan, quality, assets, file, profile] = await Promise.all([
          api.getJobPlan(job.id).catch(() => null),
          api.getJobQuality(job.id).catch(() => null),
          api.getJobAssets(job.id).catch(() => [] as ParsedAsset[]),
          api.getFile(job.file_id).catch(() => null),
          api.getFileProfile(job.file_id).catch(() => null),
        ]);
        setData({ job, plan, quality, assets, file, profile });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load run.");
      }
    }
    load();
  }, [params.job_id]);

  if (error) return <Panel><div className="p-4 text-sm text-red-700">{error}</div></Panel>;
  if (!data) return <Panel><div className="p-4 text-sm text-muted">Loading run detail...</div></Panel>;

  const { job, plan, quality, assets, file, profile } = data;
  const firstAsset = assets[0];

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong" href="/run-monitor">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Run Monitor
      </Link>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader title="Document Profile" action={<StatusBadge value={job.status} />} />
          <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <Field label="File" value={file?.original_filename ?? shortId(job.file_id)} />
            <Field label="Size" value={formatBytes(file?.size_bytes)} />
            <Field label="File type" value={profile?.file_type ?? file?.file_type ?? "--"} />
            <Field label="MIME type" value={file?.mime_type ?? "--"} />
            <Field label="Modalities" value={profile?.modalities?.join(", ") ?? "--"} />
            <Field label="Pages" value={profile?.page_count?.toString() ?? "--"} />
            <Field label="Text layer" value={profile?.has_text_layer === null ? "--" : profile?.has_text_layer ? "Yes" : "No"} />
            <Field label="Scanned" value={profile?.is_scanned === null ? "--" : profile?.is_scanned ? "Likely" : "Unlikely"} />
            <Field label="Layout complexity" value={profile?.layout_complexity ?? "--"} />
            <Field label="Strategy" value={profile?.recommended_parsing_strategy ?? "--"} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Parser Decision" />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Field label="Primary parser" value={plan?.selected_parser_id ?? job.parser_id ?? "--"} />
              <Field label="Fallback parser" value={plan?.fallback_parser_id ?? "--"} />
              <Field label="Skill" value={plan?.selected_skill_id ?? job.skill_id ?? "--"} />
            </div>
            <div className="rounded-md border border-border bg-surface p-3 text-sm text-ink">
              {plan?.decision_reason ?? "No planner explanation is available yet."}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Parsing Timeline" />
          <ol className="space-y-3 p-4 text-sm">
            <TimelineItem label="Run created" value={new Date(job.created_at).toLocaleString()} />
            <TimelineItem label="Plan selected" value={plan?.selected_parser_id ?? "Pending"} />
            <TimelineItem label="Parser executed" value={firstAsset?.parser_used ?? "Pending"} />
            <TimelineItem label="Quality evaluated" value={quality ? pct(quality.extraction_confidence) : "Pending"} />
            <TimelineItem label="Asset published" value={firstAsset ? shortId(firstAsset.asset_id) : "Pending"} />
          </ol>
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader title="Quality Report" action={<StatusBadge value={quality?.quality_status} />} />
          <div className="grid gap-3 p-4 text-sm sm:grid-cols-3">
            <Field label="Parser confidence" value={pct(quality?.parser_confidence)} />
            <Field label="Extraction confidence" value={pct(quality?.extraction_confidence)} />
            <Field label="Schema validation" value={pct(quality?.schema_validation_score)} />
            <Field label="Completeness" value={pct(quality?.completeness_score)} />
            <Field label="Consistency" value={pct(quality?.consistency_score)} />
            <Field label="Review required" value={quality?.human_review_required ? "Yes" : "No"} />
          </div>
          <div className="border-t border-border p-4 text-sm text-muted">
            {quality?.quality_explanation ?? "Quality has not been evaluated yet."}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Output Assets" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Parser</th>
                <th className="px-4 py-3 font-semibold">Fallback</th>
                <th className="px-4 py-3 font-semibold">Skill</th>
                <th className="px-4 py-3 font-semibold">Latency</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map((asset) => (
                <tr key={asset.asset_id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link className="inline-flex items-center gap-2 font-semibold text-ink hover:text-accent-strong" href={`/assets/${asset.asset_id}`}>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      {shortId(asset.asset_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{asset.parser_used}</td>
                  <td className="px-4 py-3 text-muted">{asset.fallback_used ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-muted">{asset.skill_used ?? "--"}</td>
                  <td className="px-4 py-3 text-muted">{formatMs(asset.latency_ms)}</td>
                  <td className="px-4 py-3 text-muted">{pct(Number(asset.quality_report?.extraction_confidence ?? 0))}</td>
                </tr>
              ))}
              {!assets.length ? <tr><td className="px-4 py-8 text-muted" colSpan={6}>No assets have been published for this run.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {plan ? <JsonBlock data={plan.output_contract} title="Requested output contract" /> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-ink" title={value}>{value}</div>
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="text-muted">{value}</span>
      </span>
    </li>
  );
}
