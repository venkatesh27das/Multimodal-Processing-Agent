"use client";

import { AlertTriangle, CheckCircle2, FileText, Gauge, Plus, Timer, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ActionButton,
  Card,
  DataTable,
  MetricCard,
  MiniBar,
  PageHeader,
  SearchFilterBar,
  SelectField,
  StatusPill,
  Tag,
  Toggle,
} from "@/components/design-system";
import { getParsers, type ParserView } from "@/lib/enterprise-data";

export default function ParsersPage() {
  const [parsers, setParsers] = useState<ParserView[]>([]);

  useEffect(() => {
    getParsers().then(setParsers);
  }, []);

  const healthy = parsers.filter((parser) => parser.status === "healthy").length;
  const degraded = parsers.filter((parser) => parser.status === "degraded").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parsers"
        description="Manage parser registry, health, benchmarking, and routing readiness across the workspace."
        action={
          <>
            <ActionButton variant="secondary" icon={Gauge}>Run Benchmark</ActionButton>
            <ActionButton icon={Plus}>Register Parser</ActionButton>
          </>
        }
      />

      <Card className="p-4">
        <SearchFilterBar placeholder="Search parsers, providers, modalities...">
          <SelectField value="All Modalities" options={["All Modalities"]} />
          <SelectField value="All Providers" options={["All Providers"]} />
          <SelectField value="All Statuses" options={["All Statuses"]} />
          <SelectField value="All Environments" options={["All Environments"]} />
          <div className="flex h-11 items-center gap-3 px-2 text-sm font-semibold text-ink">
            Show degraded only
            <Toggle />
          </div>
        </SearchFilterBar>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <MetricCard icon={FileText} label="Total Parsers" value={String(parsers.length || 18)} delta="↑ 12% vs last 7 days" tone="info" data={[5, 7, 8, 10, 9, 13, 12]} />
        <MetricCard icon={CheckCircle2} label="Active" value={String(healthy || 14)} delta="↑ 8% vs last 7 days" tone="success" data={[7, 8, 7, 9, 12, 10, 13]} />
        <MetricCard icon={AlertTriangle} label="Degraded" value={String(degraded || 2)} delta="↓ 20% vs last 7 days" tone="warning" data={[8, 6, 7, 5, 4, 3, 2]} />
        <MetricCard icon={Workflow} label="Avg Success" value="91.8%" delta="↑ 2.6% vs last 7 days" tone="info" data={[6, 8, 7, 10, 9, 11, 10]} />
        <MetricCard icon={Timer} label="Avg Latency" value="3.2s" delta="↓ 0.3s vs last 7 days" tone="purple" data={[9, 8, 10, 7, 9, 10, 11]} />
      </div>

      <Card>
        <DataTable columns={["Parser", "Supported Modalities", "Provider / Type", "Version", "Usage %", "Success Rate", "Avg Quality", "Avg Latency", "Cost Tier", "Status", "Last Updated", "Actions"]} minWidth="1180px">
          {parsers.map((parser) => (
            <tr key={parser.id} className="hover:bg-surface">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted" />
                  <span className="font-bold text-ink">{parser.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {parser.modalities.map((item) => <Tag key={item}>{item.toUpperCase()}</Tag>)}
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-ink">{parser.provider}</p>
                <p className="text-xs capitalize text-muted">{parser.providerType}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-ink">{parser.version}</td>
              <td className="px-4 py-3"><span className="mr-2 text-xs font-semibold text-ink">{parser.usage}%</span><MiniBar value={parser.usage * 4} /></td>
              <td className="px-4 py-3 font-bold text-success">{parser.successRate}</td>
              <td className="px-4 py-3 font-semibold text-ink">{parser.avgQuality}</td>
              <td className="px-4 py-3 text-muted">{parser.avgLatency}</td>
              <td className="px-4 py-3 font-semibold text-ink">{parser.costTier}</td>
              <td className="px-4 py-3"><StatusPill status={parser.status}>{parser.status}</StatusPill></td>
              <td className="px-4 py-3 text-muted">{parser.lastUpdated}</td>
              <td className="px-4 py-3">
                <div className="flex gap-4 text-sm font-bold text-accent">
                  <button type="button">View</button>
                  <button type="button">Configure</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[1fr_1.1fr]">
        <Card className="p-5">
          <PageHeader title="Routing Policy Summary" />
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Fallback Behavior", "Up to 2 fallback parsers enabled"],
              ["Parser Priority", "Priority routing with health scoring"],
              ["OCR Routing", "Auto OCR for image/PDF confidence < 70%"],
              ["Review Thresholds", "Route to review if quality < 80%"],
            ].map(([title, body]) => (
              <div key={title} className="border-r border-border last:border-r-0">
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <PageHeader title="Recent Parser Changes" action={<span className="text-sm font-bold text-accent">View all activity →</span>} />
          <div className="space-y-3">
            {["PDF Native Text Parser updated to v0.2.0", "LM Studio VLM benchmark completed", "Routing rule updated: Image/PDF → OCR", "Research Paper Parser marked as healthy"].map((item, index) => (
              <div key={item} className="grid grid-cols-[24px_1fr_120px] items-center gap-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-success" : index === 1 ? "bg-info" : index === 2 ? "bg-purple" : "bg-warning"}`} />
                <span className="font-semibold text-ink">{item}</span>
                <span className="text-xs text-muted">Today</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
