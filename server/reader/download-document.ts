import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRow } from '../../shared/database.js';
import { EVIDENCE_BUCKET, MAX_FILE_BYTES } from '../../shared/limits.js';
import { HttpError } from '../http.js';

export async function downloadDocument(supabase: SupabaseClient, document: DocumentRow): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).download(document.storage_path);
  if (error || !data) throw new HttpError(502, 'document_fetch_failed', 'Could not read the saved file. Please try again.');
  if (data.size === 0 || data.size > MAX_FILE_BYTES) throw new HttpError(422, 'document_size_invalid', 'This saved file is empty or too large to read.');
  return new Uint8Array(await data.arrayBuffer());
}
