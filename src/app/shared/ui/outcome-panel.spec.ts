import { TestBed } from '@angular/core/testing';
import { OutcomePanel, type OutcomeSubmission } from './outcome-panel';
describe('outcome choices without an API',()=>{
  async function setup() {
    const fixture=TestBed.createComponent(OutcomePanel);
    await fixture.whenStable();
    const values:OutcomeSubmission[]=[];fixture.componentInstance.outcomeRequested.subscribe(v=>values.push(v));
    return {fixture,page:fixture.nativeElement as HTMLElement,values};
  }
  it('offers all four choices, preserves a retry ID, then allows a fresh update after success',async()=>{
    const {fixture,page,values}=await setup();
    expect(page.querySelectorAll('input[type=radio]')).toHaveLength(4);
    Array.from(page.querySelectorAll('label')).find(l=>l.textContent?.trim()==='No reply and no refund')!.querySelector<HTMLInputElement>('input')!.click();await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button')!.click();page.querySelector<HTMLButtonElement>('button')!.click();
    expect(values[0]).toMatchObject({outcome:'no_reply',file:null});expect(values[1]?.requestId).toBe(values[0]?.requestId);
    fixture.componentRef.setInput('completedRequest',values[0]!.requestId);await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button')!.click();expect(values[2]?.requestId).not.toBe(values[0]?.requestId);
  });
  it('requires a valid reply and consent for a written refusal',async()=>{
    const {fixture,page,values}=await setup();
    Array.from(page.querySelectorAll('label')).find(l=>l.textContent?.trim()==='Refused in writing')!.querySelector<HTMLInputElement>('input')!.click();await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    const input=page.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input,'files',{configurable:true,value:[new File(['x'],'reply.txt',{type:'text/plain'})]});
    input.dispatchEvent(new Event('change',{bubbles:true}));await fixture.whenStable();
    expect(page.textContent).toContain('not a PNG');expect(values).toHaveLength(0);
    Object.defineProperty(input,'files',{configurable:true,value:[new File(['x'],'reply.pdf',{type:'application/pdf'})]});
    input.dispatchEvent(new Event('change',{bubbles:true}));await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    page.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button')!.click();expect(values[0]).toMatchObject({outcome:'refused',consent:true,file:expect.any(File)});
  });
});
