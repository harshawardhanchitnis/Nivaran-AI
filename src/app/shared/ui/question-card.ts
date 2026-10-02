import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { QuestionView } from './models';

/** A question from the agent. Answerable with one tap. */
@Component({
  selector: 'app-question-card',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="question-title">
      <p class="eyebrow"><mat-icon aria-hidden="true">help</mat-icon> Nivaran needs one answer</p>
      <h2 id="question-title">{{ question().prompt }}</h2>
      <p class="why">{{ question().why }}</p>
      <div class="options">
        @for (option of question().options; track option.id) {
          <button type="button" class="option" (click)="answered.emit(option.id)">
            <span class="label">{{ option.label }}</span>
            @if (option.hint) {
              <span class="hint">{{ option.hint }}</span>
            }
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .card {
      padding: 18px;
      border-radius: var(--radius);
      background: linear-gradient(180deg, #fff8ea 0%, #fffdf8 100%);
      border: 1px solid #f0d9a8;
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

    @media (min-width: 640px) {
      .options {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
    }
  `,
})
export class QuestionCard {
  readonly question = input.required<QuestionView>();
  /** Emits the id of the chosen option. */
  readonly answered = output<string>();
}
