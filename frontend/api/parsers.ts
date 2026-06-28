const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type ParserStatus = "healthy" | "active" | "degraded" | "warning" | "disabled";

export type ParserFilters = {
  search: string;
  modality: string;
  provider: string;
  status: string;
  environment: string;
  degradedOnly: boolean;
};

export type ParserDefinition = {
  parserId: string;
  name: string;
  supportedFileTypes: string[];
  supportedModalities: string[];
  provider: string;
  parserType: string;
  version: string;
  usagePercent: number;
  successRate: number | null;
  avgQuality: number | null;
  avgLatencyMs: number | null;
  costTier: string;
  status: ParserStatus;
  deploymentMode: string;
  lastUpdated: string;
  strengths: string[];
  weaknesses: string[];
  enabled: boolean;
};

export type ParserMetrics = {
  parserId: string;
  jobCount: number;
  successCount: number;
  errorCount: number;
  fallbackAssetCount: number;
  averageConfidence: number | null;
  averageLatencyMs: number | null;
};

export type ParserKpis = {
  totalParsers: number;
  activeParsers: number;
  degradedParsers: number;
  avgSuccessRate: number | null;
  avgLatencyMs: number | null;
};

export type RoutingPolicySummary = {
  items: Array<{ title: string; body: string }>;
};

export type ParserActivity = {
  id: string;
  message: string;
  timestampLabel: string;
  tone: "success" | "info" | "purple" | "warning";
};

export class UnsupportedParserActionError extends Error {
  constructor(action: string) {
    super(`${action} is not available in the backend yet.`);
    this.name = "UnsupportedParserActionError";
  }
}

type BackendParserDefinition = {
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
  created_at?: string;
  updated_at?: string;
};

type BackendParserMetric = {
  parser_id: string;
  execution_count?: number;
  job_count: number;
  success_count: number;
  error_count: number;
  fallback_asset_count: number;
  average_confidence: number | null;
  average_latency_ms: number | null;
  estimated_cost?: number;
};

type BackendRoutingPolicy = RoutingPolicySummary | { policies?: RoutingPolicySummary["items"]; items?: RoutingPolicySummary["items"] };
type BackendActivity = ParserActivity[] | { activity?: ParserActivity[]; items?: ParserActivity[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new UnsupportedParserActionError(path);
    }
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

export const parsersApi = {
  async listParsers(filters?: Partial<ParserFilters>): Promise<ParserDefinition[]> {
    const [registry, metrics] = await Promise.all([
      request<BackendParserDefinition[]>(`/parser-registry${buildParsersQuery(filters)}`).catch(async (error) => {
        if (error instanceof UnsupportedParserActionError) {
          return request<BackendParserDefinition[]>(`/parsers${buildParsersQuery(filters)}`);
        }
        throw error;
      }),
      parsersApi.getParserMetrics().catch(() => []),
    ]);
    return mergeParsersAndMetrics(registry, metrics);
  },

  async getParser(parserId: string): Promise<ParserDefinition> {
    const [parser, metrics] = await Promise.all([
      request<BackendParserDefinition>(`/parser-registry/${parserId}`).catch(async (error) => {
        if (error instanceof UnsupportedParserActionError) {
          return request<BackendParserDefinition>(`/parsers/${parserId}`);
        }
        throw error;
      }),
      parsersApi.getParserMetrics().catch(() => []),
    ]);
    return mergeParsersAndMetrics([parser], metrics)[0];
  },

  async getParserMetrics(): Promise<ParserMetrics[]> {
    const metrics =
      await optionalRequest<BackendParserMetric[]>("/parsers/metrics") ??
      await optionalRequest<BackendParserMetric[]>("/observability/parser-usage") ??
      [];
    return metrics.map(metricFromBackend);
  },

  async getRoutingPolicySummary(parsers: ParserDefinition[]): Promise<RoutingPolicySummary> {
    const response = await optionalRequest<BackendRoutingPolicy>("/parsers/routing-policy");
    if (response) {
      if ("policies" in response && response.policies) return { items: response.policies };
      if ("items" in response && response.items) return { items: response.items };
      return response as RoutingPolicySummary;
    }
    return deriveRoutingPolicy(parsers);
  },

  async getParserActivity(): Promise<ParserActivity[]> {
    const response = await optionalRequest<BackendActivity>("/parsers/activity");
    if (!response) return [];
    if (Array.isArray(response)) return response;
    return response.activity ?? response.items ?? [];
  },

  createParser(payload: Record<string, unknown>) {
    return request<ParserDefinition>("/parsers", { method: "POST", body: JSON.stringify(payload) });
  },

  updateParser(parserId: string, payload: Record<string, unknown>) {
    return request<ParserDefinition>(`/parsers/${parserId}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  benchmarkParser(parserId: string) {
    return request<Record<string, unknown>>(`/parsers/${parserId}/benchmark`, { method: "POST" });
  },

  benchmarkAll() {
    return request<Record<string, unknown>>("/parsers/benchmark", { method: "POST" });
  },
};

export function filterParsers(parsers: ParserDefinition[], filters: ParserFilters): ParserDefinition[] {
  const search = filters.search.trim().toLowerCase();
  return parsers.filter((parser) => {
    if (search) {
      const haystack = [
        parser.parserId,
        parser.name,
        parser.provider,
        parser.parserType,
        parser.deploymentMode,
        ...parser.supportedFileTypes,
        ...parser.supportedModalities,
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.modality !== "all" && !parser.supportedModalities.concat(parser.supportedFileTypes).map((item) => item.toLowerCase()).includes(filters.modality)) return false;
    if (filters.provider !== "all" && parser.provider !== filters.provider) return false;
    if (filters.status !== "all" && parser.status !== filters.status) return false;
    if (filters.environment !== "all" && parser.deploymentMode !== filters.environment) return false;
    if (filters.degradedOnly && !["degraded", "warning", "disabled"].includes(parser.status)) return false;
    return true;
  });
}

export function parserKpis(parsers: ParserDefinition[]): ParserKpis {
  const active = parsers.filter((parser) => ["healthy", "active"].includes(parser.status)).length;
  const degraded = parsers.filter((parser) => ["degraded", "warning", "disabled"].includes(parser.status)).length;
  return {
    totalParsers: parsers.length,
    activeParsers: active,
    degradedParsers: degraded,
    avgSuccessRate: average(parsers.map((parser) => parser.successRate).filter((value): value is number => value !== null)),
    avgLatencyMs: average(parsers.map((parser) => parser.avgLatencyMs).filter((value): value is number => value !== null)),
  };
}

export function formatPercent(value: number | null): string {
  return value === null ? "--" : `${Math.round(value * 1000) / 10}%`;
}

export function formatLatency(value: number | null): string {
  if (value === null) return "--";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)}s`;
}

function mergeParsersAndMetrics(parsers: BackendParserDefinition[], metrics: ParserMetrics[]): ParserDefinition[] {
  const metricByParser = new Map(metrics.map((metric) => [metric.parserId, metric]));
  const maxJobs = Math.max(1, ...metrics.map((metric) => metric.jobCount));
  return parsers.map((parser) => {
    const metric = metricByParser.get(parser.parser_id);
    const successRate = metric?.jobCount ? metric.successCount / metric.jobCount : Math.min(0.98, parser.expected_quality + 0.08);
    const status = statusFor(parser, metric);
    return {
      parserId: parser.parser_id,
      name: parser.name,
      supportedFileTypes: parser.supported_file_types,
      supportedModalities: parser.supported_modalities,
      provider: parser.deployment_mode === "external" ? "Managed Provider" : "Local Runtime",
      parserType: parser.parser_type,
      version: parser.version,
      usagePercent: metric?.jobCount ? Math.round((metric.jobCount / maxJobs) * 100) : Math.max(3, Math.round(parser.expected_quality * 20)),
      successRate,
      avgQuality: metric?.averageConfidence ?? parser.expected_quality,
      avgLatencyMs: metric?.averageLatencyMs ?? latencyFor(parser.latency_level),
      costTier: parser.cost_level === "high" ? "Premium" : parser.cost_level === "low" ? "Low" : "Standard",
      status,
      deploymentMode: parser.deployment_mode,
      lastUpdated: parser.updated_at ? formatRelativeTime(parser.updated_at) : "Today",
      strengths: parser.strengths,
      weaknesses: parser.weaknesses,
      enabled: parser.enabled,
    };
  });
}

function metricFromBackend(metric: BackendParserMetric): ParserMetrics {
  return {
    parserId: metric.parser_id,
    jobCount: metric.job_count,
    successCount: metric.success_count,
    errorCount: metric.error_count,
    fallbackAssetCount: metric.fallback_asset_count,
    averageConfidence: metric.average_confidence,
    averageLatencyMs: metric.average_latency_ms,
  };
}

function statusFor(parser: BackendParserDefinition, metric?: ParserMetrics): ParserStatus {
  if (!parser.enabled) return "disabled";
  if ((metric?.errorCount ?? 0) > 0) return "degraded";
  if ((metric?.averageConfidence ?? parser.expected_quality) < 0.75) return "warning";
  return "healthy";
}

function latencyFor(level: string): number {
  if (level === "low") return 1600;
  if (level === "medium") return 3200;
  return 6200;
}

function deriveRoutingPolicy(parsers: ParserDefinition[]): RoutingPolicySummary {
  const fallbackCount = parsers.filter((parser) => parser.enabled && parser.supportedModalities.some((item) => ["image", "layout"].includes(item))).length;
  const localCount = parsers.filter((parser) => parser.deploymentMode === "local").length;
  return {
    items: [
      ["Fallback Behavior", fallbackCount ? `Fallback routing available across ${fallbackCount} parser${fallbackCount === 1 ? "" : "s"}` : "Fallback routing is not configured yet"],
      ["Parser Priority", `${localCount} local parser${localCount === 1 ? "" : "s"} prioritized before external services`],
      ["OCR Routing", parsers.some((parser) => parser.parserType === "ocr") ? "OCR parsers are available for image and scanned inputs" : "No OCR parser is currently enabled"],
      ["Review Thresholds", "Quality and review thresholds are applied during job planning"],
    ].map(([title, body]) => ({ title, body })),
  };
}

function buildParsersQuery(filters?: Partial<ParserFilters>): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.modality && filters.modality !== "all") params.set("modality", filters.modality);
  if (filters.provider && filters.provider !== "all") params.set("provider", filters.provider);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.environment && filters.environment !== "all") params.set("environment", filters.environment);
  if (filters.degradedOnly) params.set("degraded_only", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Today";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
