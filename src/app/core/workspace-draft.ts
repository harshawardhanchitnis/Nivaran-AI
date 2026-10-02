import type { DraftRow } from '@shared/database';
import type { WorkspaceRows } from './case-workspace.service';
import { draftLintSpans, fillPrivateDetails, renderDraft } from '@shared/draft-render';
import type { DraftRenderContext } from '@shared/draft-render';
import { draftCandidates, lintDraft } from '@shared/draft-lint';
import type { DraftFlag } from '@shared/draft-lint';
import { normaliseDate } from '@shared/normalise';
import type { DraftSegment } from '../shared/ui/models';
export function draftStatements(draft: DraftRow): string[] {
  const value = draft.lint['userStatements'];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length <= 200).slice(0, 50)
    : [];
}
export function workspaceDraftContext(rows: WorkspaceRows, today: string): DraftRenderContext {
  return {
    facts: rows.facts,
    evidence: rows.evidence,
    documents: rows.documents,
    dates: rows.plan?.dates ?? {},
    today,
  };
}
export function draftPresentation(
  draft: DraftRow,
  base: string,
  context: DraftRenderContext,
  details: Record<'name' | 'contact' | 'address', string>,
  statements: readonly string[],
) {
  const local = fillPrivateDetails(base, details);
  const privateMatches = [...base.matchAll(/{{you:(name|contact|address)}}/g)];
  const shift = (position: number) =>
    position +
    privateMatches
      .filter((m) => m.index + m[0].length <= position)
      .reduce(
        (sum, m) =>
          sum + (details[m[1] as keyof typeof details] || `[your ${m[1]}]`).length - m[0].length,
        0,
      );
  const markers: Array<{ start: number; end: number; segment: DraftSegment }> = local.spans.map(
    (span) => ({ ...span, segment: { kind: 'you', text: local.text.slice(span.start, span.end) } }),
  );
  try {
    const on = draft.lint['generatedOn'];
    const rendered = renderDraft(draft.template_md, {
      ...context,
      today: typeof on === 'string' && normaliseDate(on) === on ? on : context.today,
    });
    for (const part of rendered.parts.filter((p) => p.kind === 'value')) {
      let offset = base.indexOf(part.text);
      while (offset >= 0) {
        markers.push({
          start: shift(offset),
          end: shift(offset + part.text.length),
          segment: {
            kind: 'value',
            text: part.text.replace(` [${part.evidence}]`, ''),
            evidence: part.evidence!,
          },
        });
        offset = base.indexOf(part.text, offset + part.text.length);
      }
    }
  } catch {
    /* A historical draft still opens; unsupported edited values are checked below. */
  }
  const flags = lintDraft(local.text, {
    ...context,
    ignore: markers.map(({ start, end }) => ({ start, end })),
    userStatements: statements,
  });
  for (const flag of flags) markers.push({ ...flag, segment: { kind: 'flag', text: flag.text } });
  for (const candidate of draftCandidates(local.text))
    if (
      statements.some((s) => s.toUpperCase() === candidate.text.toUpperCase()) &&
      !markers.some((m) => candidate.start < m.end && candidate.end > m.start)
    ) {
      const suffix = ' [your statement]';
      const hasSuffix = local.text.slice(candidate.end, candidate.end + suffix.length) === suffix;
      markers.push({
        start: candidate.start,
        end: candidate.end + (hasSuffix ? suffix.length : 0),
        segment: { kind: 'value', text: candidate.text, evidence: 'your statement' },
      });
    }
  markers.sort((a, b) => a.start - b.start);
  const segments: DraftSegment[] = [];
  let previous = 0;
  const ordinary = (text: string) =>
    text.split(/(\n\s*\n|\n)/).forEach((value) => {
      if (/^\n/.test(value)) segments.push({ kind: 'break' });
      else if (value) segments.push({ kind: 'text', text: value });
    });
  for (const marker of markers) {
    if (marker.start < previous) continue;
    ordinary(local.text.slice(previous, marker.start));
    segments.push(marker.segment);
    previous = marker.end;
  }
  ordinary(local.text.slice(previous));
  const text = segments
    .map((s) =>
      s.kind === 'break' ? '\n\n' : s.kind === 'value' ? `${s.text} [${s.evidence}]` : s.text,
    )
    .join('');
  return { text, segments, flags };
}
export function baseDraftFlags(
  draft: DraftRow,
  base: string,
  context: DraftRenderContext,
  statements: readonly string[],
): DraftFlag[] {
  const on = draft.lint['generatedOn'];
  const ignore = draftLintSpans(draft.template_md, base, {
    ...context,
    today: typeof on === 'string' && normaliseDate(on) === on ? on : context.today,
  });
  return lintDraft(base, { ...context, ignore, userStatements: statements });
}
