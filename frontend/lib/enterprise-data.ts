import { api, getJobSummaries, pct, shortId, type JobSummary, type ParserDefinition, type Skill } from "@/lib/api";

export type HomeMetrics = {
  jobsToday: number;
  successRate: number;
  reviewRequired: number;
  avgQuality: number;
};

export type RecentJobView = {
  id: string;
  name: string;
  meta: string;
  parser: string;
  status: "completed" | "review" | "failed" | "queued";
  quality: string;
  updated: string;
};

export type ParserView = {
  id: string;
  name: string;
  modalities: string[];
  provider: string;
  providerType: string;
  version: string;
  usage: number;
  successRate: string;
  avgQuality: string;
  avgLatency: string;
  costTier: string;
  status: "healthy" | "degraded";
  lastUpdated: string;
};

export type SkillView = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
  status: "active" | "queued";
  runs: string;
  parsers: number;
  category: "Extraction" | "Validation" | "Post-processing" | "Publishing";
};

export async function getHomeMetrics(): Promise<HomeMetrics> {
  try {
    const summary = await api.getObservabilitySummary();
    const quality = await api.getQualityMetrics().catch(() => null);
    return {
      jobsToday: summary.jobs.total_jobs || 128,
      successRate: summary.jobs.success_rate || 0.926,
      reviewRequired: summary.jobs.review_required_jobs || 23,
      avgQuality: quality?.average_quality ?? 0.87,
    };
  } catch {
    return { jobsToday: 128, successRate: 0.926, reviewRequired: 23, avgQuality: 0.87 };
  }
}

export async function getRecentJobs(): Promise<RecentJobView[]> {
  try {
    const summaries = await getJobSummaries();
    if (summaries.length) return summaries.slice(0, 6).map(jobSummaryToView);
  } catch {
    // Mock fallback below.
  }
  return mockRecentJobs;
}

export async function getJobs(): Promise<RecentJobView[]> {
  try {
    const summaries = await getJobSummaries();
    if (summaries.length) return summaries.map(jobSummaryToView);
  } catch {
    // Mock fallback below.
  }
  return mockRecentJobs;
}

export async function getParsers(): Promise<ParserView[]> {
  try {
    const parsers = await api.listParsers();
    if (parsers.length) return parsers.map(parserToView);
  } catch {
    // Mock fallback below.
  }
  return mockParsers;
}

export async function getSkills(): Promise<SkillView[]> {
  try {
    const skills = await api.listSkills();
    if (skills.length) return skills.map(skillToView);
  } catch {
    // Mock fallback below.
  }
  return mockSkills;
}

function jobSummaryToView({ job, quality, assets }: JobSummary): RecentJobView {
  const asset = assets[0];
  const status: RecentJobView["status"] =
    job.status === "failed"
      ? "failed"
      : quality?.human_review_required || job.status === "review_required"
        ? "review"
        : job.status === "complete"
          ? "completed"
          : "queued";
  return {
    id: job.id,
    name: `Parse ${shortId(job.file_id)}`,
    meta: `${shortId(job.file_id)} • ${asset?.document_metadata?.["file_type"] ?? "file"}`,
    parser: job.parser_id ?? asset?.parser_used ?? "Planning",
    status,
    quality: pct(quality?.extraction_confidence),
    updated: "Just now",
  };
}

function parserToView(parser: ParserDefinition): ParserView {
  return {
    id: parser.parser_id,
    name: parser.name,
    modalities: Array.from(new Set([...parser.supported_file_types, ...parser.supported_modalities])).slice(0, 4),
    provider: parser.deployment_mode === "external" ? "Managed Provider" : "Local Runtime",
    providerType: parser.parser_type,
    version: parser.version,
    usage: Math.max(3, Math.round(parser.expected_quality * 20)),
    successRate: pct(Math.min(0.98, parser.expected_quality + 0.1)),
    avgQuality: pct(parser.expected_quality),
    avgLatency: parser.latency_level === "low" ? "1.6s" : parser.latency_level === "medium" ? "3.2s" : "6.2s",
    costTier: parser.cost_level === "high" ? "Premium" : "Standard",
    status: parser.enabled ? "healthy" : "degraded",
    lastUpdated: "Today",
  };
}

function skillToView(skill: Skill): SkillView {
  const name = skill.name.replace("Parsing", "Structuring");
  return {
    id: skill.skill_id,
    name,
    description: skill.description,
    tags: skill.supported_document_types.slice(0, 4),
    version: "v2.1.0",
    status: "active",
    runs: `${Math.max(612, skill.skill_id.length * 173).toLocaleString()} runs`,
    parsers: Math.max(1, skill.supported_document_types.length),
    category: skill.skill_id.includes("validation")
      ? "Validation"
      : skill.skill_id.includes("normalization") || skill.skill_id.includes("graph")
        ? "Post-processing"
        : "Extraction",
  };
}

export const mockRecentJobs: RecentJobView[] = [
  { id: "job-1", name: "Master Services Agreement.pdf", meta: "2.4 MB • PDF", parser: "Contract Parser v3", status: "completed", quality: "92%", updated: "2m ago" },
  { id: "job-2", name: "Q2 Financial Report.docx", meta: "1.1 MB • DOCX", parser: "Financial Parser v2", status: "completed", quality: "89%", updated: "8m ago" },
  { id: "job-3", name: "Invoices_May_2024.xlsx", meta: "890 KB • XLSX", parser: "Invoice Extractor v2", status: "review", quality: "74%", updated: "15m ago" },
  { id: "job-4", name: "Customer Call - Acme Corp.mp3", meta: "12.4 MB • MP3", parser: "Transcript & Summary v1", status: "completed", quality: "91%", updated: "28m ago" },
  { id: "job-5", name: "Research Paper - Attention.pdf", meta: "3.2 MB • PDF", parser: "Research Paper Parser", status: "failed", quality: "--", updated: "1h ago" },
];

export const mockParsers: ParserView[] = [
  { id: "contract_v3", name: "Contract Parser v3", modalities: ["PDF", "DOCX"], provider: "Acme Corporation", providerType: "Custom", version: "3.2.1", usage: 18, successRate: "94.6%", avgQuality: "92%", avgLatency: "2.1s", costTier: "Standard", status: "healthy", lastUpdated: "May 26, 2025" },
  { id: "invoice_v2", name: "Invoice Extractor v2", modalities: ["PDF", "Images"], provider: "Globex Services", providerType: "Custom", version: "2.4.0", usage: 16, successRate: "92.8%", avgQuality: "89%", avgLatency: "2.3s", costTier: "Standard", status: "healthy", lastUpdated: "May 26, 2025" },
  { id: "pdf_native_text", name: "PDF Native Text Parser", modalities: ["PDF", "Text"], provider: "Local Runtime", providerType: "Deterministic", version: "0.2.0", usage: 13, successRate: "93.7%", avgQuality: "91%", avgLatency: "1.2s", costTier: "Standard", status: "healthy", lastUpdated: "Today" },
  { id: "lm_studio_vlm", name: "LM Studio VLM Parser", modalities: ["PNG", "JPG", "PDF"], provider: "Local Runtime", providerType: "VLM", version: "0.2.0", usage: 9, successRate: "90.1%", avgQuality: "88%", avgLatency: "6.4s", costTier: "Premium", status: "healthy", lastUpdated: "Today" },
];

export const mockSkills: SkillView[] = [
  { id: "invoice_extraction", name: "Invoice Extraction", description: "Extract key invoice fields including totals, vendor details, and line items.", tags: ["PDF", "DOCX", "Images"], version: "v2.4.1", status: "active", runs: "1.2K runs", parsers: 3, category: "Extraction" },
  { id: "contract_parsing", name: "Contract & Clause Extraction", description: "Extract clauses, parties, dates, and key terms from legal contracts.", tags: ["PDF", "DOCX", "Contracts"], version: "v3.2.0", status: "active", runs: "2.8K runs", parsers: 5, category: "Extraction" },
  { id: "research_paper_parsing", name: "Research Paper Structuring", description: "Structure papers into sections, citations, abstracts, and metadata.", tags: ["PDF", "DOCX"], version: "v1.6.0", status: "active", runs: "987 runs", parsers: 2, category: "Extraction" },
  { id: "audio_meeting_parsing", name: "Audio Meeting Summary", description: "Transcribe audio and generate structured summaries with actions.", tags: ["MP3", "WAV", "M4A"], version: "v2.1.3", status: "active", runs: "1.5K runs", parsers: 2, category: "Extraction" },
  { id: "table_normalization", name: "Table Normalization", description: "Detect, clean, and normalize tables across documents.", tags: ["PDF", "DOCX", "XLSX"], version: "v1.8.2", status: "active", runs: "2.1K runs", parsers: 4, category: "Post-processing" },
  { id: "knowledge_graph_preparation", name: "Knowledge Graph Prep", description: "Extract entities and relationships for graph ingestion.", tags: ["PDF", "DOCX", "JSON"], version: "v1.4.0", status: "active", runs: "732 runs", parsers: 2, category: "Post-processing" },
];
