"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterSkills,
  skillsApi,
  type SkillDefinition,
  type SkillDetail,
  type SkillFilters,
  type SkillKpis,
} from "@/api/skills";

const defaultFilters: SkillFilters = {
  search: "",
  category: "all",
  status: "all",
  attachedParser: "all",
};

export function useSkills() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [kpis, setKpis] = useState<SkillKpis>({
    totalSkills: 0,
    activeInWorkflows: 0,
    reusablePacks: 0,
    avgSuccess: null,
    mostUsed: "--",
  });
  const [filters, setFilters] = useState<SkillFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSkills = await skillsApi.listSkills(filters);
      const nextKpis = await skillsApi.getSkillMetrics(nextSkills);
      setSkills(nextSkills);
      setKpis(nextKpis);
      setSelectedId((current) => current && nextSkills.some((skill) => skill.skillId === current) ? current : nextSkills[0]?.skillId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load skills.");
      setSkills([]);
      setSelectedId(null);
      setSelectedSkill(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSkill(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    skillsApi.getSkill(selectedId)
      .then((detail) => {
        if (active) setSelectedSkill(detail);
      })
      .catch((err) => {
        if (active) {
          setDetailError(err instanceof Error ? err.message : "Unable to load skill details.");
          const fallback = skills.find((skill) => skill.skillId === selectedId);
          if (fallback) setSelectedSkill(null);
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId, skills]);

  const filteredSkills = useMemo(() => filterSkills(skills, filters), [filters, skills]);
  const parserOptions = useMemo(
    () => Array.from(new Set(skills.flatMap((skill) => skill.linkedParsers))).sort(),
    [skills],
  );

  function updateFilters(patch: Partial<SkillFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return {
    skills,
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
  };
}
