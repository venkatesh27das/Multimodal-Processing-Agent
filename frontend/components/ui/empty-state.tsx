export function EmptyState({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted">
      <div className="font-medium text-ink">{label}</div>
      {detail ? <div className="mt-1 text-xs text-muted">{detail}</div> : null}
    </div>
  );
}
