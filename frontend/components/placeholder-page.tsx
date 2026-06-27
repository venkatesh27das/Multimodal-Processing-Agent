type PlaceholderPageProps = {
  title: string;
  description: string;
  rows: Array<{ label: string; value: string }>;
};

export function PlaceholderPage({ title, description, rows }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </section>
      <section className="rounded-md border border-border bg-white shadow-panel">
        <div className="grid border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted sm:grid-cols-2">
          <span>Name</span>
          <span>Status</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 border-b border-border px-4 py-4 text-sm last:border-b-0 sm:grid-cols-2"
          >
            <span className="font-medium text-ink">{row.label}</span>
            <span className="text-muted">{row.value}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

