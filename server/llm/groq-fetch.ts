import {currentModelCallObserver} from './observer.js';
import type {ProviderMeasurement} from './observer.js';

/** Evaluation-only metering; no raw prompts, keys or response bodies enter its telemetry. */
export const groqFetch:typeof fetch=async(input,init)=>{
  const observer=currentModelCallObserver();
  if(!observer||typeof init?.body!=='string')return fetch(input,init);
  const body=JSON.parse(init.body) as Record<string,unknown>;
  const inputBytes=Buffer.byteLength(JSON.stringify({messages:body['messages'],tools:body['tools'],response_format:body['response_format']}));
  const requested=Number(body['max_tokens']??body['max_completion_tokens']??0);
  const imageCount=(JSON.stringify(body['messages']).match(/"type":"image_url"/g)??[]).length;
  const allowance=observer.groqOutputAllowance?.(inputBytes,requested,imageCount)??requested;
  if('max_completion_tokens'in body)body['max_completion_tokens']=allowance;else body['max_tokens']=allowance;
  const started=performance.now();
  const response=await fetch(input,{...init,body:JSON.stringify(body)});
  const measurement:ProviderMeasurement={modelId:String(body['model']),kind:body['tools']?'tool_choice':body['response_format']?'reading':'draft',inputBytes,maxOutputTokens:allowance,status:response.status};
  if(imageCount)measurement.imageCount=imageCount;
  for(const [header,key] of [['x-ratelimit-limit-tokens','tokenLimit'],['x-ratelimit-remaining-tokens','remainingTokens']] as const) {
    const raw=response.headers.get(header);if(raw!==null&&Number.isFinite(Number(raw)))measurement[key]=Number(raw);
  }
  const reset=response.headers.get('x-ratelimit-reset-tokens');if(reset)measurement.resetTokens=reset;
  if(response.ok) {
    try {
      const result=await response.clone().json() as {usage?:{prompt_tokens?:number;completion_tokens?:number}};
      if(typeof result.usage?.prompt_tokens==='number')measurement.inputTokens=result.usage.prompt_tokens;
      if(typeof result.usage?.completion_tokens==='number')measurement.outputTokens=result.usage.completion_tokens;
    } catch { /* The SDK reports any malformed body; telemetry must not invent usage. */ }
  }
  measurement.responseMs=Math.round(performance.now()-started);
  observer.providerResponse?.(measurement);return response;
};
