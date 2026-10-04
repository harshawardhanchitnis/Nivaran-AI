import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDeleteCase } from '../../shared/ui/confirm-delete-case';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CasesService } from '../../core/cases.service';
import type { CaseSummaryView } from '../../shared/ui/models';

@Component({
  selector: 'app-my-cases',
  imports: [RouterLink, MatButtonModule, MatIconModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="narrow stack" [attr.aria-busy]="loading()">
      <header class="row heading-row">
        <div>
          <p class="eyebrow">Your case files</p>
          <h1 tabindex="-1">My cases</h1>
          <p class="muted">Your cases stay private to your sign-in in this browser.</p>
        </div>
        <a mat-flat-button routerLink="/cases/new">Add documents</a>
      </header>
      @if (deleteProblem()) { <p role="alert">{{deleteProblem()}}</p> }
      @if (deletedMessage()) { <p role="status">{{deletedMessage()}}</p> }
      @if (loading()) {
        <p role="status">Loading your cases…</p>
      } @else if (problem()) {
        <div class="surface card" role="alert">
          <p>{{ problem() }}</p>
          <button mat-stroked-button type="button" (click)="load()">Try again</button>
        </div>
      } @else if (cases().length === 0) {
        <div class="surface card">
          <h2>No cases yet</h2>
          <p class="muted">Add your order and refund documents to start a case.</p>
          <a mat-stroked-button routerLink="/cases/new">Start a case</a>
        </div>
      } @else {
        <ul class="case-list" aria-label="Your cases">
          @for (item of cases(); track item.id) {
            <li>
              <article class="surface card">
                <div class="row heading-row">
                  <h2><a [routerLink]="['/cases', item.id]">{{ item.title }}</a></h2>
                  <span class="stage">{{ item.status }}</span>
                </div>
                <p class="muted">{{ item.merchant || 'Merchant not read yet' }} · {{ item.documentCount }} documents</p>
                <p><span class="eyebrow">Current step</span><br />{{ item.step || 'Next step not chosen yet' }}</p>
                @if (item.nextDate; as deadline) {
                  <p class="deadline">
                    <mat-icon aria-hidden="true">event</mat-icon>
                    <span>{{ deadline.label }}: {{ (deadline.date + 'T00:00:00Z') | date:'d MMM y':'UTC' }}{{ deadline.overdue ? ' · overdue' : '' }}</span>
                  </p>
                } @else {
                  <p class="muted">No pending date yet.</p>
                }
                <button mat-button type="button" [disabled]="deleting() !== null" [attr.aria-label]="'Delete ' + item.title" (click)="confirmDelete(item)">
                  {{ deleting() === item.id ? 'Deleting…' : 'Delete case' }}
                </button>
              </article>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .heading-row { justify-content: space-between; align-items: flex-start; }
    .case-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
    .card { padding: 20px; min-width: 0; }
    h2 { font-size: 1.35rem; overflow-wrap: anywhere; }
    h2 a { text-decoration-thickness: 1px; text-underline-offset: 4px; }
    .stage { padding: 4px 10px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); font-size: 0.8rem; font-weight: 600; }
    .deadline { display: flex; align-items: flex-start; gap: 8px; }
    .deadline mat-icon { flex: none; color: var(--ink-2); }
    .card p:last-child { margin-bottom: 0; }
  `,
})
export class MyCases {
  private readonly store = inject(CasesService);
  private readonly dialog=inject(MatDialog);
  private readonly element=inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector=inject(Injector);
  protected readonly deleting=signal<string|null>(null);
  protected readonly deleteProblem=signal('');protected readonly deletedMessage=signal('');
  protected async confirmDelete(item:CaseSummaryView):Promise<void> {
    if(this.deleting())return;
    const confirmed=await firstValueFrom(this.dialog.open<ConfirmDeleteCase,{title:string},boolean>(ConfirmDeleteCase,{data:{title:item.title},autoFocus:'#delete-cancel',maxWidth:'calc(100vw - 32px)',restoreFocus:true}).afterClosed());
    if(!confirmed||this.deleting())return;
    this.deleting.set(item.id);this.deleteProblem.set('');this.deletedMessage.set('');
    try {
      await this.store.deleteCase(item.id);this.cases.update(items=>items.filter(row=>row.id!==item.id));
      this.deletedMessage.set('The case, files and records were deleted.');
      afterNextRender(()=>this.element.nativeElement.querySelector<HTMLElement>('h1')?.focus(),{injector:this.injector});
    } catch(error) {this.deleteProblem.set(error instanceof Error?error.message:'Could not finish deleting. Retry Delete case.');}
    finally {this.deleting.set(null);}
  }
  protected readonly cases = signal<readonly CaseSummaryView[]>([]);
  protected readonly loading = signal(true);
  protected readonly problem = signal<string | null>(null);

  constructor() { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.problem.set(null);
    try {
      this.cases.set(await this.store.list());
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : 'Could not load your cases. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
