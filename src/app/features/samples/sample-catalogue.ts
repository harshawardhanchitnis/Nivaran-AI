import { SAMPLE_CASES } from '@shared/samples';

/** How each saved run is introduced to a visitor. Outcomes describe the recorded run honestly. */
export interface SampleCard {
  id: (typeof SAMPLE_CASES)[number]['id'];
  title: string;
  description: string;
  icon: string;
  /** What the recorded run ended with, in plain words. */
  outcome: string;
  tone: 'good' | 'mixed' | 'neutral';
  shows: readonly string[];
}

const DETAILS: Record<SampleCard['id'], Omit<SampleCard, 'id' | 'title' | 'description'>> = {
  'clean-overdue': {
    icon: 'event_busy',
    outcome: 'Grievance complaint drafted',
    tone: 'mixed',
    shows: ['A refund past its due date', 'Plan to write to the grievance officer', 'One fact the reader missed stays marked Missing'],
  },
  'conflicting-amounts': {
    icon: 'compare_arrows',
    outcome: 'Question asked, complaint drafted',
    tone: 'good',
    shows: ['Two documents with different refund amounts', 'The question Nivaran asked and the recorded answer', 'Both sources kept visible'],
  },
  'not-yet-due': {
    icon: 'hourglass_top',
    outcome: 'Told to wait for the promised date',
    tone: 'good',
    shows: ['A refund that is not late yet', 'Step 0: nothing to send', 'Recorded in an earlier measured pass'],
  },
  'already-complained': {
    icon: 'support_agent',
    outcome: 'Helpline step chosen; draft failed',
    tone: 'mixed',
    shows: ['A complaint already sent with no reply', 'Escalation to the National Consumer Helpline', 'The failed draft is shown, not hidden'],
  },
  'out-of-scope': {
    icon: 'block',
    outcome: 'Stopped as out of scope',
    tone: 'neutral',
    shows: ['A case Nivaran is not built for', 'It stops instead of guessing', 'A failed document read is disclosed'],
  },
};

export const SAMPLE_CARDS: readonly SampleCard[] = SAMPLE_CASES.map((sample) => ({
  ...sample,
  ...DETAILS[sample.id],
}));
