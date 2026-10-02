import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { FactField } from '@shared/facts';

import { ActivityLog } from './activity-log';
import { ComplaintDraft } from './complaint-draft';
import { FactList } from './fact-list';
import type { ActivityView, DraftSegment, FactView, PlanView, QuestionView } from './models';
import { PlanPanel } from './plan-panel';
import { QuestionCard } from './question-card';
import { SourcePanel } from './source-panel';

type Tab = 'facts' | 'activity' | 'plan' | 'complaint';

/**
 * The whole case screen as one presentational component: header, tabs, fact sheet with its
 * source panel, activity log, plan with the approval gate, and the complaint.
 *
 * It holds only view state (which tab, which fact is open). Give it data, listen to its events.
 * features/demo drives it with sample data; the real case screen drives it with database rows.
 */
@Component({
  selector: 'app-case-workspace-view',
  imports: [A11yModule, MatButtonModule, MatIconModule, FactList, SourcePanel, ActivityLog, QuestionCard, PlanPanel, ComplaintDraft],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="case-head">
      <p class="eyebrow">Case</p>
      <h1>{{ heading() }}</h1>
      <p class="meta">
        <span><mat-icon aria-hidden="true">storefront</mat-icon>{{ merchant() }}</span>
        <span><mat-icon aria-hidden="true">attach_file</mat-icon>{{ documentCount() }} documents</span>
        <span class="stage">{{ stage() }}</span>
      </p>
    </header>

    <ng-content select="[banner]" />

    <div class="tabs no-print" role="tablist" aria-label="Case sections">
      @for (item of tabs; track item.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="tab() === item.id"
          [attr.aria-selected]="tab() === item.id"
          [attr.id]="'case-tab-' + item.id"
          [attr.aria-controls]="'case-panel-' + item.id"
          [attr.tabindex]="tab() === item.id ? 0 : -1"
          (click)="selectTab(item.id)"
          (keydown)="tabKey($event, item.id)"
        >
          {{ item.label }}
          @if (item.id === 'facts' && attention() > 0) {
            <span class="badge" [attr.aria-label]="attention() + ' need attention'">{{ attention() }}</span>
          }
        </button>
      }
    </div>

    @switch (tab()) {
      @case ('facts') {
        <div class="split" role="tabpanel" id="case-panel-facts" aria-labelledby="case-tab-facts">
          <div class="stack">
            @if (question(); as open) {
              <app-question-card [question]="open" [busy]="answerBusy()" (answered)="answered.emit($event)" (textAnswered)="textAnswered.emit($event)" />
            }
            <app-fact-list [facts]="facts()" [selected]="selectedField()" (factSelected)="openSource($event)" />
          </div>

          <aside class="source" [class.open]="selectedFact() !== null">
            @if (selectedFact(); as fact) {
              <button type="button" class="backdrop" tabindex="-1" aria-label="Close source" (click)="closeSource()"></button>
              <app-source-panel class="sheet" [fact]="fact" [attr.role]="phone() ? 'dialog' : 'region'"
                [attr.aria-modal]="phone() ? 'true' : null" aria-label="Fact source"
                cdkTrapFocus [cdkTrapFocus]="phone()" [cdkTrapFocusAutoCapture]="phone()"
                (keydown.escape)="closeSource()" (closed)="closeSource()" (retry)="sourceRetry.emit($event)" />
            } @else {
              <div class="hint surface">
                <mat-icon aria-hidden="true">touch_app</mat-icon>
                <p>Tap any fact to see the document and the exact words it comes from.</p>
              </div>
            }
          </aside>
        </div>
      }
      @case ('activity') {
        <div class="narrow-panel surface pad" role="tabpanel" id="case-panel-activity" aria-labelledby="case-tab-activity">
          <h2>What Nivaran did</h2>
          <p class="muted">Every step, in order. Nothing here was sent to anyone.</p>
          <app-activity-log [items]="activity()" [busy]="busy()" />
        </div>
      }
      @case ('plan') {
        <div role="tabpanel" id="case-panel-plan" aria-labelledby="case-tab-plan">
          @if (plan(); as current) {
            <app-plan-panel [plan]="current" [approved]="approved()" (approve)="approve.emit()" (decline)="decline.emit()" />
          } @else {
            <div class="empty surface">
              <mat-icon aria-hidden="true">hourglass_empty</mat-icon>
              <h2>No plan yet</h2>
              <p class="muted">The next step appears here after Nivaran has enough facts. Check progress on the Facts tab.</p>
              <button mat-stroked-button type="button" (click)="selectTab('facts')">Go to Facts</button>
            </div>
          }
        </div>
      }
      @case ('complaint') {
        <div class="narrow-panel" role="tabpanel" id="case-panel-complaint" aria-labelledby="case-tab-complaint">
          @if (draft(); as segments) {
            <app-complaint-draft [segments]="segments" />
            <ng-content select="[draft-tools]" />
          } @else {
            <div class="empty surface">
              <mat-icon aria-hidden="true">edit_note</mat-icon>
              <h2>Nothing drafted yet</h2>
              <p class="muted">The complaint is prepared only after you approve the plan.</p>
              <button mat-stroked-button type="button" (click)="selectTab('plan')">Go to Plan</button>
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .case-head {
      margin-bottom: 16px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 16px;
      margin: 0;
      color: var(--ink-2);
      font-size: 0.92rem;
    }

    .meta span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .meta mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .stage {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--brand-soft);
      color: var(--brand-ink);
      font-weight: 600;
      font-size: 0.8rem;
    }

    .tabs {
      position: sticky;
      top: 56px;
      z-index: 4;
      display: flex;
      gap: 4px;
      margin: 16px calc(var(--page-gutter) * -1) 16px;
      padding: 8px var(--page-gutter);
      background: color-mix(in srgb, var(--paper) 92%, transparent);
      backdrop-filter: blur(8px);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--ink-2);
      font-size: 0.92rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }

    .tab:hover {
      background: #efece4;
    }

    .tab.active {
      background: var(--ink);
      color: #fff;
    }

    .badge {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--st-conflict);
      color: #fff;
      font-size: 0.72rem;
      line-height: 20px;
      text-align: center;
    }

    .split {
      display: grid;
      gap: 16px;
    }

    .pad {
      padding: 20px;
    }

    .narrow-panel {
      max-width: 760px;
    }

    .hint {
      display: none;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      max-width: 760px;
      padding: 28px 22px;
    }

    .empty > mat-icon {
      color: var(--ink-3);
    }

    /* Phones: the source opens as a sheet from the bottom. */
    .source.open {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: flex-end;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      border: 0;
      background: rgb(21 26 45 / 45%);
      cursor: pointer;
    }

    .sheet {
      position: relative;
      width: 100%;
      max-height: 82dvh;
      overflow-y: auto;
      border-radius: 20px 20px 0 0;
      box-shadow: var(--shadow-2);
      animation: rise 180ms ease-out;
    }

    @keyframes rise {
      from {
        transform: translateY(24px);
        opacity: 0;
      }
    }

    /* Wide screens: the source sits beside the facts. */
    @media (min-width: 1000px) {
      .split {
        grid-template-columns: minmax(0, 1fr) 400px;
        align-items: start;
        gap: 24px;
      }

      .source,
      .source.open {
        position: sticky;
        inset: auto;
        top: 124px;
        display: block;
        z-index: auto;
      }

      .backdrop {
        display: none;
      }

      .sheet {
        max-height: none;
        border-radius: 0;
        box-shadow: none;
        animation: none;
      }

      .hint {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 20px;
        color: var(--ink-2);
      }

      .hint p {
        margin: 0;
      }
    }
  `,
})
export class CaseWorkspaceView {
  readonly heading = input.required<string>();
  readonly merchant = input.required<string>();
  readonly documentCount = input.required<number>();
  /** Short status in plain words: "Needs your answer", "Plan ready". */
  readonly stage = input.required<string>();
  readonly facts = input.required<readonly FactView[]>();
  readonly activity = input.required<readonly ActivityView[]>();
  readonly busy = input(false);
  readonly question = input<QuestionView | null>(null);
  readonly answerBusy = input(false);
  readonly plan = input<PlanView | null>(null);
  readonly approved = input(false);
  readonly draft = input<readonly DraftSegment[] | null>(null);

  /** The id of the option the user chose for the open question. */
  readonly answered = output<string>();
  readonly textAnswered = output<string>();
  readonly approve = output<void>();
  readonly decline = output<void>();
  readonly sourceRequested = output<FactField>();
  readonly sourceRetry = output<string>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly breakpoint = toSignal(inject(BreakpointObserver).observe('(max-width: 999px)'));
  protected readonly phone = computed(() => this.breakpoint()?.matches ?? false);

  protected readonly tabs: readonly { id: Tab; label: string }[] = [
    { id: 'facts', label: 'Facts' },
    { id: 'activity', label: 'Activity' },
    { id: 'plan', label: 'Plan' },
    { id: 'complaint', label: 'Complaint' },
  ];
  readonly tab = signal<Tab>('facts');
  constructor() {
    let previous: string | null = null;
    effect(() => {
      const question = this.question();
      if (question && question.id !== previous) {
        this.tab.set('facts');
        afterNextRender(() => { const heading = this.element.nativeElement.querySelector<HTMLElement>('app-question-card h2'); heading?.setAttribute('tabindex', '-1'); heading?.focus(); }, { injector: this.injector });
      } else if (!question && previous) {
        afterNextRender(() => this.element.nativeElement.querySelector<HTMLButtonElement>('#case-tab-facts')?.focus(), { injector: this.injector });
      }
      previous = question?.id ?? null;
    });
  }
  protected readonly selectedField = signal<FactField | null>(null);

  protected readonly selectedFact = computed(
    () => this.facts().find((fact) => fact.field === this.selectedField()) ?? null,
  );
  /** Facts the user should look at: conflicts and unconfirmed readings. */
  protected readonly attention = computed(
    () => this.facts().filter((fact) => fact.status === 'conflict' || fact.status === 'needs_check').length,
  );

  protected openSource(field: FactField): void {
    this.selectedField.set(field);
    this.sourceRequested.emit(field);
    afterNextRender(() => this.element.nativeElement.querySelector<HTMLButtonElement>('app-source-panel button[aria-label="Close source"]')?.focus(), { injector: this.injector });
  }

  protected closeSource(): void {
    const field = this.selectedField();
    this.selectedField.set(null);
    if (field) this.element.nativeElement.querySelector<HTMLButtonElement>(`[data-fact-field="${field}"]`)?.focus();
  }

  protected selectTab(tab: Tab): void { this.selectedField.set(null); this.tab.set(tab); }

  protected tabKey(event: KeyboardEvent, tab: Tab): void {
    const index = this.tabs.findIndex(item => item.id === tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % this.tabs.length
      : event.key === 'ArrowLeft' ? (index + this.tabs.length - 1) % this.tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = this.tabs[next]!.id;
    this.selectTab(target);
    this.element.nativeElement.querySelector<HTMLButtonElement>(`#case-tab-${target}`)?.focus();
  }
}
