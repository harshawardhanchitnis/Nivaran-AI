import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import type { SentPlanView } from './models';
import { normaliseDate } from '@shared/normalise';
import { COMPLAINT_DATE_BASIS } from '../../core/workspace-plan';
@Component({
  selector: 'app-sent-panel',
  imports: [ReactiveFormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="surface sent-panel no-print" aria-labelledby="sent-title">
    <h2 id="sent-title">
      {{ plan().sentOn ? 'You recorded sending this complaint' : 'After you send it yourself' }}
    </h2>
    <p>
      Nivaran does not send or file anything. Record the date only after you have sent the complaint
      to the merchant's grievance officer. This is saved as Your statement.
    </p>
    <label for="complaint-sent-on">Date you sent the complaint</label
    ><input id="complaint-sent-on" type="date" [max]="today()" [formControl]="sentOn" />
    @if (invalid()) {
      <p class="invalid" role="alert">Use a valid date on or before today in India.</p>
    }
    <p>{{ dateBasis }}</p>
    @if (plan().sentOn) {
      <p>
        Acknowledge by <strong>{{ plan().acknowledgeBy }}</strong
        >; resolve by <strong>{{ plan().resolveBy }}</strong
        >.
      </p>
    }
    <div class="actions">
      <button
        mat-flat-button
        type="button"
        [disabled]="busy() || invalid()"
        (click)="recordRequested.emit(sentOn.value)"
      >
        {{ busy() ? 'Saving…' : plan().sentOn ? 'Save corrected date' : 'Mark as sent' }}
      </button>
      @if (plan().sentOn) {
        <button mat-stroked-button type="button" (click)="calendarRequested.emit()">
          Add dates to calendar
        </button>
      }
    </div>
  </section>`,
  styles: `
    .sent-panel {
      padding: 20px;
      margin-top: 24px;
      display: grid;
      gap: 10px;
    }
    label {
      font-weight: 600;
    }
    input {
      width: 100%;
      max-width: 280px;
      padding: 12px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .invalid {
      color: var(--st-conflict);
    }
  `,
})
export class SentPanel {
  readonly plan = input.required<SentPlanView>();
  readonly today = input.required<string>();
  readonly busy = input(false);
  readonly recordRequested = output<string>();
  readonly calendarRequested = output<void>();
  protected readonly dateBasis = COMPLAINT_DATE_BASIS;
  protected readonly sentOn = new FormControl('', { nonNullable: true });
  private readonly value = toSignal(this.sentOn.valueChanges, { initialValue: '' });
  protected readonly invalid = computed(
    () =>
      normaliseDate(this.value()) !== this.value() || !this.value() || this.value() > this.today(),
  );
  constructor() {
    effect(() => this.sentOn.setValue(this.plan().sentOn ?? this.today()));
  }
}
