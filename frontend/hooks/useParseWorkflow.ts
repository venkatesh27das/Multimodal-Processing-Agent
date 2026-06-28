"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UploadedFile } from "@/api/files";
import {
  createParsingPlan,
  defaultParseConfiguration,
  deriveJobProgress,
  jobsApi,
  type JobEvent,
  type JobProgress,
  type ParseConfiguration,
  type ParseJob,
  type ParseJobRunResponse,
  type ParseObjective,
  type ParserRecommendation,
  type ParsingPlan,
} from "@/api/jobs";

export type ParseWorkflowStep = "upload" | "configure" | "review" | "running";

export type ParseWorkflowToast = {
  tone: "success" | "warning" | "danger";
  message: string;
};

const terminalStatuses = new Set(["complete", "failed", "cancelled", "review_required"]);

export function useParseWorkflow(uploadedFiles: UploadedFile[]) {
  const [step, setStep] = useState<ParseWorkflowStep>("upload");
  const [objective, setObjective] = useState<ParseObjective>("general");
  const [configuration, setConfiguration] = useState<ParseConfiguration>(() => defaultParseConfiguration());
  const [plan, setPlan] = useState<ParsingPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobRuns, setJobRuns] = useState<ParseJobRunResponse[]>([]);
  const [jobSnapshots, setJobSnapshots] = useState<Record<string, ParseJob>>({});
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [toast, setToast] = useState<ParseWorkflowToast | null>(null);
  const planRequestId = useRef(0);

  const uploadedKey = uploadedFiles.map((file) => file.fileId).join("|");

  const updateConfiguration = useCallback((patch: Partial<ParseConfiguration>) => {
    setConfiguration((current) => ({ ...current, ...patch }));
  }, []);

  const computePlan = useCallback(async () => {
    const readyFiles = uploadedFiles.filter((file) => file.fileId);
    if (!readyFiles.length) {
      setPlan(null);
      return null;
    }

    const requestId = planRequestId.current + 1;
    planRequestId.current = requestId;
    setPlanning(true);
    setPlanError(null);
    try {
      const recommendations = await Promise.all(
        readyFiles.map((file) =>
          isDemoFile(file.fileId)
            ? Promise.resolve(demoRecommendation(file))
            : jobsApi.planParseJob(
                file.fileId as string,
                file.name,
                file.profile?.file_type ?? file.type,
                objective,
                configuration,
              ),
        ),
      );
      if (requestId !== planRequestId.current) return null;
      const nextPlan = createParsingPlan(recommendations, configuration);
      setPlan(nextPlan);
      setToast({ tone: "success", message: "Parser recommendations are ready." });
      return nextPlan;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate parser recommendations.";
      if (requestId === planRequestId.current) {
        setPlanError(message);
        setToast({ tone: "danger", message: `Planning failed: ${message}` });
      }
      return null;
    } finally {
      if (requestId === planRequestId.current) setPlanning(false);
    }
  }, [configuration, objective, uploadedFiles]);

  useEffect(() => {
    if (step !== "configure") return;
    const timeout = window.setTimeout(() => {
      void computePlan();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [computePlan, step, uploadedKey]);

  const goToConfigure = useCallback(async () => {
    if (!uploadedFiles.length) {
      setToast({ tone: "warning", message: "Upload at least one file before configuring." });
      return;
    }
    setStep("configure");
    await computePlan();
  }, [computePlan, uploadedFiles.length]);

  const goToReview = useCallback(async () => {
    const latestPlan = plan ?? await computePlan();
    if (!latestPlan) return;
    setStep("review");
  }, [computePlan, plan]);

  const saveDraft = useCallback(() => {
    setToast({ tone: "warning", message: "Draft saving is not available yet." });
  }, []);

  const runJobs = useCallback(async () => {
    if (creatingJob) return;

    const readyFiles = uploadedFiles.filter((file) => file.fileId);
    if (!readyFiles.length) {
      setToast({ tone: "warning", message: "Upload at least one file before running." });
      return;
    }

    setCreatingJob(true);
    setJobError(null);
    setJobRuns([]);
    setEvents([]);
    try {
      const responses: ParseJobRunResponse[] = [];
      for (const file of readyFiles) {
        const response = isDemoFile(file.fileId)
          ? demoRunResponse(file, objective, configuration, responses.length, readyFiles.length)
          : await jobsApi.createParseJob({
              fileId: file.fileId as string,
              objective,
              configuration,
            });
        responses.push(response);
      }
      setJobRuns(responses);
      setJobSnapshots(
        responses.reduce<Record<string, ParseJob>>((acc, response) => {
          acc[response.job.id] = response.job;
          return acc;
        }, {}),
      );
      setEvents(buildInitialEvents(responses));
      setStep("running");
      setToast({ tone: "success", message: "Parsing run created successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create parsing run.";
      setJobError(message);
      setToast({ tone: "danger", message: `Run creation failed: ${message}` });
    } finally {
      setCreatingJob(false);
    }
  }, [configuration, creatingJob, objective, uploadedFiles]);

  useEffect(() => {
    if (step !== "running" || !jobRuns.length) return;
    const jobIds = jobRuns.map((run) => run.job.id);
    const interval = window.setInterval(async () => {
      if (jobIds.every(isDemoJob)) {
        return;
      }
      const snapshots = await Promise.all(
        jobIds.map((jobId) => isDemoJob(jobId) ? Promise.resolve(null) : jobsApi.getParseJob(jobId).catch(() => null)),
      );
      const nextSnapshots = snapshots.filter((job): job is ParseJob => Boolean(job));
      if (!nextSnapshots.length) return;
      setJobSnapshots((current) => ({
        ...current,
        ...nextSnapshots.reduce<Record<string, ParseJob>>((acc, job) => {
          acc[job.id] = job;
          return acc;
        }, {}),
      }));
      const backendEvents = await Promise.all(
        jobIds.map((jobId) => isDemoJob(jobId) ? Promise.resolve([]) : jobsApi.getParseJobEvents(jobId).catch(() => [])),
      );
      setEvents((current) => mergeEvents(current, backendEvents.flat()));
      if (nextSnapshots.every((job) => terminalStatuses.has(job.status))) {
        window.clearInterval(interval);
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [jobRuns, step]);

  const progress: JobProgress = useMemo(() => {
    const snapshots = Object.values(jobSnapshots);
    const processed = snapshots.filter((job) => terminalStatuses.has(job.status)).length;
    return deriveJobProgress(snapshots[0] ?? jobRuns[0]?.job ?? null, uploadedFiles.length, processed);
  }, [jobRuns, jobSnapshots, uploadedFiles.length]);

  const resetWorkflow = useCallback(() => {
    setStep("upload");
    setObjective("general");
    setConfiguration(defaultParseConfiguration());
    setPlan(null);
    setPlanning(false);
    setPlanError(null);
    setCreatingJob(false);
    setJobError(null);
    setJobRuns([]);
    setJobSnapshots({});
    setEvents([]);
    setToast(null);
  }, []);

  return {
    step,
    objective,
    configuration,
    plan,
    planning,
    planError,
    creatingJob,
    jobError,
    jobRuns,
    jobSnapshots,
    progress,
    events,
    toast,
    setObjective,
    updateConfiguration,
    computePlan,
    goToConfigure,
    goToReview,
    setStep,
    saveDraft,
    runJobs,
    resetWorkflow,
    clearToast: () => setToast(null),
  };
}

function isDemoFile(fileId: string | null | undefined): boolean {
  return Boolean(fileId?.startsWith("demo-file-"));
}

function isDemoJob(jobId: string): boolean {
  return jobId.startsWith("demo-job-");
}

function demoRecommendation(file: UploadedFile): ParserRecommendation {
  const type = (file.profile?.file_type ?? file.type).toLowerCase();
  const isSheet = type.includes("xls");
  const isMedia = type.includes("mp") || type.includes("video") || type.includes("audio");
  const isDoc = type.includes("doc");
  return {
    fileId: file.fileId as string,
    fileName: file.name,
    fileType: file.type,
    primaryParserId: isSheet
      ? "Financial Parser v2"
      : isMedia
        ? "Transcript & Summary v1"
        : isDoc
          ? "Document Parser v2"
          : "Contract Parser v3",
    fallbackParserId: isSheet
      ? "Table Parser v1"
      : isMedia
        ? "Video Scene Parser"
        : "Layout OCR v2",
    secondaryParserId: null,
    selectedSkillId: isMedia ? "audio_meeting_parsing" : isSheet ? "table_normalization" : "contract_parsing",
    decisionScore: isSheet ? 0.94 : isMedia ? 0.89 : 0.92,
    decisionExplanation: "Demo recommendation generated for local UI review.",
  };
}

function demoRunResponse(
  file: UploadedFile,
  objective: ParseObjective,
  configuration: ParseConfiguration,
  index: number,
  totalFiles: number,
): ParseJobRunResponse {
  const recommendation = demoRecommendation(file);
  const now = new Date(Date.now() - index * 90_000).toISOString();
  const statuses: ParseJob["status"][] = ["complete", "running", "queued"];
  const status = statuses[index] ?? "queued";
  const job: ParseJob = {
    id: `demo-job-${index + 1}`,
    file_id: file.fileId as string,
    status,
    parser_id: recommendation.primaryParserId,
    skill_id: recommendation.selectedSkillId,
    quality_status: status === "queued" ? "pending" : "passed",
    progress_percent: 62,
    current_stage: "parsing",
    processed_files: 1,
    total_files: totalFiles,
    created_at: now,
    updated_at: now,
  };
  return {
    job,
    plan: {
      id: `demo-plan-${index + 1}`,
      job_id: job.id,
      file_id: file.fileId as string,
      selected_parser_id: recommendation.primaryParserId,
      fallback_parser_id: recommendation.fallbackParserId,
      selected_skill_id: recommendation.selectedSkillId,
      decision_reason: "Demo plan generated for UI review.",
      output_contract: {
        objective,
        outputPreset: configuration.outputPreset,
      },
      expected_assets: ["Parsed text", "Tables", "Entities", "Metadata"],
      quality_threshold: 0.85,
      cost_profile: { estimate: 0.18, currency: "USD" },
      human_review_policy: { review_if_below: 0.85 },
      created_at: now,
    },
    quality: {
      id: `demo-quality-${index + 1}`,
      job_id: job.id,
      quality_status: "passed",
      extraction_confidence: index === 1 ? 0.85 : 0.92,
      parser_confidence: 0.91,
      human_review_required: false,
      created_at: now,
      quality_explanation: "Demo quality score for UI review.",
    },
    assets: [],
    review_item: null,
  };
}

function buildInitialEvents(responses: ParseJobRunResponse[]): JobEvent[] {
  return responses.map((response) => ({
    id: `event-${response.job.id}`,
    jobId: response.job.id,
    timestamp: response.job.updated_at,
    message: `${response.plan.selected_parser_id} ${statusPhrase(response.job.status)}.`,
    status: eventStatus(response.job.status),
  }));
}

function mergeEvents(current: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function statusPhrase(status: string): string {
  if (status === "complete") return "completed parsing";
  if (status === "failed") return "failed during parsing";
  if (status === "cancelled") return "was cancelled";
  if (status === "review_required") return "completed with review required";
  return "started parsing";
}

function eventStatus(status: string): JobEvent["status"] {
  if (status === "complete") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "review_required") return "Review Required";
  if (status === "queued") return "Queued";
  return "Parsing";
}
