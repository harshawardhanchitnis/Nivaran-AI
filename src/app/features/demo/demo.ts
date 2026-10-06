import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';
import type { FactView } from '../../shared/ui/models';
import type { DraftRow } from '@shared/database';
import { draftPresentation, draftStatements, baseDraftFlags } from '../../core/workspace-draft';
import { DraftEditor } from '../../shared/ui/draft-editor';
import { demoBasicDraft, demoDraftContext } from './demo-draft';
import {
  SAMPLE_ACTIVITY_AFTER,
  SAMPLE_ACTIVITY_BEFORE,
  SAMPLE_CASE,
  SAMPLE_FACTS,
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
  imports: [MatButtonModule, MatIconModule, CaseWorkspaceView, DraftEditor],
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
      [draftId]="draftRow()?.id ?? null"
      [customDraft]="true"
      [practice]="true"
      (answered)="onAnswered($event)"
      (approve)="onApprove()"
      (decline)="resetReview('You rejected the practice plan. Start again to explore a different choice.')"
      (edit)="resetReview('Practice restarted so you can choose a different amount. A real case saves your requested change separately.')"
    >
      <p banner class="banner">
        <mat-icon aria-hidden="true">science</mat-icon>
        <span>
          <strong>Interactive practice case.</strong> Invented documents from a fictional seller.
          No model calls or account. Changes last only until you leave or restart.
          @if (practiceMessage()) { <span role="status">{{ practiceMessage() }}</span> }
          <button type="button" class="link" (click)="reset()">Start again</button>
        </span>
      </p>

      @if (draftRow(); as letter) {
        <app-draft-editor complaint-editor [draft]="letter" [context]="draftContext()" [practice]="true" (saveRequested)="savePractice($event)" (copyRequested)="copyPractice($event)" (printRequested)="printPractice()" />
      }
      <div draft-tools class="tools no-print">
        @if (approved() && !draftRow()) {
          <p>This invented practice uses the real basic-complaint renderer and edit linter, without AI wording.</p>
          <button mat-flat-button type="button" (click)="preparePractice()">Prepare practice complaint without AI</button>
        }
        @if (draftRow()) { <p>Try adding FAKE123456 in the editor. The real linter will flag it; review, remove it or keep it as Your statement.</p> }
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
  protected readonly question = { ...SAMPLE_QUESTION, options: SAMPLE_QUESTION.options.map(option => {
    if (option.id === 'unsure') return { ...option, hint:'Keep the conflict open while you compare the sources.' };
    const source = SAMPLE_FACTS.find(f => f.field === 'refund_amount')?.sources[option.id === 'chat' ? 1 : 0];
    return { ...option, sources:source ? [{ evidence:source.evidence,documentName:source.documentName,page:source.page,quote:source.quote }] : [] };
  }) };
  protected readonly plan = SAMPLE_PLAN;

  private readonly view = viewChild.required(CaseWorkspaceView);

  /** The option chosen for the refund-amount question, once answered. */
  protected readonly answer = signal<string | null>(null);
  protected readonly approved = signal(false);
  protected readonly draftRow = signal<DraftRow | null>(null);
  protected readonly practiceMessage = signal('');
  protected readonly draftContext = computed(() => demoDraftContext(this.facts()));

  protected readonly stage = computed(() => {
    if (this.draftRow()) return 'Practice complaint ready';
    if (this.approved()) return 'Plan approved';
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
        status: 'user' as const,
        sources: [],
        note: 'Your choice is Your statement; it does not establish which document is correct.',
      };
    });
  });

  protected readonly activity = computed(() =>
    this.answer() ? [...SAMPLE_ACTIVITY_BEFORE, ...SAMPLE_ACTIVITY_AFTER] : SAMPLE_ACTIVITY_BEFORE,
  );

  protected readonly draft = computed(() => {
    const draft = this.draftRow();
    return draft ? draftPresentation(draft, draft.rendered_md ?? '', this.draftContext(), {name:'',contact:'',address:''}, draftStatements(draft)).segments : null;
  });

  protected onAnswered(optionId: string): void {
    if (optionId === 'unsure') { this.practiceMessage.set('The conflict stays open. Compare the source quotes before choosing an amount.'); return; }
    this.answer.set(optionId);
    this.view().tab.set('plan');
  }

  protected onApprove(): void {
    this.approved.set(true);
    this.view().tab.set('complaint');
  }
  protected preparePractice(): void { if (this.approved() && !this.draftRow()) this.draftRow.set(demoBasicDraft(this.draftContext())); }
  protected savePractice(edit: {text:string;userStatements:string[]}): void {
    const previous = this.draftRow(); if (!previous) return;
    this.draftRow.set({...previous,id:`demo-draft-${previous.version + 1}`,version:previous.version + 1,rendered_md:edit.text,edited_by_user:true,
      lint:{...previous.lint,userStatements:edit.userStatements,flags:baseDraftFlags(previous,edit.text,this.draftContext(),edit.userStatements)}});
    this.practiceMessage.set('Practice edit saved in this page only. It disappears when you leave or restart.');
  }
  protected async copyPractice(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); this.practiceMessage.set('Practice text copied. It uses fictional facts.'); }
    catch { this.practiceMessage.set('Copy was unavailable. Select and copy the text manually.'); }
  }
  protected printPractice(): void { window.print(); }

  protected reset(): void {
    this.answer.set(null);
    this.approved.set(false);
    this.draftRow.set(null);
    this.practiceMessage.set('');
    this.view().tab.set('facts');
  }
  protected resetReview(message: string): void { this.reset(); this.practiceMessage.set(message); }
}
