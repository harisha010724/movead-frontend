/** Same cap the API and multer enforce. */
export const CREATIVE_MAX_BYTES = 25 * 1024 * 1024;

export const CREATIVE_ACCEPT = 'image/png,application/pdf,.png,.pdf';

export type CreativeKind = 'png' | 'pdf';

const BY_TYPE: Record<string, CreativeKind> = {
  'image/png': 'png',
  'application/pdf': 'pdf',
};

/**
 * Prefer MIME type; fall back to the extension because some browsers leave
 * `File.type` empty when the file came from a picker on Windows.
 */
export function creativeKindFromName(name: string): CreativeKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
}

export function creativeKind(file: File): CreativeKind | null {
  const fromType = BY_TYPE[file.type];
  if (fromType) return fromType;

  return creativeKindFromName(file.name);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

export type AcceptCreative =
  | { ok: true; file: File; kind: CreativeKind }
  | { ok: false; error: string };

export function acceptCreative(file: File): AcceptCreative {
  const kind = creativeKind(file);
  if (!kind) {
    return { ok: false, error: 'Choose a PDF or PNG.' };
  }
  if (file.size > CREATIVE_MAX_BYTES) {
    return { ok: false, error: 'File must be 25 MB or smaller.' };
  }
  return { ok: true, file, kind };
}
