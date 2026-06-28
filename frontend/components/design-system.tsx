"use client";

import clsx from "clsx";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CloudUpload,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Info,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-lg border border-border bg-white shadow-panel", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ActionButton({
  children,
  icon: Icon,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-accent text-white shadow-panel hover:bg-accent-strong",
        variant === "secondary" && "border border-border bg-white text-ink shadow-panel hover:bg-surface",
        variant === "ghost" && "text-accent hover:bg-accent-soft",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  tone = "info",
  icon: Icon,
  data,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "purple";
  icon: LucideIcon;
  data?: number[];
}) {
  const toneClasses = {
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    purple: "bg-purple-soft text-purple",
  };
  const isNegativeDelta = delta?.trim().startsWith("↓");
  return (
    <Card className="flex min-h-[86px] items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-lg", toneClasses[tone])}>
          {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-bold leading-tight text-muted">
            <span>{label}</span>
            <Info className="h-3 w-3 shrink-0 text-subtle" aria-hidden="true" />
          </p>
          <p className="mt-1 text-[23px] font-bold leading-none tracking-[-0.02em] text-ink">{value}</p>
          {delta ? (
            <p className={clsx("mt-2 text-xs font-semibold", isNegativeDelta ? "text-danger" : "text-success")}>
              {delta}
            </p>
          ) : null}
        </div>
      </div>
      {data ? <Sparkline data={data} tone={tone} className="hidden shrink-0 2xl:block" /> : null}
    </Card>
  );
}

export function StatusPill({
  status,
  children,
}: {
  status: "healthy" | "completed" | "active" | "review" | "warning" | "failed" | "degraded" | "queued";
  children?: React.ReactNode;
}) {
  const classes = {
    healthy: "border-success/20 bg-success-soft text-emerald-700",
    completed: "border-success/20 bg-success-soft text-emerald-700",
    active: "border-success/20 bg-success-soft text-emerald-700",
    review: "border-warning/25 bg-warning-soft text-amber-700",
    warning: "border-warning/25 bg-warning-soft text-amber-700",
    failed: "border-danger/20 bg-danger-soft text-red-700",
    degraded: "border-danger/20 bg-danger-soft text-red-700",
    queued: "border-slate-200 bg-surface text-muted",
  };
  return (
    <span className={clsx("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-bold", classes[status])}>
      {["healthy", "completed", "active"].includes(status) ? <Check className="h-3 w-3" /> : null}
      {children ?? status}
    </span>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "info" | "purple";
}) {
  const classes = {
    neutral: "border-border bg-surface text-slate-700",
    accent: "border-orange-200 bg-accent-soft text-accent",
    success: "border-emerald-200 bg-success-soft text-emerald-700",
    warning: "border-amber-200 bg-warning-soft text-amber-700",
    info: "border-blue-200 bg-info-soft text-info",
    purple: "border-violet-200 bg-purple-soft text-purple",
  };
  return (
    <span className={clsx("inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold", classes[tone])}>
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  children,
  minWidth = "980px",
}: {
  columns: string[];
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="bg-surface text-[11px] uppercase tracking-wide text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-border px-4 py-3 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function SearchFilterBar({
  placeholder,
  children,
}: {
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex h-11 min-w-[300px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>{placeholder}</span>
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = CloudUpload,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-muted shadow-panel">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-4xl pt-10">
      <Card className="p-10">
        <EmptyState
          title={`${title} is coming soon`}
          description="This navigation area is reserved in the product shell. We will wire the full workflow in a later implementation pass."
        />
      </Card>
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
}: {
  label?: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-xs font-bold text-muted">{label}</span> : null}
      <div className="flex h-11 min-w-[170px] items-center justify-between rounded-lg border border-border bg-white px-3 text-sm font-semibold text-ink shadow-panel">
        <span>{value}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>
      <select className="sr-only" defaultValue={value} aria-label={label ?? value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ checked = false }: { checked?: boolean }) {
  return (
    <span className={clsx("inline-flex h-6 w-10 items-center rounded-full p-0.5", checked ? "bg-accent" : "bg-slate-300")}>
      <span className={clsx("h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-4" : "translate-x-0")} />
    </span>
  );
}

export function ProgressStepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-4">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={step} className="flex min-w-0 flex-1 items-center gap-4 last:flex-none">
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  "grid h-8 w-8 place-items-center rounded-full border text-sm font-bold",
                  done && "border-success bg-success text-white",
                  active && "border-accent bg-accent text-white",
                  !done && !active && "border-slate-300 bg-white text-slate-600",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={clsx("text-sm font-bold", active ? "text-accent" : "text-ink")}>{step}</span>
            </div>
            {index < steps.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function FileTypeIcon({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  const Icon =
    normalized.includes("png") || normalized.includes("jpg") || normalized.includes("image")
      ? FileImage
      : normalized.includes("mp3") || normalized.includes("audio")
        ? FileAudio
        : normalized.includes("mp4") || normalized.includes("video")
          ? FileVideo
          : normalized.includes("pdf") || normalized.includes("doc")
            ? FileText
            : File;
  const tone =
    normalized.includes("pdf") ? "text-danger bg-danger-soft" :
    normalized.includes("doc") ? "text-info bg-info-soft" :
    normalized.includes("xls") ? "text-success bg-success-soft" :
    normalized.includes("mp") ? "text-purple bg-purple-soft" :
    "text-muted bg-surface";
  return (
    <span className={clsx("grid h-8 w-8 place-items-center rounded-md", tone)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function Sparkline({
  data,
  tone = "info",
  className,
}: {
  data: number[];
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "purple";
  className?: string;
}) {
  const color = {
    accent: "#F45113",
    success: "#12B76A",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#2563EB",
    purple: "#8B5CF6",
  }[tone];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * 78;
      const y = 26 - ((value - min) / Math.max(1, max - min)) * 22;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className={clsx("h-8 w-20", className)} viewBox="0 0 80 32" aria-hidden="true">
      <polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function MiniBar({ value }: { value: number }) {
  return (
    <span className="inline-flex h-1.5 w-16 rounded-full bg-slate-100">
      <span className="rounded-full bg-info" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </span>
  );
}

export function ArrowLink({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-accent">
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
