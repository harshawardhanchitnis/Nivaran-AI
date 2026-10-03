import { describe, expect, it } from 'vitest';
import { currentModelCallObserver, observeModelCalls } from '../../server/llm/observer.js';
import { EvaluationBudget } from '../../eval/budget.js';
import { routeModelCall } from '../../server/llm/router.js';
import { HttpError } from '../../server/http.js';
describe('bounded evaluation calls', () => {
  it('records successful answering models separately from attempts, including a skipped primary',()=>{
    const budget=new EvaluationBudget(3,4);
    budget.charged();budget.beforeAttempt('primary');budget.beforeAttempt('fallback');budget.answered('fallback','primary');
    budget.charged();budget.beforeAttempt('fallback');budget.answered('fallback','primary');
    budget.charged();budget.beforeAttempt('failed');
    expect(budget.snapshot().answers).toEqual([
      {modelId:'fallback',firstModelId:'primary',attempts:['primary','fallback']},
      {modelId:'fallback',firstModelId:'primary',attempts:['fallback']},
    ]);
    expect(budget.snapshot().providerAttempts).toBe(4);
  });
  it('permits a zero-remaining budget for audit recovery but refuses every new call',()=>{
    const budget=new EvaluationBudget(0,0);
    expect(()=>budget.beforeCharge()).toThrow(/budget/);expect(()=>budget.beforeAttempt('first')).toThrow(/budget/);
    expect(budget.snapshot()).toEqual({logicalCalls:0,providerAttempts:0,models:{}});
  });
  it('persists counts before returning permission to invoke an SDK',()=>{
    const saved:number[]=[];let budget:EvaluationBudget;
    budget=new EvaluationBudget(1,2,()=>{saved.push(budget.snapshot().providerAttempts);});
    budget.charged();budget.beforeAttempt('first');budget.beforeAttempt('fallback');
    expect(saved).toEqual([0,1,2]);
  });
  it('does not mark a provider exhausted when the local budget stops an attempt',async()=>{
    let cooldowns=0;
    await expect(routeModelCall([{key:'google:test',provider:'google',modelId:'test'}],{
      now:()=>0,timeoutMs:1000,charge:async()=>{},available:async()=>[],exhaust:async()=>{cooldowns++;},
      attempt:async()=>{throw new HttpError(429,'evaluation_budget','budget exhausted');},
    })).rejects.toThrow('budget exhausted');
    expect(cooldowns).toBe(0);
  });
  it('counts successful logical charges and each attempted provider separately', async () => {
    const budget = new EvaluationBudget(1, 2);
    await observeModelCalls(budget, async () => {
      const observer = currentModelCallObserver()!;
      observer.beforeCharge(); observer.charged();
      observer.beforeAttempt('first'); observer.beforeAttempt('fallback');
      expect(() => observer.beforeAttempt('third')).toThrow(/budget/);
      expect(() => observer.beforeCharge()).toThrow(/budget/);
    });
    expect(budget.snapshot()).toEqual({logicalCalls:1,providerAttempts:2,models:{first:1,fallback:1}});
    expect(currentModelCallObserver()).toBeUndefined();
  });
  it('does not count a refused database charge or leak state between asynchronous runs', async () => {
    const one = new EvaluationBudget(2, 3), two = new EvaluationBudget(2, 3);
    await Promise.all([observeModelCalls(one,async()=> {await Promise.resolve(); currentModelCallObserver()!.beforeCharge();}),
      observeModelCalls(two,async()=>{currentModelCallObserver()!.charged();})]);
    expect(one.snapshot().logicalCalls).toBe(0); expect(two.snapshot().logicalCalls).toBe(1);
  });
});
