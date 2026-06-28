const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type SkillCategory = "Extraction" | "Validation" | "Post-processing" | "Publishing";
export type SkillStatus = "active" | "disabled" | "draft";

export type SkillFilters = {
  search: string;
  category: "all" | SkillCategory;
  status: "all" | SkillStatus;
  attachedParser: string;
};

export type SkillDefinition = {
  skillId: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
  status: SkillStatus;
  runCount: number;
  runCountLabel: string;
  linkedParserCount: number;
  linkedParsers: string[];
  category: SkillCategory;
  successRate: number | null;
  averageDurationMs: number | null;
  weeklyRuns: number;
  lastUpdated: string;
  supportedDocumentTypes: string[];
};

export type SkillDetail = SkillDefinition & {
  overview: string;
  inputs: string;
  outputs: string;
  exampleFields: string;
  workflowUsage: string;
  recentVersions: string[];
  extractionSchema: Record<string, unknown>;
  validationRules: Record<string, unknown>;
  examples: Array<Record<string, unknown>>;
  postProcessingHook: string | null;
};

export type SkillKpis = {
  totalSkills: number;
  activeInWorkflows: number;
  reusablePacks: number;
  avgSuccess: number | null;
  mostUsed: string;
};

export type SkillMutationPayload = {
  skill_id?: string;
  name: string;
  description: string;
  supported_document_types: string[];
  extraction_schema: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  examples: Array<Record<string, unknown>>;
  post_processing_hook?: string | null;
  enabled: boolean;
  version: string;
};

export type SkillWorkflowAttachmentPayload = {
  workflow_id?: string;
  workflow_name: string;
  notes?: string;
};

export type SkillImportResponse = {
  imported: number;
  skill_ids: string[];
};

export class UnsupportedSkillActionError extends Error {
  constructor(action: string) {
    super(`${action} is not available in the backend yet.`);
    this.name = "UnsupportedSkillActionError";
  }
}

type BackendSkillRead = {
  skill_id: string;
  name: string;
  description: string;
  supported_document_types?: string[];
  schema?: Record<string, unknown>;
  extraction_schema?: Record<string, unknown>;
  validation_rules?: Record<string, unknown>;
};

type BackendSkillDefinitionRead = BackendSkillRead & {
  examples?: Array<Record<string, unknown>>;
  post_processing_hook?: string | null;
  enabled?: boolean;
  version?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendSkillMetrics = Partial<SkillKpis> & {
  total_skills?: number;
  active_in_workflows?: number;
  reusable_packs?: number;
  avg_success?: number;
  average_success?: number;
  most_used?: string;
};

type BackendParserSummary = {
  parser_id: string;
  name: string;
  supported_file_types?: string[];
  supported_modalities?: string[];
  enabled?: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new UnsupportedSkillActionError(path);
    }
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function optionalRequest<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch {
    return null;
  }
}

export const skillsApi = {
  async listSkills(filters?: Partial<SkillFilters>): Promise<SkillDefinition[]> {
    const [agentSkills, registrySkills, parsers] = await Promise.all([
      optionalRequest<BackendSkillRead[]>(`/skills${buildSkillsQuery(filters)}`),
      optionalRequest<BackendSkillDefinitionRead[]>(`/skills-registry${buildSkillsQuery(filters)}`),
      optionalRequest<BackendParserSummary[]>("/parsers").then(async (items) => items ?? await optionalRequest<BackendParserSummary[]>("/parser-registry") ?? []),
    ]);
    if (agentSkills === null && registrySkills === null) {
      throw new Error("Unable to load skill registry from the backend.");
    }
    const merged = mergeSkillSources(agentSkills ?? [], registrySkills ?? [], parsers);
    return filterSkills(merged, normalizeFilters(filters));
  },

  async getSkill(skillId: string): Promise<SkillDetail> {
    const [agentSkill, registrySkill, parsers] = await Promise.all([
      optionalRequest<BackendSkillRead>(`/skills/${skillId}`),
      optionalRequest<BackendSkillDefinitionRead>(`/skills-registry/${skillId}`),
      optionalRequest<BackendParserSummary[]>("/parsers").then(async (items) => items ?? await optionalRequest<BackendParserSummary[]>("/parser-registry") ?? []),
    ]);
    const backendSkill = registrySkill ?? agentSkill;
    if (!backendSkill) throw new Error("Unable to load skill details.");
    const mergedSkill: BackendSkillDefinitionRead = { ...backendSkill, ...(agentSkill ?? {}), ...(registrySkill ?? {}) };
    return detailFromBackend(mergedSkill, parsers);
  },

  async getSkillMetrics(skills: SkillDefinition[]): Promise<SkillKpis> {
    const metrics = await optionalRequest<BackendSkillMetrics>("/skills/metrics");
    if (!metrics) return skillKpis(skills);
    return {
      totalSkills: metrics.totalSkills ?? metrics.total_skills ?? skills.length,
      activeInWorkflows: metrics.activeInWorkflows ?? metrics.active_in_workflows ?? skillKpis(skills).activeInWorkflows,
      reusablePacks: metrics.reusablePacks ?? metrics.reusable_packs ?? skillKpis(skills).reusablePacks,
      avgSuccess: metrics.avgSuccess ?? metrics.avg_success ?? metrics.average_success ?? skillKpis(skills).avgSuccess,
      mostUsed: metrics.mostUsed ?? metrics.most_used ?? skillKpis(skills).mostUsed,
    };
  },

  async createSkill(payload: SkillMutationPayload): Promise<SkillDetail> {
    const skill = await request<BackendSkillDefinitionRead>("/skills-registry", { method: "POST", body: JSON.stringify(payload) });
    const parsers = await getParserSummaries();
    return detailFromBackend(skill, parsers);
  },

  async updateSkill(skillId: string, payload: Partial<SkillMutationPayload>): Promise<SkillDetail> {
    const skill = await request<BackendSkillDefinitionRead>(`/skills-registry/${skillId}`, { method: "PATCH", body: JSON.stringify(payload) });
    const parsers = await getParserSummaries();
    return detailFromBackend(skill, parsers);
  },

  async duplicateSkill(skillId: string): Promise<SkillDetail> {
    const skill = await request<BackendSkillDefinitionRead>(`/skills-registry/${skillId}/duplicate`, { method: "POST", body: JSON.stringify({}) });
    const parsers = await getParserSummaries();
    return detailFromBackend(skill, parsers);
  },

  importSkillPack(file: File): Promise<SkillImportResponse> {
    const body = new FormData();
    body.append("file", file);
    return fetch(`${API_BASE_URL}/skills-registry/import`, { method: "POST", body, cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) throw new UnsupportedSkillActionError("skill import");
        throw new Error(await response.text() || `Request failed: ${response.status}`);
      }
      return response.json();
    });
  },

  attachSkillToWorkflow(skillId: string, payload: SkillWorkflowAttachmentPayload) {
    return request<{ skill_id: string; workflow_id: string; workflow_name: string; attached: boolean }>(
      `/skills-registry/${skillId}/attach`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
};

export function filterSkills(skills: SkillDefinition[], filters: SkillFilters): SkillDefinition[] {
  const search = filters.search.trim().toLowerCase();
  return skills.filter((skill) => {
    if (search) {
      const haystack = [
        skill.skillId,
        skill.name,
        skill.description,
        skill.category,
        skill.status,
        ...skill.tags,
        ...skill.linkedParsers,
        ...skill.supportedDocumentTypes,
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.category !== "all" && skill.category !== filters.category) return false;
    if (filters.status !== "all" && skill.status !== filters.status) return false;
    if (filters.attachedParser !== "all" && !skill.linkedParsers.includes(filters.attachedParser)) return false;
    return true;
  });
}

export function skillKpis(skills: SkillDefinition[]): SkillKpis {
  const usedSkills = skills.filter((skill) => skill.linkedParserCount > 0 || skill.runCount > 0);
  const reusablePacks = new Set(skills.flatMap((skill) => skill.tags.filter((tag) => ["pdf", "docx", "image", "audio", "table", "json"].includes(tag.toLowerCase())))).size || skills.length;
  const avgSuccess = average(skills.map((skill) => skill.successRate).filter((value): value is number => value !== null));
  const mostUsedSkill = [...skills].sort((a, b) => b.runCount - a.runCount)[0];
  const mostUsed = mostUsedSkill && mostUsedSkill.runCount > 0 ? mostUsedSkill.name : "--";
  return {
    totalSkills: skills.length,
    activeInWorkflows: usedSkills.length,
    reusablePacks,
    avgSuccess,
    mostUsed,
  };
}

export function formatPercent(value: number | null): string {
  if (value === null) return "--";
  const percent = value > 1 ? value : value * 100;
  return `${Math.round(percent * 10) / 10}%`;
}

export function formatDuration(value: number | null): string {
  if (value === null) return "--";
  const seconds = value > 1000 ? value / 1000 : value;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function mergeSkillSources(agentSkills: BackendSkillRead[], registrySkills: BackendSkillDefinitionRead[], parsers: BackendParserSummary[]): SkillDefinition[] {
  const byId = new Map<string, BackendSkillDefinitionRead>();
  for (const skill of agentSkills) byId.set(skill.skill_id, skill);
  for (const skill of registrySkills) byId.set(skill.skill_id, { ...byId.get(skill.skill_id), ...skill });
  return Array.from(byId.values()).map((skill) => skillFromBackend(skill, parsers));
}

function skillFromBackend(skill: BackendSkillDefinitionRead, parsers: BackendParserSummary[]): SkillDefinition {
  const supportedTypes = skill.supported_document_types ?? [];
  const linkedParsers = inferLinkedParsers(skill, parsers);
  const category = inferCategory(skill);
  return {
    skillId: skill.skill_id,
    name: skill.name,
    description: skill.description,
    tags: unique([category, ...supportedTypes, ...(skill.post_processing_hook ? ["Hook"] : [])]).slice(0, 4),
    version: skill.version ?? "v1.0",
    status: skill.enabled === false ? "disabled" : "active",
    runCount: 0,
    runCountLabel: "0 runs",
    linkedParserCount: linkedParsers.length,
    linkedParsers,
    category,
    successRate: null,
    averageDurationMs: null,
    weeklyRuns: 0,
    lastUpdated: skill.updated_at ? formatDate(skill.updated_at) : "Today",
    supportedDocumentTypes: supportedTypes,
  };
}

function detailFromBackend(skill: BackendSkillDefinitionRead, parsers: BackendParserSummary[]): SkillDetail {
  const definition = skillFromBackend(skill, parsers);
  const schema = skill.extraction_schema ?? skill.schema ?? {};
  const validationRules = skill.validation_rules ?? {};
  return {
    ...definition,
    overview: `${skill.description} It normalizes extracted content into reusable workflow-ready outputs.`,
    inputs: definition.supportedDocumentTypes.length ? `Document file (${definition.supportedDocumentTypes.map((item) => item.toUpperCase()).join(", ")})` : "Document file",
    outputs: describeOutputs(schema),
    exampleFields: describeExampleFields(schema),
    workflowUsage: definition.linkedParserCount ? `Used with ${definition.linkedParserCount} linked parser${definition.linkedParserCount === 1 ? "" : "s"}` : "No workflow usage reported yet",
    recentVersions: [`${definition.version} (Current)`],
    extractionSchema: schema,
    validationRules,
    examples: skill.examples ?? [],
    postProcessingHook: skill.post_processing_hook ?? null,
  };
}

function inferLinkedParsers(skill: BackendSkillDefinitionRead, parsers: BackendParserSummary[]): string[] {
  const supported = new Set((skill.supported_document_types ?? []).map((item) => item.toLowerCase()));
  return parsers
    .filter((parser) => {
      const parserTypes = [...(parser.supported_file_types ?? []), ...(parser.supported_modalities ?? [])].map((item) => item.toLowerCase());
      return parser.enabled !== false && parserTypes.some((item) => supported.has(item) || Array.from(supported).some((type) => item.includes(type)));
    })
    .map((parser) => parser.name)
    .slice(0, 4);
}

function inferCategory(skill: BackendSkillDefinitionRead): SkillCategory {
  const text = `${skill.skill_id} ${skill.name} ${skill.description} ${skill.post_processing_hook ?? ""}`.toLowerCase();
  if (text.includes("publish") || text.includes("asset") || text.includes("graph")) return "Publishing";
  if (text.includes("normal") || text.includes("post") || text.includes("hook")) return "Post-processing";
  if (text.includes("valid") || Object.keys(skill.validation_rules ?? {}).length > 2) return "Validation";
  return "Extraction";
}

function describeOutputs(schema: Record<string, unknown>): string {
  const properties = schema.properties;
  if (properties && typeof properties === "object") return `${Object.keys(properties).slice(0, 4).join(", ")} (JSON)`;
  return "Fields, metadata, entities, tables (JSON)";
}

function describeExampleFields(schema: Record<string, unknown>): string {
  const properties = schema.properties;
  if (properties && typeof properties === "object") return Object.keys(properties).slice(0, 5).join(", ");
  return "field_name, confidence, source_page, metadata";
}

function buildSkillsQuery(filters?: Partial<SkillFilters>): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.attachedParser && filters.attachedParser !== "all") params.set("parser", filters.attachedParser);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function normalizeFilters(filters?: Partial<SkillFilters>): SkillFilters {
  return {
    search: filters?.search ?? "",
    category: filters?.category ?? "all",
    status: filters?.status ?? "all",
    attachedParser: filters?.attachedParser ?? "all",
  };
}

async function getParserSummaries(): Promise<BackendParserSummary[]> {
  return await optionalRequest<BackendParserSummary[]>("/parsers").then(async (items) => items ?? await optionalRequest<BackendParserSummary[]>("/parser-registry") ?? []);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
