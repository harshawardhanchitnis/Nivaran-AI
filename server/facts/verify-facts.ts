import type { CaseFactRow, DocumentRow, EvidenceItemRow } from '../../shared/database.js';
import { FACT_FIELDS, isFactField, type FactField } from '../../shared/facts.js';
import { normaliseFact } from '../verify/normalise.js';
import { pdfQuoteChecks, type QuoteResults, type ImageQuoteResult } from '../verify/quote.js';
import { buildFactSheet, type FactSheetValue } from './build-fact-sheet.js';

export interface FactCheckDependencies {
  download(document: DocumentRow): Promise<Uint8Array>;
  images(documents: readonly DocumentRow[], items: readonly EvidenceItemRow[]): Promise<QuoteResults|ImageQuoteResult>;
}
export interface CheckedFactSheet { evidence: EvidenceItemRow[]; facts: FactSheetValue[];modelId?:string }

/** Returns changes for the caller's atomic turn commit; it never writes rows itself. */
export async function verifyFacts(
  documents: readonly DocumentRow[], items: readonly EvidenceItemRow[], decisions: readonly CaseFactRow[],
  deps: FactCheckDependencies, required: readonly FactField[] = FACT_FIELDS,
): Promise<CheckedFactSheet> {
  const checks: QuoteResults = {};
  for (const document of documents.filter(doc => doc.mime_type === 'application/pdf')) {
    const quotes = items.filter(item => item.source === 'document' && item.document_id === document.id);
    if (!quotes.length) continue;
    Object.assign(checks, await pdfQuoteChecks(await deps.download(document), quotes));
  }
  const uncheckedImages = items.filter(item => item.source === 'document' && item.quote_verified === null &&
    documents.some(doc => doc.id === item.document_id && doc.mime_type !== 'application/pdf'));
  let modelId:string|undefined;
  if (uncheckedImages.length) {
    const result=await deps.images(documents,uncheckedImages);
    if(typeof result['modelId']==='string' && result['checks'] && typeof result['checks']==='object') {
      Object.assign(checks,result['checks']); modelId=result['modelId'];
    } else Object.assign(checks,result);
  }
  const evidence = items.map(item => ({ ...item,
    quote_verified: item.source === 'user' ? null : Object.hasOwn(checks, item.id) ? checks[item.id]! : item.quote_verified,
    value_norm: isFactField(item.field) ? normaliseFact(item.field, item.value_text) : null,
  }));
  return { evidence, facts: buildFactSheet(evidence, required, decisions),...(modelId?{modelId}:{}) };
}
