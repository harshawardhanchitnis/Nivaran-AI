import {HttpError} from '../server/http.js';
import type {Availability,ModelTask} from '../server/llm/router.js';
import type {ModelCallObserver} from '../server/llm/observer.js';
export interface CooldownRow extends Availability {reason:string}
export function cooldownWait(models:readonly string[],rows:readonly CooldownRow[],now:number):{daily:boolean;waitMs:number} {
  const blocked=models.map(key=>rows.find(row=>row.model_key===key&&Date.parse(row.usable_after)>now));
  if(blocked.some(row=>!row))return {daily:false,waitMs:0};
  if(blocked.every(row=>row?.reason==='quota'))return {daily:true,waitMs:0};
  return {daily:false,waitMs:Math.max(1000,Math.min(...blocked.filter(row=>row?.reason!=='quota').map(row=>Date.parse(row!.usable_after)-now))+250)};
}
export interface EvaluationPacing {
  beforeStep():Promise<void>;
  onCooldown(task:ModelTask,retryAfterMs:number):Promise<void>;
}
/** Only the local runner waits. Provider fallback and HTTP advance never sleep. */
export class GroqPacer implements Pick<ModelCallObserver,'groqOutputAllowance'> {
  private windowEnds=0;
  private remaining=0;
  constructor(readonly tpm:number,readonly rpm:number,private readonly now:()=>number,private readonly wait:(ms:number)=>Promise<void>) {
    if(![tpm,rpm].every(n=>Number.isSafeInteger(n)&&n>0))throw new Error('Use positive Groq TPM and RPM limits.');
  }
  async beforeStep():Promise<void> {if(this.windowEnds>this.now())await this.wait(this.windowEnds-this.now());}
  groqOutputAllowance(inputBytes:number,requestedTokens:number,imageCount=0):number {
    if(this.now()>=this.windowEnds){this.remaining=this.tpm;this.windowEnds=this.now()+Math.max(61000,Math.ceil(60000/this.rpm));}
    if(imageCount&&this.remaining===this.tpm) {
      // Encoded image bytes are not a token estimate. Reserve the entire window for one image
      // request; the provider enforces its actual pixel-token cost and reports usage afterward.
      this.remaining=0;return Math.min(requestedTokens,Math.floor(this.tpm/4));
    }
    // UTF-8 bytes are a deliberately conservative upper bound on text tokens. Include framing margin.
    const allowance=Math.min(requestedTokens,this.remaining-inputBytes-256);
    if(!imageCount&&inputBytes+288>this.tpm)throw new HttpError(413,'evaluation_request_too_large','The text request exceeds the conservative local Groq TPM allowance. Trim the context before another attempt.');
    if(allowance<32) {
      // Local pacing is not a provider error and must never write shared model cooldowns.
      const error=Object.assign(new HttpError(429,'evaluation_pacing','The request would exceed the local Groq token-minute budget.'),
        {retryAfterMs:Math.max(1000,this.windowEnds-this.now())});
      throw error;
    }
    this.remaining-=inputBytes+allowance+256;return allowance;
  }
}
export async function waitChunks(ms:number,onWait:(remainingMs:number)=>void=remaining=>console.log(`Evaluation pacing: waiting ${Math.ceil(remaining/1000)} seconds; no provider call.`)):Promise<void> {
  const end=Date.now()+ms;
  while(Date.now()<end) {onWait(end-Date.now());await new Promise<void>(resolve=>setTimeout(resolve,Math.min(30000,end-Date.now())));}
}
export const dailyStop=()=>new HttpError(429,'model_daily_quota','Every suitable model has a stored daily-quota cooldown. This case cannot continue today.');
