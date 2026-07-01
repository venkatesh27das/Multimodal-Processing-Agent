"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Brain,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  GitBranch,
  Hammer,
  Network,
  ShieldCheck,
  Sparkles,
  Timer,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  AgentArtifact,
  AgentDecision,
  AgentSkillInvocation,
  AgentStep,
  AgentTaskDetail,
  AgentToolCall,
} from "@/api/agent";
import { ActionButton, Card, StatusPill, Tag } from "@/components/design-system";

type AgentTracePanelProps = {
  task: AgentTaskDetail;
  compact?: boolean;
};

type TraceTone = "success" | "warning" | "info" | "purple" | "accent";

const phaseOrder = ["observe", "plan", "act", "evaluate", "repair", "publish"];

export function AgentTracePanel({ compact = false, task }: AgentTracePanelProps) {
  const [selectedStepKind, setSelectedStepKind] = useState("plan");
  const toolPolicy = getRecord(task.input_payload.tool_policy) ?? getToolPolicyFromDecision(task.decisions);
  const steps = useMemo(() => normalizeSteps(task), [task]);
  const selectedStep = steps.find((step) => step.kind === selectedStepKind) ?? steps[0];
  const selectedSkill = task.skill_invocations[0];
  const confidence = numericDimension(task, "extraction_confidence") ?? numericDimension(task, "parser_confidence");
  const confidenceLabel = confidence === null ? "--" : `${Math.round(confidence * 100)}%`;
  const threshold = numericThreshold(task) ?? task.plan?.quality_threshold ?? null;
  const thresholdLabel = threshold === null ? "--" : `${Math.round(threshold * 100)}%`;
  const fallbackParser = task.plan?.fallback_parser_id ?? lineageText(task, "parser_id");
  const reviewRequired = task.status === "awaiting_review" || Boolean(task.quality_judgement?.review_rationale);
  const visibleToolCalls = compact ? task.tool_calls.slice(0, 5) : task.tool_calls;
  const groupedArtifacts = groupArtifacts(compact ? task.artifacts.slice(0, 9) : task.artifacts);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">Agent Trace</h3>
          <p className="mt-1 text-sm text-muted">Reasoning, lifecycle, decisions, tool policy, and generated trace artifacts.</p>
        </div>
        <ActionButton icon={Download} variant="secondary" onClick={() => downloadTrace(task)}>Download Trace</ActionButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <TraceSummaryCard icon={Timer} label="Agent Status" value={reviewRequired ? "Awaiting Review" : formatLabel(task.status)} detail={reviewRequired ? "Run requires human review" : task.summary ?? "Agent task trace"} tone="warning" />
        <TraceSummaryCard icon={Brain} label="Selected Strategy" value={task.plan?.selected_parser_id ?? "Pending"} detail={fallbackParser ? "with fallback" : "primary parser"} tone="purple" />
        <TraceSummaryCard icon={Clock3} label="Confidence" value={confidenceLabel} detail={`Threshold: ${thresholdLabel}`} tone={reviewRequired ? "warning" : "success"} meter={confidence ?? undefined} />
        <TraceSummaryCard icon={Sparkles} label="Review Trigger" value={reviewRequired ? "Quality below threshold" : "No review required"} detail={task.quality_judgement?.summary ?? "Quality judgement pending"} tone="accent" />
        <TraceSummaryCard icon={GitBranch} label="Fallback Used" value={fallbackParser ?? "None"} detail={selectedSkill ? `+ ${selectedSkill.skill_id}` : "No selected skill"} tone="success" />
      </div>

      <Card className="p-4">
        <TraceSectionTitle icon={Activity} title="Reasoning Flow" />
        <div className="mt-4 grid gap-3 xl:grid-cols-6">
          {steps.map((step, index) => (
            <ReasoningStep
              key={step.id}
              active={step.kind === selectedStep.kind}
              index={index + 1}
              step={step}
              onSelect={() => setSelectedStepKind(step.kind)}
            />
          ))}
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_minmax(360px,0.9fr)]">
        <Card className="p-4">
          <TraceSectionTitle icon={Activity} title="Trace Timeline" />
          <div className="mt-3 space-y-2">
            {steps.map((step) => (
              <TimelineStep
                key={step.id}
                active={step.kind === selectedStep.kind}
                step={step}
                onSelect={() => setSelectedStepKind(step.kind)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <TraceSectionTitle icon={Brain} title={`Step Details: ${formatLabel(selectedStep.kind)}`} />
          <div className="mt-3 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <StepDetailBlock title="Objective" text={stepObjective(selectedStep, task)} />
              <StepSignals step={selectedStep} task={task} />
            </div>
            <div className="space-y-3">
              <StepDetailBlock title="Reasoning" text={selectedStep.summary} />
              <ParserConsiderationTable task={task} />
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-bold text-muted">Output Artifact</p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{artifactForStep(selectedStep, task)?.title ?? "Trace artifact pending"}</span>
                  <button className="text-xs font-bold text-info" type="button">View</button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <TraceSectionTitle icon={Sparkles} title="Decision Evidence" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <DecisionEvidenceCard title="Parser Strategy Decision" tone="purple" rows={parserDecisionRows(task)} />
            <DecisionEvidenceCard title="Tool Policy Decision" tone="info" rows={toolPolicyRows(toolPolicy)} />
            <DecisionEvidenceCard title="Fallback Decision" tone="warning" rows={fallbackDecisionRows(task)} />
            <DecisionEvidenceCard title="Review Decision" tone="accent" rows={reviewDecisionRows(task, confidenceLabel, thresholdLabel)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="p-4">
          <TraceSectionTitle icon={Wrench} title="Tool Calls And Policy" />
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="border-b border-border p-2">Step</th>
                  <th className="border-b border-border p-2">Tool / Parser</th>
                  <th className="border-b border-border p-2">Purpose</th>
                  <th className="border-b border-border p-2">Policy Result</th>
                  <th className="border-b border-border p-2">Status</th>
                  <th className="border-b border-border p-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleToolCalls.map((toolCall) => (
                  <ToolCallRow key={toolCall.id} toolCall={toolCall} />
                ))}
                {!visibleToolCalls.length ? (
                  <tr><td className="p-3 text-muted" colSpan={6}>Tool call records will appear as the planner and executors run.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <TraceSectionTitle icon={FileText} title="Artifacts" />
            <button className="text-xs font-bold text-info" type="button">View all artifacts</button>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <ArtifactGroup title="Planning Artifacts" artifacts={groupedArtifacts.planning} />
            <ArtifactGroup title="Execution Artifacts" artifacts={groupedArtifacts.execution} />
            <ArtifactGroup title="Governance Artifacts" artifacts={groupedArtifacts.governance} />
          </div>
        </Card>
      </div>

      {!compact && task.subtasks.length ? (
        <Card className="p-4">
          <TraceSectionTitle icon={Boxes} title="Internal Subagents" />
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {task.subtasks.map((subtask) => (
              <div key={subtask.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-ink">{subtask.subagent_id}</p>
                  <Tag tone={subtask.status === "completed" ? "success" : "info"}>{formatLabel(subtask.status)}</Tag>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{subtask.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function TraceSummaryCard({
  detail,
  icon: Icon,
  label,
  meter,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  meter?: number;
  tone: TraceTone;
  value: string;
}) {
  const toneClasses = {
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    purple: "bg-purple-soft text-purple",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${toneClasses[tone]}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-muted">{label}</p>
          <p className="mt-1 truncate text-base font-bold text-ink">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{detail}</p>
          {typeof meter === "number" ? (
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, Math.round(meter * 100)))}%` }} />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function TraceSectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
      <p className="text-sm font-bold text-ink">{title}</p>
    </div>
  );
}

function ReasoningStep({
  active,
  index,
  onSelect,
  step,
}: {
  active: boolean;
  index: number;
  onSelect: () => void;
  step: AgentStep;
}) {
  return (
    <button
      className={`relative rounded-md border p-3 text-left transition hover:bg-surface ${active ? "border-accent bg-accent-soft/30" : "border-border"}`}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success-soft text-xs font-bold text-success">{index}</span>
        <span className="font-bold text-ink">{formatLabel(step.kind)}</span>
        <Tag tone={stepStatusTone(step.status)}>{formatLabel(step.status)}</Tag>
      </div>
      <p className="mt-2 line-clamp-3 text-xs text-muted">{step.summary}</p>
    </button>
  );
}

function TimelineStep({
  active,
  onSelect,
  step,
}: {
  active: boolean;
  onSelect: () => void;
  step: AgentStep;
}) {
  return (
    <button
      className={`w-full rounded-md border px-3 py-2 text-left transition hover:bg-surface ${active ? "border-accent bg-accent-soft/30" : "border-border"}`}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${step.status === "completed" ? "text-success" : "text-muted"}`} />
          <span className="truncate text-sm font-bold text-ink">{formatLabel(step.kind)}</span>
        </span>
        <Tag tone={stepStatusTone(step.status)}>{formatLabel(step.status)}</Tag>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatDateTime(step.created_at)}</span>
        <span>{stepDuration(step)}</span>
      </div>
    </button>
  );
}

function StepDetailBlock({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-bold text-muted">{title}</p>
      <p className="mt-2 text-sm text-ink">{text}</p>
    </div>
  );
}

function StepSignals({ step, task }: { step: AgentStep; task: AgentTaskDetail }) {
  const profile = getRecord(task.artifacts.find((artifact) => artifact.kind === "file_profile")?.payload.profile);
  const rows: Array<[string, string]> = [
    ["File type", stringifyValue(profile?.file_type ?? task.input_payload.file_type ?? "Unknown")],
    ["Layout risk", stringifyValue(profile?.layout_complexity ?? "Unknown")],
    ["Table likelihood", stringifyPercent(profile?.table_likelihood)],
    ["Text layer", profile?.has_text_layer === false ? "Not available" : profile?.has_text_layer === true ? "Available" : "Unknown"],
    ["Step tool", stringifyValue(step.payload.tool ?? "N/A")],
  ];
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-bold text-muted">Input Signals</p>
      <KeyValueList rows={rows} />
    </div>
  );
}

function ParserConsiderationTable({ task }: { task: AgentTaskDetail }) {
  const plan = task.plan;
  const rows = [
    [plan?.selected_parser_id ?? "Pending", scoreFromPlan(task), "Selected primary parser"],
    [plan?.fallback_parser_id ?? "None", "--", "Fallback parser"],
    [plan?.selected_skill_id ?? "No skill", "--", "Selected skill"],
  ];
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-bold text-muted">Parsers Considered</p>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-muted">
          <tr><th className="border-b border-border py-1">Parser</th><th className="border-b border-border py-1">Score</th><th className="border-b border-border py-1">Reason</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([parser, score, reason]) => <tr key={parser}><td className="py-1 font-semibold text-ink">{parser}</td><td className="py-1 text-muted">{score}</td><td className="py-1 text-muted">{reason}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function DecisionEvidenceCard({
  rows,
  title,
  tone,
}: {
  rows: Array<[string, string]>;
  title: string;
  tone: TraceTone;
}) {
  const toneClasses = {
    accent: "text-accent",
    info: "text-info",
    purple: "text-purple",
    success: "text-success",
    warning: "text-warning",
  };
  return (
    <div className="rounded-md border border-border p-3">
      <p className={`text-sm font-bold ${toneClasses[tone]}`}>{title}</p>
      <KeyValueList rows={rows} />
    </div>
  );
}

function ToolCallRow({ toolCall }: { toolCall: AgentToolCall }) {
  const allowed = getRecord(toolCall.response_payload)?.allowed;
  return (
    <tr>
      <td className="p-2 font-semibold text-ink">{stepFromToolCall(toolCall)}</td>
      <td className="p-2 font-semibold text-ink">{toolCall.tool_id}</td>
      <td className="p-2 text-muted">{toolCall.input_summary ?? toolCall.output_summary ?? "Tool policy check"}</td>
      <td className="p-2"><Tag tone={allowed === false || toolCall.status === "blocked" ? "warning" : "success"}>{allowed === false || toolCall.status === "blocked" ? "Blocked" : "Allowed"}</Tag></td>
      <td className="p-2"><Tag tone={toolCall.status === "complete" || toolCall.status === "completed" ? "success" : toolCall.status === "blocked" ? "warning" : "info"}>{formatLabel(toolCall.status)}</Tag></td>
      <td className="p-2 text-muted">{toolCall.duration_ms ? `${toolCall.duration_ms}ms` : "N/A"}</td>
    </tr>
  );
}

function ArtifactGroup({ artifacts, title }: { artifacts: AgentArtifact[]; title: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-bold text-ink">{title}</p>
      <div className="mt-3 space-y-2">
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-2 py-1.5 text-xs">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{artifact.title}</span>
              <span className="text-muted">{formatLabel(artifact.kind)}</span>
            </span>
            <button className="shrink-0 font-bold text-info" type="button">View</button>
          </div>
        ))}
        {!artifacts.length ? <p className="text-xs text-muted">No artifacts yet.</p> : null}
      </div>
    </div>
  );
}

function KeyValueList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="min-w-0">
          <dt className="font-bold text-muted">{label}</dt>
          <dd className="truncate font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function normalizeSteps(task: AgentTaskDetail): AgentStep[] {
  if (!task.steps.length) return fallbackAgentSteps(task.status);
  const byPhase = new Map<string, AgentStep>();
  task.steps.forEach((step) => {
    const phase = normalizedPhase(step.kind);
    if (!byPhase.has(phase) || step.sequence > Number(byPhase.get(phase)?.sequence ?? 0)) {
      byPhase.set(phase, { ...step, kind: phase });
    }
  });
  return phaseOrder
    .map((phase) => byPhase.get(phase))
    .filter((step): step is AgentStep => Boolean(step));
}

function normalizedPhase(kind: string) {
  const lower = kind.toLowerCase();
  if (lower.includes("observe")) return "observe";
  if (lower.includes("plan")) return "plan";
  if (lower.includes("act") || lower.includes("execute")) return "act";
  if (lower.includes("evaluate")) return "evaluate";
  if (lower.includes("repair") || lower.includes("fallback")) return "repair";
  if (lower.includes("publish")) return "publish";
  return lower;
}

function fallbackAgentSteps(status: AgentTaskDetail["status"]): AgentStep[] {
  return [{
    id: "pending-agent-step",
    kind: status === "accepted" ? "accepted" : "executing",
    status: "running",
    sequence: 1,
    title: "Agent task pending",
    summary: "Waiting for persisted agent step records.",
    payload: {},
    created_at: new Date().toISOString(),
  }];
}

function stepObjective(step: AgentStep, task: AgentTaskDetail) {
  if (step.kind === "observe") return "Profile the input file and identify modality, layout, and parsing constraints.";
  if (step.kind === "plan") return "Create a parsing plan and select the best parser strategy.";
  if (step.kind === "act") return "Execute selected parser adapters and extraction skills.";
  if (step.kind === "evaluate") return "Score confidence, completeness, consistency, and review need.";
  if (step.kind === "repair") return task.plan?.fallback_parser_id ? "Apply fallback parser or repair strategy." : "Confirm no repair is required.";
  if (step.kind === "publish") return "Publish governed assets, quality, lineage, and audit context.";
  return step.title;
}

function artifactForStep(step: AgentStep, task: AgentTaskDetail) {
  const kindByStep: Record<string, string[]> = {
    observe: ["file_profile"],
    plan: ["parsing_plan"],
    act: ["parser_output", "skill_output"],
    evaluate: ["quality_report"],
    repair: ["fallback_report"],
    publish: ["parsed_asset", "lineage_report", "audit_summary"],
  };
  const kinds = kindByStep[step.kind] ?? [];
  return task.artifacts.find((artifact) => kinds.includes(artifact.kind));
}

function parserDecisionRows(task: AgentTaskDetail): Array<[string, string]> {
  return [
    ["Selected", task.plan?.selected_parser_id ?? "Pending"],
    ["Alternatives", String(task.decisions.find((decision) => decision.decision_type.includes("parser"))?.alternatives.length ?? (task.plan?.fallback_parser_id ? 1 : 0))],
    ["Reason", task.plan?.summary ?? task.plan?.payload?.decision_reason?.toString() ?? "Planner rationale pending"],
  ];
}

function toolPolicyRows(policy: Record<string, unknown> | null): Array<[string, string]> {
  const allowed = getArray(policy?.allowed_tool_ids).length || getArray(policy?.allowed_tools).length;
  const blocked = getArray(policy?.blocked_tool_ids).length || getArray(policy?.blocked_tools).length;
  return [
    ["Selected", policy?.external_services_allowed ? "external_allowed" : "local_tools_only"],
    ["Allowed tools", String(allowed)],
    ["Blocked tools", String(blocked)],
    ["Reason", policy?.external_services_allowed ? "Governance allows external tools" : "Governance policy restricted external tools"],
  ];
}

function fallbackDecisionRows(task: AgentTaskDetail): Array<[string, string]> {
  return [
    ["Fallback used", task.plan?.fallback_parser_id ? "Yes" : "No"],
    ["Fallback parser", task.plan?.fallback_parser_id ?? "None"],
    ["Reason", task.quality_judgement?.review_rationale ? "Primary confidence below threshold" : "Fallback policy followed"],
  ];
}

function reviewDecisionRows(task: AgentTaskDetail, confidence: string, threshold: string): Array<[string, string]> {
  return [
    ["Review required", task.status === "awaiting_review" ? "Yes" : "No"],
    ["Confidence", confidence],
    ["Threshold", threshold],
    ["Reason", task.quality_judgement?.review_rationale ?? "No review rationale recorded"],
  ];
}

function groupArtifacts(artifacts: AgentArtifact[]) {
  return {
    planning: artifacts.filter((artifact) => ["file_profile", "parsing_plan", "agent_reasoning"].includes(artifact.kind)),
    execution: artifacts.filter((artifact) => ["parser_output", "skill_output", "parsed_asset"].includes(artifact.kind)),
    governance: artifacts.filter((artifact) => ["quality_report", "fallback_report", "review_request", "lineage_report", "audit_summary"].includes(artifact.kind)),
  };
}

function getToolPolicyFromDecision(decisions: AgentDecision[]) {
  const decision = decisions.find((item) => item.decision_type === "tool_policy");
  return getRecord(getRecord(decision?.payload)?.policy);
}

function numericDimension(task: AgentTaskDetail, key: string) {
  const value = task.quality_judgement?.dimensions[key];
  return typeof value === "number" ? value : null;
}

function numericThreshold(task: AgentTaskDetail) {
  const value = task.quality_judgement?.thresholds?.quality_threshold;
  return typeof value === "number" ? value : null;
}

function lineageText(task: AgentTaskDetail, key: string) {
  return stringifyValue(task.lineage?.payload?.[key]);
}

function scoreFromPlan(task: AgentTaskDetail) {
  const value = task.plan?.payload?.expected_quality ?? task.plan?.payload?.score;
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function stepDuration(step: AgentStep) {
  const value = step.payload.duration_ms;
  return typeof value === "number" ? `${value}ms` : "--";
}

function stepFromToolCall(toolCall: AgentToolCall) {
  if (toolCall.tool_id.startsWith("parser:")) return "Act";
  if (toolCall.tool_id.includes("quality")) return "Evaluate";
  if (toolCall.tool_id.includes("table")) return "Repair";
  if (toolCall.tool_id.includes("publisher")) return "Publish";
  return toolCall.sequence < 50 ? "Plan" : "Act";
}

function downloadTrace(task: AgentTaskDetail) {
  const blob = new Blob([JSON.stringify(task, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-trace-${task.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function agentStatusTone(status: AgentTaskDetail["status"]) {
  if (status === "failed") return "failed";
  if (status === "awaiting_review") return "review";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "warning";
  return "queued";
}

function stepStatusTone(status: string): "neutral" | "accent" | "success" | "warning" | "info" | "purple" {
  if (status === "completed") return "success";
  if (status === "failed") return "warning";
  if (status === "skipped") return "neutral";
  return "info";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function stringifyPercent(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unknown";
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
