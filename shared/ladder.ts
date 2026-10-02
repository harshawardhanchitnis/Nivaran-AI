// Names of the escalation ladder steps. The rules that pick a step live on the server
// (server/ladder/) and are decided by code, never by the model.

export const LADDER_STEPS = [0, 1, 2, 3] as const;
export type LadderStep = (typeof LADDER_STEPS)[number];

export const LADDER_STEP_LABELS: Record<LadderStep, string> = {
  0: 'Wait for the promised date',
  1: "Write to the merchant's grievance officer",
  2: 'National Consumer Helpline',
  3: 'Consumer Commission (e-Jagriti)',
};
