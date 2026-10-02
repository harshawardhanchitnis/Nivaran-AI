import type { ServerEnv } from '../env.js';
import { HttpError } from '../http.js';
export type ModelTask = 'vision_image' | 'vision_pdf' | 'text';
export interface RoutedModel { key: string; provider: 'google' | 'groq'; modelId: string }
export interface Availability { model_key: string; usable_after: string }
export type CooldownReason = 'quota' | 'rate_limit' | 'high_demand' | 'timeout';
export class ModelsUnavailableError extends Error {
  constructor(readonly retryAfterMs: number) { super('All suitable models are temporarily unavailable. Your progress is saved.'); }
}
export function modelLineup(task: ModelTask, env: ServerEnv): RoutedModel[] {
  const list=task === 'text' ? env.textLineup : env.visionLineup;
  if(!list.length || list.length>6) throw new HttpError(503,'model_lineup_invalid','Configure one to six models per lineup.');
  return list.map(modelId => {
    const provider = modelId.startsWith('gemini-') ? 'google' as const : 'groq' as const;
    if (!/^(?:gemini-[A-Za-z0-9._-]+|qwen\/[A-Za-z0-9._-]+)$/.test(modelId)) throw new HttpError(503,'model_lineup_invalid','A configured model ID is not supported.');
    return { key: `${provider}:${modelId}`, provider, modelId };
  }).filter(model=>task !== 'vision_pdf' || model.provider !== 'groq');
}
function nextPacificMidnight(now: number): number {
  const parts = (value: number) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(value).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  const local=parts(now); const target=Date.UTC(local['year']!,local['month']!-1,local['day']!+1);
  let candidate=target+8*3600000;
  const at=parts(candidate); const represented=Date.UTC(at['year']!,at['month']!-1,at['day']!,at['hour']!,at['minute']!,at['second']!);
  candidate -= represented-target; return candidate;
}
const duration = (text: string): number | null => {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text)*1000;
  const matches=[...text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  return matches.length ? matches.reduce((sum,m)=>sum+Number(m[1])*({ms:1,h:3600000,m:60000,s:1000}[m[2]!]??0),0) : null;
};
/** Retry times are provider hints; conservative defaults apply when no reset time is supplied. */
export function providerCooldown(error: unknown, provider: RoutedModel['provider'], now: number): {reason:CooldownReason;until:number} | null {
  let value=error;
  for(let depth=0;depth<5;depth++) {
    if(!value || typeof value!=='object') return null;
    const e=value as Record<string,unknown>; const message=[e['message'],e['responseBody']].filter(v=>typeof v==='string').join(' ');
    const status=e['statusCode'] ?? e['status'];
    const timeout=e['name']==='TimeoutError' || e['name']==='AbortError';
    const quota=/quota|resource_exhausted/i.test(message); const daily=/perday|per.day|daily|requests per day|tokens per day/i.test(message);
    if(status===429 || timeout || quota && (status===403 || status===429) || status===503 || /high demand|overloaded/i.test(message)) {
      const reason:CooldownReason=timeout?'timeout':daily?'quota':status===503 || /high demand|overloaded/i.test(message)?'high_demand':'rate_limit';
      const headers=e['responseHeaders'] && typeof e['responseHeaders']==='object' ? e['responseHeaders'] as Record<string,unknown> : {};
      const retry=String(headers['retry-after'] ?? ''); const reset=duration(retry) ?? (Number.isFinite(Date.parse(retry)) ? Date.parse(retry)-now : null);
      const bodyRetry=/"retryDelay"\s*:\s*"([^"]+)"/.exec(message)?.[1];
      const groqReset=daily ? duration(String(headers['x-ratelimit-reset-requests']??'')) : null;
      // A short RPM hint must not override an explicit exhausted daily quota.
      const wait=daily ? groqReset ?? (provider==='google'?nextPacificMidnight(now)-now:86400000)
        : reset ?? (bodyRetry?duration(bodyRetry):null) ?? 60000;
      return {reason,until:now+Math.max(1000,Math.min(30*3600000,wait))};
    }
    value=e['cause'] ?? e['lastError'];
  }
  return null;
}
export interface RouterDependencies<T> {
  now():number; timeoutMs:number; charge():Promise<void>; available():Promise<Availability[]>;
  exhaust(model:RoutedModel,until:number,reason:CooldownReason):Promise<void>;
  attempt(model:RoutedModel,signal:AbortSignal):Promise<T>;
}
/** One logical charge. Each candidate is tried at most once; no sleep and no SDK retries. */
export async function routeModelCall<T>(models: readonly RoutedModel[], deps: RouterDependencies<T>): Promise<{ value:T;modelId:string;provider:RoutedModel['provider'] }> {
  if(!models.length) throw new HttpError(503,'model_lineup_invalid','No suitable model is configured.');
  const rows=await deps.available(); const blocked=new Map(rows.map(row=>[row.model_key,Date.parse(row.usable_after)]));
  let charged=false;
  const deadline=deps.now()+48000;
  for(const model of models) {
    if((blocked.get(model.key)??0)>deps.now()) continue;
    if(deps.now()>=deadline) throw new ModelsUnavailableError(1000);
    if(!charged) { await deps.charge(); charged=true; }
    try { return { value:await deps.attempt(model,AbortSignal.timeout(Math.max(1,Math.min(deps.timeoutMs,deadline-deps.now())))),modelId:model.modelId,provider:model.provider }; }
    catch(error) {
      const cooldown=providerCooldown(error,model.provider,deps.now()); if(!cooldown) throw error;
      await deps.exhaust(model,cooldown.until,cooldown.reason); blocked.set(model.key,cooldown.until);
    }
  }
  const next=models.map(model=>blocked.get(model.key)??deps.now()+60000);
  throw new ModelsUnavailableError(Math.max(1000,Math.min(...next)-deps.now()));
}
