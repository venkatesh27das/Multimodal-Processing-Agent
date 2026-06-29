"use client";

import {
  Activity,
  AlertTriangle,
  Boxes,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  Hammer,
  Network,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  AgentArtifact,
  AgentDecision,
  AgentSkillInvocation,
  AgentTaskDetail,
  AgentToolCall,
} from "@/api/agent";
import { Card, SectionHeader, StatusPill, Tag } from "@/components/design-system";

type AgentTracePanelProps = {
  task: AgentTaskDetail;
  compact?: boolean;
};

export function AgentTracePanel({ compact = false, task }: AgentTracePanelProps) {
  const reasoning = task.artifacts.find((artifact) => artifact.kind === "agent_reasoning");
  const toolPolicy = getRecord(task.input_payload.tool_policy) ?? getToolPolicyFromDecision(task.decisions);
  const selectedSkill = task.skill_invocations[0];
  const visibleArtifacts = compact ? task.artifacts.slice(0, 6) : task.artifacts;
  const visibleToolCalls = compact ? task.tool_calls.slice(0, 8) : task.tool_calls;

  return (
    <Card className="p-4">
      <SectionHeader
        title="Agent trace"
        description="Plan, timeline, reasoning, tool policy, skills, artifacts, quality, and worker state."
        action={<StatusPill status={agentStatusTone(task.status)}>{formatLabel(task.status)}</StatusPill>}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TraceMetric icon={GitBranch} label="Task" value={shortId(task.id)} detail={task.summary ?? "Agent task trace"} />
        <TraceMetric icon={Brain} label="Parser" value={task.plan?.selected_parser_id ?? "Pending"} detail={task.plan?.summary ?? "Strategy pending"} />
        <TraceMetric icon={CheckCircle2} label="Quality" value={task.quality_judgement?.status ?? "Pending"} detail={task.quality_judgement?.summary ?? "Quality pending"} />
        <TraceMetric icon={Clock3} label="Worker" value={`${task.attempt_count}/${task.max_attempts}`} detail={workerDetail(task)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <TraceSection title="Timeline" icon={Activity}>
            <div className="space-y-2">
              {(task.steps.length ? task.steps : fallbackAgentSteps(task.status)).map((step) => (
                <div key={step.id} className="grid gap-2 rounded-md border border-border px-3 py-2 text-sm md:grid-cols-[94px_96px_minmax(0,1fr)]">
                  <span className="font-bold capitalize text-ink">{formatLabel(step.kind)}</span>
                  <Tag tone={stepStatusTone(step.status)}>{formatLabel(step.status)}</Tag>
                  <span className="min-w-0 text-muted">{step.summary}</span>
                </div>
              ))}
            </div>
          </TraceSection>

          <TraceSection title="Decisions" icon={Sparkles}>
            <div className="grid gap-2 lg:grid-cols-2">
              {task.decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)}
              {!task.decisions.length ? <EmptyTraceText text="Agent decisions will appear after planning starts." /> : null}
            </div>
          </TraceSection>

          <TraceSection title="Tool Calls And Policy" icon={Wrench}>
            <ToolPolicySummary policy={toolPolicy} />
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {visibleToolCalls.map((toolCall) => <ToolCallCard key={toolCall.id} toolCall={toolCall} />)}
              {!task.tool_calls.length ? <EmptyTraceText text="Tool call records will appear as the planner and executors run." /> : null}
            </div>
          </TraceSection>

          <TraceSection title="Skill Selection" icon={Hammer}>
            <SkillSummary invocation={selectedSkill} reasoningPayload={getRecord(reasoning?.payload)} />
          </TraceSection>
        </div>

        <div className="space-y-4">
          <TraceSection title="Artifacts" icon={FileText}>
            <div className="space-y-2">
              {visibleArtifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
              {!task.artifacts.length ? <EmptyTraceText text="Artifacts will appear as the agent publishes trace records." /> : null}
            </div>
          </TraceSection>

          <TraceSection title="Quality And Lineage" icon={ShieldCheck}>
            <KeyValueList
              rows={[
                ["Quality", task.quality_judgement?.status ?? "Pending"],
                ["Threshold", stringifyValue(task.quality_judgement?.thresholds?.quality_threshold ?? task.plan?.quality_threshold ?? "Pending")],
                ["Review", task.quality_judgement?.review_rationale ? "Required" : "Not required"],
                ["Source", task.lineage?.source_file_id ? shortId(task.lineage.source_file_id) : "Pending"],
                ["Asset", task.lineage?.asset_id ? shortId(task.lineage.asset_id) : "Pending"],
              ]}
            />
          </TraceSection>

          {reasoning ? (
            <TraceSection title="Reasoning" icon={Network}>
              <p className="text-sm text-ink">{reasoning.summary}</p>
              <ReasoningHighlights payload={getRecord(reasoning.payload)} />
            </TraceSection>
          ) : null}

          {!compact && task.subtasks.length ? (
            <TraceSection title="Subagents" icon={Boxes}>
              <div className="space-y-2">
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
            </TraceSection>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function TraceMetric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-2 truncate text-sm font-bold text-ink">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{detail}</p>
    </div>
  );
}

function TraceSection({ children, icon: Icon, title }: { children: React.ReactNode; icon: LucideIcon; title: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      </div>
      {children}
    </section>
  );
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{decision.title}</p>
        <Tag tone="info">{formatLabel(decision.decision_type)}</Tag>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{decision.summary}</p>
      <KeyValueList
        rows={[
          ["Selected", decision.selected_option ?? "None"],
          ["Alternatives", String(decision.alternatives.length)],
        ]}
      />
    </div>
  );
}

function ToolPolicySummary({ policy }: { policy: Record<string, unknown> | null }) {
  if (!policy) return <EmptyTraceText text="Tool policy snapshot is not available yet." />;
  const allowed = getArray(policy.allowed_tool_ids).length || getArray(policy.allowed_tools).length;
  const blocked = getArray(policy.blocked_tool_ids).length || getArray(policy.blocked_tools).length;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <MiniStat label="External" value={policy.external_services_allowed ? "Allowed" : "Blocked"} />
      <MiniStat label="Allowed tools" value={String(allowed)} />
      <MiniStat label="Blocked tools" value={String(blocked)} />
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: AgentToolCall }) {
  const allowed = getRecord(toolCall.response_payload)?.allowed;
  const blockedReasons = getArray(getRecord(toolCall.response_payload)?.blocked_reasons);
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{toolCall.tool_id}</p>
        <Tag tone={toolCall.status === "blocked" ? "warning" : toolCall.status === "failed" ? "warning" : "success"}>{formatLabel(toolCall.status)}</Tag>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{toolCall.output_summary ?? toolCall.input_summary ?? "Tool record persisted."}</p>
      <KeyValueList
        rows={[
          ["Allowed", typeof allowed === "boolean" ? (allowed ? "Yes" : "No") : "Unknown"],
          ["Duration", toolCall.duration_ms ? `${toolCall.duration_ms} ms` : "N/A"],
          ["Reason", blockedReasons.length ? blockedReasons.map(String).join(", ") : "N/A"],
        ]}
      />
    </div>
  );
}

function SkillSummary({
  invocation,
  reasoningPayload,
}: {
  invocation: AgentSkillInvocation | undefined;
  reasoningPayload: Record<string, unknown> | null;
}) {
  const selectedMetadata = getRecord(invocation?.payload.selected_skill_metadata);
  const invocationCandidates = getArray(invocation?.payload.candidate_skills);
  const reasoningCandidates = getArray(reasoningPayload?.planner_selectable_skills);
  const candidates = invocationCandidates.length ? invocationCandidates : reasoningCandidates;
  if (!invocation && !candidates.length) return <EmptyTraceText text="No planner-selectable skills were recorded for this task." />;
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{invocation?.skill_id ?? "No selected skill"}</p>
        <Tag tone={invocation?.status === "completed" ? "success" : "neutral"}>{formatLabel(invocation?.status ?? "candidates")}</Tag>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{invocation?.output_summary ?? selectedMetadata?.description?.toString() ?? "Planner candidate metadata captured."}</p>
      <KeyValueList
        rows={[
          ["Candidates", String(candidates.length)],
          ["Outputs", getArray(selectedMetadata?.produced_outputs).map(String).join(", ") || "N/A"],
          ["Latency", selectedMetadata?.latency_profile?.toString() ?? "N/A"],
        ]}
      />
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: AgentArtifact }) {
  return (
    <details className="rounded-md border border-border px-3 py-2">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-ink">{artifact.title}</p>
          <Tag>{formatLabel(artifact.kind)}</Tag>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{artifact.summary}</p>
      </summary>
      <JsonPreview value={artifact.payload} />
    </details>
  );
}

function ReasoningHighlights({ payload }: { payload: Record<string, unknown> | null }) {
  if (!payload) return null;
  return (
    <KeyValueList
      rows={[
        ["Parser", stringifyValue(payload.selected_parser ?? "Pending")],
        ["Fallback", stringifyValue(payload.fallback_parser ?? "None")],
        ["Skill", stringifyValue(payload.selected_skill ?? "None")],
        ["Decision", stringifyValue(payload.publish_decision ?? "Pending")],
      ]}
    />
  );
}

function KeyValueList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="min-w-0">
          <dt className="font-bold text-muted">{label}</dt>
          <dd className="truncate text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyTraceText({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-sm text-muted">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function fallbackAgentSteps(status: AgentTaskDetail["status"]) {
  return [
    {
      id: "pending-agent-step",
      kind: status === "accepted" ? "accepted" : "executing",
      status: "running",
      summary: "Waiting for persisted agent step records.",
    },
  ];
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

function getToolPolicyFromDecision(decisions: AgentDecision[]) {
  const decision = decisions.find((item) => item.decision_type === "tool_policy");
  return getRecord(getRecord(decision?.payload)?.policy);
}

function workerDetail(task: AgentTaskDetail) {
  if (task.worker_id) return `${task.worker_id} until ${formatDate(task.lock_expires_at)}`;
  if (task.next_attempt_at) return `Retry at ${formatDate(task.next_attempt_at)}`;
  return "No active worker lock.";
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
