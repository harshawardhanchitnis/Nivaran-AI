// View models for the case components in this folder.
//
// The components are presentational: they take these shapes as inputs and emit events. They know
// nothing about Supabase or the API. Feature screens map database rows (shared/database.ts) into
// these shapes; features/demo/sample-case.ts shows a complete, realistic example of each.
import type { FactField, FactStatus } from '@shared/facts';
import type { LadderStep } from '@shared/ladder';

export interface CaseSummaryView {
  id: string;
  title: string;
  merchant: string | null;
  status: string;
  documentCount: number;
  step: string | null;
  nextDate: { label: string; date: string; overdue: boolean } | null;
}

/** Where a value was read from. */
export interface SourceView {
  /** Unique reading, including when one document contains several source quotes. */
  id?: string;
  documentId?: string;
  /** Evidence label, for example E02. */
  evidence: string;
  documentName: string;
  /** Plain description: "Cancellation email", "Support chat screenshot". */
  documentKind: string;
  page: number | null;
  /** The value as this source states it. */
  value: string;
  /** Text copied character for character from the document. */
  quote: string;
  /** Optional surrounding text, to show the quote in place. */
  before?: string;
  after?: string;
  /** Signed URL of the page image, when there is one to show. */
  imageUrl?: string | null;
  pdfUrl?: string | null;
  pdfImageUrl?: string | null;
  previewLoading?: boolean;
  previewError?: string;
}

export interface FactView {
  field: FactField;
  label: string;
  /** Null when the fact is missing. */
  value: string | null;
  status: FactStatus;
  /** One source for a supported fact, several for a conflict, none for a user statement. */
  sources: readonly SourceView[];
  /** One plain sentence under the value, for example why it matters. */
  note?: string;
}

export type ActivityKind =
  | 'read'
  | 'check'
  | 'found'
  | 'ask'
  | 'answer'
  | 'search'
  | 'decide'
  | 'plan'
  | 'error';

export interface ActivityView {
  id: string;
  kind: ActivityKind;
  /** Plain words: "Read E02, the cancellation email". */
  title: string;
  detail?: string;
  time: string;
}

export interface QuestionOptionView {
  id: string;
  label: string;
  /** Where this option comes from, for example "E02, cancellation email". */
  hint?: string;
}

export interface QuestionView {
  id: string;
  prompt: string;
  /** Why Nivaran is asking. */
  why: string;
  options: readonly QuestionOptionView[];
}

export interface ReasonView {
  text: string;
  sourceName?: string;
  sourceUrl?: string | null;
  checkedOn?: string | null;
}

export type TimelineTone = 'past' | 'overdue' | 'today' | 'upcoming';

export interface TimelineItemView {
  id: string;
  label: string;
  date: string;
  tone: TimelineTone;
  note?: string;
}

export interface PlanView {
  /** Saved proposal identity; a new proposal opens the plan tab. Omitted in the presentation demo. */
  id?: string;
  step: LadderStep;
  headline: string;
  summary: string;
  reasons: readonly ReasonView[];
  timeline: readonly TimelineItemView[];
}
export interface SentPlanView {
  sentOn: string | null;
  acknowledgeBy: string | null;
  resolveBy: string | null;
}

/** A complaint is rendered from segments so inserted values, flags and personal details can be styled. */
export type DraftSegment =
  | { kind: 'text'; text: string }
  /** A value inserted by code from the fact sheet, with its evidence label. */
  | { kind: 'value'; text: string; evidence: string }
  /** An amount, date or ID that is not in the fact sheet. */
  | { kind: 'flag'; text: string }
  /** The user's own details, filled in the browser only. */
  | { kind: 'you'; text: string }
  | { kind: 'break' };
