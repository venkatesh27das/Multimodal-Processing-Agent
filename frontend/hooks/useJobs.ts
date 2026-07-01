"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  const [filtered, setFiltered] = useState<PaginatedJobsResponse>({
    jobs: [],
    total: 0,
    page: 1,
    pageSize: defaultFilters.pageSize,
    totalPages: 1,
  });
  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextJobs, nextFiltered] = await Promise.all([
        jobsApi.listJobs({ pageSize: 250 }),
        jobsApi.listJobsPage(filters),
      ]);
      setJobs(nextJobs);
      setFiltered(nextFiltered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load runs.");
      setJobs([]);
      setFiltered({
        jobs: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: 1,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

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
