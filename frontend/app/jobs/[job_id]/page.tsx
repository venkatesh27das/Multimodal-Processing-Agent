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
import { ActionButton, Card, FileTypeIcon, Tag } from "@/components/design-system";

type DetailState = {
  job: ParseJob;
  plan: ParsingPlan | null;
  quality: QualityReport | null;
  assets: ParsedAsset[];
  file: FileRecord | null;
  profile: FileProfile | null;
  demo?: boolean;
};

export default function JobDetailPage({ params }: { params: { job_id: string } }) {
  const [data, setData] = useState<DetailState | null>(null);
  const [agentTask, setAgentTask] = useState<AgentTaskDetail | null>(null);

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
        setAgentTask(await agentApi.findTaskByJobId(job.id).catch(() => null));
      } catch (err) {
        setData(demoDetail(params.job_id));
        setAgentTask(null);
      }
    }
    load();
  }, [params.job_id]);

  const detail = data;
  const qualityScore = pct(detail?.quality?.extraction_confidence ?? 0.92);
  const fileName = detail?.file?.original_filename ?? "Master Services Agreement.pdf";
  const parser = detail?.plan?.selected_parser_id ?? detail?.job.parser_id ?? "Contract Parser v3";
  const fallback = detail?.plan?.fallback_parser_id ?? "Financial Parser v2";
  const duration = formatDurationLabel(detail?.assets[0]?.latency_ms ?? 122000);

  if (!detail) {
    return <Card className="p-4 text-sm text-muted">Loading job detail...</Card>;
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
                {(detail.file?.file_type ?? "PDF").toUpperCase()} · {formatBytes(detail.file?.size_bytes ?? 2_400_000)} · Uploaded Mar 24, 2025 10:14 AM
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric icon={CheckCircle2} label="Status" value="Completed" detail="Completed Mar 24, 2025 10:16 AM" tone="success" />
          <HeroMetric icon={Star} label="Quality Score" value={qualityScore} detail="High quality" tone="info" />
          <HeroMetric icon={GitBranch} label="Parser Strategy" value={parser} detail="with 1 fallback" tone="purple" />
          <HeroMetric icon={Clock3} label="Duration" value={duration} detail="Avg for similar: 1m 48s" tone="warning" />
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
              <DetailRow label="File Size" value={formatBytes(detail.file?.size_bytes ?? 2_400_000)} />
              <DetailRow label="Pages" value={String(detail.profile?.page_count ?? 24)} />
              <DetailRow label="Language" value={detail.profile?.language ?? "English"} />
              <DetailRow label="Uploaded By" value="Jane Thompson" />
              <DetailRow label="Source" value={detail.file?.source ?? "Upload"} />
              <DetailRow label="Checksum" value={shortId(detail.file?.checksum_sha256 ?? "4b8d7f2c1e9a")} />
            </dl>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Detected Document Profile" action={<Tag tone="success">Contract</Tag>} />
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label="Document Type" value="Master Services Agreement" />
              <DetailRow label="Subtype" value="Services Agreement" />
              <DetailRow label="Industry" value="Technology" />
              <DetailRow label="Jurisdiction" value="Delaware, USA" />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Confidence</dt>
                <dd className="flex items-center gap-3 font-semibold text-ink">
                  94%
                  <span className="h-1.5 w-24 rounded-full bg-slate-100"><span className="block h-full w-[94%] rounded-full bg-success" /></span>
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
                ["Fallback Parser", fallback, ""],
                ["Skill Used", detail.plan?.selected_skill_id ?? "Contract & Clause Extraction", ""],
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
                  Document classified as a Services Agreement based on structural cues, payment terms, and language patterns.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                ["Intake", "File received and queued", "10:14:01 AM", "success"],
                ["Profiling", "Document profiled successfully", "10:14:07 AM", "success"],
                ["Parsing", `${parser} executed`, "10:14:18 AM", "success"],
                ["Validation", "Output validated", "10:15:28 AM", "success"],
                ["Fallback Check", "No fallback required", "10:15:34 AM", "warning"],
                ["Publish", "Outputs published", "10:16:03 AM", "success"],
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
              <QualityBar label="Completeness" value={94} />
              <QualityBar label="Consistency" value={90} />
              <QualityBar label="Confidence" value={92} />
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Overall Quality Score</span>
                  <span className="flex items-center gap-2 text-xl font-bold text-success"><Star className="h-5 w-5" /> {qualityScore}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted">Review Decision</span>
                  <span className="font-bold text-success">Auto-accepted</span>
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

      {agentTask ? <AgentTraceCard task={agentTask} /> : null}

      <Card className="p-4">
        <SectionTitle title="Outputs Preview" />
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
          <PreviewPanel title="Extracted Text (Preview)" action="View full text">
            <pre className="max-h-44 overflow-hidden whitespace-pre-wrap rounded-md bg-surface p-3 font-mono text-xs text-ink">
{`THIS MASTER SERVICES AGREEMENT ("Agreement") is made and entered into as of March 1, 2025 by and between Acme Corporation, a Delaware corporation with principal place of business at 123 Market Street, San Francisco, CA 94105...`}
            </pre>
          </PreviewPanel>
          <PreviewPanel title="Entities (Top 10)" action="View all">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["Acme Corporation", "Globex Solutions, LLC", "March 1, 2025", "$1,250,000", "Exhibit A", "San Francisco, CA", "Austin, TX", "Delaware", "12 months", "Confidential Information"].map((item, index) => (
                <span key={item} className={`rounded-md px-2 py-1 font-semibold ${index % 3 === 0 ? "bg-purple-soft text-purple" : index % 3 === 1 ? "bg-success-soft text-success" : "bg-info-soft text-info"}`}>{item}</span>
              ))}
            </div>
          </PreviewPanel>
          <PreviewPanel title="Tables (2)" action="View all">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted">
                <tr><th className="p-2">Milestone</th><th className="p-2">Description</th><th className="p-2">Amount</th><th className="p-2">Due Date</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["1", "Project Kickoff", "$250,000", "Net 15"],
                  ["2", "Phase 1 Delivery", "$500,000", "Net 15"],
                  ["3", "Phase 2 Delivery", "$500,000", "Net 15"],
                ].map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell} className="p-2">{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </PreviewPanel>
        </div>
      </Card>
    </div>
  );
}

function AgentTraceCard({ task }: { task: AgentTaskDetail }) {
  const reasoning = task.artifacts.find((artifact) => artifact.kind === "agent_reasoning");
  return (
    <Card className="p-4">
      <SectionTitle
        title="Agent Plan, Timeline & Reasoning"
        action={<Tag tone={task.status === "completed" ? "success" : task.status === "awaiting_review" ? "warning" : "info"}>{task.status.replace("_", " ")}</Tag>}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <AgentTraceMetric label="Task" value={shortId(task.id)} detail={task.summary ?? "Agent task trace"} />
        <AgentTraceMetric label="Parser" value={task.plan?.selected_parser_id ?? "Pending"} detail={task.plan?.summary ?? "Strategy pending"} />
        <AgentTraceMetric label="Quality" value={task.quality_judgement?.status ?? "Pending"} detail={task.quality_judgement?.summary ?? "Quality pending"} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2">
          {task.steps.length ? task.steps.map((step) => (
            <div key={step.id} className="grid grid-cols-[92px_96px_1fr] gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-bold capitalize text-ink">{step.kind}</span>
              <Tag tone={step.status === "completed" ? "success" : step.status === "skipped" ? "neutral" : "info"}>{step.status}</Tag>
              <span className="text-muted">{step.summary}</span>
            </div>
          )) : <p className="text-sm text-muted">Agent steps will appear after execution starts.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Artifacts</p>
          {task.artifacts.slice(0, 6).map((artifact) => (
            <div key={artifact.id} className="rounded-md border border-border p-2">
              <p className="text-sm font-bold text-ink">{artifact.title}</p>
              <p className="line-clamp-2 text-xs text-muted">{artifact.summary}</p>
            </div>
          ))}
          {!task.artifacts.length ? <p className="text-sm text-muted">No artifacts persisted yet.</p> : null}
        </div>
      </div>
      {reasoning ? (
        <div className="mt-4 rounded-md bg-surface p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Reasoning</p>
          <p className="mt-1 text-sm text-ink">{reasoning.summary}</p>
        </div>
      ) : null}
    </Card>
  );
}

function AgentTraceMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{detail}</p>
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

function demoDetail(jobId: string): DetailState {
  const job: ParseJob = {
    id: jobId,
    file_id: "demo-file-contract",
    status: "complete",
    parser_id: "Contract Parser v3",
    skill_id: "contract_parsing",
    quality_status: "passed",
    created_at: "2025-03-24T10:14:00Z",
    updated_at: "2025-03-24T10:16:00Z",
  };
  return {
    demo: true,
    job,
    file: {
      id: "demo-file-contract",
      original_filename: "Master Services Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      size_bytes: 2_400_000,
      checksum_sha256: "4b8d7f2c1e9a8cc6a7b2e1d9f8a",
      source: "Upload",
      storage_path: "demo",
      status: "complete",
      created_by: "demo",
      uploaded_at: "2025-03-24T10:14:00Z",
    },
    profile: {
      id: "demo-profile",
      file_id: "demo-file-contract",
      file_type: "pdf",
      modalities: ["text"],
      has_text_layer: true,
      is_scanned: false,
      page_count: 24,
      table_likelihood: 0.42,
      image_likelihood: 0.12,
      language: "English",
      layout_complexity: "medium",
      estimated_cost_class: "standard",
      recommended_parsing_strategy: "Contract parser with layout-aware validation.",
      created_at: "2025-03-24T10:14:00Z",
    },
    plan: {
      id: "demo-plan",
      job_id: job.id,
      file_id: job.file_id,
      selected_parser_id: "Contract Parser v3",
      fallback_parser_id: "Financial Parser v2",
      selected_skill_id: "Contract & Clause Extraction",
      output_contract: { parsed_text: true, tables: true, entities: true },
      expected_assets: ["text", "tables", "entities"],
      quality_threshold: 0.85,
      cost_profile: { estimate: 0.18 },
      human_review_policy: { auto_accept_above: 0.9 },
      decision_reason: "Selected based on document profile and clause density.",
      created_at: "2025-03-24T10:14:07Z",
    },
    quality: {
      id: "demo-quality",
      job_id: job.id,
      execution_result_id: null,
      quality_status: "passed",
      parser_confidence: 0.92,
      extraction_confidence: 0.92,
      schema_validation_score: 0.91,
      completeness_score: 0.94,
      consistency_score: 0.9,
      human_review_required: false,
      quality_explanation: "High quality extraction with no review required.",
      created_at: "2025-03-24T10:16:00Z",
    },
    assets: [{ asset_id: "asset-demo", id: "asset-demo", job_id: job.id, file_id: job.file_id, asset_type: "document", parser_used: "Contract Parser v3", fallback_used: false, skill_used: "Contract & Clause Extraction", latency_ms: 122000, document_metadata: {}, parsed_text: null, layout_blocks: [], tables: [], image_descriptions: [], audio_transcript: null, video_transcript: null, chunks: [], embeddings: [], entities: [], relationships: [], evidence_spans: [], quality_report: { extraction_confidence: 0.92 }, lineage: {}, cost_estimate: {}, audit_trail: [], structured_data: {}, created_at: "2025-03-24T10:16:00Z" }],
  };
}
