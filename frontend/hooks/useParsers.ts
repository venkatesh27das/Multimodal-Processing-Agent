"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterParsers,
  parserKpis,
  parsersApi,
  type ParserActivity,
  type ParserDefinition,
  type ParserFilters,
  type ParserKpis,
  type RoutingPolicySummary,
} from "@/api/parsers";

const defaultFilters: ParserFilters = {
  search: "",
  modality: "all",
  provider: "all",
  status: "all",
  environment: "all",
  degradedOnly: false,
};

export function useParsers() {
  const [parsers, setParsers] = useState<ParserDefinition[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicySummary>({ items: [] });
  const [activity, setActivity] = useState<ParserActivity[]>([]);
  const [filters, setFilters] = useState<ParserFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadParsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextParsers = await parsersApi.listParsers(filters);
      const [nextRoutingPolicy, nextActivity] = await Promise.all([
        parsersApi.getRoutingPolicySummary(nextParsers),
        parsersApi.getParserActivity(),
      ]);
      setParsers(nextParsers);
      setRoutingPolicy(nextRoutingPolicy);
      setActivity(nextActivity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load parser registry.");
      setParsers([]);
      setRoutingPolicy({ items: [] });
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadParsers();
  }, [loadParsers]);

  const filteredParsers = useMemo(() => filterParsers(parsers, filters), [filters, parsers]);
  const kpis: ParserKpis = useMemo(() => parserKpis(parsers), [parsers]);

  const modalityOptions = useMemo(
    () => Array.from(new Set(parsers.flatMap((parser) => [...parser.supportedModalities, ...parser.supportedFileTypes]).map((item) => item.toLowerCase()))).sort(),
    [parsers],
  );
  const providerOptions = useMemo(
    () => Array.from(new Set(parsers.map((parser) => parser.provider))).sort(),
    [parsers],
  );
  const environmentOptions = useMemo(
    () => Array.from(new Set(parsers.map((parser) => parser.deploymentMode))).sort(),
    [parsers],
  );

  function updateFilters(patch: Partial<ParserFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return {
    parsers,
    filteredParsers,
    kpis,
    routingPolicy,
    activity,
    filters,
    modalityOptions,
    providerOptions,
    environmentOptions,
    loading,
    error,
    loadParsers,
    updateFilters,
  };
}
