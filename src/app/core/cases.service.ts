import { Injectable, inject } from '@angular/core';
import type { CaseRow, DocumentRow, PlanRow } from '@shared/database';
import { EVIDENCE_BUCKET, evidencePath } from '@shared/limits';
import { checkFiles } from '../features/case-new/file-rules';
import type { CaseSummaryView } from '../shared/ui/models';
import { caseSummary } from './case-summary';
import { SupabaseService } from './supabase.service';

export class CaseUploadError extends Error {
  constructor(message: string, readonly caseId: string | null = null) {
    super(message);
    this.name = 'CaseUploadError';
  }
}

export interface CreatedCase { case: CaseRow; documents: DocumentRow[] }

@Injectable({ providedIn: 'root' })
export class CasesService {
  private readonly supabase = inject(SupabaseService);

  async createWithDocuments(files: readonly File[], consent: boolean): Promise<CreatedCase> {
    if (!consent) throw new CaseUploadError('Please give consent before uploading.');
    if (files.length === 0) throw new CaseUploadError('Add at least one document to continue.');
    const checked = checkFiles(files, []);
    if (checked.problems.length > 0) throw new CaseUploadError(checked.problems.join(' '));
    const session = await this.supabase.ensureSignedIn();
    const client = this.supabase.client;
    const { data: created, error: createError } = await client.from('cases')
      .insert({ title: 'Refund not received' }).select().single<CaseRow>();
    if (createError || !created) {
      throw new CaseUploadError(`Could not create your case. ${createError?.message ?? 'Please try again.'}`);
    }
    const storage = client.storage.from(EVIDENCE_BUCKET);
    const paths: string[] = [];
    try {
      const documents = [];
      for (const [index, file] of files.entries()) {
        const id = crypto.randomUUID();
        const path = evidencePath(session.user.id, created.id, id, file.name);
        paths.push(path);
        const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Could not upload a document.');
        documents.push({
          id, case_id: created.id, label: `E${String(index + 1).padStart(2, '0')}`,
          file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size,
        });
      }
      const { data, error } = await client.from('documents').insert(documents).select().returns<DocumentRow[]>();
      if (error || !data) throw new Error('Could not save your document records.');
      return { case: created, documents: data };
    } catch {
      // Roll back this new upload only; never touch a case that already existed.
      try {
        if (paths.length > 0) {
          const { error } = await storage.remove(paths);
          if (error) throw new Error('Could not remove the incomplete upload.');
        }
        const { error } = await client.from('cases').delete().eq('id', created.id);
        if (error) throw new Error('Could not remove the empty case.');
      } catch {
        throw new CaseUploadError(
          'The upload could not finish. A partial case is saved in My cases. Check it before trying again.', created.id,
        );
      }
      throw new CaseUploadError('The upload could not finish. Your file choices are still here. Please try again.');
    }
  }

  async list(): Promise<CaseSummaryView[]> {
    await this.supabase.ensureSignedIn();
    const client = this.supabase.client;
    const { data: cases, error } = await client.from('cases').select().order('updated_at', { ascending: false }).returns<CaseRow[]>();
    if (error || !cases) throw new Error('Could not load your cases. Please try again.');
    if (cases.length === 0) return [];
    const ids = cases.map((row) => row.id);
    const [documents, plans] = await Promise.all([
      client.from('documents').select('case_id').in('case_id', ids).returns<Pick<DocumentRow, 'case_id'>[]>(),
      client.from('plans').select('case_id, dates, created_at').in('case_id', ids)
        .order('created_at', { ascending: false }).returns<Pick<PlanRow, 'case_id' | 'dates' | 'created_at'>[]>(),
    ]);
    if (documents.error || plans.error) throw new Error('Could not load the case details. Please try again.');
    const counts = new Map<string, number>();
    for (const document of documents.data ?? []) counts.set(document.case_id, (counts.get(document.case_id) ?? 0) + 1);
    const dates = new Map<string, Record<string, string>>();
    for (const plan of plans.data ?? []) if (!dates.has(plan.case_id)) dates.set(plan.case_id, plan.dates);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    return cases.map((row) => caseSummary(row, counts.get(row.id) ?? 0, dates.get(row.id) ?? {}, today));
  }
}
