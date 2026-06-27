import { PlaceholderPage } from "@/components/placeholder-page";

export default function SkillsRegistryPage() {
  return (
    <PlaceholderPage
      title="Skills registry"
      description="Reusable extraction skills will declare schemas, validation rules, examples, and post-processing hooks."
      rows={[
        { label: "Invoice extraction", value: "Planned" },
        { label: "Contract parsing", value: "Planned" },
        { label: "Research paper parsing", value: "Planned" },
      ]}
    />
  );
}

