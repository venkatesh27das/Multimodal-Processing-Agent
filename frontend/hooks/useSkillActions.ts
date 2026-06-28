"use client";

import { useRef, useState } from "react";
import {
  skillsApi,
  UnsupportedSkillActionError,
  type SkillDetail,
  type SkillMutationPayload,
  type SkillWorkflowAttachmentPayload,
} from "@/api/skills";

export type SkillActionToast = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

export type SkillActionModal =
  | { type: "create" }
  | { type: "edit"; skill: SkillDetail }
  | { type: "attach"; skill: SkillDetail }
  | null;

export function useSkillActions({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const [toast, setToast] = useState<SkillActionToast>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [modal, setModal] = useState<SkillActionModal>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function clearToast() {
    setToast(null);
  }

  function importSkillPack() {
    fileInputRef.current?.click();
  }

  async function handleSkillPackFile(file: File | null) {
    if (!file) return;
    await runAction(
      "import",
      async () => {
        await skillsApi.importSkillPack(file);
        setToast({ tone: "success", message: "Skill pack imported." });
        await onRefresh();
      },
      "Skill import is not available yet.",
    );
  }

  function createSkill() {
    setModal({ type: "create" });
  }

  async function submitCreateSkill(payload: SkillMutationPayload) {
    await runAction(
      "create",
      async () => {
        await skillsApi.createSkill(payload);
        setToast({ tone: "success", message: "Skill created." });
        setModal(null);
        await onRefresh();
      },
      "Skill creation is not available yet.",
    );
  }

  function editSkill(skill: SkillDetail | null) {
    if (!skill) return;
    setModal({ type: "edit", skill });
  }

  async function submitEditSkill(skill: SkillDetail, payload: Partial<SkillMutationPayload>) {
    await runAction(
      `edit-${skill.skillId}`,
      async () => {
        await skillsApi.updateSkill(skill.skillId, payload);
        setToast({ tone: "success", message: `${skill.name} updated.` });
        setModal(null);
        await onRefresh();
      },
      "Skill editing is not available yet.",
    );
  }

  async function duplicateSkill(skill: SkillDetail | null) {
    if (!skill) return;
    await runAction(
      `duplicate-${skill.skillId}`,
      async () => {
        await skillsApi.duplicateSkill(skill.skillId);
        setToast({ tone: "success", message: `${skill.name} duplicated.` });
        await onRefresh();
      },
      "Skill duplication is not available yet.",
    );
  }

  function attachToWorkflow(skill: SkillDetail | null) {
    if (!skill) return;
    setModal({ type: "attach", skill });
  }

  async function submitWorkflowAttachment(skill: SkillDetail, payload: SkillWorkflowAttachmentPayload) {
    await runAction(
      `attach-${skill.skillId}`,
      async () => {
        await skillsApi.attachSkillToWorkflow(skill.skillId, payload);
        setToast({ tone: "success", message: `${skill.name} attached to workflow.` });
        setModal(null);
        await onRefresh();
      },
      "Workflow attachment is not available yet.",
    );
  }

  function closeModal() {
    if (!busyAction) setModal(null);
  }

  async function runAction(key: string, action: () => Promise<void>, unsupportedMessage: string) {
    setBusyAction(key);
    setToast(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof UnsupportedSkillActionError) {
        setToast({ tone: "warning", message: unsupportedMessage });
      } else {
        setToast({ tone: "error", message: err instanceof Error ? err.message : "Skill action failed." });
      }
    } finally {
      setBusyAction(null);
    }
  }

  return {
    toast,
    busyAction,
    modal,
    fileInputRef,
    clearToast,
    closeModal,
    importSkillPack,
    handleSkillPackFile,
    createSkill,
    submitCreateSkill,
    editSkill,
    submitEditSkill,
    duplicateSkill,
    attachToWorkflow,
    submitWorkflowAttachment,
  };
}
