"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardApi, type RecentJob } from "@/api/dashboard";

export function useRecentJobs(limit = 6) {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await dashboardApi.getRecentJobs(limit));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load recent jobs.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    jobs,
    loading,
    error,
    refresh: load,
  };
}
