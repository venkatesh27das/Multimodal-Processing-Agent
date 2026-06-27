"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { formatMs, getJobSummaries, pct, shortId, type ParsedAsset } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/panel";

export default function AssetsPage() {
  const [assets, setAssets] = useState<ParsedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJobSummaries()
      .then((summaries) => setAssets(summaries.flatMap((summary) => summary.assets)))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load assets."));
  }, []);

  return (
    <Panel>
      <PanelHeader title="Asset Viewer" />
      {error ? <div className="border-b border-border bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Asset</th>
              <th className="px-4 py-3 font-semibold">File</th>
              <th className="px-4 py-3 font-semibold">Parser</th>
              <th className="px-4 py-3 font-semibold">Skill</th>
              <th className="px-4 py-3 font-semibold">Quality</th>
              <th className="px-4 py-3 font-semibold">Chunks</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => (
              <tr key={asset.asset_id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <Link className="inline-flex items-center gap-2 font-semibold text-ink hover:text-accent-strong" href={`/assets/${asset.asset_id}`}>
                    <Boxes className="h-4 w-4" aria-hidden="true" />
                    {shortId(asset.asset_id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{shortId(asset.file_id)}</td>
                <td className="px-4 py-3 text-muted">{asset.parser_used}</td>
                <td className="px-4 py-3 text-muted">{asset.skill_used ?? "--"}</td>
                <td className="px-4 py-3 text-muted">{pct(Number(asset.quality_report?.extraction_confidence ?? 0))}</td>
                <td className="px-4 py-3 text-muted">{asset.chunks.length}</td>
                <td className="px-4 py-3 text-muted">{formatMs(asset.latency_ms)}</td>
              </tr>
            ))}
            {!assets.length && !error ? <tr><td className="px-4 py-8 text-sm text-muted" colSpan={7}>No parsed assets are available yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
