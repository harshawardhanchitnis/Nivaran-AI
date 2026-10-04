import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MyCases } from './my-cases';
import { CasesService } from '../../core/cases.service';
describe('confirmed deletion in My cases',()=>{
  const item={id:'case',title:'Disposable check',merchant:null,status:'Documents added',documentCount:1,step:null,nextDate:null};
  const remove=vi.fn(),open=vi.fn();
  beforeEach(()=>{
    remove.mockReset().mockResolvedValue(undefined);open.mockReset().mockReturnValue({afterClosed:()=>of(false)});
    TestBed.configureTestingModule({imports:[MyCases],providers:[provideRouter([]),{provide:CasesService,useValue:{list:async()=>[item],deleteCase:remove}},{provide:MatDialog,useValue:{open}}]});
  });
  it('does nothing on cancel and removes the card only after confirmed success',async()=>{
    const fixture=TestBed.createComponent(MyCases);await fixture.whenStable();const page=fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>('button[aria-label="Delete Disposable check"]')!.click();await fixture.whenStable();expect(remove).not.toHaveBeenCalled();
    open.mockReturnValue({afterClosed:()=>of(true)});
    page.querySelector<HTMLButtonElement>('button[aria-label="Delete Disposable check"]')!.click();await fixture.whenStable();
    expect(remove).toHaveBeenCalledExactlyOnceWith('case');expect(page.querySelector('.case-list')).toBeNull();expect(page.textContent).toContain('files and records were deleted');
  });
  it('keeps the card and offers retry when deletion fails',async()=>{
    remove.mockRejectedValue(new Error('Storage unavailable; retry Delete case.'));open.mockReturnValue({afterClosed:()=>of(true)});
    const fixture=TestBed.createComponent(MyCases);await fixture.whenStable();const page=fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>('button[aria-label="Delete Disposable check"]')!.click();await fixture.whenStable();
    expect(page.querySelector('.case-list')).not.toBeNull();expect(page.querySelector('[role=alert]')?.textContent).toContain('retry');
  });
});
