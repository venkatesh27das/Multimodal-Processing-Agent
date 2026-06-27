"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Send } from "lucide-react";
import { api, getJobSummaries, ParseJobRunResponse, pct, shortId, type JobSummary } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

const contractOptions = [
  { id: "parsed_text", label: "Parsed text" },
  { id: "tables", label: "Tables" },
  { id: "entities", label: "Entities" },
  { id: "relationships", label: "Relationships" },
  { id: "evidence_spans", label: "Evidence spans" },
];

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [contract, setContract] = useState<string[]>(["parsed_text", "tables", "entities"]);
  const [qualityTarget, setQualityTarget] = useState<"low" | "balanced" | "high">("balanced");
  const [costProfile, setCostProfile] = useState<"low_cost" | "balanced" | "premium">("balanced");
  const [latencyProfile, setLatencyProfile] = useState<"batch" | "interactive" | "real_time">("interactive");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseJobRunResponse | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  useEffect(() => {
    getJobSummaries().then(setJobs).catch(() => setJobs([]));
  }, []);

  const outputContract = useMemo(
    () => Object.fromEntries(contractOptions.map((item) => [item.id, contract.includes(item.id)])),
    [contract],
  );

  async function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file before submitting a parsing job.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const uploaded = await api.uploadFile(file);
      const created = await api.runJob({
        file_id: uploaded.file_id,
        requested_output_contract: outputContract,
        quality_target: qualityTarget,
        cost_profile: costProfile,
        latency_profile: latencyProfile,
        governance_constraints: {},
      });
      setResult(created);
      setJobs(await getJobSummaries().catch(() => []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit parsing job.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleContract(id: string) {
    setContract((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <Panel>
        <PanelHeader title="Upload and Parse" />
        <form className="space-y-5 p-4" onSubmit={submitJob}>
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center transition hover:border-accent hover:bg-accent-soft">
            <FileUp className="h-8 w-8 text-accent" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-ink">
              {file ? file.name : "Choose a document, image, audio, or video file"}
            </span>
            <span className="mt-1 text-xs text-muted">Local storage intake with checksum and profiling</span>
            <input className="sr-only" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>

          <div>
            <p className="text-xs font-semibold uppercase text-muted">Output contract</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {contractOptions.map((item) => (
                <label
                  key={item.id}
                  className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-ink"
                >
                  <input
                    checked={contract.includes(item.id)}
                    className="h-4 w-4 accent-accent"
                    type="checkbox"
                    onChange={() => toggleContract(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Select label="Quality target" value={qualityTarget} onChange={setQualityTarget} options={["low", "balanced", "high"]} />
            <Select label="Cost profile" value={costProfile} onChange={setCostProfile} options={["low_cost", "balanced", "premium"]} />
            <Select label="Latency profile" value={latencyProfile} onChange={setLatencyProfile} options={["batch", "interactive", "real_time"]} />
          </div>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Job created with {result.plan.selected_parser_id}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <Link className="font-semibold text-emerald-900 underline" href={`/jobs/${result.job.id}`}>
                  Open job {shortId(result.job.id)}
                </Link>
                {result.assets[0] ? (
                  <Link className="font-semibold text-emerald-900 underline" href={`/assets/${result.assets[0].asset_id}`}>
                    Open asset {shortId(result.assets[0].asset_id)}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Submit parsing job
          </button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Recent Jobs" action={<Link className="text-xs font-semibold text-accent-strong" href="/jobs">View all</Link>} />
        <div className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.slice(0, 6).map(({ job, quality }) => (
                <tr key={job.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-ink hover:text-accent-strong" href={`/jobs/${job.id}`}>
                      {shortId(job.id)}
                    </Link>
                    <div className="text-xs text-muted">{job.parser_id ?? "Planning"}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={job.status} /></td>
                  <td className="px-4 py-3 text-muted">{pct(quality?.extraction_confidence)}</td>
                </tr>
              ))}
              {!jobs.length ? (
                <tr><td className="px-4 py-8 text-sm text-muted" colSpan={3}>No jobs yet. Upload a file to begin.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-muted">{label}</span>
      <select
        className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-ink outline-none focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}
