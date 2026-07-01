"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FolderOpen,
  GitBranch,
  MoreVertical,
  RefreshCw,
  Send,
  Star,
  Table2,
  Users,
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

type JobDetailTab = "overview" | "outputs" | "agent_trace";

const jobDetailTabs: Array<{ id: JobDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "outputs", label: "Outputs" },
  { id: "agent_trace", label: "Agent Trace" },
];

export default function JobDetailPage({ params }: { params: { job_id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DetailState | null>(null);
  const [agentTask, setAgentTask] = useState<AgentTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("overview");
  const [selectedOutputAsset, setSelectedOutputAsset] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadDetail = useCallback(async (jobId: string) => {
    setError(null);
    try {
      const job = await api.getJob(jobId);
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
  }, []);

  useEffect(() => {
    loadDetail(params.job_id);
  }, [loadDetail, params.job_id]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "outputs" || tab === "agent_trace") {
      setActiveTab(tab);
    }
  }, [searchParams]);

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
  const preferredOutputKind = generatedAssets.some((asset) => asset.kind === "tables")
    ? "tables"
    : generatedAssets[0]?.kind ?? null;
  const selectedOutputKind = selectedOutputAsset ?? preferredOutputKind;
  const selectedAssetItem = generatedAssets.find((asset) => asset.kind === selectedOutputKind) ?? null;
  const showOutputAsset = (kind: string) => {
    setSelectedOutputAsset(kind);
    setActiveTab("outputs");
  };
  const sendToReview = async () => {
    if (!detail) return;
    setBusyAction("review");
    try {
      await api.sendJobToReview(detail.job.id);
      await loadDetail(detail.job.id);
      router.push(`/review-queue?job_id=${encodeURIComponent(detail.job.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send run to review.");
    } finally {
      setBusyAction(null);
    }
  };
  const retryRun = async () => {
    if (!detail) return;
    setBusyAction("retry");
    try {
      const retriedJob = await api.retryJob(detail.job.id);
      router.push(`/jobs/${retriedJob.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry run.");
      setBusyAction(null);
    }
  };
  const openInAssets = () => {
    if (!firstAsset) return;
    router.push(`/assets/${firstAsset.id}`);
  };
  const exportSelectedAsset = () => {
    if (!firstAsset || !selectedOutputKind) return;
    downloadAssetCsv(firstAsset, selectedOutputKind, fileName);
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
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <Card className="border-warning/50 bg-warning-soft/40 p-4">
              <div className="grid gap-4 lg:grid-cols-[56px_minmax(0,1fr)]">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-ink">Review Recommended</h3>
                  <p className="mt-1 text-sm text-ink">
                    The run completed, but human review is recommended because the quality score is {qualityScore}, below the configured threshold.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton icon={FolderOpen} variant="secondary" onClick={() => setActiveTab("outputs")}>Open Outputs</ActionButton>
                    <ActionButton icon={Users} variant="secondary" disabled={busyAction === "review"} onClick={sendToReview}>
                      {busyAction === "review" ? "Sending" : "Send to Review"}
                    </ActionButton>
                    <ActionButton icon={GitBranch} variant="secondary" onClick={() => setActiveTab("agent_trace")}>Open Agent Trace</ActionButton>
                    <ActionButton icon={RefreshCw} variant="secondary" disabled={busyAction === "retry"} onClick={retryRun}>
                      {busyAction === "retry" ? "Retrying" : "Retry Run"}
                    </ActionButton>
                  </div>
                </div>
                <div className="grid gap-3 border-t border-warning/30 pt-3 text-sm sm:grid-cols-3 lg:col-span-2">
                  <MiniRunFact label="Primary Parser" value={parser} />
                  <MiniRunFact label="Fallback Parser" value={fallback ?? "--"} />
                  <MiniRunFact label="Skill Used" value={skill ?? "--"} />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle
                title="Execution Journey"
                action={<button className="flex items-center gap-1 text-xs font-bold text-info" type="button" onClick={() => setActiveTab("agent_trace")}>View full agent trace <ArrowRight className="h-3 w-3" /></button>}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {overviewJourneySteps({ completedAt, detail, fallback, parser, uploadedAt }).map((step) => (
                  <JourneyStep key={step.title} {...step} />
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle
                title="Generated Assets"
                action={<button className="flex items-center gap-1 text-xs font-bold text-info" type="button" onClick={() => setActiveTab("outputs")}>Open outputs <ArrowRight className="h-3 w-3" /></button>}
              />
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {generatedAssets.slice(0, 10).map((asset) => (
                  <GeneratedAssetSummaryCard key={asset.kind} asset={asset} onClick={() => showOutputAsset(asset.kind)} />
                ))}
                {!generatedAssets.length ? <p className="text-sm text-muted">No published assets yet.</p> : null}
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle
                title="Key Extraction Preview"
                action={<button className="flex items-center gap-1 text-xs font-bold text-info" type="button" onClick={() => showOutputAsset("tables")}>View full table <ArrowRight className="h-3 w-3" /></button>}
              />
              <div className="mt-3 overflow-hidden rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>{tableHeaders(tables[0]).map((header) => <th key={header} className="p-2">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tableRows(tables[0]).slice(0, 4).map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="p-2 font-semibold text-ink">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>

          <div className="space-y-3">
            <Card className="p-4">
              <SectionTitle title="Review Decision" action={<Tag tone="warning">Needs review</Tag>} />
              <dl className="mt-4 space-y-3 text-sm">
                <DetailRow label="Decision" value={reviewDecision} valueClassName={reviewTone} />
                <DetailRow label="Reason" value={detail.quality?.quality_explanation ?? "Quality below threshold"} />
                <DetailRow label="Confidence" value={qualityScore} />
                <DetailRow label="Threshold" value={`${Math.round((detail.plan?.quality_threshold ?? 0.8) * 100)}%`} />
                <DetailRow label="Recommended Action" value="Human validation" />
              </dl>
              <ActionButton className="mt-4 w-full justify-center" icon={Send} variant="secondary" disabled={busyAction === "review"} onClick={sendToReview}>
                {busyAction === "review" ? "Sending" : "Send to Review"}
              </ActionButton>
            </Card>

            <Card className="p-4">
              <SectionTitle title="Quality Breakdown" />
              <div className="mt-4 space-y-4">
                <QualityBar label="Completeness" value={scoreToPercent(detail.quality?.completeness_score)} />
                <QualityBar label="Consistency" value={scoreToPercent(detail.quality?.consistency_score)} />
                <QualityBar label="Confidence" value={qualityValue} />
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Overall Quality Score</span>
                    <span className="flex items-center gap-2 text-xl font-bold text-success"><Star className="h-5 w-5" /> {qualityScore}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle title="Document Profile" action={<Tag tone="success">{profileTag}</Tag>} />
              <dl className="mt-3 space-y-3 text-sm">
                <DetailRow label="File Type" value={detail.file?.mime_type ?? "--"} />
                <DetailRow label="File Size" value={formatBytes(detail.file?.size_bytes ?? 0)} />
                <DetailRow label="Modality" value={detail.profile?.modalities?.join(", ") || "--"} />
                <DetailRow label="Layout Risk" value={formatLabel(detail.profile?.layout_complexity ?? "--")} />
                <DetailRow label="Image Likelihood" value={formatLikelihood(detail.profile?.image_likelihood)} />
                <DetailRow label="Table Likelihood" value={formatLikelihood(detail.profile?.table_likelihood)} />
                <DetailRow label="Uploaded By" value={detail.file?.created_by ?? "--"} />
                <DetailRow label="Source" value={detail.file?.source ?? "Upload"} />
              </dl>
            </Card>

            <Card className="p-4">
              <SectionTitle title="Run Metadata" action={<MoreVertical className="h-4 w-4 text-muted" />} />
              <dl className="mt-3 space-y-3 text-sm">
                <DetailRow label="Run ID" value={detail.job.id} />
                <DetailRow label="Created" value={formatDateTime(detail.job.created_at)} />
                <DetailRow label="Updated" value={completedAt} />
                <DetailRow label="Workspace" value="Enterprise Workspace" />
                <DetailRow label="Policy" value="Default Parsing Policy" />
                <DetailRow label="Checksum" value={detail.file?.checksum_sha256 ? shortId(detail.file.checksum_sha256) : "--"} />
              </dl>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "outputs" ? (
        <div className="space-y-3">
          <Card className="p-4">
            <SectionTitle title="Generated Assets" action={<span className="text-xs font-bold text-muted">{generatedAssets.length} asset types</span>} />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {generatedAssets.map((asset) => (
                <OutputAssetTile
                  key={asset.kind}
                  active={asset.kind === selectedOutputKind}
                  asset={asset}
                  onSelect={() => setSelectedOutputAsset(asset.kind)}
                />
              ))}
              {!generatedAssets.length ? <p className="text-sm text-muted">No published assets yet.</p> : null}
            </div>
          </Card>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-4">
              <SectionTitle
                title={selectedOutputKind ? formatAssetKind(selectedOutputKind) : "Asset Viewer"}
                action={<span className={`rounded-full px-2 py-1 text-xs font-bold ${selectedAssetItem?.ready ? "bg-success-soft text-success" : "bg-slate-100 text-muted"}`}>{selectedAssetItem?.status ?? "Empty"}</span>}
              />
              <p className="mt-1 text-sm text-muted">
                {selectedOutputKind ? assetViewerDescription(selectedOutputKind, fileName) : "Select a generated asset to inspect its output."}
              </p>
              <div className="mt-4">
                {firstAsset && selectedOutputKind ? (
                  <AssetViewer asset={firstAsset} kind={selectedOutputKind} />
                ) : (
                  <div className="rounded-md border border-border p-3 text-sm text-muted">
                    No generated asset is available to inspect yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle title="Asset Details" action={<Tag tone={selectedAssetItem?.ready ? "success" : "neutral"}>{selectedAssetItem?.status ?? "Empty"}</Tag>} />
              <dl className="mt-4 space-y-3 text-sm">
                {assetDetailRows({ asset: firstAsset, item: selectedAssetItem, kind: selectedOutputKind, parser, qualityScore }).map(([label, value, tone]) => (
                  <DetailRow
                    key={label}
                    label={label}
                    value={value}
                    valueClassName={tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink"}
                  />
                ))}
              </dl>
              <div className="mt-4 grid gap-2">
                <ActionButton className="justify-center" icon={Download} variant="secondary" disabled={!firstAsset || !selectedOutputKind} onClick={exportSelectedAsset}>Export CSV</ActionButton>
                <ActionButton className="justify-center" icon={FolderOpen} variant="secondary" disabled={!firstAsset} onClick={openInAssets}>Open in Assets</ActionButton>
                <ActionButton className="justify-center" icon={Send} variant="primary" disabled={busyAction === "review"} onClick={sendToReview}>
                  {busyAction === "review" ? "Sending" : "Send to Review"}
                </ActionButton>
              </div>
              {detail.quality?.human_review_required ? (
                <div className="mt-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-warning">
                  Review recommended because quality score is below the configured threshold.
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "agent_trace" ? (
        agentTask ? (
          <AgentTracePanel task={agentTask} />
        ) : (
          <Card className="p-4 text-sm text-muted">No agent task trace is linked to this job yet.</Card>
        )
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

function MiniRunFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 truncate font-bold text-ink">{value}</p>
    </div>
  );
}

function SectionTitle({ action, title }: { action?: React.ReactNode; title: string }) {
  return <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink">{title}</h3>{action}</div>;
}

function DetailRow({
  label,
  value,
  valueClassName = "text-ink",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className={`truncate font-semibold ${valueClassName}`}>{value}</dd></div>;
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

type JourneyStepProps = {
  detail: string;
  duration: string;
  status: "success" | "warning" | "running";
  time: string;
  title: string;
};

function JourneyStep({ detail, duration, status, time, title }: JourneyStepProps) {
  const icon =
    status === "warning"
      ? <AlertTriangle className="h-4 w-4 text-warning" />
      : status === "running"
        ? <RefreshCw className="h-4 w-4 text-accent" />
        : <CheckCircle2 className="h-4 w-4 text-success" />;
  return (
    <div className="min-h-[110px] rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${status === "warning" ? "bg-warning-soft" : status === "running" ? "bg-accent-soft" : "bg-success-soft"}`}>{icon}</span>
        <p className="font-bold text-ink">{title}</p>
      </div>
      <p className="mt-3 line-clamp-3 text-xs text-muted">{detail}</p>
      <div className="mt-3 flex justify-between gap-2 text-xs text-muted">
        <span>{time}</span>
        <span className="font-semibold">{duration}</span>
      </div>
    </div>
  );
}

function GeneratedAssetSummaryCard({ asset, onClick }: { asset: GeneratedAssetItem; onClick: () => void }) {
  return (
    <button className="flex items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-surface" type="button" onClick={onClick}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-success-soft text-success">
        <AssetIcon kind={asset.kind} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink">{asset.label}</span>
        <span className="text-xs font-semibold text-muted">{assetCountLabel(asset)}</span>
      </span>
    </button>
  );
}

function overviewJourneySteps({
  completedAt,
  detail,
  fallback,
  parser,
  uploadedAt,
}: {
  completedAt: string;
  detail: DetailState;
  fallback: string | null;
  parser: string;
  uploadedAt: string;
}): JourneyStepProps[] {
  return [
    { title: "Intake", detail: "File received", time: uploadedAt, duration: "2s", status: "success" },
    { title: "Profiling", detail: "Document profile created", time: uploadedAt, duration: "4s", status: detail.profile ? "success" : "warning" },
    { title: "Parsing", detail: `${parser} executed`, time: completedAt, duration: "41s", status: "success" },
    { title: "Validation", detail: detail.quality?.quality_explanation ?? "Quality report pending", time: completedAt, duration: "8s", status: detail.quality?.human_review_required ? "warning" : "success" },
    { title: "Fallback", detail: fallback ? `${fallback} used` : "No fallback required", time: completedAt, duration: fallback ? "28s" : "--", status: fallback ? "running" : "success" },
    { title: "Publish", detail: "Assets published and review request created", time: completedAt, duration: "6s", status: "success" },
  ];
}

type GeneratedAssetItem = {
  kind: string;
  label: string;
  count: number;
  status: string;
  ready: boolean;
};

function OutputAssetTile({
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
      className={`min-h-[92px] w-[142px] shrink-0 rounded-md border p-3 text-left transition hover:bg-surface ${active ? "border-accent bg-accent-soft/40" : "border-border"}`}
      type="button"
      onClick={onSelect}
    >
      <span className="flex items-start gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info-soft text-info">
          <AssetIcon kind={asset.kind} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-ink">{asset.label}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">{assetCountLabel(asset)}</span>
        </span>
      </span>
      <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${asset.ready ? "bg-success-soft text-success" : "bg-slate-100 text-muted"}`}>
        {asset.status}
      </span>
    </button>
  );
}

function AssetIcon({ kind }: { kind: string }) {
  const classes = "h-4 w-4";
  if (kind === "tables") return <Table2 className={classes} aria-hidden="true" />;
  if (kind === "quality_report") return <Star className={classes} aria-hidden="true" />;
  if (kind === "lineage" || kind === "relationships" || kind === "knowledge_graph") return <GitBranch className={classes} aria-hidden="true" />;
  return <FileTypeIcon type="document" />;
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

function assetCountLabel(asset: GeneratedAssetItem) {
  if (asset.kind === "parsed_content") return `${asset.count} chars`;
  if (asset.kind === "tables") return `${asset.count} ${asset.count === 1 ? "record" : "records"}`;
  if (asset.kind === "quality_report" || asset.kind === "lineage" || asset.kind === "summary" || asset.kind === "classification") return `${asset.count} record`;
  return `${asset.count} ${asset.count === 1 ? "record" : "records"}`;
}

function assetViewerDescription(kind: string, fileName: string) {
  if (kind === "tables") return `Extracted table records from ${fileName}.`;
  if (kind === "parsed_content") return `Extracted text content from ${fileName}.`;
  if (kind === "entities") return `Extracted entity records from ${fileName}.`;
  if (kind === "chunks") return `Chunked retrieval units from ${fileName}.`;
  if (kind === "vectors") return `Embedding records generated from chunks in ${fileName}.`;
  if (kind === "quality_report") return "Quality and review judgement for this run.";
  if (kind === "lineage") return "Source, parser, skill, execution, and asset provenance.";
  return `${formatAssetKind(kind)} generated from ${fileName}.`;
}

function assetDetailRows({
  asset,
  item,
  kind,
  parser,
  qualityScore,
}: {
  asset: ParsedAsset | null;
  item: GeneratedAssetItem | null;
  kind: string | null;
  parser: string;
  qualityScore: string;
}): Array<[string, string, "success" | "warning" | undefined]> {
  const table = kind === "tables" ? asset?.tables[0] : null;
  const rows = tableRows(table ?? undefined);
  const hasRealTable = Boolean(asset?.tables.length);
  const rowCount = hasRealTable ? rows.length : 0;
  const columnCount = hasRealTable ? tableHeaders(table ?? undefined).length : 0;
  return [
    ["Type", kind ? formatAssetKind(kind) : "--", undefined],
    ["Status", item?.status ?? "Empty", item?.ready ? "success" : undefined],
    ["Records", item ? assetCountLabel(item) : "0 records", undefined],
    ["Rows", kind === "tables" ? String(rowCount) : "--", undefined],
    ["Columns", kind === "tables" ? String(columnCount) : "--", undefined],
    ["Quality", qualityScore, qualityScore === "--" ? undefined : "warning"],
    ["Parser", parser, undefined],
    ["Evidence", `${asset?.evidence_spans.length ?? 0} spans`, undefined],
    ["Generated", formatDateTime(asset?.created_at), undefined],
  ];
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

function downloadAssetCsv(asset: ParsedAsset, kind: string, fileName: string) {
  const rows = csvRowsForAsset(asset, kind);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName.replace(/[^a-z0-9._-]+/gi, "-")}-${kind}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvRowsForAsset(asset: ParsedAsset, kind: string): string[][] {
  if (kind === "tables") {
    const table = asset.tables[0];
    const rows = table?.rows;
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => Array.isArray(row) ? row.map(stringifyCell) : [stringifyCell(row)]);
    }
    return [["message"], ["No tables extracted"]];
  }
  if (kind === "chunks") {
    return [
      ["index", "start_char", "end_char", "token_estimate", "text"],
      ...asset.chunks.map((chunk) => [
        stringifyCell(chunk.index),
        stringifyCell(chunk.start_char),
        stringifyCell(chunk.end_char),
        stringifyCell(chunk.token_estimate),
        stringifyCell(chunk.text),
      ]),
    ];
  }
  if (kind === "entities") {
    return [
      ["type", "text", "confidence", "source", "start_char", "end_char"],
      ...asset.entities.map((entity) => [
        stringifyCell(entity.type),
        stringifyCell(entity.text ?? entity.value ?? entity.name),
        stringifyCell(entity.confidence),
        stringifyCell(entity.source),
        stringifyCell(entity.start_char),
        stringifyCell(entity.end_char),
      ]),
    ];
  }
  if (kind === "evidence") {
    return [
      ["evidence_id", "chunk_id", "source_filename", "start_char", "end_char"],
      ...asset.evidence_spans.map((span) => [
        stringifyCell(span.evidence_id),
        stringifyCell(span.chunk_id),
        stringifyCell(span.source_filename),
        stringifyCell(span.start_char),
        stringifyCell(span.end_char),
      ]),
    ];
  }
  if (kind === "parsed_content") return [["parsed_text"], [asset.parsed_text ?? ""]];
  return [["kind", "payload"], [kind, JSON.stringify(asset.structured_data?.[kind] ?? asset.structured_data ?? {})]];
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
