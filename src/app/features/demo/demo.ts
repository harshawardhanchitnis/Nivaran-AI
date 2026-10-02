import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';
import type { FactView } from '../../shared/ui/models';
import {
  SAMPLE_ACTIVITY_AFTER,
  SAMPLE_ACTIVITY_BEFORE,
  SAMPLE_CASE,
  SAMPLE_DRAFT,
  SAMPLE_FACTS,
  SAMPLE_FLAG,
  SAMPLE_PLAN,
  SAMPLE_QUESTION,
} from './sample-case';

/**
 * /demo: the full case screen driven by invented sample data, with no sign-in and no model calls.
 * It is the visual reference for the real case screen and a safe way to try the flow:
 * answer the question, approve the plan, read the complaint.
 */
@Component({
  selector: 'app-demo',
  imports: [MatButtonModule, MatIconModule, CaseWorkspaceView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-case-workspace-view
      [heading]="sample.title"
      [merchant]="sample.merchant"
      [documentCount]="sample.documents.length"
      [stage]="stage()"
      [facts]="facts()"
      [activity]="activity()"
      [question]="answer() ? null : question"
      [plan]="answer() ? plan : null"
      [approved]="approved()"
      [draft]="draft()"
      (answered)="onAnswered($event)"
      (approve)="onApprove()"
    >
      <p banner class="banner">
        <mat-icon aria-hidden="true">science</mat-icon>
        <span>
          <strong>Sample case.</strong> Invented documents from a fictional seller. Nothing here was
          produced by a model, and nothing is saved.
          <button type="button" class="link" (click)="reset()">Start again</button>
        </span>
      </p>

      <div draft-tools class="tools">
        <button mat-stroked-button type="button" (click)="fake.set(!fake())">
          <mat-icon aria-hidden="true">bug_report</mat-icon>
          {{ fake() ? 'Remove the made-up ID' : 'Try typing a made-up transaction ID' }}
        </button>
      </div>
    </app-case-workspace-view>
  `,
  styles: `
    .banner {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 10px;
      margin: 0;
      padding: 10px 14px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink-2);
      font-size: 0.88rem;
    }

    .banner mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .link {
      padding: 0;
      border: 0;
      background: none;
      color: var(--brand);
      font: inherit;
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
    }

    .tools {
      margin-top: 16px;
    }
  `,
})
export class Demo {
  protected readonly sample = SAMPLE_CASE;
  protected readonly question = SAMPLE_QUESTION;
  protected readonly plan = SAMPLE_PLAN;

  private readonly view = viewChild.required(CaseWorkspaceView);

  /** The option chosen for the refund-amount question, once answered. */
  protected readonly answer = signal<string | null>(null);
  protected readonly approved = signal(false);
  protected readonly fake = signal(false);

  protected readonly stage = computed(() => {
    if (this.approved()) {
      return 'Complaint ready';
    }
    return this.answer() ? 'Plan ready for your approval' : 'Needs your answer';
  });

  protected readonly facts = computed<readonly FactView[]>(() => {
    const answer = this.answer();
    if (!answer) {
      return SAMPLE_FACTS;
    }
    return SAMPLE_FACTS.map((fact) => {
      if (fact.field !== 'refund_amount') {
        return fact;
      }
      const chosen = answer === 'chat' ? fact.sources[1] : fact.sources[0];
      return {
        ...fact,
        value: chosen?.value ?? fact.value,
        status: 'document' as const,
        sources: chosen ? [chosen] : fact.sources,
        note:
          answer === 'unsure'
            ? 'You were not sure, so the complaint asks for the full amount the seller confirmed.'
            : 'You confirmed this amount.',
      };
    });
  });

  protected readonly activity = computed(() =>
    this.answer() ? [...SAMPLE_ACTIVITY_BEFORE, ...SAMPLE_ACTIVITY_AFTER] : SAMPLE_ACTIVITY_BEFORE,
  );

  protected readonly draft = computed(() => {
    if (!this.approved()) {
      return null;
    }
    // Keep the letter in step with the answer: the refund amount comes from the chosen source.
    const base =
      this.answer() === 'chat'
        ? SAMPLE_DRAFT.map((segment) =>
            segment.kind === 'value' && segment.text === '₹9,999' && segment.evidence === 'E02'
              ? { ...segment, text: '₹8,999', evidence: 'E03' }
              : segment,
          )
        : SAMPLE_DRAFT;
    return this.fake() ? [...base, ...SAMPLE_FLAG] : base;
  });

  protected onAnswered(optionId: string): void {
    this.answer.set(optionId);
    this.view().tab.set('plan');
  }

  protected onApprove(): void {
    this.approved.set(true);
    this.view().tab.set('complaint');
  }

  protected reset(): void {
    this.answer.set(null);
    this.approved.set(false);
    this.fake.set(false);
    this.view().tab.set('facts');
  }
}
