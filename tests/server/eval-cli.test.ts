import {describe,expect,it} from 'vitest';
import {main} from '../../eval/run-eval.js';
describe('evaluation CLI safety',()=>{
  it('limits the final pass to all cases, repetition one and 70 logical calls',async()=>{
    const base=['--live','--batch','final-stage-one','--max-provider-attempts','350'];
    await expect(main([...base,'--max-logical-calls','71','--repetitions','1'])).rejects.toThrow(/at most 70/);
    await expect(main([...base,'--max-logical-calls','70','--repetitions','2'])).rejects.toThrow(/repetition 1/);
    await expect(main([...base,'--max-logical-calls','70','--repetitions','1','--case','clean-overdue'])).rejects.toThrow(/all 12/);
  });
  it('never widens the named rerun beyond repetition one or 40 calls',async()=>{
    const base=['--live','--batch','rerun-stage-one','--max-provider-attempts','120'];
    await expect(main([...base,'--max-logical-calls','41','--repetitions','1'])).rejects.toThrow(/at most 40/);
    await expect(main([...base,'--max-logical-calls','40','--repetitions','2'])).rejects.toThrow(/repetition 1/);
  });
  it('rejects conflicting or duplicate repetition selectors before authentication',async()=>{
    await expect(main(['--live','--rounds','1','--repetitions','2,3'])).rejects.toThrow(/not both/);
    await expect(main(['--live','--max-logical-calls','300','--max-provider-attempts','450','--repetitions','1,1'])).rejects.toThrow(/distinct/);
  });
  it('refuses conflicting live and dry-run modes before accessing a session',async()=>{
    await expect(main(['--live','--dry-run'])).rejects.toThrow(/exactly one mode/);
  });
  it('requires explicit positive budgets before any authenticated live operation',async()=>{
    await expect(main(['--live'])).rejects.toThrow(/max-logical-calls/);
    await expect(main(['--live','--max-logical-calls','10','--max-provider-attempts','0'])).rejects.toThrow(/max-provider-attempts/);
  });
});
