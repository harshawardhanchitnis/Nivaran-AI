import { AsyncLocalStorage } from 'node:async_hooks';

/** Optional request-local instrumentation. It never replaces the database quota charge. */
export interface ModelCallObserver {
  beforeCharge(): void;
  charged(): void;
  beforeAttempt(modelId: string): void;
  answered?(modelId: string, firstModelId: string): void;
  groqOutputAllowance?(inputBytes: number, requestedTokens: number, imageCount?:number): number;
  providerResponse?(measurement: ProviderMeasurement): void;
}
export interface ProviderMeasurement {
  modelId:string; kind:'tool_choice'|'reading'|'draft'; inputBytes:number; maxOutputTokens:number; status:number;
  inputTokens?:number; outputTokens?:number;
  tokenLimit?:number; remainingTokens?:number; resetTokens?:string;
  imageCount?:number;
}
const observers = new AsyncLocalStorage<ModelCallObserver>();
export const currentModelCallObserver = () => observers.getStore();
export function observeModelCalls<T>(observer: ModelCallObserver, operation: () => Promise<T>): Promise<T> {
  return observers.run(observer, operation);
}
