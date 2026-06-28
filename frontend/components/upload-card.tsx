import { FileUp, UploadCloud } from "lucide-react";

export function UploadCard() {
  return (
    <section className="rounded-md border border-border bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[#E8F3F1] text-accent">
              <FileUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold">File intake</h2>
              <p className="text-sm text-muted">
                Register source files for profiling, parser planning, and governed outputs.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <span>PDF, DOCX, images</span>
            <span>HTML, audio, video</span>
            <span>Checksum and audit ready</span>
          </div>
        </div>
        <label className="flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#B7C0CE] bg-surface px-6 text-center transition hover:border-accent lg:max-w-md">
          <UploadCloud className="h-7 w-7 text-accent" aria-hidden="true" />
          <span className="mt-3 text-sm font-medium text-ink">Choose a file</span>
          <span className="mt-1 text-xs text-muted">Upload wiring is ready for API integration.</span>
          <input className="sr-only" type="file" />
        </label>
      </div>
    </section>
  );
}
