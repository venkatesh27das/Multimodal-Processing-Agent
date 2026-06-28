const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type FileUploadStatus = "uploading" | "uploaded" | "failed";

export type FileProfile = {
  id: string;
  file_id: string;
  file_type: string;
  modalities: string[];
  has_text_layer: boolean | null;
  is_scanned: boolean | null;
  page_count: number | null;
  table_likelihood: number | null;
  image_likelihood: number | null;
  language: string | null;
  layout_complexity: string | null;
  estimated_cost_class: string | null;
  recommended_parsing_strategy: string | null;
  created_at: string;
};

export type FileRecord = {
  id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  source: string;
  storage_path: string;
  status: string;
  created_by: string;
  uploaded_at: string;
};

export type FileUploadResponse = {
  file_id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  source?: string;
  storage_path?: string;
  status: string;
  uploaded_at: string;
};

export type UploadedFile = {
  localId: string;
  fileId: string | null;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  sizeLabel: string;
  status: FileUploadStatus;
  error: string | null;
  profile: FileProfile | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const filesApi = {
  async uploadFile(file: File): Promise<UploadedFile> {
    if (USE_MOCKS) return mockUploadedFile(file);

    const body = new FormData();
    body.append("file", file);
    const uploaded = await request<FileUploadResponse>("/files/upload", {
      method: "POST",
      body,
    });
    const profile = await filesApi.getFileProfile(uploaded.file_id).catch(() => null);
    return {
      localId: crypto.randomUUID(),
      fileId: uploaded.file_id,
      name: uploaded.original_filename,
      type: uploaded.file_type,
      mimeType: uploaded.mime_type,
      size: uploaded.size_bytes,
      sizeLabel: formatBytes(uploaded.size_bytes),
      status: "uploaded",
      error: null,
      profile,
    };
  },

  getFile(fileId: string) {
    if (USE_MOCKS) return Promise.resolve(mockFileRecord(fileId));
    return request<FileRecord>(`/files/${fileId}`);
  },

  getFileProfile(fileId: string) {
    if (USE_MOCKS) return Promise.resolve(mockProfile(fileId, "pdf"));
    return request<FileProfile>(`/files/${fileId}/profile`);
  },
};

export function createPendingUpload(file: File): UploadedFile {
  return {
    localId: crypto.randomUUID(),
    fileId: null,
    name: file.name,
    type: inferType(file.name, file.type),
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sizeLabel: formatBytes(file.size),
    status: "uploading",
    error: null,
    profile: null,
  };
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function inferType(name: string, mimeType = ""): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext) return ext;
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("image")) return "image";
  if (mimeType.includes("audio")) return "audio";
  if (mimeType.includes("video")) return "video";
  if (mimeType.includes("html")) return "html";
  return "file";
}

function mockUploadedFile(file: File): Promise<UploadedFile> {
  const fileId = `mock-file-${crypto.randomUUID()}`;
  const type = inferType(file.name, file.type);
  return Promise.resolve({
    localId: crypto.randomUUID(),
    fileId,
    name: file.name,
    type,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sizeLabel: formatBytes(file.size),
    status: "uploaded",
    error: null,
    profile: mockProfile(fileId, type),
  });
}

function mockFileRecord(fileId: string): FileRecord {
  return {
    id: fileId,
    original_filename: "Mock document.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    size_bytes: 2_400_000,
    checksum_sha256: "mock-checksum",
    source: "ui",
    storage_path: "mock",
    status: "registered",
    created_by: "local-user",
    uploaded_at: new Date().toISOString(),
  };
}

function mockProfile(fileId: string, fileType: string): FileProfile {
  const modality = fileType.includes("image")
    ? "image"
    : fileType.includes("audio")
      ? "audio"
      : fileType.includes("video")
        ? "video"
        : "text";
  return {
    id: `mock-profile-${fileId}`,
    file_id: fileId,
    file_type: fileType,
    modalities: [modality],
    has_text_layer: fileType === "pdf" ? true : null,
    is_scanned: false,
    page_count: fileType === "pdf" ? 3 : null,
    table_likelihood: 0.35,
    image_likelihood: modality === "image" ? 0.9 : 0.2,
    language: "English",
    layout_complexity: "medium",
    estimated_cost_class: "standard",
    recommended_parsing_strategy: "Use local parser first with OCR fallback when required.",
    created_at: new Date().toISOString(),
  };
}
