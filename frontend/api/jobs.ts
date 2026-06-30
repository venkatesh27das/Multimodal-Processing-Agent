const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type BackendJobStatus =
  | "registered"
  | "queued"
  | "planning"
  | "running"
  | "review_required"
  | "complete"
  | "cancelled"
  | "failed";

export type JobsStatusFilter =
  | "all"
  | "completed"
  | "running"
  | "review_required"
  | "failed"
  | "queued";

export type JobStatus =
  | "Completed"
  | "Running"
  | "In Progress"
  | "Review Required"
  | "Failed"
  | "Cancelled"
  | "Queued"
  | "Pending";

export type JobFilters = {
  search: string;
  status: JobsStatusFilter;
  fileType: string;
  parser: string;
  dateRange: "all" | "today" | "7d" | "30d";
  reviewOnly: boolean;
  page: number;
  pageSize: number;
};

export type BackendParseJob = {
  id: string;
  file_id: string;
  status: BackendJobStatus;
  parser_id: string | null;
  skill_id: string | null;
  quality_status: string;
  progress_percent?: number | null;
  current_stage?: JobProgress["currentStage"] | null;
  processed_files?: number | null;
  total_files?: number | null;
  created_at: string;
  updated_at: string;
};

export type BackendFileRecord = {
  id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};

export type BackendParsingPlan = {
  selected_parser_id: string;
  fallback_parser_id: string | null;
  selected_skill_id: string | null;
  decision_reason: string;
  output_contract: Record<string, unknown>;
};

export type BackendQualityReport = {
  quality_status: string;
  extraction_confidence: number | null;
  parser_confidence: number | null;
  human_review_required: boolean;
  created_at: string;
};

export type BackendParsedAsset = {
  parser_used: string;
  fallback_used: boolean;
  latency_ms: number | null;
  document_metadata: Record<string, unknown>;
  quality_report: Record<string, unknown>;
  created_at: string;
};

type BackendParserSummary = {
  parser_id: string;
  name: string;
};

export type ParseObjective =
  | "general"
  | "structured"
  | "search"
  | "graph"
  | "transcript"
  | "custom";

export type QualityTarget = "low" | "balanced" | "high";
export type CostProfile = "low_cost" | "balanced" | "premium";
export type LatencyProfile = "batch" | "interactive" | "real_time";
export type GeneratedAssetKind =
  | "parsed_content"
  | "document_structure"
  | "tables"
  | "chunks"
  | "vectors"
  | "entities"
  | "relationships"
  | "knowledge_graph"
  | "summary"
  | "classification"
  | "evidence"
  | "quality_report"
  | "lineage"
  | "review_package"
  | "user_defined_extraction";

export type ParseConfiguration = {
  outputPreset: "balanced" | "text_structure" | "structured" | "search" | "graph";
  qualityTarget: QualityTarget;
  costProfile: CostProfile;
  latencyProfile: LatencyProfile;
  humanReviewPolicy: "review_if_70" | "review_if_85" | "review_if_92" | "always" | "never";
  customOutputs: string;
  preferredParserOverride: string;
  skillOverride: string;
  fallbackPolicy: "recommended" | "none" | "aggressive";
  ocrImageHandling: "auto" | "force_ocr" | "native_only";
  tableStructureDetection: boolean;
  generateEmbeddings: boolean;
  sensitivityHandling: "auto_mask" | "detect_only" | "none";
  selectedAssets: GeneratedAssetKind[];
};

export type ParserRecommendation = {
  fileId: string;
  fileName: string;
  fileType: string;
  primaryParserId: string;
  fallbackParserId: string | null;
  secondaryParserId: string | null;
  selectedSkillId: string | null;
  decisionScore: number;
  decisionExplanation: string;
};

export type ParsingPlan = {
  recommendations: ParserRecommendation[];
  expectedOutputs: string[];
  recommendedSkills: string[];
  estimatedCost: string;
  estimatedDuration: string;
  reviewCoverage: string;
  policyCoverage: string;
  executionStages: Array<{
    name: string;
    description: string;
    duration: string;
  }>;
};

export type CreateJobRequest = {
  fileId: string;
  objective: ParseObjective;
  configuration: ParseConfiguration;
};

export type ParserSelectionResponse = {
  file_id: string;
  primary_parser_id: string;
  fallback_parser_id: string | null;
  secondary_parser_id: string | null;
  selected_skill_id: string | null;
  decision_score: number;
  decision_explanation: string;
  score_breakdown: Array<{
    parser_id: string;
    expected_quality_score: number;
    cost_penalty: number;
    latency_penalty: number;
    risk_penalty: number;
    historical_success_bonus: number;
    total_score: number;
  }>;
};

export type ParseJob = BackendParseJob;

export type QualityReport = BackendQualityReport & {
  id?: string;
  job_id?: string;
  quality_explanation?: string;
};

export type ParsedAsset = BackendParsedAsset & {
  id?: string;
  asset_id?: string;
  job_id?: string;
  file_id?: string;
  parsed_text?: string | null;
  chunks?: Array<Record<string, unknown>>;
  entities?: Array<Record<string, unknown>>;
  relationships?: Array<Record<string, unknown>>;
};

export type ParseJobRunResponse = {
  job: ParseJob;
  plan: BackendParsingPlan & {
    id?: string;
    job_id?: string;
    file_id?: string;
    expected_assets?: string[];
    quality_threshold?: number;
    cost_profile?: Record<string, unknown>;
    human_review_policy?: Record<string, unknown>;
    created_at?: string;
  };
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

export type JobProgress = {
  jobId: string;
  status: BackendJobStatus;
  percent: number;
  currentStage: "intake" | "profiling" | "parsing" | "validation" | "publish";
  processedFiles: number;
  totalFiles: number;
};

export type JobEvent = {
  id: string;
  jobId: string;
  timestamp: string;
  message: string;
  status: "Queued" | "Parsing" | "Completed" | "Failed" | "Review Required" | "Cancelled";
};

export type Job = {
  id: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSizeLabel: string;
  objective: string;
  parser: string;
  fallback: boolean;
  fallbackParser: string | null;
  status: JobStatus;
  statusKey: JobsStatusFilter;
  quality: number | null;
  startedAt: string;
  startedAtLabel: string;
  durationMs: number | null;
  durationLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
  reviewRequired: boolean;
};

export type PaginatedJobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type BackendPaginatedJobsResponse = {
  jobs?: BackendParseJob[];
  items?: BackendParseJob[];
  results?: BackendParseJob[];
  total?: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
  total_pages?: number;
  totalPages?: number;
};

export class UnsupportedJobActionError extends Error {
  constructor(action: string) {
    super(`${action} is not available in the backend yet.`);
    this.name = "UnsupportedJobActionError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new UnsupportedJobActionError(path);
    }
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const jobsApi = {
  async listJobs(filters?: Partial<JobFilters>): Promise<Job[]> {
    const response = await request<BackendParseJob[] | BackendPaginatedJobsResponse>(
      `/jobs${buildJobsQuery(filters)}`,
    );
    const jobs = Array.isArray(response)
      ? response
      : response.jobs ?? response.items ?? response.results ?? [];
    const enriched = await Promise.all(jobs.map(enrichJob));
    return enriched;
  },

  async listJobsPage(filters: JobFilters): Promise<PaginatedJobsResponse> {
    const response = await request<BackendParseJob[] | BackendPaginatedJobsResponse>(
      `/jobs${buildJobsQuery(filters)}`,
    );
    if (Array.isArray(response)) {
      const enriched = await Promise.all(response.map(enrichJob));
      return filterAndPaginateJobs(enriched, filters);
    }

    const backendJobs = response.jobs ?? response.items ?? response.results ?? [];
    const enriched = await Promise.all(backendJobs.map(enrichJob));
    return {
      jobs: enriched,
      total: response.total ?? enriched.length,
      page: response.page ?? filters.page,
      pageSize: response.page_size ?? response.pageSize ?? filters.pageSize,
      totalPages: response.total_pages ?? response.totalPages ?? Math.max(1, Math.ceil((response.total ?? enriched.length) / filters.pageSize)),
    };
  },

  getJob(jobId: string) {
    return request<BackendParseJob>(`/jobs/${jobId}`);
  },

  retryJob(jobId: string) {
    return request<BackendParseJob>(`/jobs/${jobId}/retry`, { method: "POST" });
  },

  sendToReview(jobId: string) {
    return request<BackendParseJob>(`/jobs/${jobId}/send-to-review`, { method: "POST" });
  },

  async deleteJob(jobId: string): Promise<void> {
    await request<void>(`/jobs/${jobId}`, { method: "DELETE" });
  },

  exportJobs() {
    return fetch(`${API_BASE_URL}/jobs/export`, { cache: "no-store" });
  },

  async planParseJob(
    fileId: string,
    fileName: string,
    fileType: string,
    objective: ParseObjective,
    configuration: ParseConfiguration,
  ): Promise<ParserRecommendation> {
    if (USE_MOCKS) {
      return mockRecommendation(fileId, fileName, fileType);
    }

    const response = await request<ParserSelectionResponse>("/jobs/plan", {
      method: "POST",
      body: JSON.stringify(buildParserSelectionPayload(fileId, objective, configuration)),
    });
    return {
      fileId: response.file_id,
      fileName,
      fileType,
      primaryParserId: response.primary_parser_id,
      fallbackParserId: response.fallback_parser_id,
      secondaryParserId: response.secondary_parser_id,
      selectedSkillId: response.selected_skill_id,
      decisionScore: response.decision_score,
      decisionExplanation: response.decision_explanation,
    };
  },

  async createParseJob(requestPayload: CreateJobRequest): Promise<ParseJobRunResponse> {
    if (USE_MOCKS) {
      return mockRunResponse(requestPayload.fileId, requestPayload.objective, requestPayload.configuration);
    }

    return request<ParseJobRunResponse>("/jobs", {
      method: "POST",
      body: JSON.stringify(
        buildParserSelectionPayload(
          requestPayload.fileId,
          requestPayload.objective,
          requestPayload.configuration,
        ),
      ),
    });
  },

  getParseJob(jobId: string) {
    if (USE_MOCKS) return Promise.resolve(mockJob(jobId, "running"));
    return request<ParseJob>(`/jobs/${jobId}`);
  },

  getParseJobQuality(jobId: string) {
    if (USE_MOCKS) return Promise.resolve(mockQuality(jobId));
    return request<QualityReport>(`/jobs/${jobId}/quality`);
  },

  getParseJobAssets(jobId: string) {
    if (USE_MOCKS) return Promise.resolve(mockAssets(jobId));
    return request<ParsedAsset[]>(`/jobs/${jobId}/assets`);
  },

  async getParseJobEvents(jobId: string): Promise<JobEvent[]> {
    if (USE_MOCKS) {
      return [
        {
          id: "mock-event-1",
          jobId,
          timestamp: new Date().toISOString(),
          message: "Parser started processing document.",
          status: "Parsing",
        },
      ];
    }
    try {
      const response = await request<BackendJobEvent[] | { events: BackendJobEvent[] }>(`/jobs/${jobId}/events`);
      const events = Array.isArray(response) ? response : response.events;
      return events.map((event, index) => normalizeJobEvent(event, jobId, index));
    } catch (error) {
      if (error instanceof UnsupportedJobActionError) return [];
      throw error;
    }
  },
};

function buildJobsQuery(filters?: Partial<JobFilters>): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.fileType && filters.fileType !== "all") params.set("file_type", filters.fileType);
  if (filters.parser && filters.parser !== "all") params.set("parser", filters.parser);
  if (filters.dateRange && filters.dateRange !== "all") params.set("date_range", filters.dateRange);
  if (filters.reviewOnly) params.set("review_required", "true");
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function createParsingPlan(recommendations: ParserRecommendation[], configuration: ParseConfiguration): ParsingPlan {
  const skills = Array.from(
    new Set(
      recommendations
        .map((recommendation) => recommendation.selectedSkillId)
        .filter((skill): skill is string => Boolean(skill)),
    ),
  );
  return {
    recommendations,
    expectedOutputs: expectedOutputsFor(configuration),
    recommendedSkills: skills.length ? skills : inferSkills(recommendations),
    estimatedCost: configuration.costProfile === "premium" ? "~ $0.12" : configuration.costProfile === "low_cost" ? "~ $0.02" : "~ $0.04",
    estimatedDuration: configuration.latencyProfile === "batch" ? "~ 8 min" : configuration.latencyProfile === "real_time" ? "~ 45 sec" : "~ 2 min 30 sec",
    reviewCoverage: configuration.humanReviewPolicy === "never" ? "70%" : configuration.humanReviewPolicy === "review_if_92" ? "95%" : "92%",
    policyCoverage: "High (92%+)",
    executionStages: [
      { name: "Intake", description: "Files are received, virus scanned, and stored securely.", duration: "~ 1 min" },
      { name: "Profiling", description: "Document structure, type, and complexity analysis.", duration: "~ 2 min" },
      { name: "Parsing", description: "Content extraction using recommended parsers with fallbacks.", duration: "~ 4-6 min" },
      { name: "Validation", description: "Quality checks, schema validation, and confidence scoring.", duration: "~ 2-3 min" },
      { name: "Publish", description: "Outputs are finalized and published to the workspace.", duration: "~ 1 min" },
    ],
  };
}

export function defaultParseConfiguration(): ParseConfiguration {
  return {
    outputPreset: "balanced",
    qualityTarget: "high",
    costProfile: "balanced",
    latencyProfile: "interactive",
    humanReviewPolicy: "review_if_85",
    customOutputs: "",
    preferredParserOverride: "",
    skillOverride: "",
    fallbackPolicy: "recommended",
    ocrImageHandling: "auto",
    tableStructureDetection: true,
    generateEmbeddings: true,
    sensitivityHandling: "auto_mask",
    selectedAssets: defaultAssetsForObjective("general"),
  };
}

export function defaultAssetsForObjective(objective: ParseObjective): GeneratedAssetKind[] {
  const base: GeneratedAssetKind[] = [
    "parsed_content",
    "document_structure",
    "classification",
    "quality_report",
    "lineage",
  ];
  if (objective === "search") return [...base, "chunks", "vectors", "evidence"];
  if (objective === "structured") {
    return [...base, "tables", "entities", "evidence", "user_defined_extraction"];
  }
  if (objective === "graph") {
    return [...base, "entities", "relationships", "knowledge_graph", "evidence"];
  }
  if (objective === "transcript") return [...base, "chunks", "summary", "entities", "evidence"];
  if (objective === "custom") return [...base, "tables", "chunks", "entities", "evidence"];
  return [...base, "tables", "chunks", "summary", "evidence"];
}

export function deriveJobProgress(job: ParseJob | null, totalFiles: number, processedFiles: number): JobProgress {
  const status = job?.status ?? "queued";
  const terminal = ["complete", "failed", "review_required", "cancelled"].includes(status);
  const currentStage = job?.current_stage ?? (terminal ? "publish" : status === "running" ? "parsing" : status === "planning" ? "profiling" : "intake");
  const terminalPercent =
    status === "complete" || status === "review_required"
      ? 100
      : status === "failed"
        ? 80
        : status === "cancelled"
          ? 0
          : null;
  const percent = terminalPercent ?? (typeof job?.progress_percent === "number"
    ? clampPercent(job.progress_percent)
    : status === "running"
      ? 62
      : status === "planning"
        ? 40
        : 22);
  return {
    jobId: job?.id ?? "",
    status,
    percent,
    currentStage,
    processedFiles: job?.processed_files ?? processedFiles,
    totalFiles: Math.max(1, job?.total_files ?? totalFiles),
  };
}

type BackendJobEvent = {
  id?: string;
  job_id?: string;
  timestamp?: string;
  created_at?: string;
  message?: string;
  status?: string;
  stage?: string;
};

function normalizeJobEvent(event: BackendJobEvent, jobId: string, index: number): JobEvent {
  const status = normalizeEventStatus(event.status ?? event.stage);
  const timestamp = event.timestamp ?? event.created_at ?? new Date().toISOString();
  return {
    id: event.id ?? `${jobId}-${timestamp}-${index}`,
    jobId: event.job_id ?? jobId,
    timestamp,
    message: event.message ?? `${status} update received.`,
    status,
  };
}

function normalizeEventStatus(value: string | undefined): JobEvent["status"] {
  const normalized = value?.toLowerCase();
  if (normalized === "complete" || normalized === "completed") return "Completed";
  if (normalized === "failed" || normalized === "error") return "Failed";
  if (normalized === "review_required") return "Review Required";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  if (normalized === "queued" || normalized === "registered") return "Queued";
  return "Parsing";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildParserSelectionPayload(
  fileId: string,
  objective: ParseObjective,
  configuration: ParseConfiguration,
) {
  return {
    file_id: fileId,
    requested_output_contract: buildOutputContract(objective, configuration),
    quality_target: configuration.qualityTarget,
    cost_profile: configuration.costProfile,
    latency_profile: configuration.latencyProfile,
    governance_constraints: {
      external_services_allowed: false,
      human_review_policy: configuration.humanReviewPolicy,
      fallback_policy: configuration.fallbackPolicy,
      ocr_image_handling: configuration.ocrImageHandling,
      sensitivity_handling: configuration.sensitivityHandling,
      preferred_parser_id: configuration.preferredParserOverride || null,
      skill_id: configuration.skillOverride || null,
    },
  };
}

function buildOutputContract(objective: ParseObjective, configuration: ParseConfiguration): Record<string, unknown> {
  const assets = new Set(configuration.selectedAssets);
  const wantsTables = assets.has("tables") || configuration.tableStructureDetection || objective === "structured";
  const wantsChunks = assets.has("chunks") || assets.has("vectors");
  const wantsVectors = assets.has("vectors") || configuration.generateEmbeddings;
  const wantsEntities =
    assets.has("entities") ||
    assets.has("relationships") ||
    assets.has("knowledge_graph") ||
    objective === "graph" ||
    objective === "structured";
  const wantsRelationships =
    assets.has("relationships") ||
    assets.has("knowledge_graph") ||
    objective === "graph";
  return {
    parsed_text: true,
    metadata: true,
    sections: assets.has("document_structure"),
    tables: wantsTables,
    chunks: objective === "search" || wantsChunks || wantsVectors,
    embeddings: wantsVectors,
    entities: wantsEntities,
    relationships: wantsRelationships,
    knowledge_graph: assets.has("knowledge_graph"),
    summary: assets.has("summary"),
    classification: assets.has("classification"),
    evidence: assets.has("evidence"),
    quality_report: assets.has("quality_report"),
    lineage: assets.has("lineage"),
    review_package: assets.has("review_package"),
    user_defined_extraction: assets.has("user_defined_extraction"),
    transcript: objective === "transcript",
    custom_outputs: configuration.customOutputs || null,
    output_preset: configuration.outputPreset,
    selected_asset_types: configuration.selectedAssets,
  };
}

function expectedOutputsFor(configuration: ParseConfiguration): string[] {
  return configuration.selectedAssets.map(labelForGeneratedAsset);
}

function labelForGeneratedAsset(asset: GeneratedAssetKind): string {
  const labels: Record<GeneratedAssetKind, string> = {
    parsed_content: "Parsed content",
    document_structure: "Document structure",
    tables: "Tables",
    chunks: "Chunks",
    vectors: "Vectors",
    entities: "Entities",
    relationships: "Relationships",
    knowledge_graph: "Knowledge graph",
    summary: "Summary",
    classification: "Classification",
    evidence: "Evidence spans",
    quality_report: "Quality report",
    lineage: "Lineage",
    review_package: "Review package",
    user_defined_extraction: "User-defined fields",
  };
  return labels[asset];
}

function inferSkills(recommendations: ParserRecommendation[]): string[] {
  const joined = recommendations.map((item) => `${item.fileType} ${item.primaryParserId}`).join(" ").toLowerCase();
  if (joined.includes("audio") || joined.includes("video")) return ["audio_meeting_parsing"];
  if (joined.includes("html")) return ["knowledge_graph_preparation"];
  if (joined.includes("docx") || joined.includes("pdf")) return ["contract_parsing", "table_normalization"];
  return ["general_parsing"];
}

function mockRecommendation(fileId: string, fileName: string, fileType: string): ParserRecommendation {
  const normalized = fileType.toLowerCase();
  const primary = normalized.includes("image")
    ? "image_ocr_parser"
    : normalized.includes("html")
      ? "html_parser"
      : normalized.includes("doc")
        ? "docx_parser"
        : normalized.includes("audio")
          ? "audio_parser"
          : normalized.includes("video")
            ? "video_parser"
            : "pdf_native_parser";
  return {
    fileId,
    fileName,
    fileType,
    primaryParserId: primary,
    fallbackParserId: normalized.includes("pdf") || normalized.includes("image") ? "mock_vlm_parser" : null,
    secondaryParserId: null,
    selectedSkillId: normalized.includes("pdf") || normalized.includes("doc") ? "contract_parsing" : null,
    decisionScore: 0.92,
    decisionExplanation: "Selected the strongest local parser for the detected file type with fallback coverage where useful.",
  };
}

function mockRunResponse(fileId: string, objective: ParseObjective, configuration: ParseConfiguration): ParseJobRunResponse {
  const job = mockJob(`mock-job-${crypto.randomUUID()}`, "running");
  job.file_id = fileId;
  return {
    job,
    plan: {
      id: `mock-plan-${job.id}`,
      job_id: job.id,
      file_id: fileId,
      selected_parser_id: "pdf_native_parser",
      fallback_parser_id: "mock_vlm_parser",
      selected_skill_id: objective === "custom" ? null : "contract_parsing",
      output_contract: buildOutputContract(objective, configuration),
      expected_assets: expectedOutputsFor(configuration),
      quality_threshold: 0.85,
      cost_profile: { estimate: 0.04, currency: "USD" },
      human_review_policy: { review_if_below: 0.85 },
      decision_reason: "Mock plan generated for local development.",
      created_at: new Date().toISOString(),
    },
    quality: mockQuality(job.id),
    assets: mockAssets(job.id),
    review_item: null,
  };
}

function mockJob(jobId: string, status: BackendJobStatus): ParseJob {
  return {
    id: jobId,
    file_id: "mock-file",
    status,
    parser_id: "pdf_native_parser",
    skill_id: "contract_parsing",
    quality_status: "not_evaluated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mockQuality(jobId: string): QualityReport {
  return {
    id: `mock-quality-${jobId}`,
    job_id: jobId,
    quality_status: "passed",
    extraction_confidence: 0.92,
    parser_confidence: 0.91,
    human_review_required: false,
    created_at: new Date().toISOString(),
    quality_explanation: "Mock quality score for local UI development.",
  };
}

function mockAssets(jobId: string): ParsedAsset[] {
  return [
    {
      id: `mock-asset-${jobId}`,
      job_id: jobId,
      file_id: "mock-file",
      parser_used: "pdf_native_parser",
      fallback_used: false,
      latency_ms: 1200,
      document_metadata: { title: "Mock document" },
      quality_report: { extraction_confidence: 0.92 },
      created_at: new Date().toISOString(),
    },
  ];
}

export function filterAndPaginateJobs(jobs: Job[], filters: JobFilters): PaginatedJobsResponse {
  const search = filters.search.trim().toLowerCase();
  const now = Date.now();
  const filtered = jobs.filter((job) => {
    if (search) {
      const haystack = [
        job.id,
        job.fileName,
        job.fileType,
        job.objective,
        job.parser,
        job.status,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.status !== "all" && job.statusKey !== filters.status) return false;
    if (filters.fileType !== "all" && job.fileType.toLowerCase() !== filters.fileType) return false;
    if (filters.parser !== "all" && job.parser !== filters.parser) return false;
    if (filters.reviewOnly && !job.reviewRequired) return false;
    if (filters.dateRange !== "all") {
      const started = new Date(job.startedAt).getTime();
      const ageDays = (now - started) / 86_400_000;
      if (filters.dateRange === "today" && ageDays > 1) return false;
      if (filters.dateRange === "7d" && ageDays > 7) return false;
      if (filters.dateRange === "30d" && ageDays > 30) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  return {
    jobs: filtered.slice(start, start + filters.pageSize),
    total: filtered.length,
    page,
    pageSize: filters.pageSize,
    totalPages,
  };
}

async function enrichJob(job: BackendParseJob): Promise<Job> {
  const [file, plan, quality, assets, parserNames] = await Promise.all([
    safeRequest<BackendFileRecord>(`/files/${job.file_id}`),
    safeRequest<BackendParsingPlan>(`/jobs/${job.id}/plan`),
    safeRequest<BackendQualityReport>(`/jobs/${job.id}/quality`),
    safeRequest<BackendParsedAsset[]>(`/jobs/${job.id}/assets`),
    getParserNameMap(),
  ]);

  const firstAsset = assets?.[0] ?? null;
  const status = mapStatus(job.status, quality?.human_review_required ?? false);
  const parserId = job.parser_id ?? firstAsset?.parser_used ?? plan?.selected_parser_id ?? null;
  const parser = parserId ? parserNames.get(parserId) ?? parserId : "Planning";
  const fileName = file?.original_filename ?? `File ${shortId(job.file_id)}`;
  const fileType =
    file?.file_type ??
    String(firstAsset?.document_metadata?.["file_type"] ?? "file").toLowerCase();
  const qualityScore = quality?.extraction_confidence ?? firstAssetQuality(firstAsset);

  return {
    id: job.id,
    fileId: job.file_id,
    fileName,
    fileType,
    fileSizeLabel: file?.size_bytes ? formatBytes(file.size_bytes) : "--",
    objective: inferObjective(plan, fileType),
    parser,
    fallback: firstAsset?.fallback_used ?? false,
    fallbackParser: plan?.fallback_parser_id ? parserNames.get(plan.fallback_parser_id) ?? plan.fallback_parser_id : null,
    status,
    statusKey: statusToFilter(status),
    quality: qualityScore,
    startedAt: job.created_at,
    startedAtLabel: formatRelativeTime(job.created_at),
    durationMs: firstAsset?.latency_ms ?? null,
    durationLabel: formatDuration(firstAsset?.latency_ms ?? null),
    updatedAt: job.updated_at,
    updatedAtLabel: formatRelativeTime(job.updated_at),
    reviewRequired:
      quality?.human_review_required ??
      (job.status === "review_required" || quality?.quality_status === "review_required"),
  };
}

async function safeRequest<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch {
    return null;
  }
}

let parserNameMapPromise: Promise<Map<string, string>> | null = null;

async function getParserNameMap(): Promise<Map<string, string>> {
  parserNameMapPromise ??= safeRequest<BackendParserSummary[]>("/parser-registry")
    .then((parsers) => new Map((parsers ?? []).map((parser) => [parser.parser_id, parser.name])));
  return parserNameMapPromise;
}

function mapStatus(status: BackendJobStatus, reviewRequired: boolean): JobStatus {
  if (reviewRequired || status === "review_required") return "Review Required";
  if (status === "complete") return "Completed";
  if (status === "running") return "Running";
  if (status === "planning") return "In Progress";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "queued") return "Queued";
  return "Pending";
}

function statusToFilter(status: JobStatus): JobsStatusFilter {
  if (status === "Completed") return "completed";
  if (status === "Review Required") return "review_required";
  if (status === "Failed") return "failed";
  if (status === "Cancelled") return "failed";
  if (status === "Queued" || status === "Pending") return "queued";
  return "running";
}

function inferObjective(plan: BackendParsingPlan | null, fileType: string): string {
  const contract = plan?.output_contract ?? {};
  if (contract["knowledge_graph"]) return "Graph-ready";
  if (contract["tables"]) return "Structured Extraction";
  if (fileType === "audio" || fileType === "video") return "Audio/Video Transcript";
  return "General Parsing";
}

function firstAssetQuality(asset: BackendParsedAsset | null): number | null {
  const report = asset?.quality_report;
  const value = report?.["extraction_confidence"] ?? report?.["parser_confidence"];
  return typeof value === "number" ? value : null;
}

export function formatQuality(value: number | null): string {
  return value === null ? "--" : `${Math.round(value * 100)}%`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(value: number | null): string {
  if (value === null) return "--";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "--";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function shortId(value: string): string {
  return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}
