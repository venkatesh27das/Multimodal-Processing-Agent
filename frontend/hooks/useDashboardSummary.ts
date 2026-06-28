"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardApi, type DashboardSummary, type SystemInsights } from "@/api/dashboard";

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [insights, setInsights] = useState<SystemInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, nextInsights] = await Promise.all([
        dashboardApi.getDashboardSummary(),
        dashboardApi.getSystemInsights(),
      ]);
      setSummary(nextSummary);
      setInsights(nextInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard summary.");
      setSummary(null);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    summary,
    insights,
    loading,
    error,
    refresh: load,
  };
}
