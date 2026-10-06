import { Injectable, inject } from '@angular/core';
import type { CaseRow, CaseFactRow, DocumentRow, PlanRow, ModelBudgetStatus } from '@shared/database';
import { EVIDENCE_BUCKET, evidencePath, MAX_FILES_PER_CASE } from '@shared/limits';
import { checkFiles } from '../features/case-new/file-rules';
import type { CaseSummaryView } from '../shared/ui/models';
import { caseSummary } from './case-summary';
import { SupabaseService } from './supabase.service';
import { ApiService } from './api.service';
import type { CaseDeleteResponse } from '@shared/api';

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
  private readonly api = inject(ApiService);

  async deleteCase(caseId:string):Promise<void> {
    await this.supabase.ensureSignedIn();
    const result=await this.api.post<CaseDeleteResponse>('cases/delete',{caseId,confirmed:true});
    if(!result?.deleted)throw new Error('Could not confirm deletion. Retry Delete case.');
  }

  async modelBudget(): Promise<ModelBudgetStatus> {
    await this.supabase.ensureSignedIn();
    const { data, error } = await this.supabase.client.rpc('model_budget_status');
    if (error || !data || !Number.isSafeInteger(data.remaining) || data.remaining < 0) throw new Error('Live availability could not be checked. You can still open every saved run.');
    return data as ModelBudgetStatus;
  }

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
    const [documents, plans, merchants] = await Promise.all([
      client.from('documents').select('case_id').in('case_id', ids).returns<Pick<DocumentRow, 'case_id'>[]>(),
      client.from('plans').select('case_id, dates, created_at').in('case_id', ids)
        .is('rejected_at', null)
        .order('created_at', { ascending: false }).returns<Pick<PlanRow, 'case_id' | 'dates' | 'created_at'>[]>(),
      client.from('case_facts').select('case_id, value_text').in('case_id', ids).eq('field', 'merchant_name')
        .in('status', ['document', 'user']).returns<Pick<CaseFactRow, 'case_id' | 'value_text'>[]>(),
    ]);
    if (documents.error || plans.error || merchants.error) throw new Error('Could not load the case details. Please try again.');
    const counts = new Map<string, number>();
    for (const document of documents.data ?? []) counts.set(document.case_id, (counts.get(document.case_id) ?? 0) + 1);
    const dates = new Map<string, Record<string, string>>();
    for (const plan of plans.data ?? []) if (!dates.has(plan.case_id)) dates.set(plan.case_id, plan.dates);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const names = new Map((merchants.data ?? []).map(f => [f.case_id, f.value_text]));
    return cases.map((row) => caseSummary({ ...row, merchant_name: row.merchant_name ?? names.get(row.id) ?? null }, counts.get(row.id) ?? 0, dates.get(row.id) ?? {}, today));
  }
  /** Append one reply to an existing caller-owned case. Its earlier files are never removed. */
  async addReplyDocument(caseId: string, file: File, consent: boolean): Promise<DocumentRow> {
    if (!consent) throw new CaseUploadError('Please give consent before uploading.');
    const basic=checkFiles([file],[]);
    if (basic.problems.length) throw new CaseUploadError(basic.problems.join(' '));
    const session=await this.supabase.ensureSignedIn();
    const client=this.supabase.client;
    const owner=await client.from('cases').select('id').eq('id',caseId).maybeSingle();
    if (owner.error || !owner.data) throw new CaseUploadError('This case is not available in this browser.');
    const previous=await client.from('documents').select('*').eq('case_id',caseId).returns<DocumentRow[]>();
    if (previous.error) throw new CaseUploadError('Could not check the existing files. Reload and try again.');
    const checked=checkFiles([file],(previous.data??[]).map(d=>({name:d.file_name,type:d.mime_type,size:d.size_bytes})));
    if (checked.problems.length) throw new CaseUploadError(checked.problems.join(' '));
    const id=crypto.randomUUID();
    const path=evidencePath(session.user.id,caseId,id,file.name);
    const number=Math.max(0,...(previous.data??[]).map(d=>Number(d.label.slice(1))))+1;
    if (!Number.isSafeInteger(number) || number>MAX_FILES_PER_CASE) throw new CaseUploadError('This case has no free evidence label. Start a new case if you need more files.');
    const row={id,case_id:caseId,label:`E${String(number).padStart(2,'0')}`,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size};
    const storage=client.storage.from(EVIDENCE_BUCKET);
    const upload=await storage.upload(path,file,{contentType:file.type,upsert:false});
    if (upload.error) throw new CaseUploadError('Could not upload the reply. Your earlier files are safe; try again.');
    const saved=await client.from('documents').insert(row).select().single<DocumentRow>();
    if (!saved.error && saved.data) return saved.data;
    // A lost response may hide a successful insert. Confirm before cleaning up this new file.
    const confirmed=await client.from('documents').select('*').eq('id',id).maybeSingle<DocumentRow>();
    if (!confirmed.error && confirmed.data) return confirmed.data;
    if (confirmed.error) throw new CaseUploadError('The reply upload could not be confirmed. Reload your case before adding it again.',caseId);
    const cleanup=await storage.remove([path]);
    throw new CaseUploadError(cleanup.error ? 'The reply could not be saved or cleaned up. Your earlier files are safe; reload your case.' : 'Could not save the reply. Your earlier files are safe; try again.',caseId);
  }
}
