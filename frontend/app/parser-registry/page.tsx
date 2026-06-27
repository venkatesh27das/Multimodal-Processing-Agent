import { PlaceholderPage } from "@/components/placeholder-page";

export default function ParserRegistryPage() {
  return (
    <PlaceholderPage
      title="Parser registry"
      description="Parser capabilities, costs, latency classes, deployment modes, and enablement controls will live here."
      rows={[
        { label: "PDF Native Text Parser", value: "Enabled" },
        { label: "DOCX Parser", value: "Enabled" },
        { label: "Mock VLM Parser", value: "Disabled" },
      ]}
    />
  );
}

