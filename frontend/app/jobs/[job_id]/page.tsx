"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
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
import { JsonBlock } from "@/components/ui/json-block";

type DetailState = {
  job: ParseJob;
  plan: ParsingPlan | null;
  quality: QualityReport | null;
  assets: ParsedAsset[];
  file: FileRecord | null;
  profile: FileProfile | null;
};

type JobDetailTab = "overview" | "outputs" | "agent_trace" | "lineage" | "audit";

const jobDetailTabs: Array<{ id: JobDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "outputs", label: "Outputs" },
  { id: "agent_trace", label: "Agent Trace" },
  { id: "lineage", label: "Lineage" },
  { id: "audit", label: "Audit" },
];

export default function JobDetailPage({ params }: { params: { job_id: string } }) {
  const [data, setData] = useState<DetailState | null>(null);
  const [agentTask, setAgentTask] = useState<AgentTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("overview");
  const [selectedOutputAsset, setSelectedOutputAsset] = useState<string | null>(null);

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
  const generatedAssets = firstAsset ? generatedAssetItems(firstAsset) : [];
  const selectedOutputKind = selectedOutputAsset ?? generatedAssets[0]?.kind ?? null;
  const showOutputAsset = (kind: string) => {
    setSelectedOutputAsset(kind);
    window.requestAnimationFrame(() => {
      document.getElementById("asset-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
            <Link className="hover:text-accent" href="/jobs">Run History</Link>
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

      <JobDetailTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
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
            <SectionTitle
              title="Parsing Plan & Execution"
              action={<button className="text-xs font-bold text-info" type="button" onClick={() => setActiveTab("agent_trace")}>Open trace</button>}
            />
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
                <ActionButton variant="secondary" onClick={() => setActiveTab("agent_trace")}>View Full Execution Log</ActionButton>
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
              <SectionTitle
                title="Assets Summary"
                action={<button className="text-xs font-bold text-info" type="button" onClick={() => setActiveTab("outputs")}>Open outputs</button>}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {generatedAssets.slice(0, 4).map((asset) => (
                  <div key={asset.kind} className="rounded-md border border-border p-2">
                    <p className="truncate text-xs font-bold text-ink">{asset.label}</p>
                    <p className="mt-1 text-lg font-bold text-ink">{asset.count}</p>
                  </div>
                ))}
                {!generatedAssets.length ? <p className="col-span-2 text-sm text-muted">No published assets yet.</p> : null}
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle title="Quick Actions" />
              <div className="mt-3 space-y-2">
                <QuickAction icon={FolderOpen} title="Open Assets" detail="View extracted outputs" href="/assets" />
                <QuickAction icon={RefreshCw} title="Retry Run" detail="Re-run parsing for this file" href="/jobs" />
                <QuickAction icon={Send} title="Send to Review" detail="Add to review queue" href="/review-queue" />
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "outputs" ? (
        <div className="space-y-3">
          <Card className="p-4">
            <SectionTitle
              title="Outputs Review"
              action={<span className="text-xs font-bold text-muted">{generatedAssets.length} asset types</span>}
            />
            <p className="mt-1 text-sm text-muted">
              Inspect published assets, rendered previews, and machine-readable payloads from this run.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LineageNode label="Parsed Content" value={parsedText ? String(parsedText.length) : "0"} detail="Characters extracted" />
              <LineageNode label="Chunks" value={String(firstAsset?.chunks.length ?? 0)} detail="Retrieval units" />
              <LineageNode label="Entities" value={String(entities.length)} detail="Detected records" />
              <LineageNode label="Tables" value={String(tables.length)} detail="Structured tables" />
            </div>
          </Card>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-3">
              <div id="asset-viewer">
                <Card className="p-4">
                  <SectionTitle
                    title={selectedOutputKind ? formatAssetKind(selectedOutputKind) : "Asset Viewer"}
                    action={<span className="text-xs font-bold text-muted">{selectedOutputKind ? "Selected asset" : "No asset selected"}</span>}
                  />
                  <div className="mt-3">
                    {firstAsset && selectedOutputKind ? (
                      <AssetViewer asset={firstAsset} kind={selectedOutputKind} />
                    ) : (
                      <div className="rounded-md border border-border p-3 text-sm text-muted">
                        No generated asset is available to inspect yet.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <SectionTitle title="Output Previews" />
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <PreviewPanel
                    title="Extracted Text"
                    action="View full text"
                    onAction={() => showOutputAsset("parsed_content")}
                  >
                    <pre className="max-h-40 overflow-hidden whitespace-pre-wrap rounded-md bg-surface p-3 font-mono text-xs text-ink">
                      {parsedText ?? "No text preview is available for this asset yet."}
                    </pre>
                  </PreviewPanel>
                  <PreviewPanel
                    title={`Entities (${entities.length})`}
                    action="View all"
                    onAction={() => showOutputAsset("entities")}
                  >
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(entities.length ? entities.slice(0, 10).map(entityLabel) : ["No entities extracted"]).map((item, index) => (
                        <span key={item} className={`rounded-md px-2 py-1 font-semibold ${index % 3 === 0 ? "bg-purple-soft text-purple" : index % 3 === 1 ? "bg-success-soft text-success" : "bg-info-soft text-info"}`}>{item}</span>
                      ))}
                    </div>
                  </PreviewPanel>
                  <PreviewPanel
                    title={`Tables (${tables.length})`}
                    action="View all"
                    onAction={() => showOutputAsset("tables")}
                  >
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

            <Card className="p-4">
              <SectionTitle title="Generated Assets" />
              <div className="mt-3 space-y-2">
                {generatedAssets.map((asset) => (
                  <OutputAssetListItem
                    key={asset.kind}
                    active={asset.kind === selectedOutputKind}
                    asset={asset}
                    onSelect={() => showOutputAsset(asset.kind)}
                  />
                ))}
                {!generatedAssets.length ? (
                  <div className="rounded-md border border-border p-3 text-sm text-muted">
                    No generated assets have been published for this run yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "agent_trace" ? (
        agentTask ? (
          <AgentTracePanel task={agentTask} />
        ) : (
          <Card className="p-4 text-sm text-muted">
            No agent task trace is linked to this job yet.
          </Card>
        )
      ) : null}

      {activeTab === "lineage" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="p-4">
            <SectionTitle title="Lineage Map" />
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LineageNode label="Source File" value={fileName} detail={shortId(detail.job.file_id)} />
              <LineageNode label="Agent Task" value={agentTask?.id ? shortId(agentTask.id) : "--"} detail={agentTask?.status ? formatLabel(agentTask.status) : "No linked task"} />
              <LineageNode label="Parser" value={parser} detail={fallback ? `Fallback ${fallback}` : "Primary execution"} />
              <LineageNode label="Published Asset" value={firstAsset ? shortId(firstAsset.id) : "--"} detail={firstAsset ? formatLabel(firstAsset.asset_type) : "Not published"} />
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle title="Provenance Details" />
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label="Job ID" value={detail.job.id} />
              <DetailRow label="Plan ID" value={lineageText(firstAsset?.lineage, "plan_id")} />
              <DetailRow label="Execution Result" value={lineageText(firstAsset?.lineage, "execution_result_id")} />
              <DetailRow label="Storage Path" value={lineageText(firstAsset?.lineage, "storage_path")} />
              <DetailRow label="Skill" value={skill ?? "--"} />
              <DetailRow label="Quality" value={qualityScore} />
            </dl>
          </Card>
        </div>
      ) : null}

      {activeTab === "audit" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="p-4">
            <SectionTitle title="Audit Events" />
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {auditEvents(firstAsset).map((event, index) => (
                <div key={`${auditText(event, "entity_id")}-${index}`} className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_180px_150px]">
                  <div>
                    <p className="font-bold text-ink">{formatLabel(auditText(event, "action"))}</p>
                    <p className="text-xs text-muted">{formatLabel(auditText(event, "entity_type"))} · {shortId(auditText(event, "entity_id"))}</p>
                  </div>
                  <span className="text-muted">{formatDateTime(auditText(event, "created_at"))}</span>
                  <span className="font-semibold text-ink">{auditText(event, "actor")}</span>
                </div>
              ))}
              {!auditEvents(firstAsset).length ? (
                <div className="p-3 text-sm text-muted">No audit events were recorded for this asset yet.</div>
              ) : null}
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle title="Governance Decision" />
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label="Review" value={reviewDecision} />
              <DetailRow label="Quality Status" value={detail.quality?.quality_status ? formatLabel(detail.quality.quality_status) : "--"} />
              <DetailRow label="Review Reason" value={detail.quality?.quality_explanation ?? "--"} />
              <DetailRow label="Human Policy" value={compactJson(detail.plan?.human_review_policy)} />
              <DetailRow label="Output Contract" value={compactJson(detail.plan?.output_contract)} />
            </dl>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function JobDetailTabs({ activeTab, onChange }: { activeTab: JobDetailTab; onChange: (tab: JobDetailTab) => void }) {
  return (
    <div className="flex gap-8 overflow-x-auto border-b border-border text-sm font-bold">
      {jobDetailTabs.map((tab) => (
        <button
          key={tab.id}
          className={`shrink-0 pb-3 ${activeTab === tab.id ? "border-b-2 border-accent text-accent" : "text-muted hover:text-ink"}`}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
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

type GeneratedAssetItem = {
  kind: string;
  label: string;
  count: number;
  status: string;
  ready: boolean;
};

function OutputAssetListItem({
  active = false,
  asset,
  onSelect,
}: {
  active?: boolean;
  asset: GeneratedAssetItem;
  onSelect?: () => void;
}) {
  return (
    <button
      className={`w-full rounded-md border p-3 text-left transition hover:bg-surface ${active ? "border-accent bg-accent-soft/40" : "border-border"}`}
      type="button"
      onClick={onSelect}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">{asset.label}</span>
          <span className="mt-1 block text-xs text-muted">{assetStatusDetail(asset)}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${asset.ready ? "bg-success-soft text-success" : "bg-slate-100 text-muted"}`}>
          {asset.status}
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between">
        <span className="text-2xl font-bold text-ink">{asset.count}</span>
        <ArrowRight className="h-4 w-4 text-muted" />
      </span>
    </button>
  );
}

function PreviewPanel({
  action,
  children,
  onAction,
  title,
}: {
  action: string;
  children: React.ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">{title}</p>
        {onAction ? (
          <button
            className="shrink-0 text-xs font-bold text-info hover:text-accent"
            type="button"
            onClick={onAction}
          >
            {action}
          </button>
        ) : (
          <span className="shrink-0 text-xs font-bold text-info">{action}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function AssetViewer({ asset, kind }: { asset: ParsedAsset; kind: string }) {
  if (kind === "parsed_content") {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm leading-6 text-ink">
        {asset.parsed_text || "No parsed content was produced."}
      </pre>
    );
  }
  if (kind === "document_structure") {
    return (
      <div className="space-y-3">
        <AssetDataTable
          columns={["Type", "Page", "Text"]}
          rows={asset.layout_blocks.slice(0, 80).map((block) => [
            compactValue(block.type),
            compactValue(block.page_number ?? block.page),
            compactValue(block.text),
          ])}
          empty="No structure blocks were emitted."
        />
        <JsonBlock value={asset.document_metadata} title="Document metadata" />
      </div>
    );
  }
  if (kind === "tables") {
    return <TablesAssetView tables={asset.tables} />;
  }
  if (kind === "chunks") {
    return (
      <AssetDataTable
        columns={["Index", "Tokens", "Start", "End", "Text"]}
        rows={asset.chunks.map((chunk) => [
          compactValue(chunk.index),
          compactValue(chunk.token_estimate),
          compactValue(chunk.start_char),
          compactValue(chunk.end_char),
          compactValue(chunk.text),
        ])}
        empty="No chunks were generated."
      />
    );
  }
  if (kind === "vectors") {
    return (
      <div className="space-y-3">
        <JsonBlock value={recordPayload(asset.structured_data, "vector_asset")} title="Vector index metadata" />
        <AssetDataTable
          columns={["Chunk", "Model", "Dimensions", "Vector Preview"]}
          rows={asset.embeddings.map((embedding) => [
            compactValue(embedding.chunk_id),
            compactValue(embedding.model),
            compactValue(embedding.dimensions),
            vectorPreview(embedding.vector),
          ])}
          empty="No vectors were generated."
        />
      </div>
    );
  }
  if (kind === "entities") {
    return (
      <AssetDataTable
        columns={["Type", "Text", "Confidence", "Source", "Span"]}
        rows={asset.entities.map((entity) => [
          compactValue(entity.type),
          compactValue(entity.text ?? entity.value ?? entity.name),
          confidenceValue(entity.confidence),
          compactValue(entity.source),
          `${compactValue(entity.start_char)}-${compactValue(entity.end_char)}`,
        ])}
        empty="No entities were extracted."
      />
    );
  }
  if (kind === "relationships") {
    return (
      <AssetDataTable
        columns={["Type", "Source", "Target", "Confidence", "Evidence"]}
        rows={asset.relationships.map((relationship) => [
          compactValue(relationship.type),
          compactValue(relationship.source_entity_id),
          compactValue(relationship.target_entity_id),
          confidenceValue(relationship.confidence),
          compactValue(relationship.evidence_chunk_id),
        ])}
        empty="No relationships were extracted."
      />
    );
  }
  if (kind === "knowledge_graph") {
    const graph = recordPayload(asset.structured_data, "graph_asset");
    const nodes = arrayPayload(graph, "nodes");
    const edges = arrayPayload(graph, "edges");
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <LineageNode label="Nodes" value={String(nodes.length)} detail="Graph entities" />
          <LineageNode label="Edges" value={String(edges.length)} detail="Graph relationships" />
        </div>
        <AssetDataTable
          columns={["Node", "Type", "Label", "Confidence"]}
          rows={nodes.slice(0, 50).map((node) => [
            compactValue(node.id),
            compactValue(node.type),
            compactValue(node.label),
            confidenceValue(node.confidence),
          ])}
          empty="No graph nodes were produced."
        />
        <JsonBlock value={graph} title="Graph payload" />
      </div>
    );
  }
  if (kind === "summary") {
    const summary = recordPayload(asset.structured_data, "summary_asset");
    const keyPoints = arrayPayload(summary, "key_points");
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-surface p-3 text-sm leading-6 text-ink">
          {compactValue(summary.summary)}
        </div>
        <AssetDataTable
          columns={["#", "Key Point"]}
          rows={keyPoints.map((point, index) => [String(index + 1), compactValue(point)])}
          empty="No summary points were generated."
        />
      </div>
    );
  }
  if (kind === "classification") {
    return <JsonBlock value={recordPayload(asset.structured_data, "classification_asset")} title="Classification" />;
  }
  if (kind === "evidence") {
    return (
      <AssetDataTable
        columns={["Evidence", "Chunk", "File", "Start", "End"]}
        rows={asset.evidence_spans.map((span) => [
          compactValue(span.evidence_id),
          compactValue(span.chunk_id),
          compactValue(span.source_filename),
          compactValue(span.start_char),
          compactValue(span.end_char),
        ])}
        empty="No evidence spans were generated."
      />
    );
  }
  if (kind === "quality_report") {
    return <JsonBlock value={asset.quality_report} title="Quality report" />;
  }
  if (kind === "lineage") {
    return <JsonBlock value={asset.lineage} title="Lineage" />;
  }
  if (kind === "review_package") {
    return <JsonBlock value={recordPayload(asset.structured_data, "review_package_asset")} title="Review package" />;
  }
  if (kind === "user_defined_extraction") {
    const extraction = recordPayload(asset.structured_data, "user_defined_extraction_asset");
    const matches = arrayPayload(extraction, "matched_entities");
    return (
      <div className="space-y-3">
        <AssetDataTable
          columns={["Field", "Value", "Confidence", "Source"]}
          rows={matches.map((entity) => [
            compactValue(entity.type),
            compactValue(entity.text),
            confidenceValue(entity.confidence),
            compactValue(entity.source),
          ])}
          empty="No user-defined fields were matched."
        />
        <JsonBlock value={extraction} title="User-defined extraction payload" />
      </div>
    );
  }
  if (kind === "image_understanding") {
    return <JsonBlock value={asset.image_descriptions} title="Image understanding" />;
  }
  if (kind === "audio_transcript") {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm leading-6 text-ink">
        {asset.audio_transcript || "No audio transcript was produced."}
      </pre>
    );
  }
  if (kind === "video_understanding") {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm leading-6 text-ink">
        {asset.video_transcript || "No video transcript was produced."}
      </pre>
    );
  }
  return <JsonBlock value={asset.structured_data?.[kind] ?? asset.structured_data} title={formatAssetKind(kind)} />;
}

function AssetDataTable({
  columns,
  empty,
  rows,
}: {
  columns: string[];
  empty: string;
  rows: string[][];
}) {
  if (!rows.length) {
    return <div className="rounded-md border border-border p-3 text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-surface text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-border p-2 font-bold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="max-w-[360px] truncate p-2" title={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablesAssetView({ tables }: { tables: Array<Record<string, unknown>> }) {
  if (!tables.length) {
    return <div className="rounded-md border border-border p-3 text-sm text-muted">No tables were extracted.</div>;
  }
  return (
    <div className="space-y-3">
      {tables.map((table, index) => (
        <div key={index} className="space-y-2">
          <p className="text-sm font-bold text-ink">Table {index + 1}</p>
          <AssetDataTable
            columns={tableHeaders(table)}
            rows={tableRows(table)}
            empty="This table has no rows."
          />
        </div>
      ))}
    </div>
  );
}

function LineageNode({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 truncate font-bold text-ink">{value}</p>
      <p className="mt-1 truncate text-xs text-muted">{detail}</p>
    </div>
  );
}

function lineageText(lineage: Record<string, unknown> | undefined, key: string) {
  return compactValue(lineage?.[key]);
}

function auditEvents(asset: ParsedAsset | null) {
  return asset?.audit_trail ?? [];
}

function auditText(event: Record<string, unknown>, key: string) {
  return compactValue(event[key]);
}

function compactJson(value: Record<string, unknown> | null | undefined) {
  if (!value || !Object.keys(value).length) return "--";
  return JSON.stringify(value);
}

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function confidenceValue(value: unknown) {
  if (typeof value !== "number") return compactValue(value);
  return `${Math.round(value * 100)}%`;
}

function recordPayload(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayPayload(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function vectorPreview(value: unknown) {
  if (!Array.isArray(value)) return "--";
  return value.slice(0, 8).map((item) => typeof item === "number" ? item.toFixed(3) : String(item)).join(", ");
}

function generatedAssetItems(asset: ParsedAsset): GeneratedAssetItem[] {
  const manifest = asset.structured_data?.asset_manifest;
  if (Array.isArray(manifest)) {
    return manifest
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => {
        const kind = String(item.kind ?? "asset");
        const status = String(item.status ?? (item.generated ? "ready" : "empty"));
        return {
          kind,
          label: formatAssetKind(kind),
          count: typeof item.count === "number" ? item.count : 0,
          status: formatLabel(status),
          ready: item.generated === true || status === "ready",
        };
      });
  }

  return [
    fallbackAssetItem("parsed_content", asset.parsed_text ? 1 : 0),
    fallbackAssetItem("chunks", asset.chunks.length),
    fallbackAssetItem("vectors", asset.embeddings.length),
    fallbackAssetItem("entities", asset.entities.length),
    fallbackAssetItem("relationships", asset.relationships.length),
    fallbackAssetItem("tables", asset.tables.length),
    fallbackAssetItem("evidence", asset.evidence_spans.length),
    fallbackAssetItem("quality_report", Object.keys(asset.quality_report).length ? 1 : 0),
    fallbackAssetItem("lineage", Object.keys(asset.lineage).length ? 1 : 0),
  ];
}

function fallbackAssetItem(kind: string, count: number): GeneratedAssetItem {
  return {
    kind,
    label: formatAssetKind(kind),
    count,
    status: count ? "Ready" : "Empty",
    ready: count > 0,
  };
}

function formatAssetKind(kind: string) {
  return kind
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assetStatusDetail(asset: GeneratedAssetItem) {
  if (asset.kind === "parsed_content") return asset.ready ? "Characters extracted" : "No text emitted";
  if (asset.kind === "vectors") return "Embedding records";
  if (asset.kind === "knowledge_graph") return "Graph edges";
  if (asset.kind === "quality_report" || asset.kind === "lineage") return "Run governance asset";
  return "Generated records";
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
