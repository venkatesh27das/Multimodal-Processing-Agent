const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type ReviewItem = {
  id: string;
  job_id: string;
  file_id: string;
  quality_report_id: string | null;
  status: "open" | "assigned" | "resolved" | "dismissed";
  reason: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
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

export const reviewApi = {
  listItems(filters?: { jobId?: string | null }) {
    const params = new URLSearchParams();
    if (filters?.jobId) params.set("job_id", filters.jobId);
    const query = params.toString();
    return request<ReviewItem[]>(`/review/items${query ? `?${query}` : ""}`);
  },

  approveItem(reviewItemId: string, resolutionNotes?: string) {
    return request<ReviewItem>(`/review/items/${reviewItemId}/approve`, {
      method: "POST",
      body: JSON.stringify({ resolution_notes: resolutionNotes ?? "Approved in review queue." }),
    });
  },

  rejectItem(reviewItemId: string, resolutionNotes?: string) {
    return request<ReviewItem>(`/review/items/${reviewItemId}/reject`, {
      method: "POST",
      body: JSON.stringify({ resolution_notes: resolutionNotes ?? "Rejected in review queue." }),
    });
  },
};
