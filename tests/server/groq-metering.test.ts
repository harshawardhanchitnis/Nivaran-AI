import {afterEach,describe,expect,it,vi} from 'vitest';
import {groqFetch} from '../../server/llm/groq-fetch.js';
import {observeModelCalls} from '../../server/llm/observer.js';
import {EvaluationBudget} from '../../eval/budget.js';
afterEach(()=>vi.unstubAllGlobals());
describe('provider token metering without model calls',()=>{
  it('records reported usage and safe headers, trims evaluation output reservation, and never records secrets or prompts',async()=>{
    const http=vi.fn(async()=>new Response(JSON.stringify({usage:{prompt_tokens:123,completion_tokens:45}}),{headers:{'content-type':'application/json','x-ratelimit-limit-tokens':'8000','x-ratelimit-remaining-tokens':'7832','x-ratelimit-reset-tokens':'1m0s'}}));
    vi.stubGlobal('fetch',http);
    const budget=new EvaluationBudget(1,1,undefined,{groqOutputAllowance:()=>600});
    await observeModelCalls(budget,()=>groqFetch('https://api.groq.com/openai/v1/chat/completions',{
      headers:{authorization:'Bearer fake-secret'},body:JSON.stringify({model:'qwen/qwen3.8-27b',messages:[{role:'user',content:'private-source-data'}],tools:[],max_tokens:2500}),
    }));
    expect(JSON.parse(String((http.mock.calls[0] as unknown as [unknown,RequestInit])[1].body)).max_tokens).toBe(600);
    expect(budget.snapshot().requests?.[0]).toMatchObject({modelId:'qwen/qwen3.8-27b',kind:'tool_choice',inputTokens:123,outputTokens:45,tokenLimit:8000,remainingTokens:7832});
    expect(JSON.stringify(budget.snapshot())).not.toMatch(/private-source-data|fake-secret/);
  });
});
