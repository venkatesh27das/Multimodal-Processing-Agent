import { PlaceholderPage } from "@/components/placeholder-page";

export default function JobsPage() {
  return (
    <PlaceholderPage
      title="Parse jobs"
      description="Queue, execution, fallback, and quality states will surface here as the engine comes online."
      rows={[
        { label: "Queued", value: "Placeholder" },
        { label: "Running", value: "Placeholder" },
        { label: "Completed", value: "Placeholder" },
      ]}
    />
  );
}

