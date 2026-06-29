"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { jobsApi, UnsupportedJobActionError, type Job } from "@/api/jobs";

export type ToastState = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

export function useJobActions({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportUnsupported, setExportUnsupported] = useState(false);

  function clearToast() {
    setToast(null);
  }

  function viewJob(job: Job) {
    router.push(`/jobs/${job.id}`);
  }

  async function retryJob(job: Job) {
    await runAction(`retry-${job.id}`, async () => {
      await jobsApi.retryJob(job.id);
      setToast({ tone: "success", message: `Retry started for ${job.fileName}.` });
      await onRefresh();
    }, "Retry endpoint is not available yet.");
  }

  async function sendToReview(job: Job) {
    await runAction(`review-${job.id}`, async () => {
      await jobsApi.sendToReview(job.id);
      setToast({ tone: "success", message: `${job.fileName} was sent to review.` });
      await onRefresh();
    }, "Send to Review endpoint is not available yet.");
  }

  async function deleteJob(job: Job) {
    const confirmed = window.confirm(`Delete the run for ${job.fileName}? This removes the job, agent trace, review item, and published assets for this run.`);
    if (!confirmed) return;

    await runAction(`delete-${job.id}`, async () => {
      await jobsApi.deleteJob(job.id);
      setToast({ tone: "success", message: `${job.fileName} run was deleted.` });
      await onRefresh();
    }, "Delete endpoint is not available yet.");
  }

  async function exportJobs() {
    if (exportUnsupported) {
      setToast({ tone: "warning", message: "Export endpoint is not available yet." });
      return;
    }

    setBusyAction("export");
    setToast(null);
    try {
      const response = await jobsApi.exportJobs();
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) setExportUnsupported(true);
        setToast({ tone: "warning", message: "Export endpoint is not available yet." });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "runs-export";
      anchor.click();
      URL.revokeObjectURL(url);
      setToast({ tone: "success", message: "Runs export downloaded." });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Export failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(key: string, action: () => Promise<void>, unsupportedMessage: string) {
    setBusyAction(key);
    setToast(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof UnsupportedJobActionError) {
        setToast({ tone: "warning", message: unsupportedMessage });
      } else {
        setToast({
          tone: "error",
          message: err instanceof Error ? err.message : "Run action failed.",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  return {
    toast,
    busyAction,
    exportUnsupported,
    clearToast,
    viewJob,
    retryJob,
    sendToReview,
    deleteJob,
    exportJobs,
  };
}
