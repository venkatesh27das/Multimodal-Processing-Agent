import { MetricStrip } from "@/components/metric-strip";
import { UploadCard } from "@/components/upload-card";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <MetricStrip />
      <UploadCard />
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-md border border-border bg-white p-4 shadow-panel xl:col-span-2">
          <h2 className="text-base font-semibold">Recent parse jobs</h2>
          <div className="mt-4 rounded-md border border-border">
            <div className="grid grid-cols-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted">
              <span>File</span>
              <span>Status</span>
              <span>Parser</span>
            </div>
            <div className="px-4 py-8 text-sm text-muted">No jobs have been queued yet.</div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold">Parser readiness</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">PDF native text</span>
              <span className="font-medium text-accent-strong">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">DOCX text</span>
              <span className="font-medium text-accent-strong">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Mock VLM</span>
              <span className="font-medium text-muted">Disabled</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

