import clsx from "clsx";

export function Panel({
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

export function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

