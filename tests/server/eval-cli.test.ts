import {describe,expect,it} from 'vitest';
import {main} from '../../eval/run-eval.js';
describe('evaluation CLI safety',()=>{
  it('refuses conflicting live and dry-run modes before accessing a session',async()=>{
    await expect(main(['--live','--dry-run'])).rejects.toThrow(/exactly one mode/);
  });
  it('requires explicit positive budgets before any authenticated live operation',async()=>{
    await expect(main(['--live'])).rejects.toThrow(/max-logical-calls/);
    await expect(main(['--live','--max-logical-calls','10','--max-provider-attempts','0'])).rejects.toThrow(/max-provider-attempts/);
  });
});
