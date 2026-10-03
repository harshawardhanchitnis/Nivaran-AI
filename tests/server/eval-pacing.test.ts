import {describe,expect,it,vi} from 'vitest';
import {cooldownWait,GroqPacer} from '../../eval/pacing.js';
import {HttpError} from '../../server/http.js';
describe('evaluation waits outside provider attempts',()=>{
  it('keeps Qwen image routing available without treating base64 bytes as text tokens',()=>{
    const pacer=new GroqPacer(8000,30,()=>1000,async()=>{});
    expect(pacer.groqOutputAllowance(50000,8000,1)).toBe(2000);
    expect(()=>pacer.groqOutputAllowance(50000,8000,1)).toThrow(/token-minute/);
  });
  it('stops for daily quotas only when every suitable model is daily-blocked',()=>{
    const now=1000,rows=[{model_key:'g',usable_after:new Date(90000).toISOString(),reason:'quota'},
      {model_key:'q',usable_after:new Date(12000).toISOString(),reason:'rate_limit'}];
    expect(cooldownWait(['g','q'],rows,now)).toEqual({daily:false,waitMs:11250});
    expect(cooldownWait(['g'],rows,now)).toEqual({daily:true,waitMs:0});
    expect(cooldownWait(['g','available'],rows,now)).toEqual({daily:false,waitMs:0});
  });
  it.each(['timeout','high_demand','rate_limit'])('waits for %s rather than stopping the case',reason=>{
    expect(cooldownWait(['q'],[{model_key:'q',reason,usable_after:new Date(61000).toISOString()}],1000)).toEqual({daily:false,waitMs:60250});
  });
  it('spaces Groq windows and reserves text input plus output below the supplied TPM',async()=>{
    let now=1000;const wait=vi.fn(async(ms:number)=>{now+=ms;});const pacer=new GroqPacer(8000,30,()=>now,wait);
    expect(pacer.groqOutputAllowance(3000,8000)).toBe(4744);
    expect(()=>pacer.groqOutputAllowance(3000,600)).toThrow(/token-minute/);
    try {pacer.groqOutputAllowance(3000,600);}catch(error){expect(error).toBeInstanceOf(HttpError);expect(error).toHaveProperty('code','evaluation_pacing');}
    await pacer.beforeStep();expect(wait).toHaveBeenCalledWith(61000);
    expect(pacer.groqOutputAllowance(3000,600)).toBe(600);
  });
});
