import type { CaseFactRow } from './database.js';
import { normaliseAmount, normaliseDate } from './normalise.js';
import type { TextSpan } from './draft-render.js';
export interface DraftFlag extends TextSpan {
  kind: 'amount' | 'date' | 'id';
  text: string;
}
export interface DraftLintContext {
  facts: readonly Pick<CaseFactRow, 'field' | 'status' | 'value_norm'>[];
  dates: Record<string, string>;
  today: string;
  ignore?: readonly TextSpan[];
  userStatements?: readonly string[];
}
const months =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const patterns: Array<[DraftFlag['kind'], RegExp]> = [
  [
    'date',
    new RegExp(
      `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{1,2}(?:st|nd|rd|th)? ${months} \\d{4}|${months} \\d{1,2}(?:st|nd|rd|th)?,? \\d{4})\\b`,
      'gi',
    ),
  ],
  [
    'amount',
    /(?:₹\s*|\b(?:Rs\.?|INR)\s*)[-+]?\s*\d[\d,]*(?:\.\d+)?|(?<![\w])[-+]?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b|(?<![\w])[-+]?\d{3,}(?:\.\d+)?\b/gi,
  ],
  ['id', /\b[A-Za-z0-9][A-Za-z0-9_-]{5,}\b/g],
];
export function draftCandidates(text: string): DraftFlag[] {
  const all = patterns.flatMap(([kind, pattern]) =>
    [...text.matchAll(pattern)]
      .filter((m) => kind !== 'id' || /\d/.test(m[0]))
      .map((m) => ({ kind, text: m[0], start: m.index, end: m.index + m[0].length })),
  );
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const picked: DraftFlag[] = [];
  for (const item of all)
    if (!picked.some((p) => item.start < p.end && item.end > p.start)) picked.push(item);
  return picked;
}
function canonical(kind: DraftFlag['kind'], text: string): string | null {
  if (kind === 'amount') return normaliseAmount(text)?.decimal ?? null;
  if (kind === 'date') return normaliseDate(text);
  return text.normalize('NFKC').trim().toUpperCase();
}
/** Digit-formatted values only. Prose claims and amounts written solely in words are not checked. */
export function lintDraft(text: string, context: DraftLintContext): DraftFlag[] {
  const allowed: Record<DraftFlag['kind'], Set<string>> = {
    amount: new Set(),
    date: new Set(),
    id: new Set(),
  };
  for (const fact of context.facts) {
    if (!['document', 'user'].includes(fact.status)) continue;
    const value = fact.value_norm;
    if (!value) continue;
    if (value['kind'] === 'amount' && typeof value['decimal'] === 'string')
      allowed.amount.add(value['decimal']);
    if ((value['kind'] === 'date' || value['kind'] === 'id') && typeof value['value'] === 'string')
      allowed[value['kind']].add(value['value'].toUpperCase());
  }
  for (const date of [context.today, ...Object.values(context.dates)])
    if (normaliseDate(date) === date) allowed.date.add(date);
  const statements = new Set(
    (context.userStatements ?? []).map((value) => value.normalize('NFKC').trim().toUpperCase()),
  );
  for (const statement of context.userStatements ?? [])
    for (const candidate of draftCandidates(statement)) {
      const norm = canonical(candidate.kind, candidate.text);
      if (norm) allowed[candidate.kind].add(norm);
    }
  return draftCandidates(text).filter((candidate) => {
    if (context.ignore?.some((span) => candidate.start >= span.start && candidate.end <= span.end))
      return false;
    if (statements.has(candidate.text.normalize('NFKC').trim().toUpperCase())) return false;
    if (
      candidate.kind === 'amount' &&
      !/₹|\b(?:Rs|INR)/i.test(candidate.text) &&
      allowed.id.has(candidate.text.toUpperCase())
    )
      return false;
    const norm = canonical(candidate.kind, candidate.text);
    return !norm || !allowed[candidate.kind].has(norm);
  });
}
