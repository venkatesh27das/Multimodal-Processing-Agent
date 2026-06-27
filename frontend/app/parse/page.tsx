"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudUpload,
  FileText,
  Laptop,
  Loader2,
  Mail,
  Play,
  Settings2,
  Share2,
  ShieldCheck,
} from "lucide-react";
import {
  ActionButton,
  Card,
  FileTypeIcon,
  ProgressStepper,
  SectionHeader,
  SelectField,
  StatusPill,
  Tag,
  Toggle,
} from "@/components/design-system";
import { api, type ParseJobRunResponse } from "@/lib/api";

const objectives = [
  ["General Parsing", "Extract content, structure, and metadata."],
  ["Structured Extraction", "Extract data into structured fields."],
  ["Search-ready", "Optimize for semantic search and RAG."],
  ["Graph-ready", "Extract entities and relationships."],
  ["Audio/Video Transcript", "Generate transcripts and summaries."],
  ["Custom", "Use a custom strategy or configuration."],
];

export default function ParsePage() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseJobRunResponse | null>(null);

  const fileType = useMemo(() => file?.name.split(".").pop()?.toUpperCase() ?? "PDF", [file]);

  async function runJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file before running a parsing job.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const uploaded = await api.uploadFile(file);
      const created = await api.runJob({
        file_id: uploaded.file_id,
        requested_output_contract: {
          parsed_text: true,
          tables: true,
          entities: true,
          relationships: true,
          chunks: true,
        },
        quality_target: "balanced",
        cost_profile: "balanced",
        latency_profile: "interactive",
        governance_constraints: { external_services_allowed: false },
      });
      setResult(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run parsing job.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={runJob}>
      <ProgressStepper steps={["Upload", "Configure", "Review & Run"]} current={result ? 3 : file ? 2 : 0} />

      {result ? (
        <Card className="border-emerald-200 bg-success-soft p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
              <div>
                <p className="text-base font-bold text-emerald-800">Parsing job created successfully.</p>
                <p className="text-sm text-emerald-700">Job ID: {result.job.id}</p>
              </div>
            </div>
            <ActionButton type="button" variant="secondary">View Job</ActionButton>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeader title="Upload files" />
            <label className="mt-4 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center hover:border-accent hover:bg-accent-soft/40">
              <CloudUpload className="h-12 w-12 text-slate-500" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-ink">
                {file ? file.name : "Drag and drop files here, or click to browse"}
              </p>
              <p className="mt-2 text-sm text-muted">Upload documents, spreadsheets, images, audio, and video files.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["PDF", "DOCX", "PPTX", "XLSX", "TXT", "PNG", "JPG", "MP3", "MP4"].map((type) => (
                  <Tag key={type}>{type}</Tag>
                ))}
              </div>
              <input className="sr-only" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <p className="mt-4 text-sm font-bold text-ink">Or upload from</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                ["Local Upload", Laptop],
                ["Cloud Storage", Cloud],
                ["SharePoint", Share2],
                ["Email Intake", Mail],
              ].map(([label, Icon]) => (
                <button key={String(label)} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white text-sm font-bold text-ink hover:bg-surface" type="button">
                  <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
                  {String(label)}
                </button>
              ))}
            </div>
            {file ? (
              <div className="mt-5 rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
                  <span className="font-bold text-ink">1 file uploaded</span>
                  <span className="text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileTypeIcon type={fileType} />
                    <span className="text-sm font-bold text-ink">{file.name}</span>
                  </div>
                  <Tag>{fileType}</Tag>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionHeader title="Parsing objective" description="Select the primary objective for this parsing run." />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {objectives.map(([title, description], index) => (
                <button
                  key={title}
                  className={`rounded-lg border p-4 text-left ${index === 0 ? "border-accent bg-accent-soft/50" : "border-border bg-white hover:bg-surface"}`}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <FileText className={index === 0 ? "h-5 w-5 text-accent" : "h-5 w-5 text-muted"} />
                    <span className={`h-4 w-4 rounded-full border ${index === 0 ? "border-accent bg-accent" : "border-slate-300"}`} />
                  </div>
                  <p className="mt-5 text-sm font-bold text-ink">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Smart configuration" description="Recommended settings optimized for selected files." />
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <SelectField label="Output Preset" value="Balanced" options={["Balanced"]} />
              <SelectField label="Quality Target" value="High (92%+)" options={["High (92%+)"]} />
              <SelectField label="Cost Profile" value="Balanced" options={["Balanced"]} />
              <SelectField label="Latency Profile" value="Standard" options={["Standard"]} />
              <SelectField label="Review Policy" value="Review if <85%" options={["Review if <85%"]} />
            </div>
            <div className="mt-4 grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
              <SelectField label="OCR & image handling" value="Auto (OCR if needed)" options={["Auto (OCR if needed)"]} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Generate embeddings</span>
                <Toggle checked />
              </div>
              <SelectField label="Fallback policy" value="Use recommended fallback" options={["Use recommended fallback"]} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Enable table structure detection</span>
                <Toggle checked />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader title="Parsing summary" />
            <div className="mt-4 space-y-3">
              <SummaryRow icon={FileText} title="Detected file types" value={file ? "1" : "0"} detail={file ? fileType : "No file selected"} />
              <SummaryRow icon={CheckCircle2} title="Intake checks passed" value={file ? "3 / 3" : "0 / 3"} detail={file ? "All files scanned and validated" : "Waiting for upload"} success />
              <SummaryRow icon={ShieldCheck} title="Governance" value="OK" detail="Default Parsing Policy" />
              <SummaryRow icon={Settings2} title="What happens next" value="Profile" detail="We will generate parser recommendations." />
            </div>
          </Card>
          <Card className="p-5">
            <SectionHeader title="Ready to run" description="Review the summary and start the job." />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="Files" value={file ? "1" : "0"} />
              <MiniStat label="Estimated cost" value="$0.04" />
              <MiniStat label="Turnaround" value="~2m 30s" />
              <MiniStat label="Coverage" value="92%" />
            </div>
            {error ? <div className="mt-4 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm text-red-700">{error}</div> : null}
            <ActionButton className="mt-5 w-full" disabled={running} icon={running ? Loader2 : Play} type="submit">
              {running ? "Running..." : "Run Parsing Job"}
            </ActionButton>
          </Card>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({
  icon: Icon,
  title,
  value,
  detail,
  success = false,
}: {
  icon: typeof FileText;
  title: string;
  value: string;
  detail: string;
  success?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`${success ? "bg-success-soft text-success" : "bg-accent-soft text-accent"} grid h-10 w-10 place-items-center rounded-lg`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{title}</p>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </div>
        </div>
        <span className="text-lg font-bold text-ink">{value}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
