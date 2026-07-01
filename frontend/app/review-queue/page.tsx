"use client";

import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { reviewApi, type ReviewItem } from "@/api/review";
import {
  ActionButton,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  Tag,
} from "@/components/design-system";

export default function ReviewQueuePage() {
  const searchParams = useSearchParams();
  const focusedJobId = searchParams.get("job_id");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await reviewApi.listItems({ jobId: focusedJobId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load review items.");
    } finally {
      setLoading(false);
    }
  }, [focusedJobId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const metrics = useMemo(() => {
    const open = items.filter((item) => item.status === "open" || item.status === "assigned").length;
    const resolved = items.filter((item) => item.status === "resolved").length;
    const dismissed = items.filter((item) => item.status === "dismissed").length;
    return { open, resolved, dismissed };
  }, [items]);

  async function decide(item: ReviewItem, decision: "approve" | "reject") {
    setBusyId(item.id);
    setError(null);
    try {
      const nextItem = decision === "approve"
        ? await reviewApi.approveItem(item.id)
        : await reviewApi.rejectItem(item.id);
      setItems((current) => current.map((existing) => existing.id === item.id ? nextItem : existing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update review item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={focusedJobId ? "Review Item" : "Review Queue"}
        description={focusedJobId ? `Review outputs routed from run ${focusedJobId}.` : "Resolve uncertain parser outputs and persist human review decisions."}
        action={
          <div className="flex gap-2">
            {focusedJobId ? (
              <Link href="/review-queue">
                <ActionButton type="button" variant="secondary">All Reviews</ActionButton>
              </Link>
            ) : null}
            <ActionButton type="button" icon={RefreshCw} variant="secondary" onClick={() => void loadItems()}>
              Refresh
            </ActionButton>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <ReviewMetric label="Open" value={metrics.open} tone="review" />
        <ReviewMetric label="Approved" value={metrics.resolved} tone="completed" />
        <ReviewMetric label="Rejected" value={metrics.dismissed} tone="failed" />
      </div>

      {error ? (
        <Card className="border-red-200 bg-danger-soft p-4 text-sm font-semibold text-red-700">
          {error}
        </Card>
      ) : null}

      <Card className="p-4">
        {loading ? (
          <p className="text-sm text-muted">Loading review items...</p>
        ) : items.length ? (
          <DataTable
            columns={["Status", "Reason", "Job", "File", "Created", "Resolution", "Actions"]}
            minWidth="1040px"
          >
            {items.map((item) => {
              const resolved = item.status === "resolved" || item.status === "dismissed";
              return (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <StatusPill status={statusTone(item.status)}>{item.status}</StatusPill>
                  </td>
                  <td className="px-3 py-3">
                    <p className="max-w-[360px] text-sm font-semibold text-ink">{item.reason}</p>
                    <p className="mt-1 text-xs text-muted">Review item {item.id}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Tag>{item.job_id}</Tag>
                  </td>
                  <td className="px-3 py-3 text-sm text-muted">{item.file_id}</td>
                  <td className="px-3 py-3 text-sm text-muted">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3 text-sm text-muted">
                    {item.resolution_notes ?? "Pending human decision"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <ActionButton
                        type="button"
                        icon={CheckCircle2}
                        variant="secondary"
                        disabled={resolved || busyId === item.id}
                        onClick={() => void decide(item, "approve")}
                      >
                        Approve
                      </ActionButton>
                      <ActionButton
                        type="button"
                        icon={XCircle}
                        variant="secondary"
                        disabled={resolved || busyId === item.id}
                        onClick={() => void decide(item, "reject")}
                      >
                        Reject
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        ) : (
          <EmptyState
            title="No review items"
            description="Low-confidence parser outputs will appear here when the agent routes work to human review."
          />
        )}
      </Card>
    </div>
  );
}

function ReviewMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "review" | "completed" | "failed";
  value: number;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      </div>
      <StatusPill status={tone}>{label}</StatusPill>
    </Card>
  );
}

function statusTone(status: ReviewItem["status"]) {
  if (status === "resolved") return "completed";
  if (status === "dismissed") return "failed";
  return "review";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
