import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type { QuestionView } from './models';

/** A question from the agent. Answerable with one tap. */
@Component({
  selector: 'app-question-card',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" [attr.aria-labelledby]="'question-title-' + question().id" [attr.aria-busy]="busy()">
      <p class="eyebrow"><mat-icon aria-hidden="true">help</mat-icon> {{ readOnly() ? 'Question from the saved run' : 'Nivaran needs one answer' }}</p>
      <h2 [id]="'question-title-' + question().id">{{ question().prompt }}</h2>
      <p class="why">{{ question().why }}</p>
      <div class="options">
        @for (option of question().options; track option.id) {
          <button type="button" class="option" [disabled]="busy() || readOnly()" (click)="answered.emit(option.id)">
            <span class="label">{{ option.label }}</span>
            @if (option.hint) {
              <span class="hint">{{ option.hint }}</span>
            }
            @for (source of option.sources ?? []; track $index) {
              <span class="hint">{{ source.evidence }} · {{ source.documentName }}{{ source.page ? ' · page ' + source.page : '' }}</span>
              <q class="excerpt">{{ source.quote }}</q>
            }
          </button>
        }
      </div>
      @if (question().options.length === 0 && !readOnly() && !question().documentRequest) {
        <form (submit)="submitText($event)">
          <label [for]="'question-answer-' + question().id">Your answer</label>
          <textarea [id]="'question-answer-' + question().id" [formControl]="text" maxlength="4000" rows="3" [readOnly]="busy()"></textarea>
          <button type="submit" class="option" [disabled]="busy() || !text.value.trim()">Save answer and continue</button>
        </form>
      }
      @if (busy()) { <p role="status">Saving your answer…</p> }
    </section>
  `,
  styles: `
    .card {
      padding: 18px;
      border-radius: var(--radius);
      background: var(--st-needs_check-bg);
      border: 1px solid var(--line-strong);
      box-shadow: var(--shadow-1);
    }

    .eyebrow {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--st-needs_check);
    }

    .eyebrow mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    h2 {
      font-size: 1.3rem;
    }

    .why {
      color: var(--ink-2);
    }

    .options {
      display: grid;
      gap: 10px;
    }

    .option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 14px;
      min-height: 52px;
      border: 1.5px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    }

    .option:hover {
      border-color: var(--brand);
      box-shadow: var(--shadow-1);
      transform: translateY(-1px);
    }

    .label {
      font-size: 1.02rem;
      font-weight: 600;
    }

    .hint {
      color: var(--ink-2);
      font-size: 0.85rem;
    }
    .excerpt { font-size: .9rem; font-weight: 400; color: var(--ink); overflow-wrap: anywhere; }
    form { display: grid; gap: 10px; margin-top: 12px; }
    textarea { width: 100%; padding: 12px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); color: var(--ink); background: var(--surface); font: inherit; resize: vertical; }
    .option:disabled { cursor: default; opacity: 0.7; }

    @media (min-width: 640px) {
      .options {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
    }
  `,
})
export class QuestionCard {
  readonly question = input.required<QuestionView>();
  readonly busy = input(false);
  readonly readOnly = input(false);
  /** Emits the id of the chosen option. */
  readonly answered = output<string>();
  readonly textAnswered = output<string>();
  protected readonly text = new FormControl('', { nonNullable: true });
  constructor() {
    let previousId: string | undefined;
    effect(() => {
      const id = this.question().id;
      if (id !== previousId) { this.text.reset(''); previousId = id; }
    });
  }
  protected submitText(event: Event): void {
    event.preventDefault(); const value = this.text.value.trim();
    if (!this.busy() && !this.readOnly() && value) this.textAnswered.emit(value);
  }
}
