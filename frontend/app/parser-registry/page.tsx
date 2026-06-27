"use client";

import { useEffect, useState } from "react";
import { api, pct, type ParserDefinition } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ParserRegistryPage() {
  const [parsers, setParsers] = useState<ParserDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listParsers().then(setParsers).catch((err) => setError(err instanceof Error ? err.message : "Unable to load parsers."));
  }, []);

  return (
    <Panel>
      <PanelHeader title="Parser Registry" />
      {error ? <div className="border-b border-border bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Parser</th>
              <th className="px-4 py-3 font-semibold">Supported modalities</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Expected quality</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parsers.map((parser) => (
              <tr key={parser.parser_id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">{parser.name}</div>
                  <div className="text-xs text-muted">{parser.parser_id}</div>
                </td>
                <td className="px-4 py-3">
                  <TagList values={[...parser.supported_file_types, ...parser.supported_modalities]} />
                </td>
                <td className="px-4 py-3 text-muted capitalize">{parser.cost_level}</td>
                <td className="px-4 py-3 text-muted capitalize">{parser.latency_level}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                      <div className="h-full bg-accent" style={{ width: pct(parser.expected_quality) }} />
                    </div>
                    <span className="text-muted">{pct(parser.expected_quality)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{parser.version}</td>
                <td className="px-4 py-3"><StatusBadge value={parser.enabled ? "complete" : "queued"} /></td>
              </tr>
            ))}
            {!parsers.length && !error ? <tr><td className="px-4 py-8 text-sm text-muted" colSpan={7}>Loading parser registry...</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TagList({ values }: { values: string[] }) {
  const uniqueValues = Array.from(new Set(values));
  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {uniqueValues.slice(0, 6).map((value) => (
        <span key={value} className="rounded-full border border-border bg-white px-2 py-0.5 text-xs text-muted">
          {value}
        </span>
      ))}
    </div>
  );
}
