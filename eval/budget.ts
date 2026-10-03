import { HttpError } from '../server/http.js';
import type { ModelCallObserver } from '../server/llm/observer.js';
export interface AnsweredCall { modelId: string; firstModelId: string; attempts: string[] }
export interface CallCounts { logicalCalls: number; providerAttempts: number; models: Record<string, number>; answers?: AnsweredCall[] }
export class EvaluationBudget implements ModelCallObserver {
  private logicalCalls = 0;
  private providerAttempts = 0;
  private readonly models: Record<string, number> = {};
  private attempts: string[] = [];
  private readonly answers: AnsweredCall[] = [];
  constructor(readonly logicalLimit: number, readonly attemptLimit: number, private readonly onChange?: () => void) {
    // A resumed batch may have zero remaining calls but still need to recover its saved audit.
    if (![logicalLimit,attemptLimit].every(n=>Number.isSafeInteger(n)&&n>=0)) throw new Error('Use nonnegative integer remaining budgets.');
  }
  beforeCharge(): void {
    if(this.logicalCalls>=this.logicalLimit || this.providerAttempts>=this.attemptLimit) this.stop();
  }
  charged(): void { this.logicalCalls++; this.attempts=[]; this.onChange?.(); }
  beforeAttempt(modelId: string): void {
    if(this.providerAttempts>=this.attemptLimit) this.stop();
    this.providerAttempts++; this.models[modelId]=(this.models[modelId]??0)+1; this.attempts.push(modelId); this.onChange?.();
  }
  answered(modelId: string, firstModelId: string): void {
    this.answers.push({modelId,firstModelId,attempts:[...this.attempts]}); this.onChange?.();
  }
  snapshot(): CallCounts { return {logicalCalls:this.logicalCalls,providerAttempts:this.providerAttempts,models:{...this.models},
    ...(this.answers.length ? {answers:this.answers.map(a=>({...a,attempts:[...a.attempts]}))}: {})}; }
  private stop(): never { throw new HttpError(429,'evaluation_budget','The approved evaluation call budget is exhausted. Progress is saved.'); }
}
