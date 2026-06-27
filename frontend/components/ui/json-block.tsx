export function JsonBlock({ value, data, title }: { value?: unknown; data?: unknown; title?: string }) {
  return (
    <div className="space-y-2">
      {title ? <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3> : null}
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-[#F8FAFC] p-3 text-xs leading-5 text-ink">
        {JSON.stringify(data ?? value, null, 2)}
      </pre>
    </div>
  );
}
