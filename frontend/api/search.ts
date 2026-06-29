const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type SearchResultType =
  | "agent_task"
  | "file"
  | "job"
  | "asset"
  | "parser"
  | "skill"
  | "review_item";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  status: string | null;
  href: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type SearchResponse = {
  query: string;
  total: number;
  results: SearchResult[];
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const searchApi = {
  search(query: string, limit = 12): Promise<SearchResponse> {
    if (USE_MOCKS) return Promise.resolve(mockSearch(query));
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    return request<SearchResponse>(`/search?${params.toString()}`);
  },
};

function mockSearch(query: string): SearchResponse {
  const results: SearchResult[] = [
    {
      id: "demo-agent-task",
      type: "agent_task",
      title: "Parse Master Services Agreement",
      subtitle: "Completed parser-agent task",
      status: "completed",
      href: "/jobs/job-demo",
      score: 10,
      metadata: {},
      created_at: new Date().toISOString(),
    },
    {
      id: "html_text",
      type: "parser",
      title: "HTML Text Parser",
      subtitle: "deterministic · local",
      status: "enabled",
      href: "/parsers?parser_id=html_text",
      score: 6,
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ];
  return {
    query,
    total: results.length,
    results: results.filter((result) =>
      `${result.title} ${result.subtitle ?? ""} ${result.type}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  };
}
