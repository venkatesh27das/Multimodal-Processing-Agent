type Metric = {
  label: string;
  value: string;
};

const metrics: Metric[] = [
  { label: "Queued runs", value: "0" },
  { label: "Parsers online", value: "2" },
  { label: "Review items", value: "0" },
  { label: "Avg quality", value: "--" },
];

export function MetricStrip() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-md border border-border bg-white p-4 shadow-panel"
        >
          <p className="text-sm text-muted">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{metric.value}</p>
        </div>
      ))}
    </section>
  );
}
