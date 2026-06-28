import { jobsApi, type Job } from "@/api/jobs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type DashboardSummary = {
  jobsToday: number | null;
  successRate: number | null;
  reviewRequired: number | null;
  avgQuality: number | null;
  deltas: {
    jobsToday: string | null;
    successRate: string | null;
    reviewRequired: string | null;
    avgQuality: string | null;
  };
  sparklines: {
    jobsToday: number[];
    successRate: number[];
    reviewRequired: number[];
    avgQuality: number[];
  };
};

export type NeedsAttentionSummary = {
  pendingReview: number | null;
  failedJobs: number | null;
  degradedParsers: number | null;
  totalAttentionItems: number;
};

export type SystemInsights = {
  throughput: number | null;
  topFileTypes: Array<{ type: string; percent: number }>;
  recommendationsEnabled: boolean;
  recommendationText: string;
  sparkline: number[];
};

export type RecentJob = {
  id: string;
  fileName: string;
  fileType: string;
  meta: string;
  parser: string;
  status: "completed" | "review" | "failed" | "queued";
  statusLabel: string;
  quality: string;
  updated: string;
  detailHref: string;
};

type DashboardApiResponse = Partial<DashboardSummary> & {
  jobs_today?: number;
  success_rate?: number;
  review_required?: number;
  avg_quality?: number;
};

type ObservabilitySummary = {
  jobs: {
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    review_required_jobs: number;
    success_rate: number;
  };
  review: { count: number; rate: number };
  latency: { average_ms: number; p50_ms: number; p95_ms: number; max_ms: number };
};

type QualityMetrics = {
  average_quality: number | null;
  review_required: number;
  failed: number;
};

type ParserDefinition = {
  parser_id: string;
  name: string;
  supported_file_types: string[];
  supported_modalities: string[];
  expected_quality: number;
  enabled: boolean;
};

type ParserUsageMetric = {
  parser_id: string;
  job_count: number;
  success_count: number;
  error_count: number;
  average_confidence: number | null;
};

type JobsMetrics = {
  jobs_today?: number;
  failed_jobs?: number;
  success_rate?: number;
};

type ReviewSummary = {
  pending_review?: number;
  review_required?: number;
  count?: number;
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

async function optionalRequest<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch {
    return null;
  }
}

export const dashboardApi = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    if (USE_MOCKS) return mockDashboardSummary;

    const [dashboard, jobs, observability, quality] = await Promise.all([
      optionalRequest<DashboardApiResponse>("/dashboard/summary"),
      jobsApi.listJobs().catch(() => [] as Job[]),
      optionalRequest<ObservabilitySummary>("/observability/summary"),
      optionalRequest<QualityMetrics>("/observability/quality"),
    ]);

    return composeDashboardSummary({ dashboard, jobs, observability, quality });
  },

  async getRecentJobs(limit = 6): Promise<RecentJob[]> {
    if (USE_MOCKS) return mockRecentJobs.slice(0, limit);

    const jobs = await jobsApi.listJobs();
    return jobs.slice(0, limit).map(jobToRecentJob);
  },

  async getNeedsAttention(): Promise<NeedsAttentionSummary> {
    if (USE_MOCKS) return mockNeedsAttention;

    const [jobs, observability, jobsMetrics, reviewSummary, parsers, parserMetrics] = await Promise.all([
      jobsApi.listJobs().catch(() => [] as Job[]),
      optionalRequest<ObservabilitySummary>("/observability/summary"),
      optionalRequest<JobsMetrics>("/jobs/metrics"),
      optionalRequest<ReviewSummary>("/review/summary"),
      getParsers(),
      optionalRequest<ParserUsageMetric[]>("/parsers/metrics"),
    ]);

    const pendingReview =
      reviewSummary?.pending_review ??
      reviewSummary?.review_required ??
      reviewSummary?.count ??
      observability?.review.count ??
      jobs.filter((job) => job.reviewRequired).length;
    const failedJobs =
      jobsMetrics?.failed_jobs ??
      observability?.jobs.failed_jobs ??
      jobs.filter((job) => job.status === "Failed").length;
    const degradedParsers =
      parserMetrics?.filter((metric) => metric.error_count > 0).length ??
      parsers.filter((parser) => !parser.enabled).length;

    return {
      pendingReview,
      failedJobs,
      degradedParsers,
      totalAttentionItems: pendingReview + failedJobs + degradedParsers,
    };
  },

  async getSystemInsights(): Promise<SystemInsights> {
    if (USE_MOCKS) return mockSystemInsights;

    const [jobs, observability] = await Promise.all([
      jobsApi.listJobs().catch(() => [] as Job[]),
      optionalRequest<ObservabilitySummary>("/observability/summary"),
    ]);
    return composeSystemInsights(jobs, observability);
  },
};

async function getParsers(): Promise<ParserDefinition[]> {
  const expectedRoute = await optionalRequest<ParserDefinition[]>("/parsers");
  if (expectedRoute) return expectedRoute;
  return await optionalRequest<ParserDefinition[]>("/parser-registry") ?? [];
}

function composeDashboardSummary({
  dashboard,
  jobs,
  observability,
  quality,
}: {
  dashboard: DashboardApiResponse | null;
  jobs: Job[];
  observability: ObservabilitySummary | null;
  quality: QualityMetrics | null;
}): DashboardSummary {
  const jobsToday = dashboard?.jobsToday ?? dashboard?.jobs_today ?? countJobsToday(jobs);
  const successRate =
    dashboard?.successRate ??
    dashboard?.success_rate ??
    observability?.jobs.success_rate ??
    ratio(jobs.filter((job) => job.status === "Completed").length, jobs.length);
  const reviewRequired =
    dashboard?.reviewRequired ??
    dashboard?.review_required ??
    observability?.jobs.review_required_jobs ??
    jobs.filter((job) => job.reviewRequired).length;
  const avgQuality =
    dashboard?.avgQuality ??
    dashboard?.avg_quality ??
    quality?.average_quality ??
    average(jobs.map((job) => job.quality).filter((value): value is number => typeof value === "number"));

  return {
    jobsToday,
    successRate,
    reviewRequired,
    avgQuality,
    deltas: {
      jobsToday: dashboard?.deltas?.jobsToday ?? null,
      successRate: dashboard?.deltas?.successRate ?? null,
      reviewRequired: dashboard?.deltas?.reviewRequired ?? null,
      avgQuality: dashboard?.deltas?.avgQuality ?? null,
    },
    sparklines: {
      jobsToday: dashboard?.sparklines?.jobsToday ?? buildSparkline(jobsToday ?? observability?.jobs.total_jobs ?? 0),
      successRate: dashboard?.sparklines?.successRate ?? buildSparkline(percentToInt(successRate)),
      reviewRequired: dashboard?.sparklines?.reviewRequired ?? buildSparkline(reviewRequired ?? 0),
      avgQuality: dashboard?.sparklines?.avgQuality ?? buildSparkline(percentToInt(avgQuality)),
    },
  };
}

function composeSystemInsights(jobs: Job[], observability: ObservabilitySummary | null): SystemInsights {
  const total = observability?.jobs.total_jobs ?? jobs.length;
  return {
    throughput: observability?.jobs.completed_jobs ?? jobs.filter((job) => job.status === "Completed").length,
    topFileTypes: topFileTypes(jobs),
    recommendationsEnabled: true,
    recommendationText: total ? "We are optimizing quality and latency automatically." : "Recommendations will appear once jobs are available.",
    sparkline: buildSparkline(total),
  };
}

function jobToRecentJob(job: Job): RecentJob {
  const status = mapRecentJobStatus(job);
  return {
    id: job.id,
    fileName: job.fileName,
    fileType: job.fileType,
    meta: `${job.fileSizeLabel} • ${job.fileType.toUpperCase()}`,
    parser: job.parser,
    status,
    statusLabel: status === "review" ? "Review Required" : status === "completed" ? "completed" : status,
    quality: job.quality === null ? "--" : `${Math.round(job.quality * 100)}%`,
    updated: job.updatedAtLabel,
    detailHref: `/jobs/${job.id}`,
  };
}

function mapRecentJobStatus(job: Job): RecentJob["status"] {
  if (job.status === "Completed") return "completed";
  if (job.status === "Review Required") return "review";
  if (job.status === "Failed" || job.status === "Cancelled") return "failed";
  return "queued";
}

function countJobsToday(jobs: Job[]): number {
  const today = new Date();
  return jobs.filter((job) => {
    const started = new Date(job.startedAt);
    return (
      started.getFullYear() === today.getFullYear() &&
      started.getMonth() === today.getMonth() &&
      started.getDate() === today.getDate()
    );
  }).length;
}

function topFileTypes(jobs: Job[]): Array<{ type: string; percent: number }> {
  if (!jobs.length) return [];
  const counts = new Map<string, number>();
  jobs.forEach((job) => counts.set(job.fileType.toUpperCase(), (counts.get(job.fileType.toUpperCase()) ?? 0) + 1));
  return Array.from(counts, ([type, count]) => ({ type, percent: Math.round((count / jobs.length) * 100) }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentToInt(value: number | null | undefined): number {
  return value === null || value === undefined ? 0 : Math.round(value * 100);
}

function buildSparkline(value: number): number[] {
  const base = Math.max(1, value);
  return [0.62, 0.74, 0.69, 0.83, 0.78, 0.91, 0.87, 1].map((multiplier) => Math.max(1, Math.round(base * multiplier)));
}

const mockDashboardSummary: DashboardSummary = {
  jobsToday: 128,
  successRate: 0.926,
  reviewRequired: 23,
  avgQuality: 0.87,
  deltas: {
    jobsToday: "↑ 18% vs yesterday",
    successRate: "↑ 4.3% vs yesterday",
    reviewRequired: "↓ 8 vs yesterday",
    avgQuality: "↑ 2.1% vs yesterday",
  },
  sparklines: {
    jobsToday: [12, 18, 16, 22, 20, 25, 23, 27, 26],
    successRate: [8, 11, 14, 10, 16, 9, 13, 12, 15],
    reviewRequired: [7, 9, 8, 11, 9, 10, 11, 10, 12],
    avgQuality: [6, 7, 6, 9, 7, 8, 10, 9, 11],
  },
};

const mockNeedsAttention: NeedsAttentionSummary = {
  pendingReview: 23,
  failedJobs: 7,
  degradedParsers: 2,
  totalAttentionItems: 32,
};

const mockRecentJobs: RecentJob[] = [
  { id: "job-1", fileName: "Master Services Agreement.pdf", fileType: "pdf", meta: "2.4 MB • PDF", parser: "Contract Parser v3", status: "completed", statusLabel: "completed", quality: "92%", updated: "2m ago", detailHref: "/jobs/job-1" },
  { id: "job-2", fileName: "Q2 Financial Report.docx", fileType: "docx", meta: "1.1 MB • DOCX", parser: "Financial Parser v2", status: "completed", statusLabel: "completed", quality: "89%", updated: "8m ago", detailHref: "/jobs/job-2" },
  { id: "job-3", fileName: "Invoices_May_2024.xlsx", fileType: "xlsx", meta: "890 KB • XLSX", parser: "Invoice Extractor v2", status: "review", statusLabel: "Review Required", quality: "74%", updated: "15m ago", detailHref: "/jobs/job-3" },
  { id: "job-4", fileName: "Customer Call - Acme Corp.mp3", fileType: "mp3", meta: "12.4 MB • MP3", parser: "Transcript & Summary v1", status: "completed", statusLabel: "completed", quality: "91%", updated: "28m ago", detailHref: "/jobs/job-4" },
  { id: "job-5", fileName: "Research Paper - Attention.pdf", fileType: "pdf", meta: "3.2 MB • PDF", parser: "Research Paper Parser", status: "failed", statusLabel: "failed", quality: "--", updated: "1h ago", detailHref: "/jobs/job-5" },
];

const mockSystemInsights: SystemInsights = {
  throughput: 1248,
  topFileTypes: [
    { type: "PDF", percent: 45 },
    { type: "DOCX", percent: 24 },
    { type: "PNG/JPG", percent: 15 },
    { type: "XLSX", percent: 8 },
    { type: "Other", percent: 8 },
  ],
  recommendationsEnabled: true,
  recommendationText: "We are optimizing quality and latency automatically.",
  sparkline: [12, 16, 15, 18, 20, 18, 17, 21, 24],
};
