"use client";

import { useState } from "react";
import {
  parsersApi,
  UnsupportedParserActionError,
  type ParserDefinition,
} from "@/api/parsers";

export type ParserActionToast = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

export function useParserActions({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const [toast, setToast] = useState<ParserActionToast>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedParser, setSelectedParser] = useState<ParserDefinition | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function clearToast() {
    setToast(null);
  }

  async function viewParser(parser: ParserDefinition) {
    setBusyAction(`view-${parser.parserId}`);
    setToast(null);
    try {
      setSelectedParser(await parsersApi.getParser(parser.parserId));
      setDetailOpen(true);
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "Unable to load parser details." });
    } finally {
      setBusyAction(null);
    }
  }

  async function runBenchmark() {
    await runAction(
      "benchmark-all",
      async () => {
        await parsersApi.benchmarkAll();
        setToast({ tone: "success", message: "Parser benchmark started." });
        await onRefresh();
      },
      "Parser benchmarking is not available yet.",
    );
  }

  async function benchmarkParser(parser: ParserDefinition) {
    await runAction(
      `benchmark-${parser.parserId}`,
      async () => {
        await parsersApi.benchmarkParser(parser.parserId);
        setToast({ tone: "success", message: `Benchmark started for ${parser.name}.` });
        await onRefresh();
      },
      "Parser benchmarking is not available yet.",
    );
  }

  function registerParser() {
    setToast({ tone: "warning", message: "Parser registration is not available yet." });
  }

  function configureParser() {
    setToast({ tone: "warning", message: "Parser configuration is not available yet." });
  }

  async function runAction(key: string, action: () => Promise<void>, unsupportedMessage: string) {
    setBusyAction(key);
    setToast(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof UnsupportedParserActionError) {
        setToast({ tone: "warning", message: unsupportedMessage });
      } else {
        setToast({ tone: "error", message: err instanceof Error ? err.message : "Parser action failed." });
      }
    } finally {
      setBusyAction(null);
    }
  }

  return {
    toast,
    busyAction,
    selectedParser,
    detailOpen,
    clearToast,
    viewParser,
    runBenchmark,
    benchmarkParser,
    registerParser,
    configureParser,
    closeDetail: () => setDetailOpen(false),
  };
}
