"use client";

import { useCallback, useMemo, useState } from "react";
import { createPendingUpload, filesApi, type UploadedFile } from "@/api/files";

export type FileUploadToast = {
  tone: "success" | "warning" | "danger";
  message: string;
};

export function useFileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [toast, setToast] = useState<FileUploadToast | null>(null);

  const uploadedFiles = useMemo(
    () => files.filter((file) => file.status === "uploaded" && file.fileId),
    [files],
  );
  const uploading = files.some((file) => file.status === "uploading");

  const addFiles = useCallback(async (incoming: File[] | FileList) => {
    const selected = Array.from(incoming);
    if (!selected.length) return;

    const pending = selected.map(createPendingUpload);
    setFiles((current) => [...current, ...pending]);

    await Promise.all(
      selected.map(async (file, index) => {
        const localId = pending[index].localId;
        try {
          const uploaded = await filesApi.uploadFile(file);
          setFiles((current) =>
            current.map((item) => (item.localId === localId ? { ...uploaded, localId } : item)),
          );
          setToast({ tone: "success", message: `${file.name} uploaded and profiled.` });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";
          setFiles((current) =>
            current.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    status: "failed",
                    error: message,
                  }
                : item,
            ),
          );
          setToast({ tone: "danger", message: `${file.name} could not be uploaded: ${message}` });
        }
      }),
    );
  }, []);

  const removeFile = useCallback((localId: string) => {
    setFiles((current) => current.filter((file) => file.localId !== localId));
  }, []);

  const resetFiles = useCallback(() => {
    setFiles([]);
    setToast(null);
  }, []);

  return {
    files,
    uploadedFiles,
    uploading,
    toast,
    addFiles,
    removeFile,
    resetFiles,
    clearToast: () => setToast(null),
    setToast,
  };
}
