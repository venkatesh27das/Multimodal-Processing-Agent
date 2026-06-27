"use client";

import { useEffect, useState } from "react";
import { api, type Skill } from "@/lib/api";
import { JsonBlock } from "@/components/ui/json-block";
import { Panel, PanelHeader } from "@/components/ui/panel";

export default function SkillsRegistryPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSkills().then(setSkills).catch((err) => setError(err instanceof Error ? err.message : "Unable to load skills."));
  }, []);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="Skills Registry" />
        {error ? <div className="border-b border-border bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <div className="divide-y divide-border">
          {skills.map((skill) => (
            <div key={skill.skill_id} className="grid gap-4 p-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div>
                <div className="font-semibold text-ink">{skill.name}</div>
                <div className="mt-1 text-xs text-muted">{skill.skill_id}</div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{skill.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {skill.supported_document_types.map((type) => (
                    <span key={type} className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
              <JsonBlock value={skill.schema} title="Schema preview" />
            </div>
          ))}
          {!skills.length && !error ? <div className="p-4 text-sm text-muted">Loading skills registry...</div> : null}
        </div>
      </Panel>
    </div>
  );
}
