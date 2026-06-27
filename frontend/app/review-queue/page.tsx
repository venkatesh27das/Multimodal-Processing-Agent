import { PlaceholderPage } from "@/components/placeholder-page";

export default function ReviewQueuePage() {
  return (
    <PlaceholderPage
      title="Review queue"
      description="Human review triggers from quality scoring, validation failures, and risk policy will be triaged here."
      rows={[
        { label: "Quality review", value: "Placeholder" },
        { label: "Schema exceptions", value: "Placeholder" },
        { label: "Policy checks", value: "Placeholder" },
      ]}
    />
  );
}

