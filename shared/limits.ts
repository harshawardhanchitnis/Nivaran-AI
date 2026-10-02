// Limits enforced in the browser, on the server and (where possible) in the database.
// The storage bucket and the documents table repeat the file limits in SQL: keep them in step
// with supabase/migrations.

export const EVIDENCE_BUCKET = 'evidence';

/** Files a user may add when opening a case. The database allows a few more for later replies. */
export const MAX_FILES_PER_CASE = 6;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Hard ceiling on model-chosen steps in one investigation run. */
export const MAX_AGENT_STEPS = 10;

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/** Storage path convention. The first segment must be the owner's user id: storage policies rely on it. */
export function evidencePath(userId: string, caseId: string, documentId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
  return `${userId}/${caseId}/${documentId}-${safeName}`;
}
