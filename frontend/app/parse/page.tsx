"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  CloudUpload,
  ExternalLink,
  FileAudio,
  FileCheck2,
  FileText,
  GitBranch,
  Laptop,
  Layers3,
  Loader2,
  Mail,
  MoreHorizontal,
  Network,
  Play,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Timer,
  UserRoundCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { DragEvent, RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { UploadedFile } from "@/api/files";
import type { AgentTaskDetail } from "@/api/agent";
import type {
  JobEvent,
  JobProgress,
  ParseConfiguration,
  ParseJob,
  ParseJobRunResponse,
  ParseObjective,
  ParserRecommendation,
  ParsingPlan,
} from "@/api/jobs";
import {
  ActionButton,
  Card,
  FileTypeIcon,
  SectionHeader,
  StatusPill,
  Tag,
  Toggle,
} from "@/components/design-system";
import { AgentTracePanel } from "@/components/agent-trace-panel";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useParseWorkflow } from "@/hooks/useParseWorkflow";

const objectives: Array<{
  id: ParseObjective;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "general", title: "General Parsing", description: "Extract content, structure, and metadata.", icon: FileText },
  { id: "structured", title: "Structured Extraction", description: "Extract data into structured fields.", icon: SlidersHorizontal },
  { id: "search", title: "Search-ready", description: "Optimize for semantic search and RAG.", icon: Search },
  { id: "graph", title: "Graph-ready", description: "Extract entities and relationships.", icon: Share2 },
  { id: "transcript", title: "Audio/Video Transcript", description: "Generate transcripts and summaries.", icon: FileAudio },
  { id: "custom", title: "Custom", description: "Use a custom strategy or configuration.", icon: UserRoundCheck },
];

const supportedFormats = ["PDF", "DOCX", "PPTX", "XLSX", "TXT", "PNG", "JPG", "MP3", "MP4"];
const uploadSources: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Local Upload", icon: Laptop },
  { label: "Cloud Storage", icon: Cloud },
  { label: "SharePoint", icon: Share2 },
  { label: "Email Intake", icon: Mail },
];

export default function ParsePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useFileUpload();
  const workflow = useParseWorkflow(upload.uploadedFiles);

  const fileTypes = useMemo(() => summarizeFileTypes(upload.files), [upload.files]);
  const totalSize = useMemo(() => upload.files.reduce((sum, file) => sum + file.size, 0), [upload.files]);
  const toast = workflow.toast ?? upload.toast;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [workflow.step]);

  function closeToast() {
    workflow.clearToast();
    upload.clearToast();
  }

  function addSelectedFiles(files: FileList | null) {
    if (!files?.length) return;
    void upload.addFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) void upload.addFiles(event.dataTransfer.files);
  }

  function resetAll() {
    workflow.resetWorkflow();
    upload.resetFiles();
  }

  if (workflow.step === "running") {
    return (
      <RunningState
        agentTask={workflow.agentTask}
        events={workflow.events}
        files={upload.uploadedFiles}
        jobRuns={workflow.jobRuns}
        jobSnapshots={workflow.jobSnapshots}
        onReset={resetAll}
        progress={workflow.progress}
      />
    );
  }

  return (
    <div className="space-y-5">
      {toast ? <Toast tone={toast.tone} message={toast.message} onClose={closeToast} /> : null}

      <ParseStepper
        steps={["Upload", "Configure", "Review & Run"]}
        current={workflow.step === "review" ? 2 : workflow.step === "configure" ? 1 : 0}
      />

      {workflow.step === "upload" ? (
        <UploadState
          files={upload.files}
          fileTypes={fileTypes}
          inputRef={inputRef}
          onDrop={handleDrop}
          onFileChange={addSelectedFiles}
          onRemove={upload.removeFile}
          onSaveDraft={workflow.saveDraft}
          onContinue={workflow.goToConfigure}
          totalSize={totalSize}
          uploading={upload.uploading}
        />
      ) : null}

      {workflow.step === "configure" ? (
        <ConfigureState
          configuration={workflow.configuration}
          files={upload.uploadedFiles}
          objective={workflow.objective}
          onBack={() => workflow.setStep("upload")}
          onContinue={workflow.goToReview}
          onObjectiveChange={workflow.setObjective}
          onUpdateConfiguration={workflow.updateConfiguration}
          plan={workflow.plan}
          planError={workflow.planError}
          planning={workflow.planning}
        />
      ) : null}

      {workflow.step === "review" ? (
        <ReviewState
          configuration={workflow.configuration}
          creatingJob={workflow.creatingJob}
          files={upload.uploadedFiles}
          jobError={workflow.jobError}
          objective={workflow.objective}
          onBack={() => workflow.setStep("configure")}
          onRun={workflow.runJobs}
          plan={workflow.plan}
        />
      ) : null}
    </div>
  );
}

function ParseStepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="rounded-lg border-b border-border bg-white/40 px-3 py-4">
      <div className="flex items-center gap-3">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-3 last:flex-none">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold ${
                  done
                    ? "border-success bg-success text-white"
                    : active
                      ? "border-accent bg-accent text-white"
                      : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${active ? "text-accent" : "text-ink"}`}>{step}</span>
                {done ? <span className="block text-xs text-muted">Completed</span> : null}
                {active && current === 2 ? <span className="block text-xs text-accent">Review before you run</span> : null}
              </span>
              {index < steps.length - 1 ? <span className="h-px min-w-10 flex-1 bg-border" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadState({
  files,
  fileTypes,
  inputRef,
  onDrop,
  onFileChange,
  onRemove,
  onSaveDraft,
  onContinue,
  totalSize,
  uploading,
}: {
  files: UploadedFile[];
  fileTypes: Array<{ type: string; count: number }>;
  inputRef: RefObject<HTMLInputElement>;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileChange: (files: FileList | null) => void;
  onRemove: (localId: string) => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  totalSize: number;
  uploading: boolean;
}) {
  const uploadedCount = files.filter((file) => file.status === "uploaded").length;
  const languages = summarizeLanguages(files);
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="p-4">
        <SectionHeader title="Upload files" />
        <label
          className="mt-4 flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center hover:border-accent hover:bg-accent-soft/40"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <CloudUpload className="h-9 w-9 text-slate-500" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">
            Drag and drop files here, or <span className="text-accent">click to browse</span>
          </p>
          <p className="mt-2 text-sm text-muted">Upload documents, spreadsheets, images, audio, and video files.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {supportedFormats.map((type) => <Tag key={type}>{type}</Tag>)}
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            multiple
            type="file"
            onChange={(event) => onFileChange(event.target.files)}
          />
        </label>

        <p className="mt-4 text-sm font-bold text-ink">Or upload from</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {uploadSources.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white text-sm font-bold text-ink hover:bg-surface"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <UploadedFileList files={files} onRemove={onRemove} totalSize={totalSize} />

        <Card className="mt-4 p-3 shadow-none">
          <SectionHeader title="File profiling preview" />
          <div className="mt-3 grid overflow-hidden rounded-md border border-border text-sm md:grid-cols-3">
            <PreviewCell
              label="File types detected"
              value={fileTypes.length ? fileTypes.map((item) => `${item.type.toUpperCase()} ${item.count}`).join("  ") : "Waiting for upload"}
            />
            <PreviewCell
              label="Languages detected"
              value={languages.length ? languages.join("  ") : uploadedCount ? "Profile pending" : "Waiting for profile"}
              success={uploadedCount > 0}
            />
            <PreviewCell
              label="Complexity signals"
              value={files.length ? complexitySignals(files).join("  ") : "No signals yet"}
            />
          </div>
          <p className="mt-3 text-xs text-muted">Profiling runs automatically after upload. You can review full details in the next step.</p>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex justify-end gap-3 border-t border-border bg-white px-4 py-3">
          <ActionButton type="button" variant="secondary" onClick={onSaveDraft}>Save Draft</ActionButton>
          <ActionButton
            type="button"
            icon={uploading ? Loader2 : ArrowRight}
            disabled={uploading || uploadedCount === 0}
            onClick={onContinue}
          >
            {uploading ? "Uploading..." : "Continue to Configure"}
          </ActionButton>
        </div>
      </Card>

      <UploadSummary files={files} fileTypes={fileTypes} />
    </div>
  );
}

function ConfigureState({
  configuration,
  files,
  objective,
  onBack,
  onContinue,
  onObjectiveChange,
  onUpdateConfiguration,
  plan,
  planError,
  planning,
}: {
  configuration: ParseConfiguration;
  files: UploadedFile[];
  objective: ParseObjective;
  onBack: () => void;
  onContinue: () => void;
  onObjectiveChange: (objective: ParseObjective) => void;
  onUpdateConfiguration: (patch: Partial<ParseConfiguration>) => void;
  plan: ParsingPlan | null;
  planError: string | null;
  planning: boolean;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <section>
          <SectionHeader title="Parsing objective" description="Select the primary objective for this parsing run." />
          <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {objectives.map((item) => (
              <ObjectiveButton
                key={item.id}
                active={objective === item.id}
                icon={item.icon}
                title={item.title}
                description={item.description}
                onClick={() => onObjectiveChange(item.id)}
              />
            ))}
          </div>
        </section>

        <Card className="p-4">
          <SectionHeader
            title="Recommended parser strategy"
            description="Per-file parser recommendations based on content type and objective."
            action={planning ? <span className="text-xs font-bold text-accent">Planning...</span> : null}
          />
          {planError ? <ErrorBox message={planError} /> : null}
          <RecommendationTable files={files} planning={planning} recommendations={plan?.recommendations ?? []} />
        </Card>

        <Card className="p-4">
          <SectionHeader title="Smart configuration" description="Recommended settings optimized for your selected objective and files." />
          <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
            <ConfigSelect
              label="Output Preset"
              value={configuration.outputPreset}
              options={[
                ["balanced", "Balanced"],
                ["text_structure", "Text & structure"],
                ["structured", "Structured data"],
                ["search", "Search-ready"],
                ["graph", "Graph-ready"],
              ]}
              onChange={(value) => onUpdateConfiguration({ outputPreset: value as ParseConfiguration["outputPreset"] })}
            />
            <ConfigSelect
              label="Quality Target"
              value={configuration.qualityTarget}
              options={[["low", "Low"], ["balanced", "Balanced"], ["high", "High (92%+)"]]}
              onChange={(value) => onUpdateConfiguration({ qualityTarget: value as ParseConfiguration["qualityTarget"] })}
            />
            <ConfigSelect
              label="Cost Profile"
              value={configuration.costProfile}
              options={[["low_cost", "Low cost"], ["balanced", "Balanced"], ["premium", "Premium"]]}
              onChange={(value) => onUpdateConfiguration({ costProfile: value as ParseConfiguration["costProfile"] })}
            />
            <ConfigSelect
              label="Latency Profile"
              value={configuration.latencyProfile}
              options={[["batch", "Batch"], ["interactive", "Standard"], ["real_time", "Real-time"]]}
              onChange={(value) => onUpdateConfiguration({ latencyProfile: value as ParseConfiguration["latencyProfile"] })}
            />
            <ConfigSelect
              label="Human Review Policy"
              value={configuration.humanReviewPolicy}
              options={[
                ["review_if_70", "Review if <70%"],
                ["review_if_85", "Review if <85%"],
                ["review_if_92", "Review if <92%"],
                ["always", "Always review"],
                ["never", "Never"],
              ]}
              onChange={(value) => onUpdateConfiguration({ humanReviewPolicy: value as ParseConfiguration["humanReviewPolicy"] })}
            />
          </div>
          <Card className="mt-4 p-3 shadow-none">
            <SectionHeader title="Advanced Options" />
            <div className="mt-4 grid gap-x-8 gap-y-3 lg:grid-cols-2">
              <TextField
                label="Custom outputs"
                value={configuration.customOutputs}
                placeholder="Add custom outputs (JSON schema, fields, etc.)"
                onChange={(value) => onUpdateConfiguration({ customOutputs: value })}
              />
              <ToggleRow
                label="Enable table structure detection"
                checked={configuration.tableStructureDetection}
                onClick={() => onUpdateConfiguration({ tableStructureDetection: !configuration.tableStructureDetection })}
              />
              <TextField
                label="Preferred parser override"
                value={configuration.preferredParserOverride}
                placeholder="Select a parser (optional)"
                onChange={(value) => onUpdateConfiguration({ preferredParserOverride: value })}
              />
              <ToggleRow
                label="Generate embeddings"
                checked={configuration.generateEmbeddings}
                onClick={() => onUpdateConfiguration({ generateEmbeddings: !configuration.generateEmbeddings })}
              />
              <TextField
                label="Skill override"
                value={configuration.skillOverride}
                placeholder="Select a skill (optional)"
                onChange={(value) => onUpdateConfiguration({ skillOverride: value })}
              />
              <ConfigSelect
                label="Sensitivity handling"
                value={configuration.sensitivityHandling}
                options={[
                  ["auto_mask", "Auto-detect & mask (PII, PHI)"],
                  ["detect_only", "Detect only"],
                  ["none", "None"],
                ]}
                onChange={(value) => onUpdateConfiguration({ sensitivityHandling: value as ParseConfiguration["sensitivityHandling"] })}
              />
              <ConfigSelect
                label="Fallback policy"
                value={configuration.fallbackPolicy}
                options={[
                  ["recommended", "Use recommended fallback"],
                  ["aggressive", "Aggressive fallback"],
                  ["none", "No fallback"],
                ]}
                onChange={(value) => onUpdateConfiguration({ fallbackPolicy: value as ParseConfiguration["fallbackPolicy"] })}
              />
              <ConfigSelect
                label="OCR & image handling"
                value={configuration.ocrImageHandling}
                options={[
                  ["auto", "Auto (Detect text, OCR if needed)"],
                  ["force_ocr", "Force OCR"],
                  ["native_only", "Native text only"],
                ]}
                onChange={(value) => onUpdateConfiguration({ ocrImageHandling: value as ParseConfiguration["ocrImageHandling"] })}
              />
            </div>
          </Card>
        </Card>

        <div className="sticky bottom-0 z-10 flex justify-between border-t border-border bg-surface/95 py-3 backdrop-blur">
          <ActionButton type="button" variant="secondary" onClick={onBack}>Back</ActionButton>
          <ActionButton type="button" icon={ArrowRight} disabled={planning || !plan} onClick={onContinue}>
            Continue to Review
          </ActionButton>
        </div>
      </div>

      <ConfigureSummary configuration={configuration} plan={plan} />
    </div>
  );
}

function ReviewState({
  configuration,
  creatingJob,
  files,
  jobError,
  objective,
  onBack,
  onRun,
  plan,
}: {
  configuration: ParseConfiguration;
  creatingJob: boolean;
  files: UploadedFile[];
  jobError: string | null;
  objective: ParseObjective;
  onBack: () => void;
  onRun: () => void;
  plan: ParsingPlan | null;
}) {
  const recommendations = plan?.recommendations ?? [];
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Start Parsing</h2>
          <p className="mt-1 text-sm text-muted">Review your selections and configuration before starting the parsing run.</p>
        </div>

        <Card className="p-4">
          <SectionHeader title="Files to process" action={<span className="text-sm font-bold text-muted">({files.length})</span>} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs font-bold text-muted">
                <tr>
                  <th className="border-b border-border py-3">File name</th>
                  <th className="border-b border-border py-3">Objective</th>
                  <th className="border-b border-border py-3">Recommended parser</th>
                  <th className="border-b border-border py-3">Fallback parser</th>
                  <th className="border-b border-border py-3">Outputs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {files.map((file) => {
                  const recommendation = recommendations.find((item) => item.fileId === file.fileId);
                  return (
                    <tr key={file.localId}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <FileTypeIcon type={file.type} />
                          <div>
                            <p className="font-bold text-ink">{file.name}</p>
                            <p className="text-xs text-muted">{file.sizeLabel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-ink">{objectiveTitle(objective)}</td>
                      <td className="py-3 text-ink">
                        {recommendation?.primaryParserId ?? "--"}{" "}
                        <Tag tone="success">{formatScore(recommendation?.decisionScore)}</Tag>
                      </td>
                      <td className="py-3 text-ink">{recommendation?.fallbackParserId ?? "No fallback"}</td>
                      <td className="py-3">
                        <OutputIcons />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Execution plan" />
          <div className="mt-3 space-y-3">
            {(plan?.executionStages ?? []).map((stage, index) => (
              <div key={stage.name} className="grid grid-cols-[28px_100px_1fr_80px_20px] items-center gap-3 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-success text-xs font-bold text-success">{index + 1}</span>
                <span className="font-bold text-ink">{stage.name}</span>
                <span className="text-xs text-muted">{stage.description}</span>
                <Tag>{stage.duration}</Tag>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Expected outputs" />
          <div className="mt-3 flex flex-wrap gap-3">
            {(plan?.expectedOutputs ?? []).map((output) => <OutputTag key={output} label={output} />)}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Governance & review" />
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              ["Policy checks", "All policy checks passed"],
              ["Workspace rules", "All applicable rules will be applied"],
              ["Review threshold", reviewPolicyLabel(configuration.humanReviewPolicy)],
              ["Audit logging", "Enabled"],
            ].map(([title, detail]) => (
              <div key={title} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-bold text-ink">{title}</p>
                  <p className="text-xs text-muted">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <SectionHeader title="Ready to run" description="Review the summary below and start the run." />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniStat label="Files" value={String(files.length)} detail="Selected" />
          <MiniStat label="Estimated cost" value={plan?.estimatedCost.replace("~ ", "") ?? "$0.04"} detail="USD" />
          <MiniStat label="Estimated turnaround" value={plan?.estimatedDuration ?? "~ 2 min"} detail="Total" />
          <MiniStat label="Review coverage" value={plan?.reviewCoverage ?? "92%"} detail="Avg. confidence" />
        </div>
        <div className="my-4 h-px bg-border" />
        <div className="space-y-3 text-sm">
          <RunConfig label="Workspace" value="Enterprise Workspace" />
          <RunConfig label="Data residency" value="US (Texas)" />
          <RunConfig label="Parsing mode" value={configuration.latencyProfile === "batch" ? "Batch" : "Standard"} />
          <RunConfig label="Language" value="English" />
          <RunConfig label="Concurrency" value={`${files.length} files`} />
          <RunConfig label="Notifications" value="In-app & Email" />
        </div>
        {jobError ? <ErrorBox message={jobError} /> : null}
        <ActionButton className="mt-5 w-full" type="button" variant="secondary" onClick={onBack}>Back</ActionButton>
        <ActionButton className="mt-3 w-full" type="button" icon={creatingJob ? Loader2 : Play} disabled={creatingJob} onClick={onRun}>
          {creatingJob ? "Creating Run..." : "Start Run"}
        </ActionButton>
        <p className="mt-3 text-center text-xs text-muted">This action will start the parsing run immediately.</p>
      </Card>
    </div>
  );
}

function RunningState({
  agentTask,
  events,
  files,
  jobRuns,
  jobSnapshots,
  onReset,
  progress,
}: {
  agentTask: AgentTaskDetail | null;
  events: JobEvent[];
  files: UploadedFile[];
  jobRuns: ParseJobRunResponse[];
  jobSnapshots: Record<string, ParseJob>;
  onReset: () => void;
  progress: JobProgress;
}) {
  const firstJob = jobRuns[0]?.job;
  const activity = events.length ? events : jobRuns.map((run) => ({
    id: run.job.id,
    jobId: run.job.id,
    timestamp: run.job.updated_at,
    message: `${run.plan.selected_parser_id} started on ${fileNameFor(files, run.job.file_id)}.`,
    status: "Parsing" as const,
  }));

  return (
    <div className="space-y-5">
      <Card className="border-emerald-200 bg-success-soft p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
            <div>
              <p className="text-base font-bold text-emerald-800">Parsing run created successfully.</p>
              <p className="text-sm text-emerald-700">Run ID: {firstJob?.id ?? "--"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href={firstJob?.id ? `/jobs/${firstJob.id}` : "/run-monitor"}>
              <ActionButton type="button" icon={ExternalLink} variant="secondary">View Run</ActionButton>
            </Link>
            <ActionButton type="button" onClick={onReset}>Create Another Run</ActionButton>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              {["Configure", "Preferences", "Submit"].map((label, index) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-success text-white">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{index + 1}. {label}</p>
                    <p className="text-xs text-muted">{index === 2 ? "Run submitted successfully" : "Settings and destinations set"}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="Execution progress" />
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-muted">Overall progress</p>
                <p className="text-xl font-bold text-ink">{progress.percent}%</p>
              </div>
              <p className="text-xs text-muted">Estimated completion {estimatedCompletion()}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
            </div>
            <StageProgress currentStage={progress.currentStage} complete={progress.percent >= 100} />

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs font-bold text-muted">
                  <tr>
                    <th className="border-b border-border py-3">File</th>
                    <th className="border-b border-border py-3">Parser in Use</th>
                    <th className="border-b border-border py-3">Status</th>
                    <th className="border-b border-border py-3">Quality So Far</th>
                    <th className="border-b border-border py-3">Last Update</th>
                    <th className="border-b border-border py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {files.map((file) => {
                    const run = jobRuns.find((item) => item.job.file_id === file.fileId);
                    const snapshot = run ? jobSnapshots[run.job.id] ?? run.job : null;
                    return (
                      <tr key={file.localId}>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <FileTypeIcon type={file.type} />
                            <div>
                              <p className="font-bold text-ink">{file.name}</p>
                              <p className="text-xs text-muted">{file.sizeLabel}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-ink">{run?.plan.selected_parser_id ?? "--"}</td>
                        <td className="py-3"><JobStatusPill status={snapshot?.status ?? "queued"} /></td>
                        <td className="py-3 text-sm font-bold text-success">{formatQuality(run?.quality.extraction_confidence ?? null)}</td>
                        <td className="py-3 text-muted">{snapshot ? timeLabel(snapshot.updated_at) : "--"}</td>
                        <td className="py-3"><MoreHorizontal className="h-4 w-4 text-muted" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="Live parser activity" />
            <div className="mt-4 space-y-3">
              {activity.map((event) => (
                <div key={event.id} className="grid grid-cols-[10px_90px_1fr_100px] items-center gap-3 text-sm">
                  <span className={`h-2 w-2 rounded-full ${event.status === "Completed" ? "bg-success" : event.status === "Failed" ? "bg-danger" : "bg-accent"}`} />
                  <span className="text-xs text-muted">{timeLabel(event.timestamp)}</span>
                  <span className="text-ink">{event.message}</span>
                  <StatusPill status={event.status === "Completed" ? "completed" : event.status === "Failed" || event.status === "Cancelled" ? "failed" : event.status === "Review Required" ? "review" : "queued"}>
                    {event.status}
                  </StatusPill>
                </div>
              ))}
            </div>
          </Card>

          {agentTask ? <AgentTracePanel task={agentTask} /> : null}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader title="Run summary" />
            <div className="mt-4 space-y-3">
              <SummaryMetric icon={FileCheck2} label="Files Processed" value={String(progress.processedFiles)} detail={`of ${progress.totalFiles}`} tone="info" />
              <SummaryMetric icon={Timer} label="Remaining" value={String(Math.max(0, progress.totalFiles - progress.processedFiles))} detail="In progress / queued" tone="accent" />
              <SummaryMetric icon={Timer} label="Elapsed Time" value="00:00:15" detail="Since run start" tone="success" />
              <SummaryMetric icon={Timer} label="Estimated Completion" value={estimatedCompletion(false)} detail="Local time" tone="purple" />
            </div>
          </Card>
          <Card className="p-4">
            <SectionHeader title="Next destinations" description="You can monitor or review results as the run progresses." />
            <div className="mt-4 space-y-3">
              {[
                ["Open Run Monitor", "Track all active runs", "/run-monitor"],
                ["Open Review Queue", "Review items as they complete", "/review-queue"],
                ["Open Assets", "View parsed outputs", "/assets"],
              ].map(([title, description, href]) => (
                <Link key={title} href={href} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface">
                  <span>
                    <span className="block font-bold text-ink">{title}</span>
                    <span className="text-xs text-muted">{description}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UploadedFileList({
  files,
  onRemove,
  totalSize,
}: {
  files: UploadedFile[];
  onRemove: (localId: string) => void;
  totalSize: number;
}) {
  if (!files.length) return null;
  return (
    <div className="mt-4 rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm">
        <span className="font-bold text-ink">{files.length} file{files.length === 1 ? "" : "s"} uploaded</span>
        <span className="text-muted">Total size: {formatBytes(totalSize)}</span>
      </div>
      <div className="divide-y divide-border">
        {files.map((file) => (
          <div key={file.localId} className="grid grid-cols-[1fr_72px_86px_28px] items-center gap-3 px-4 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <FileTypeIcon type={file.type} />
              <span className="truncate font-bold text-ink">{file.name}</span>
              {file.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : null}
              {file.status === "failed" ? <span className="text-xs text-danger">{file.error}</span> : null}
            </div>
            <span className="text-muted">{file.type.toUpperCase()}</span>
            <span className="text-muted">{file.sizeLabel}</span>
            <button className="text-muted hover:text-danger" type="button" onClick={() => onRemove(file.localId)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadSummary({ files, fileTypes }: { files: UploadedFile[]; fileTypes: Array<{ type: string; count: number }> }) {
  const uploaded = files.filter((file) => file.status === "uploaded").length;
  return (
    <Card className="p-4">
      <SectionHeader title="Parsing summary" />
      <div className="mt-4 space-y-4">
        <SummaryRow icon={FileText} title="Detected file types" value={fileTypes.length ? String(fileTypes.length) : "0"} detail={fileTypes.length ? fileTypes.map((item) => item.type.toUpperCase()).join(", ") : "See preview for details"} />
        <SummaryRow icon={CheckCircle2} title="Intake checks passed" value={`${uploaded} / ${files.length || 0}`} detail={uploaded ? "All uploaded files scanned and validated" : "Waiting for upload"} success />
        <SummaryRow icon={ShieldCheck} title="Governance" value="" detail="Policy: Default Parsing Policy. Data will be handled in accordance with organizational policies." />
        <SummaryRow icon={Settings2} title="What happens next" value="" detail="We'll profile your files and generate parser recommendations tailored to your content." />
      </div>
    </Card>
  );
}

function ConfigureSummary({ configuration, plan }: { configuration: ParseConfiguration; plan: ParsingPlan | null }) {
  return (
    <Card className="p-4">
      <SectionHeader title="Configuration summary" />
      <div className="mt-4 space-y-3">
        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-bold text-ink">Expected outputs</p>
          <div className="mt-3 space-y-2">
            {(plan?.expectedOutputs ?? ["Text content & structure", "Metadata & key properties", "Sections, pages, and tables"]).slice(0, 4).map((output) => (
              <p key={output} className="flex items-center gap-2 text-xs text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" /> {output}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-bold text-ink">Recommended skills</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(plan?.recommendedSkills ?? ["contract_parsing", "table_normalization"]).map((skill) => <Tag key={skill} tone="info">{skill}</Tag>)}
          </div>
        </div>
        <SummaryMetric icon={FileText} label="Estimated cost" value={plan?.estimatedCost ?? "~ $0.04"} detail="± 15%" tone="neutral" />
        <SummaryMetric icon={Timer} label="Estimated turnaround" value={plan?.estimatedDuration ?? "~ 2 min 30 sec"} detail="± 30 sec" tone="neutral" />
        <SummaryMetric icon={ShieldCheck} label="Policy coverage" value={plan?.policyCoverage ?? "High (92%+)"} detail="Based on current configuration" tone="success" />
      </div>
    </Card>
  );
}

function RecommendationTable({
  files,
  planning,
  recommendations,
}: {
  files: UploadedFile[];
  planning: boolean;
  recommendations: ParserRecommendation[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-surface text-xs font-bold text-muted">
          <tr>
            <th className="px-4 py-2.5">File Name</th>
            <th className="px-4 py-2.5">Primary Parser (Recommended)</th>
            <th className="px-4 py-2.5">Fallback Parser</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {files.map((file) => {
            const recommendation = recommendations.find((item) => item.fileId === file.fileId);
            return (
              <tr key={file.localId}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <FileTypeIcon type={file.type} />
                    <div>
                      <p className="font-bold text-ink">{file.name}</p>
                      <p className="text-xs text-muted">{file.sizeLabel} · {file.type.toUpperCase()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-ink">
                  {planning && !recommendation ? "Planning..." : recommendation?.primaryParserId ?? "--"}{" "}
                  {recommendation ? <Tag tone="success">Primary</Tag> : null}
                </td>
                <td className="px-4 py-2.5 text-ink">
                  {recommendation?.fallbackParserId ?? "No fallback"}{" "}
                  {recommendation?.fallbackParserId ? <Tag tone="info">Fallback</Tag> : null}
                </td>
                <td className="px-4 py-2.5"><MoreHorizontal className="h-4 w-4 text-muted" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ObjectiveButton({
  active,
  description,
  icon: Icon,
  onClick,
  title,
}: {
  active: boolean;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`min-h-[112px] rounded-md border p-3 text-left ${active ? "border-accent bg-accent-soft/50" : "border-border bg-white hover:bg-surface"}`}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className={active ? "h-5 w-5 text-accent" : "h-5 w-5 text-muted"} />
        <span className={`grid h-4 w-4 place-items-center rounded-full border ${active ? "border-accent bg-accent" : "border-slate-300"}`}>
          {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
    </button>
  );
}

function ConfigSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <select
        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold text-ink shadow-panel outline-none focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid grid-cols-[160px_1fr] items-center gap-3 text-sm">
      <span className="font-semibold text-muted">{label}</span>
      <input
        className="h-9 rounded-md border border-border bg-white px-3 text-sm text-ink outline-none focus:border-accent"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleRow({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button className="flex h-9 items-center justify-between text-sm" type="button" onClick={onClick}>
      <span className="font-semibold text-ink">{label}</span>
      <Toggle checked={checked} />
    </button>
  );
}

function SummaryRow({
  detail,
  icon: Icon,
  success = false,
  title,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  success?: boolean;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`${success ? "bg-success-soft text-success" : "bg-accent-soft text-accent"} grid h-9 w-9 shrink-0 place-items-center rounded-md`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{title}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{detail}</p>
          </div>
        </div>
        {value ? <span className="text-lg font-bold text-ink">{value}</span> : null}
      </div>
    </div>
  );
}

function SummaryMetric({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "neutral" | "success" | "info" | "accent" | "purple";
  value: string;
}) {
  const toneClass = {
    neutral: "bg-surface text-muted",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
    accent: "bg-accent-soft text-accent",
    purple: "bg-purple-soft text-purple",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-xl font-bold text-ink">{value}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

function PreviewCell({ label, success = false, value }: { label: string; success?: boolean; value: string }) {
  return (
    <div className="border-b border-border p-3 md:border-b-0 md:border-r md:last:border-r-0">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${success ? "text-success" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function OutputIcons() {
  return (
    <div className="flex gap-2">
      {[FileText, Table2, GitBranch, Network].map((Icon, index) => (
        <span key={index} className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted">
          <Icon className="h-4 w-4" />
        </span>
      ))}
    </div>
  );
}

function OutputTag({ label }: { label: string }) {
  const Icon = label.toLowerCase().includes("table")
    ? Table2
    : label.toLowerCase().includes("relationship")
      ? GitBranch
      : label.toLowerCase().includes("chunk")
        ? Layers3
        : FileText;
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-ink">
      <Icon className="h-4 w-4 text-muted" /> {label}
    </span>
  );
}

function RunConfig({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function StageProgress({ currentStage, complete }: { currentStage: string; complete: boolean }) {
  const stages = ["intake", "profiling", "parsing", "validation", "publish"];
  const current = stages.indexOf(currentStage);
  return (
    <div className="mt-6 grid grid-cols-5 gap-3">
      {stages.map((stage, index) => {
        const done = complete || index < current;
        const active = !complete && index === current;
        return (
          <div key={stage} className="text-center text-sm">
            <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full border ${done ? "border-success bg-success text-white" : active ? "border-accent text-accent" : "border-slate-300 text-muted"}`}>
              {done ? <Check className="h-3 w-3" /> : null}
            </span>
            <p className="mt-2 font-semibold capitalize text-ink">{stage}</p>
            <p className="text-xs text-muted">{done ? "Complete" : active ? "In Progress" : "Pending"}</p>
          </div>
        );
      })}
    </div>
  );
}

function JobStatusPill({ status }: { status: string }) {
  if (status === "complete") return <StatusPill status="completed">Completed</StatusPill>;
  if (status === "failed") return <StatusPill status="failed">Failed</StatusPill>;
  if (status === "cancelled") return <StatusPill status="failed">Cancelled</StatusPill>;
  if (status === "review_required") return <StatusPill status="review">Review Required</StatusPill>;
  if (status === "running") return <StatusPill status="queued">In Progress</StatusPill>;
  if (status === "planning") return <StatusPill status="queued">Profiling</StatusPill>;
  return <StatusPill status="queued">Queued</StatusPill>;
}

function Toast({
  message,
  onClose,
  tone,
}: {
  message: string;
  onClose: () => void;
  tone: "success" | "warning" | "danger";
}) {
  const classes = {
    success: "border-emerald-200 bg-success-soft text-emerald-800",
    warning: "border-amber-200 bg-warning-soft text-amber-800",
    danger: "border-red-200 bg-danger-soft text-red-800",
  };
  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold ${classes[tone]}`}>
      <span>{message}</span>
      <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mt-3 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm text-red-700">{message}</div>;
}

function summarizeFileTypes(files: UploadedFile[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  files.forEach((file) => {
    const type = file.profile?.file_type ?? file.type;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });
  return Array.from(counts, ([type, count]) => ({ type, count }));
}

function summarizeLanguages(files: UploadedFile[]): string[] {
  const languages = new Set<string>();
  files.forEach((file) => {
    if (file.profile?.language) languages.add(file.profile.language);
  });
  return Array.from(languages).slice(0, 3);
}

function complexitySignals(files: UploadedFile[]): string[] {
  const signals = new Set<string>();
  files.forEach((file) => {
    if (file.profile?.layout_complexity) signals.add(file.profile.layout_complexity);
    if ((file.profile?.table_likelihood ?? 0) > 0.25) signals.add("Tables");
    if ((file.profile?.image_likelihood ?? 0) > 0.4) signals.add("Images");
    if (file.profile?.modalities?.some((modality) => ["audio", "video"].includes(modality))) signals.add("Multimedia");
  });
  return Array.from(signals).slice(0, 3);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function objectiveTitle(objective: ParseObjective): string {
  return objectives.find((item) => item.id === objective)?.title ?? "General Parsing";
}

function reviewPolicyLabel(policy: ParseConfiguration["humanReviewPolicy"]): string {
  const labels = {
    review_if_70: "Low (70% confidence)",
    review_if_85: "Medium (85% confidence)",
    review_if_92: "High (92% confidence)",
    always: "Always review",
    never: "No human review",
  };
  return labels[policy];
}

function formatScore(value: number | undefined): string {
  return value === undefined ? "--" : `${Math.round(value * 100)}%`;
}

function formatQuality(value: number | null): string {
  return value === null ? "--" : `${Math.round(value * 100)}%`;
}

function fileNameFor(files: UploadedFile[], fileId: string): string {
  return files.find((file) => file.fileId === fileId)?.name ?? "document";
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function estimatedCompletion(withZone = true): string {
  const date = new Date(Date.now() + 150_000);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: withZone ? "short" : undefined,
  }).format(date);
}
