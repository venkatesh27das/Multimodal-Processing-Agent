import clsx from "clsx";

const tones: Record<string, string> = {
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  planning: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-slate-50 text-slate-700 border-slate-200",
  review_required: "bg-amber-50 text-amber-700 border-amber-200",
  fallback_required: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const label = value ?? "unknown";
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium capitalize",
        tones[label] ?? "border-border bg-surface text-muted",
      )}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

