import type {
  CostProfile,
  JobEvent,
  LatencyProfile,
  ParseConfiguration,
  ParseObjective,
  QualityTarget,
} from "@/api/jobs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type AgentTaskStatus =
  | "submitted"
  | "accepted"
  | "observing"
  | "planning"
  | "executing"
  | "evaluating"
  | "repairing"
  | "awaiting_review"
  | "publishing"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentTask = {
  id: string;
  status: AgentTaskStatus;
  title: string;
  summary: string | null;
  file_id: string | null;
  job_id: string | null;
  requested_output_contract: Record<string, unknown>;
  governance_constraints: Record<string, unknown>;
  quality_target: string;
  cost_profile: string;
  latency_profile: string;
  input_payload: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentPlan = {
  selected_parser_id: string | null;
  fallback_parser_id: string | null;
  selected_skill_id: string | null;
  quality_threshold: number | null;
  summary: string;
};

export type AgentQualityJudgement = {
  status: string;
  summary: string;
  dimensions: Record<string, unknown>;
};

export type AgentArtifact = {
  id: string;
  kind: string;
  sequence: number;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AgentStep = {
  id: string;
  kind: string;
  status: string;
  sequence: number;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AgentTaskDetail = AgentTask & {
  plan: AgentPlan | null;
  steps: AgentStep[];
  artifacts: AgentArtifact[];
  quality_judgement: AgentQualityJudgement | null;
};

export type AgentTaskCreateResponse = {
  task: AgentTaskDetail;
};

export type AgentEvent = {
  id: string;
  task_id: string;
  event_type: string;
  sequence: number;
  title: string | null;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type CreateAgentTaskRequest = {
  fileIds: string[];
  objective: ParseObjective;
  configuration: ParseConfiguration;
  title?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const agentApi = {
  async createTask(payload: CreateAgentTaskRequest): Promise<AgentTaskDetail> {
    if (USE_MOCKS) return mockAgentTask(payload.fileIds);
    const response = await request<AgentTaskCreateResponse>("/agent/tasks", {
      method: "POST",
      body: JSON.stringify({
        file_ids: payload.fileIds,
        title: payload.title,
        requested_output_contract: buildOutputContract(payload.objective, payload.configuration),
        quality_target: payload.configuration.qualityTarget satisfies QualityTarget,
        cost_profile: payload.configuration.costProfile satisfies CostProfile,
        latency_profile: payload.configuration.latencyProfile satisfies LatencyProfile,
        governance_constraints: buildGovernanceConstraints(payload.configuration),
      }),
    });
    return response.task;
  },

  getTask(taskId: string): Promise<AgentTaskDetail> {
    if (USE_MOCKS) return Promise.resolve(mockAgentTask(["demo-file-contract"], taskId, "completed"));
    return request<AgentTaskDetail>(`/agent/tasks/${taskId}`);
  },

  async getEvents(taskId: string): Promise<JobEvent[]> {
    if (USE_MOCKS) return [];
    const events = await request<AgentEvent[]>(`/agent/tasks/${taskId}/events`);
    return events.map((event) => ({
      id: event.id,
      jobId: event.task_id,
      timestamp: event.created_at,
      message: event.summary,
      status: eventStatus(event),
    }));
  },
};

export function isTerminalAgentStatus(status: AgentTaskStatus): boolean {
  return ["awaiting_review", "cancelled", "completed", "failed"].includes(status);
}

export function agentStatusToJobStatus(status: AgentTaskStatus) {
  if (status === "completed") return "complete";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "awaiting_review") return "review_required";
  if (status === "submitted" || status === "accepted") return "queued";
  if (status === "observing" || status === "planning") return "planning";
  return "running";
}

function buildGovernanceConstraints(configuration: ParseConfiguration): Record<string, unknown> {
  return {
    external_services_allowed: false,
    human_review_policy: configuration.humanReviewPolicy,
    fallback_policy: configuration.fallbackPolicy,
    ocr_image_handling: configuration.ocrImageHandling,
    sensitivity_handling: configuration.sensitivityHandling,
    preferred_parser_id: configuration.preferredParserOverride || null,
    skill_id: configuration.skillOverride || null,
  };
}

function buildOutputContract(
  objective: ParseObjective,
  configuration: ParseConfiguration,
): Record<string, unknown> {
  return {
    parsed_text: true,
    metadata: true,
    sections: true,
    tables: configuration.tableStructureDetection || objective === "structured",
    chunks: objective === "search" || configuration.generateEmbeddings,
    embeddings: configuration.generateEmbeddings,
    entities: objective === "graph" || objective === "structured",
    relationships: objective === "graph",
    transcript: objective === "transcript",
    custom_outputs: configuration.customOutputs || null,
    output_preset: configuration.outputPreset,
  };
}

function eventStatus(event: AgentEvent): JobEvent["status"] {
  if (event.event_type.includes("failed")) return "Failed";
  if (event.event_type.includes("cancelled")) return "Cancelled";
  if (event.event_type.includes("publish")) return "Completed";
  if (event.payload.status === "awaiting_review") return "Review Required";
  if (event.payload.status === "accepted") return "Queued";
  return "Parsing";
}

function mockAgentTask(
  fileIds: string[],
  taskId = "demo-agent-task",
  status: AgentTaskStatus = "accepted",
): AgentTaskDetail {
  const now = new Date().toISOString();
  return {
    id: taskId,
    status,
    title: "Demo agent task",
    summary: "Demo parser-agent task.",
    file_id: fileIds[0] ?? null,
    job_id: null,
    requested_output_contract: {},
    governance_constraints: {},
    quality_target: "balanced",
    cost_profile: "balanced",
    latency_profile: "interactive",
    input_payload: { materialized_file_ids: fileIds, input_count: fileIds.length },
    error_code: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    plan: null,
    steps: [],
    artifacts: [],
    quality_judgement: null,
  };
}
