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
      setJobs(nextJobs.length ? nextJobs : demoJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs.");
      setJobs(demoJobs);
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

const baseTime = new Date("2025-05-26T10:24:00").toISOString();

const demoJobs: Job[] = [
  demoJob("JOB-7FLE", "Master Services Agreement.pdf", "pdf", "2.4 MB", "Contract data extraction", "Contract Parser v3", "Completed", 0.92, "2m ago", "2m 09s", baseTime),
  demoJob("JOB-Q2FR", "Q2 Financial Report.docx", "docx", "1.1 MB", "Financial statement parsing", "Financial Parser v2", "Completed", 0.89, "5m ago", "5m 13s", baseTime),
  demoJob("JOB-INV2", "Invoices_May_2024.xlsx", "xlsx", "890 KB", "Invoice data extraction", "Invoice Extractor v2", "Review Required", 0.74, "14m ago", "1m 41s", baseTime, "Table Parser v1"),
  demoJob("JOB-CALL", "Customer Call - Acme Corp.mp4", "mp4", "324 MB", "Transcript & summary", "Transcript & Summary v1", "Completed", 0.91, "18m ago", "8m 22s", baseTime),
  demoJob("JOB-RSCH", "Research Paper - Attention.pdf", "pdf", "3.2 MB", "Research paper parsing", "Research Paper Parser", "Failed", null, "22m ago", "1m 05s", baseTime, "Table Parser v2"),
  demoJob("JOB-SALE", "Sales Pipeline Q2.xlsx", "xlsx", "780 KB", "Sales data extraction", "Table Parser v1", "Completed", 0.96, "24m ago", "47s", baseTime),
  demoJob("JOB-HNDB", "Employee Handbook.pdf", "pdf", "1.8 MB", "Policy document parsing", "General Parser v2", "Review Required", 0.68, "27m ago", "3m 36s", baseTime, "General Parser v1"),
  demoJob("JOB-BRD", "Board Minutes - May.docx", "docx", "512 KB", "Meeting minutes parsing", "General Parser v2", "Completed", 0.93, "31m ago", "1m 19s", baseTime),
  demoJob("JOB-DEMO", "Product Demo Recording.mp4", "mp4", "156 MB", "Transcript extraction", "Transcript & Summary v1", "Completed", 0.9, "34m ago", "6m 03s", baseTime),
  demoJob("JOB-EXP", "Expense Report - Apr.xlsx", "xlsx", "430 KB", "Expense data extraction", "Table Parser v1", "Failed", null, "38m ago", "51s", baseTime, "Table Parser v1"),
];

function demoJob(
  id: string,
  fileName: string,
  fileType: string,
  fileSizeLabel: string,
  objective: string,
  parser: string,
  status: Job["status"],
  quality: number | null,
  updatedAtLabel: string,
  durationLabel: string,
  startedAt: string,
  fallbackParser: string | null = null,
): Job {
  return {
    id,
    fileId: `file-${id.toLowerCase()}`,
    fileName,
    fileType,
    fileSizeLabel,
    objective,
    parser,
    fallback: Boolean(fallbackParser),
    fallbackParser,
    status,
    statusKey: status === "Completed" ? "completed" : status === "Review Required" ? "review_required" : status === "Failed" ? "failed" : "running",
    quality,
    startedAt,
    startedAtLabel: "May 26, 2025\n10:24 AM",
    durationMs: durationLabel.endsWith("s") ? 129000 : null,
    durationLabel,
    updatedAt: startedAt,
    updatedAtLabel,
    reviewRequired: status === "Review Required",
  };
}
