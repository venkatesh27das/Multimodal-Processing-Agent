const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type JobStatus =
  | "registered"
  | "queued"
  | "planning"
  | "running"
  | "review_required"
  | "complete"
  | "failed";

export type QualityStatus =
  | "not_evaluated"
  | "passed"
  | "failed"
  | "fallback_required"
  | "review_required";

export type FileRecord = {
  id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  source: string;
  storage_path: string;
  status: JobStatus;
  created_by: string;
  uploaded_at: string;
};

export type FileProfile = {
  id: string;
  file_id: string;
  file_type: string;
  modalities: string[];
  has_text_layer: boolean | null;
  is_scanned: boolean | null;
  page_count: number | null;
  table_likelihood: number | null;
  image_likelihood: number | null;
  language: string | null;
  layout_complexity: string | null;
  estimated_cost_class: string | null;
  recommended_parsing_strategy: string | null;
  created_at: string;
};

export type ParseJob = {
  id: string;
  file_id: string;
  status: JobStatus;
  parser_id: string | null;
  skill_id: string | null;
  quality_status: QualityStatus;
  created_at: string;
  updated_at: string;
};

export type ParsingPlan = {
  id: string;
  job_id: string;
  file_id: string;
  selected_parser_id: string;
  fallback_parser_id: string | null;
  selected_skill_id: string | null;
  output_contract: Record<string, unknown>;
  expected_assets: string[];
  quality_threshold: number;
  cost_profile: Record<string, unknown>;
  human_review_policy: Record<string, unknown>;
  decision_reason: string;
  created_at: string;
};

export type QualityReport = {
  id: string;
  job_id: string;
  execution_result_id: string | null;
  quality_status: QualityStatus;
  parser_confidence: number | null;
  extraction_confidence: number | null;
  schema_validation_score: number | null;
  completeness_score: number | null;
  consistency_score: number | null;
  human_review_required: boolean;
  quality_explanation: string;
  created_at: string;
};

export type ParsedAsset = {
  id: string;
  asset_id: string;
  file_id: string;
  job_id: string;
  asset_type: string;
  document_metadata: Record<string, unknown>;
  parsed_text: string | null;
  layout_blocks: Array<Record<string, unknown>>;
  tables: Array<Record<string, unknown>>;
  image_descriptions: Array<Record<string, unknown>>;
  audio_transcript: string | null;
  video_transcript: string | null;
  chunks: Array<Record<string, unknown>>;
  embeddings: Array<Record<string, unknown>>;
  entities: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  evidence_spans: Array<Record<string, unknown>>;
  quality_report: Record<string, unknown>;
  lineage: Record<string, unknown>;
  parser_used: string;
  fallback_used: boolean;
  skill_used: string | null;
  cost_estimate: Record<string, unknown>;
  latency_ms: number | null;
  audit_trail: Array<Record<string, unknown>>;
  structured_data: Record<string, unknown>;
  created_at: string;
};

export type ParserDefinition = {
  parser_id: string;
  name: string;
  parser_type: string;
  supported_file_types: string[];
  supported_modalities: string[];
  strengths: string[];
  weaknesses: string[];
  cost_level: string;
  latency_level: string;
  expected_quality: number;
  quality_level: string;
  deployment_mode: string;
  enabled: boolean;
  version: string;
};

export type Skill = {
  skill_id: string;
  name: string;
  description: string;
  supported_document_types: string[];
  schema: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
};

export type ParseJobRunResponse = {
  job: ParseJob;
  plan: ParsingPlan;
  quality: QualityReport;
  assets: ParsedAsset[];
  review_item: {
    id: string;
    job_id: string;
    file_id: string;
    status: string;
    reason: string;
  } | null;
};

export type ParseRequest = {
  file_id: string;
  requested_output_contract: Record<string, unknown>;
  quality_target: "low" | "balanced" | "high";
  cost_profile: "low_cost" | "balanced" | "premium";
  latency_profile: "batch" | "interactive" | "real_time";
  governance_constraints: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  event_metadata: Record<string, unknown>;
  created_at: string;
};

export type ObservabilitySummary = {
  jobs: {
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    review_required_jobs: number;
    success_rate: number;
  };
  fallback: { count: number; rate: number };
  review: { count: number; rate: number };
  latency: {
    average_ms: number;
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
  };
  cost: {
    estimated_cost: number;
    currency: string;
  };
  error_logs: Array<{
    execution_result_id: string | null;
    job_id: string | null;
    parser_id: string | null;
    message: string;
    created_at: string;
  }>;
};

export type ParserUsageMetric = {
  parser_id: string;
  execution_count: number;
  job_count: number;
  success_count: number;
  error_count: number;
  fallback_asset_count: number;
  average_confidence: number | null;
  average_latency_ms: number | null;
  estimated_cost: number;
};

export type QualityMetrics = {
  average_quality: number | null;
  passed: number;
  review_required: number;
  failed: number;
  not_evaluated: number;
  buckets: Array<{
    label: string;
    min_score: number;
    max_score: number;
    count: number;
  }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type JobSummary = {
  job: ParseJob;
  quality: QualityReport | null;
  assets: ParsedAsset[];
};

export async function getJobSummaries(): Promise<JobSummary[]> {
  const jobs = await api.listJobs();
  return Promise.all(
    jobs.map(async (job) => {
      const [quality, assets] = await Promise.all([
        api.getJobQuality(job.id).catch(() => null),
        api.getJobAssets(job.id).catch(() => [] as ParsedAsset[]),
      ]);
      return { job, quality, assets };
    }),
  );
}

export const api = {
  uploadFile(file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<{
      file_id: string;
      original_filename: string;
      file_type: string;
      mime_type: string;
      size_bytes: number;
      checksum_sha256: string;
      status: JobStatus;
      uploaded_at: string;
    }>("/files/upload", { method: "POST", body });
  },
  runJob(payload: ParseRequest) {
    return request<ParseJobRunResponse>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listJobs() {
    return request<ParseJob[]>("/jobs");
  },
  getJob(jobId: string) {
    return request<ParseJob>(`/jobs/${jobId}`);
  },
  getJobPlan(jobId: string) {
    return request<ParsingPlan>(`/jobs/${jobId}/plan`);
  },
  getJobQuality(jobId: string) {
    return request<QualityReport>(`/jobs/${jobId}/quality`);
  },
  getJobAssets(jobId: string) {
    return request<ParsedAsset[]>(`/jobs/${jobId}/assets`);
  },
  getFile(fileId: string) {
    return request<FileRecord>(`/files/${fileId}`);
  },
  getFileProfile(fileId: string) {
    return request<FileProfile>(`/files/${fileId}/profile`);
  },
  getFileAssets(fileId: string) {
    return request<ParsedAsset[]>(`/files/${fileId}/assets`);
  },
  getAsset(assetId: string) {
    return request<ParsedAsset>(`/assets/${assetId}`);
  },
  listParsers() {
    return request<ParserDefinition[]>("/parser-registry");
  },
  listSkills() {
    return request<Skill[]>("/skills");
  },
  getObservabilitySummary() {
    return request<ObservabilitySummary>("/observability/summary");
  },
  getParserUsage() {
    return request<ParserUsageMetric[]>("/observability/parser-usage");
  },
  getQualityMetrics() {
    return request<QualityMetrics>("/observability/quality");
  },
  getAuditEvents(limit = 50) {
    return request<{ events: AuditEvent[] }>(`/audit/events?limit=${limit}`);
  },
};

export function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${Math.round(value * 100)}%`;
}

export function shortId(value: string | null | undefined) {
  if (!value) return "--";
  return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

export function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

export function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
