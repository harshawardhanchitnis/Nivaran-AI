import { TestBed } from '@angular/core/testing';
import { ReplacementUpload } from './replacement-upload';
describe('ReplacementUpload',()=>{
  it('requires consent and one selected file before emitting an upload',async()=>{
    const fixture=TestBed.createComponent(ReplacementUpload);const uploaded:File[]=[];
    fixture.componentInstance.submitted.subscribe(file=>uploaded.push(file));await fixture.whenStable();
    const page=fixture.nativeElement as HTMLElement;const picker=page.querySelector<HTMLInputElement>('input[type=file]')!;
    const select=()=>{Object.defineProperty(picker,'files',{configurable:true,value:[new File(['fixture'],'clear.png',{type:'image/png'})]});picker.dispatchEvent(new Event('change'));};
    select();await fixture.whenStable();expect(uploaded).toHaveLength(0);expect(picker.disabled).toBe(true);
    page.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();await fixture.whenStable();select();await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button[mat-flat-button]')!.click();expect(uploaded[0]?.name).toBe('clear.png');
  });
});
