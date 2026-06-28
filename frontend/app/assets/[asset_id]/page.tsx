"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, formatMs, pct, shortId, type ParsedAsset } from "@/lib/api";
import { JsonBlock } from "@/components/ui/json-block";
import { Panel, PanelHeader } from "@/components/ui/panel";

export default function AssetDetailPage({ params }: { params: { asset_id: string } }) {
  const [asset, setAsset] = useState<ParsedAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAsset(params.asset_id)
      .then(setAsset)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load asset."));
  }, [params.asset_id]);

  if (error) return <Panel><div className="p-4 text-sm text-red-700">{error}</div></Panel>;
  if (!asset) return <Panel><div className="p-4 text-sm text-muted">Loading asset...</div></Panel>;

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong" href="/assets">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to assets
      </Link>

      <Panel>
        <PanelHeader title={`Asset ${shortId(asset.asset_id)}`} />
        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="File" value={shortId(asset.file_id)} />
          <Field label="Run" value={shortId(asset.job_id)} />
          <Field label="Parser used" value={asset.parser_used} />
          <Field label="Skill used" value={asset.skill_used ?? "--"} />
          <Field label="Fallback used" value={asset.fallback_used ? "Yes" : "No"} />
          <Field label="Quality" value={pct(Number(asset.quality_report?.extraction_confidence ?? 0))} />
          <Field label="Latency" value={formatMs(asset.latency_ms)} />
          <Field label="Cost estimate" value={formatCost(asset.cost_estimate)} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader title="Parsed Text" />
          <div className="max-h-[460px] overflow-auto whitespace-pre-wrap p-4 text-sm leading-6 text-ink">
            {asset.parsed_text || "No parsed text was produced."}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel><div className="p-4"><JsonBlock value={asset.chunks} title="Chunks" /></div></Panel>
          <Panel><div className="p-4"><JsonBlock value={asset.tables} title="Tables" /></div></Panel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel><div className="p-4"><JsonBlock value={asset.entities} title="Entities" /></div></Panel>
        <Panel><div className="p-4"><JsonBlock value={asset.relationships} title="Relationships" /></div></Panel>
        <Panel><div className="p-4"><JsonBlock value={asset.evidence_spans} title="Evidence spans" /></div></Panel>
        <Panel><div className="p-4"><JsonBlock value={asset.lineage} title="Lineage" /></div></Panel>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-1 truncate font-medium text-ink" title={value}>{value}</div>
    </div>
  );
}

function formatCost(cost: Record<string, unknown>) {
  const value = cost.estimated_cost_usd ?? cost.estimated_cost;
  if (typeof value !== "number") return "--";
  return `$${value.toFixed(4)}`;
}
