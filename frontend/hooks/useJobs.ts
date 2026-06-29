"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterAndPaginateJobs,
  jobsApi,
  type Job,
  type JobFilters,
  type PaginatedJobsResponse,
} from "@/api/jobs";

const defaultFilters: JobFilters = {
  search: "",
  status: "all",
  fileType: "all",
  parser: "all",
  dateRange: "all",
  reviewOnly: false,
  page: 1,
  pageSize: 10,
};

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextJobs = await jobsApi.listJobs();
      setJobs(nextJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const filtered: PaginatedJobsResponse = useMemo(
    () => filterAndPaginateJobs(jobs, filters),
    [jobs, filters],
  );

  const parserOptions = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.parser))).sort(),
    [jobs],
  );

  const fileTypeOptions = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.fileType.toLowerCase()))).sort(),
    [jobs],
  );

  function updateFilters(patch: Partial<JobFilters>) {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 1,
    }));
  }

  return {
    jobs,
    filtered,
    filters,
    parserOptions,
    fileTypeOptions,
    loading,
    error,
    loadJobs,
    updateFilters,
  };
}
