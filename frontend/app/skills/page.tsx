"use client";

import { Box, Copy, FileText, Link2, Plus, ShieldCheck, Star, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  Card,
  MetricCard,
  PageHeader,
  SearchFilterBar,
  SelectField,
  StatusPill,
  Tag,
} from "@/components/design-system";
import { getSkills, type SkillView } from "@/lib/enterprise-data";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getSkills().then((items) => {
      setSkills(items);
      setSelectedId(items[1]?.id ?? items[0]?.id ?? null);
    });
  }, []);

  const selected = useMemo(
    () => skills.find((skill) => skill.id === selectedId) ?? skills[0],
    [selectedId, skills],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Skills"
        description="Manage reusable extraction, validation, and post-processing skills for parsing workflows."
        action={
          <>
            <ActionButton variant="secondary" icon={Upload}>Import Skill Pack</ActionButton>
            <ActionButton icon={Plus}>Create Skill</ActionButton>
          </>
        }
      />

      <SearchFilterBar placeholder="Search skills, schemas, workflows...">
        <div className="flex h-11 overflow-hidden rounded-lg border border-border bg-white shadow-panel">
          {["All Skills", "Extraction", "Validation", "Post-processing", "Publishing"].map((tab, index) => (
            <button key={tab} className={`px-5 text-sm font-bold ${index === 0 ? "border-b-2 border-accent text-accent" : "text-muted"}`} type="button">
              {tab}
            </button>
          ))}
        </div>
        <SelectField value="All Statuses" options={["All Statuses"]} />
        <SelectField value="All Parsers" options={["All Parsers"]} />
      </SearchFilterBar>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <MetricCard icon={FileText} label="Total Skills" value={String(skills.length || 24)} delta="↑ 14% vs last 7 days" tone="info" data={[7, 8, 12, 9, 13, 11, 14]} />
        <MetricCard icon={ShieldCheck} label="Active in Workflows" value="16" delta="↑ 18% vs last 7 days" tone="success" data={[5, 6, 8, 7, 10, 9, 12]} />
        <MetricCard icon={Box} label="Reusable Packs" value="8" delta="↑ 9% vs last 7 days" tone="purple" data={[3, 5, 4, 7, 6, 9, 10]} />
        <MetricCard icon={Star} label="Avg Success" value="93.4%" delta="↑ 2.1% vs last 7 days" tone="warning" data={[6, 7, 8, 7, 9, 10, 12]} />
        <MetricCard icon={Star} label="Most Used" value="Contract" tone="info" />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((skill) => (
            <button
              key={skill.id}
              className={`rounded-xl border bg-white p-4 text-left shadow-panel transition hover:bg-surface ${selected?.id === skill.id ? "border-accent bg-accent-soft/30" : "border-border"}`}
              onClick={() => setSelectedId(skill.id)}
              type="button"
            >
              <div className="flex gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-ink">{skill.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{skill.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => <Tag key={tag}>{tag.toUpperCase()}</Tag>)}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="font-bold text-muted">{skill.version}</span>
                <StatusPill status="active">Active</StatusPill>
                <span className="text-muted">{skill.runs}</span>
                <span className="text-muted">{skill.parsers} parsers</span>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.02em] text-ink">{selected.name}</h3>
                  <p className="mt-1 text-sm text-muted">{selected.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.tags.map((tag) => <Tag key={tag}>{tag.toUpperCase()}</Tag>)}
                    <Tag tone="accent">Schema v2.1</Tag>
                  </div>
                </div>
              </div>
              <StatusPill status="active">Active</StatusPill>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4 border-b border-border pb-5">
              <DetailMetric label="Weekly Runs" value="2,846" />
              <DetailMetric label="Last Updated" value="May 14, 2025" />
              <DetailMetric label="Success Rate" value="94.2%" positive />
              <DetailMetric label="Avg Duration" value="2m 18s" positive />
            </div>

            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {[
                ["Overview", "Extracts structured fields, entities, obligations, and key terms..."],
                ["Inputs", "Document file (PDF, DOCX, HTML, Image)"],
                ["Outputs", "Fields, tables, metadata, chunks, entities (JSON)"],
                ["Linked Parsers", "PDF Native Text, Tesseract OCR, LM Studio VLM"],
                ["Example Fields", "clause_text, party_name, effective_date, total_amount..."],
                ["Workflow Usage", "Used in 7 workflows"],
                ["Recent Versions", `${selected.version} (Current)`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-bold text-ink">{label}</span>
                  <span className="truncate text-muted">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <ActionButton variant="secondary" icon={FileText}>Edit Skill</ActionButton>
              <ActionButton variant="secondary" icon={Copy}>Duplicate</ActionButton>
              <ActionButton icon={Link2}>Attach to Workflow</ActionButton>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
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
