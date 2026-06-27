"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">Something went wrong</div>
      <p className="mt-1 text-red-700">{error.message || "The UI could not render this view."}</p>
      <button
        className="mt-3 h-8 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-strong"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
