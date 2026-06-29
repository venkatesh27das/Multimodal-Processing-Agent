"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Send,
  Star,
} from "lucide-react";
import {
  agentApi,
  type AgentTaskDetail,
} from "@/api/agent";
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
import { AgentTracePanel } from "@/components/agent-trace-panel";
import { ActionButton, Card, FileTypeIcon, Tag } from "@/components/design-system";

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
  const [agentTask, setAgentTask] = useState<AgentTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
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
        setAgentTask(await agentApi.findTaskByJobId(job.id).catch(() => null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job detail.");
        setData(null);
        setAgentTask(null);
      }
    }
    load();
  }, [params.job_id]);

  const detail = data;
  const firstAsset = detail?.assets[0] ?? null;
  const qualityScore = pct(detail?.quality?.extraction_confidence ?? detail?.quality?.parser_confidence ?? null);
  const qualityValue = Math.round((detail?.quality?.extraction_confidence ?? detail?.quality?.parser_confidence ?? 0) * 100);
  const fileName = detail?.file?.original_filename ?? `File ${shortId(detail?.job.file_id ?? params.job_id)}`;
  const parser = detail?.plan?.selected_parser_id ?? detail?.job.parser_id ?? firstAsset?.parser_used ?? "Not selected";
  const fallback = detail?.plan?.fallback_parser_id ?? null;
  const skill = detail?.plan?.selected_skill_id ?? detail?.job.skill_id ?? firstAsset?.skill_used ?? null;
  const duration = formatDurationLabel(firstAsset?.latency_ms ?? null);
  const profileTag = formatProfileTag(detail?.profile?.file_type ?? detail?.file?.file_type);
  const uploadedAt = formatDateTime(detail?.file?.uploaded_at ?? detail?.job.created_at);
  const completedAt = formatDateTime(detail?.job.updated_at);
  const pages = detail?.profile?.page_count === null || detail?.profile?.page_count === undefined
    ? "--"
    : String(detail.profile.page_count);
  const language = detail?.profile?.language ?? "--";
  const fallbackDetail = fallback ? "with fallback" : "no fallback";
  const reviewDecision = detail?.quality?.human_review_required ? "Needs review" : "Auto-accepted";
  const reviewTone = detail?.quality?.human_review_required ? "text-warning" : "text-success";
  const parsedText = firstAsset?.parsed_text?.trim() || null;
  const entities = firstAsset?.entities ?? [];
  const tables = firstAsset?.tables ?? [];

  if (!detail) {
    return (
      <Card className="p-4 text-sm text-muted">
        {error ? `Unable to load job detail: ${error}` : "Loading job detail..."}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted">
            <Link className="hover:text-accent" href="/jobs">Jobs</Link>
            <span>›</span>
            <span className="font-bold text-accent">{detail.job.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <FileTypeIcon type={detail.file?.file_type ?? "pdf"} />
            <div>
              <h2 className="text-xl font-bold text-ink">{fileName}</h2>
              <p className="mt-1 text-sm text-muted">
                {(detail.file?.file_type ?? "unknown").toUpperCase()} · {formatBytes(detail.file?.size_bytes ?? 0)} · Uploaded {uploadedAt}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric icon={CheckCircle2} label="Status" value={formatLabel(detail.job.status)} detail={`Updated ${completedAt}`} tone="success" />
          <HeroMetric icon={Star} label="Quality Score" value={qualityScore} detail={detail.quality?.quality_status ? formatLabel(detail.quality.quality_status) : "Not evaluated"} tone="info" />
          <HeroMetric icon={GitBranch} label="Parser Strategy" value={parser} detail={fallbackDetail} tone="purple" />
          <HeroMetric icon={Clock3} label="Duration" value={duration} detail="Recorded parser latency" tone="warning" />
        </div>
      </div>

      <div className="flex gap-8 border-b border-border text-sm font-bold">
        {["Overview", "Outputs", "Lineage", "Audit"].map((tab, index) => (
          <span key={tab} className={`pb-3 ${index === 0 ? "border-b-2 border-accent text-accent" : "text-muted"}`}>{tab}</span>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <Card className="p-4">
            <SectionTitle title="File Metadata" action={<ActionButton icon={Copy} variant="secondary">Edit</ActionButton>} />
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label="File Name" value={fileName} />
              <DetailRow label="File Type" value={detail.file?.mime_type ?? "application/pdf"} />
              <DetailRow label="File Size" value={formatBytes(detail.file?.size_bytes ?? 0)} />
              <DetailRow label="Pages" value={pages} />
              <DetailRow label="Language" value={language} />
              <DetailRow label="Uploaded By" value={detail.file?.created_by ?? "--"} />
              <DetailRow label="Source" value={detail.file?.source ?? "Upload"} />
              <DetailRow label="Checksum" value={detail.file?.checksum_sha256 ? shortId(detail.file.checksum_sha256) : "--"} />
            </dl>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Detected Document Profile" action={<Tag tone="success">{profileTag}</Tag>} />
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label="Modalities" value={detail.profile?.modalities?.join(", ") || "--"} />
              <DetailRow label="Layout" value={formatLabel(detail.profile?.layout_complexity ?? "--")} />
              <DetailRow label="Tables" value={formatLikelihood(detail.profile?.table_likelihood)} />
              <DetailRow label="Images" value={formatLikelihood(detail.profile?.image_likelihood)} />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Text Layer</dt>
                <dd className="flex items-center gap-3 font-semibold text-ink">
                  {detail.profile?.has_text_layer === null || detail.profile?.has_text_layer === undefined
                    ? "--"
                    : detail.profile.has_text_layer ? "Detected" : "Not detected"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card className="p-4">
          <SectionTitle title="Parsing Plan & Execution" />
          <div className="mt-3 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-md border border-border">
              {[
                ["Primary Parser (Selected)", parser, "Selected"],
                ["Fallback Parser", fallback ?? "No fallback", ""],
                ["Skill Used", skill ?? "No skill selected", ""],
              ].map(([label, value, badge]) => (
                <div key={label} className="border-b border-border p-4 last:border-b-0">
                  <p className="text-xs font-bold text-muted">{label}</p>
                  <p className="mt-1 font-bold text-ink">{value}</p>
                  {badge ? <Tag tone="success">{badge}</Tag> : null}
                </div>
              ))}
              <div className="p-4 text-sm">
                <p className="font-bold text-ink">Reasoning Summary</p>
                <p className="mt-2 text-muted">
                  {detail.plan?.decision_reason ?? detail.profile?.recommended_parsing_strategy ?? "No planner rationale was recorded for this job."}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                ["Intake", "File received", uploadedAt, "success"],
                ["Profiling", detail.profile ? "Document profile recorded" : "Profile pending", uploadedAt, detail.profile ? "success" : "warning"],
                ["Parsing", `${parser} executed`, completedAt, "success"],
                ["Validation", detail.quality?.quality_explanation ?? "Quality report pending", completedAt, detail.quality ? "success" : "warning"],
                ["Fallback Check", fallback ? `${fallback} available` : "No fallback required", completedAt, fallback ? "warning" : "success"],
                ["Publish", firstAsset ? "Outputs published" : "No asset published yet", firstAsset ? formatDateTime(firstAsset.created_at) : completedAt, firstAsset ? "success" : "warning"],
              ].map(([title, text, time, tone]) => (
                <div key={title} className="grid grid-cols-[20px_1fr_auto] gap-3 text-sm">
                  {tone === "warning" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                  <div>
                    <p className="font-bold text-ink">{title}</p>
                    <p className="text-xs text-muted">{text}</p>
                  </div>
                  <span className="text-xs text-muted">{time}</span>
                </div>
              ))}
              <ActionButton variant="secondary">View Full Execution Log</ActionButton>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <SectionTitle title="Quality Report" action={<span className="text-xs font-bold text-info">How is this score calculated?</span>} />
            <div className="mt-4 space-y-4">
              <QualityBar label="Completeness" value={scoreToPercent(detail.quality?.completeness_score)} />
              <QualityBar label="Consistency" value={scoreToPercent(detail.quality?.consistency_score)} />
              <QualityBar label="Confidence" value={qualityValue} />
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Overall Quality Score</span>
                  <span className="flex items-center gap-2 text-xl font-bold text-success"><Star className="h-5 w-5" /> {qualityScore}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted">Review Decision</span>
                  <span className={`font-bold ${reviewTone}`}>{reviewDecision}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Quick Actions" />
            <div className="mt-3 space-y-2">
              <QuickAction icon={FolderOpen} title="Open Assets" detail="View extracted outputs" href="/assets" />
              <QuickAction icon={RefreshCw} title="Retry Job" detail="Re-run parsing for this file" href="/jobs" />
              <QuickAction icon={Send} title="Send to Review" detail="Add to review queue" href="/review-queue" />
            </div>
          </Card>
        </div>
      </div>

      {agentTask ? <AgentTracePanel task={agentTask} /> : null}

      <Card className="p-4">
        <SectionTitle title="Outputs Preview" />
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
          <PreviewPanel title="Extracted Text (Preview)" action="View full text">
            <pre className="max-h-44 overflow-hidden whitespace-pre-wrap rounded-md bg-surface p-3 font-mono text-xs text-ink">
              {parsedText ?? "No text preview is available for this asset yet."}
            </pre>
          </PreviewPanel>
          <PreviewPanel title={`Entities (${entities.length})`} action="View all">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(entities.length ? entities.slice(0, 10).map(entityLabel) : ["No entities extracted"]).map((item, index) => (
                <span key={item} className={`rounded-md px-2 py-1 font-semibold ${index % 3 === 0 ? "bg-purple-soft text-purple" : index % 3 === 1 ? "bg-success-soft text-success" : "bg-info-soft text-info"}`}>{item}</span>
              ))}
            </div>
          </PreviewPanel>
          <PreviewPanel title={`Tables (${tables.length})`} action="View all">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted">
                <tr>{tableHeaders(tables[0]).map((header) => <th key={header} className="p-2">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableRows(tables[0]).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="p-2">{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </PreviewPanel>
        </div>
      </Card>
    </div>
  );
}

function HeroMetric({ detail, icon: Icon, label, tone, value }: { detail: string; icon: typeof CheckCircle2; label: string; tone: "success" | "info" | "purple" | "warning"; value: string }) {
  const classes = {
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
    purple: "bg-purple-soft text-purple",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <Card className="min-w-[220px] p-4">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-md ${classes[tone]}`}><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-xs font-bold text-muted">{label}</p>
          <p className="text-lg font-bold text-ink">{value}</p>
          <p className="text-xs text-muted">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ action, title }: { action?: React.ReactNode; title: string }) {
  return <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink">{title}</h3>{action}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="truncate font-semibold text-ink">{value}</dd></div>;
}

function QualityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="h-1.5 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-success" style={{ width: `${value}%` }} /></span>
      <span className="font-semibold text-ink">{value}%</span>
    </div>
  );
}

function QuickAction({ detail, href, icon: Icon, title }: { detail: string; href: string; icon: typeof FolderOpen; title: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-surface">
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-info-soft text-info"><Icon className="h-4 w-4" /></span>
        <span><span className="block font-bold text-ink">{title}</span><span className="text-xs text-muted">{detail}</span></span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted" />
    </Link>
  );
}

function PreviewPanel({ action, children, title }: { action: string; children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-ink">{title}</p><span className="text-xs font-bold text-info">{action}</span></div>
      {children}
    </div>
  );
}

function formatDurationLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  if (value < 60_000) return formatMs(value);
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLikelihood(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${Math.round(value * 100)}%`;
}

function formatProfileTag(value: string | null | undefined) {
  return value ? value.toUpperCase() : "Profile";
}

function scoreToPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function entityLabel(entity: Record<string, unknown>) {
  const value = entity.name ?? entity.text ?? entity.value ?? entity.label ?? entity.id;
  return typeof value === "string" && value.trim() ? value : "Entity";
}

function tableHeaders(table: Record<string, unknown> | undefined) {
  const rows = tableRows(table);
  if (!rows.length) return ["Output"];
  return rows[0].map((_, index) => `Column ${index + 1}`);
}

function tableRows(table: Record<string, unknown> | undefined) {
  const rows = table?.rows;
  if (!Array.isArray(rows) || !rows.length) return [["No tables extracted"]];
  return rows.slice(0, 5).map((row) => {
    if (!Array.isArray(row)) return [stringifyCell(row)];
    return row.map(stringifyCell);
  });
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
