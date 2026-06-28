"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardApi, type NeedsAttentionSummary } from "@/api/dashboard";

export function useNeedsAttention() {
  const [summary, setSummary] = useState<NeedsAttentionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await dashboardApi.getNeedsAttention());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load items that need attention.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    summary,
    loading,
    error,
    refresh: load,
  };
}
