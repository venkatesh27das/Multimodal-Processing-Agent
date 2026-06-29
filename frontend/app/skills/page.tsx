"use client";

import clsx from "clsx";
import { useState } from "react";
import {
  ChevronRight,
  Copy,
  FileText,
  Link2,
  MoreVertical,
  Package,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
} from "lucide-react";
import {
  ActionButton,
  Card,
  EmptyState,
  MetricCard,
  StatusPill,
  Tag,
} from "@/components/design-system";
import {
  formatDuration,
  formatPercent,
  type SkillCategory,
  type SkillDefinition,
  type SkillDetail,
  type SkillMutationPayload,
  type SkillStatus,
  type SkillWorkflowAttachmentPayload,
} from "@/api/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { useSkills } from "@/hooks/useSkills";

const tabs: Array<{ label: string; value: "all" | SkillCategory }> = [
  { label: "All Skills", value: "all" },
  { label: "Extraction", value: "Extraction" },
  { label: "Validation", value: "Validation" },
  { label: "Post-processing", value: "Post-processing" },
  { label: "Publishing", value: "Publishing" },
];

const statusOptions: Array<{ label: string; value: "all" | SkillStatus }> = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
  { label: "Draft", value: "draft" },
];

export default function SkillsPage() {
  const {
    filteredSkills,
    selectedId,
    selectedSkill,
    kpis,
    filters,
    parserOptions,
    loading,
    detailLoading,
    error,
    detailError,
    loadSkills,
    setSelectedId,
    updateFilters,
  } = useSkills();
  const actions = useSkillActions({ onRefresh: loadSkills });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Skills</h2>
          <p className="mt-1 text-sm text-muted">Manage reusable extraction, validation, and post-processing skills for parsing workflows.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <input
            ref={actions.fileInputRef}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void actions.handleSkillPackFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <ActionButton variant="secondary" icon={Upload} onClick={actions.importSkillPack} disabled={actions.busyAction === "import"}>
            Import Skill Pack
          </ActionButton>
          <ActionButton icon={Plus} onClick={actions.createSkill} disabled={actions.busyAction === "create"}>
            Create Skill
          </ActionButton>
        </div>
      </div>

      {actions.toast ? (
        <div
          className={clsx(
            "rounded-lg border px-4 py-3 text-sm font-semibold shadow-panel",
            actions.toast.tone === "success" && "border-emerald-200 bg-success-soft text-emerald-700",
            actions.toast.tone === "warning" && "border-amber-200 bg-warning-soft text-amber-700",
            actions.toast.tone === "error" && "border-red-200 bg-danger-soft text-red-700",
          )}
          role="status"
          onClick={actions.clearToast}
        >
          {actions.toast.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-muted shadow-panel">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent font-medium text-ink outline-none placeholder:text-muted"
            placeholder="Search skills, schemas, workflows..."
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
          />
        </label>
        <div className="flex h-10 overflow-hidden rounded-lg border border-border bg-white shadow-panel">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={clsx("px-5 text-sm font-bold", filters.category === tab.value ? "border-b-2 border-accent text-accent" : "text-muted")}
              type="button"
              onClick={() => updateFilters({ category: tab.value })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) => updateFilters({ status: value as "all" | SkillStatus })}
        />
        <FilterSelect
          label="Attached Parser"
          value={filters.attachedParser}
          options={[{ label: "All Parsers", value: "all" }, ...parserOptions.map((parser) => ({ label: parser, value: parser }))]}
          onChange={(value) => updateFilters({ attachedParser: value })}
        />
        <button className="grid h-10 w-11 place-items-center rounded-lg border border-border bg-white text-muted shadow-panel" type="button" aria-label="More filters">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <Card className="border-danger/20 bg-danger-soft p-4 text-sm font-semibold text-red-700">{error}</Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => <MetricSkeleton key={index} />)
        ) : (
          <>
            <MetricCard icon={FileText} label="Total Skills" value={String(kpis.totalSkills)} delta="From backend registry" tone="info" data={[1, 2, 3, 4, 5, 6, Math.max(1, kpis.totalSkills)]} />
            <MetricCard icon={ShieldCheck} label="Active in Workflows" value={String(kpis.activeInWorkflows)} delta="Linked parser coverage" tone="success" data={[1, 1, 2, 2, 3, 4, Math.max(1, kpis.activeInWorkflows)]} />
            <MetricCard icon={Package} label="Reusable Packs" value={String(kpis.reusablePacks)} delta="From backend tags" tone="purple" data={[1, 2, 2, 3, 3, 4, Math.max(1, kpis.reusablePacks)]} />
            <MetricCard icon={Star} label="Avg Success" value={formatPercent(kpis.avgSuccess)} delta="Awaiting backend metrics" tone="warning" data={[0, 0, 0, 0, 0, 0, 0]} />
            <MetricCard icon={Star} label="Most Used" value={kpis.mostUsed} tone="info" />
          </>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(430px,0.95fr)_minmax(520px,1.05fr)]">
        <section className="min-w-0">
          <div className="grid gap-3 md:grid-cols-2">
            {loading ? Array.from({ length: 8 }).map((_, index) => <SkillCardSkeleton key={index} />) : null}
            {!loading && filteredSkills.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState title="No skills found" description="Try clearing the search or filter selection." icon={FileText} />
              </div>
            ) : null}
            {!loading ? filteredSkills.map((skill) => (
              <SkillListCard
                key={skill.skillId}
                skill={skill}
                selected={selectedId === skill.skillId}
                onSelect={() => setSelectedId(skill.skillId)}
              />
            )) : null}
          </div>
          {!loading && filteredSkills.length ? (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted shadow-panel">
              <span>Showing 1-{filteredSkills.length} of {filteredSkills.length}</span>
              <span className="font-semibold text-ink">8 per page</span>
            </div>
          ) : null}
        </section>

        <section className="min-w-0 xl:sticky xl:top-4">
          {detailLoading ? <DetailSkeleton /> : null}
          {!detailLoading && selectedSkill ? (
          <Card className="overflow-hidden border-accent/20">
            <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-ink">{selectedSkill.name}</h3>
                  <p className="mt-1 text-sm text-muted">{selectedSkill.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSkill.tags.map((tag) => <Tag key={tag}>{tag.toUpperCase()}</Tag>)}
                    <Tag tone="accent">{selectedSkill.version}</Tag>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={statusTone(selectedSkill.status)}>{labelForStatus(selectedSkill.status)}</StatusPill>
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface" type="button" aria-label="More skill actions">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-b border-border pb-5 sm:grid-cols-2 lg:grid-cols-4">
              <DetailMetric label="Weekly Runs" value={selectedSkill.weeklyRuns.toLocaleString()} />
              <DetailMetric label="Last Updated" value={selectedSkill.lastUpdated} />
              <DetailMetric label="Success Rate" value={formatPercent(selectedSkill.successRate)} positive={selectedSkill.successRate !== null} />
              <DetailMetric label="Avg Duration" value={formatDuration(selectedSkill.averageDurationMs)} positive={selectedSkill.averageDurationMs !== null} />
            </div>

            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {[
                ["Overview", selectedSkill.overview],
                ["Inputs", selectedSkill.inputs],
                ["Outputs", selectedSkill.outputs],
                ["Linked Parsers", selectedSkill.linkedParsers.length ? selectedSkill.linkedParsers.join(", ") : "No linked parsers reported"],
                ["Example Fields", selectedSkill.exampleFields],
                ["Workflow Usage", selectedSkill.workflowUsage],
                ["Recent Versions", selectedSkill.recentVersions.join(", ")],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[130px_1fr_20px] items-center gap-4 px-4 py-3 text-sm">
                  <span className="font-bold text-ink">{label}</span>
                  <span className="truncate text-muted">{value}</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              ))}
            </div>
            </div>

            <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
              <ActionButton variant="secondary" icon={FileText} onClick={() => void actions.editSkill(selectedSkill)} disabled={actions.busyAction === `edit-${selectedSkill.skillId}`}>
                Edit Skill
              </ActionButton>
              <ActionButton variant="secondary" icon={Copy} onClick={() => void actions.duplicateSkill(selectedSkill)} disabled={actions.busyAction === `duplicate-${selectedSkill.skillId}`}>
                Duplicate
              </ActionButton>
              <ActionButton icon={Link2} onClick={() => actions.attachToWorkflow(selectedSkill)} disabled={actions.busyAction === `attach-${selectedSkill.skillId}`}>
                Attach to Workflow
              </ActionButton>
            </div>
          </Card>
          ) : null}
          {!detailLoading && !selectedSkill && !loading ? (
            <Card className="p-5">
              <EmptyState title="Select a skill" description={detailError ?? "Choose a skill card to view registry details."} icon={FileText} />
            </Card>
          ) : null}
        </section>
      </div>

      {actions.modal?.type === "create" ? (
        <SkillFormModal
          title="Create Skill"
          busy={actions.busyAction === "create"}
          onClose={actions.closeModal}
          onSubmit={(payload) => void actions.submitCreateSkill(payload)}
        />
      ) : null}
      {actions.modal?.type === "edit" ? (() => {
        const skill = actions.modal.skill;
        return (
          <SkillFormModal
            title="Edit Skill"
            skill={skill}
            busy={actions.busyAction === `edit-${skill.skillId}`}
            onClose={actions.closeModal}
            onSubmit={(payload) => void actions.submitEditSkill(skill, payload)}
          />
        );
      })() : null}
      {actions.modal?.type === "attach" ? (() => {
        const skill = actions.modal.skill;
        return (
          <AttachWorkflowModal
            skill={skill}
            busy={actions.busyAction === `attach-${skill.skillId}`}
            onClose={actions.closeModal}
            onSubmit={(payload) => void actions.submitWorkflowAttachment(skill, payload)}
          />
        );
      })() : null}
    </div>
  );
}

function SkillListCard({
  onSelect,
  selected,
  skill,
}: {
  onSelect: () => void;
  selected: boolean;
  skill: SkillDefinition;
}) {
  return (
    <button
      className={clsx(
        "group min-h-[138px] rounded-lg border bg-white p-4 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface",
        selected ? "border-accent bg-accent-soft/30 ring-1 ring-accent/20" : "border-border",
      )}
      onClick={onSelect}
      type="button"
      aria-pressed={selected}
    >
      <div className="flex gap-3">
        <span className={clsx("grid h-12 w-12 shrink-0 place-items-center rounded-lg", selected ? "bg-accent-soft text-accent" : "bg-info-soft text-info")}>
          <FileText className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{skill.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{skill.description}</p>
        </div>
      </div>
      <div className="mt-3 flex min-h-[24px] flex-wrap gap-1.5">
        {skill.tags.slice(0, 4).map((tag) => <Tag key={tag}>{tag.toUpperCase()}</Tag>)}
      </div>
      <div className="mt-4 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 text-xs">
        <span className="font-bold text-muted">{skill.version}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="font-semibold text-success">{labelForStatus(skill.status)}</span>
        <span className="truncate text-right text-muted">{skill.runCountLabel}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span>{skill.linkedParserCount} parser{skill.linkedParserCount === 1 ? "" : "s"}</span>
        <span className="truncate">{skill.category}</span>
      </div>
    </button>
  );
}

function SkillFormModal({
  title,
  skill,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  skill?: SkillDetail;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: SkillMutationPayload) => void;
}) {
  const [form, setForm] = useState({
    skillId: skill?.skillId ?? "",
    name: skill?.name ?? "",
    description: skill?.description ?? "",
    documentTypes: skill?.supportedDocumentTypes.join(", ") ?? "pdf",
    version: skill?.version ?? "0.1.0",
    enabled: skill?.status !== "disabled",
    postProcessingHook: skill?.postProcessingHook ?? "",
    extractionSchema: JSON.stringify(skill?.extractionSchema ?? { type: "object", properties: {} }, null, 2),
    validationRules: JSON.stringify(skill?.validationRules ?? {}, null, 2),
    examples: JSON.stringify(skill?.examples ?? [], null, 2),
  });
  const [error, setError] = useState<string | null>(null);

  function updateField(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    setError(null);
    let extractionSchema: Record<string, unknown>;
    let validationRules: Record<string, unknown>;
    let examples: Array<Record<string, unknown>>;
    try {
      extractionSchema = parseJsonObject(form.extractionSchema, "Extraction schema");
      validationRules = parseJsonObject(form.validationRules, "Validation rules");
      examples = parseJsonArray(form.examples, "Examples");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON.");
      return;
    }

    if (!form.name.trim() || !form.description.trim()) {
      setError("Name and description are required.");
      return;
    }

    onSubmit({
      skill_id: skill ? undefined : form.skillId.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim(),
      supported_document_types: form.documentTypes.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
      extraction_schema: extractionSchema,
      validation_rules: validationRules,
      examples,
      post_processing_hook: form.postProcessingHook.trim() || null,
      enabled: form.enabled,
      version: form.version.trim() || "0.1.0",
    });
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        {!skill ? <TextField label="Skill ID" value={form.skillId} placeholder="optional-custom-id" onChange={(value) => updateField("skillId", value)} /> : null}
        <TextField label="Name" value={form.name} placeholder="Invoice Field Validation" onChange={(value) => updateField("name", value)} />
        <TextField label="Version" value={form.version} placeholder="0.1.0" onChange={(value) => updateField("version", value)} />
        <TextField label="Document Types" value={form.documentTypes} placeholder="pdf, docx, image" onChange={(value) => updateField("documentTypes", value)} />
        <TextField label="Post-processing Hook" value={form.postProcessingHook} placeholder="optional_hook_name" onChange={(value) => updateField("postProcessingHook", value)} />
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => updateField("enabled", event.target.checked)}
          />
          Active
        </label>
      </div>
      <TextAreaField label="Description" value={form.description} rows={3} onChange={(value) => updateField("description", value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <TextAreaField label="Extraction Schema JSON" value={form.extractionSchema} rows={8} onChange={(value) => updateField("extractionSchema", value)} />
        <TextAreaField label="Validation Rules JSON" value={form.validationRules} rows={8} onChange={(value) => updateField("validationRules", value)} />
      </div>
      <TextAreaField label="Examples JSON Array" value={form.examples} rows={4} onChange={(value) => updateField("examples", value)} />
      {error ? <div className="rounded-lg border border-red-200 bg-danger-soft px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <ActionButton type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
        <ActionButton type="button" onClick={handleSubmit} disabled={busy}>{busy ? "Saving..." : "Save Skill"}</ActionButton>
      </div>
    </ModalShell>
  );
}

function AttachWorkflowModal({
  skill,
  busy,
  onClose,
  onSubmit,
}: {
  skill: SkillDetail;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: SkillWorkflowAttachmentPayload) => void;
}) {
  const [form, setForm] = useState({ workflowId: "", workflowName: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!form.workflowName.trim()) {
      setError("Workflow name is required.");
      return;
    }
    setError(null);
    onSubmit({
      workflow_id: form.workflowId.trim() || undefined,
      workflow_name: form.workflowName.trim(),
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <ModalShell title={`Attach ${skill.name}`} onClose={onClose}>
      <TextField label="Workflow Name" value={form.workflowName} placeholder="Invoice processing workflow" onChange={(value) => setForm((current) => ({ ...current, workflowName: value }))} />
      <TextField label="Workflow ID" value={form.workflowId} placeholder="optional-workflow-id" onChange={(value) => setForm((current) => ({ ...current, workflowId: value }))} />
      <TextAreaField label="Notes" value={form.notes} rows={3} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} />
      {error ? <div className="rounded-lg border border-red-200 bg-danger-soft px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <ActionButton type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
        <ActionButton type="button" onClick={handleSubmit} disabled={busy}>{busy ? "Attaching..." : "Attach"}</ActionButton>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4 py-6">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">Configure registry fields used by parsing workflows.</p>
          </div>
          <button className="rounded-lg px-2 py-1 text-lg font-bold text-muted hover:bg-surface" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="space-y-3">{children}</div>
      </Card>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-muted">
      {label}
      <input
        className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-accent"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-muted">
      {label}
      <textarea
        className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function parseJsonArray(value: string, label: string): Array<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(value || "[]");
  if (!Array.isArray(parsed) || !parsed.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new Error(`${label} must be a JSON array of objects.`);
  }
  return parsed as Array<Record<string, unknown>>;
}

function DetailMetric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
      {positive ? <p className="mt-1 text-xs font-bold text-success">↑ 3.4%</p> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? value;
  return (
    <label className="relative block">
      <div className="pointer-events-none flex h-10 min-w-[180px] items-center justify-between rounded-lg border border-border bg-white px-3 text-sm font-semibold text-ink shadow-panel">
        <span className="min-w-0">
          <span className="block text-[11px] leading-none text-muted">{label}</span>
          <span className="block max-w-[150px] truncate pt-1">{selected}</span>
        </span>
        <span className="text-muted">⌄</span>
      </div>
      <select
        className="absolute inset-0 h-10 w-full cursor-pointer opacity-0"
        value={value}
        aria-label={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function statusTone(status: SkillStatus): "active" | "queued" {
  return status === "active" ? "active" : "queued";
}

function labelForStatus(status: SkillStatus): string {
  if (status === "active") return "Active";
  if (status === "disabled") return "Disabled";
  return "Draft";
}

function MetricSkeleton() {
  return (
    <Card className="flex min-h-[92px] items-center gap-4 p-4">
      <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
        <div className="h-7 w-16 animate-pulse rounded bg-slate-100" />
      </div>
    </Card>
  );
}

function SkillCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 h-6 w-full animate-pulse rounded bg-slate-100" />
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-6 h-24 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100" />
    </Card>
  );
}
