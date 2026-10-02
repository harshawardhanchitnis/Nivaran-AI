import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LADDER_STEPS, LADDER_STEP_LABELS, type LadderStep } from '@shared/ladder';

/** The four escalation steps, with the current one marked. */
@Component({
  selector: 'app-ladder-track',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="track" aria-label="Escalation steps">
      @for (step of steps; track step) {
        <li
          [class.done]="step < current()"
          [class.current]="step === current()"
          [attr.aria-current]="step === current() ? 'step' : null"
        >
          <span class="marker">
            @if (step < current()) {
              <mat-icon aria-hidden="true">check</mat-icon>
            } @else {
              {{ step }}
            }
          </span>
          <span class="label">
            {{ labels[step] }}
            @if (step === current()) {
              <span class="here">You are here</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: `
    .track {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    li {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--ink-3);
    }

    .marker {
      flex: none;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1.5px solid var(--line-strong);
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 500;
    }

    .marker mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .label {
      font-size: 0.92rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .done {
      color: var(--ink-2);
    }

    .done .marker {
      background: var(--brand-soft);
      border-color: transparent;
      color: var(--brand);
    }

    .current {
      color: var(--ink);
    }

    .current .marker {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
      box-shadow: 0 0 0 4px var(--brand-soft);
    }

    .current .label {
      font-weight: 600;
    }

    .here {
      display: block;
      color: var(--brand);
      font-size: 0.75rem;
      font-weight: 600;
    }

    @media (min-width: 760px) {
      .track {
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
      }

      li {
        position: relative;
        flex-direction: column;
        align-items: flex-start;
        padding-right: 12px;
      }

      /* The rail between markers. */
      li:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 15px;
        left: 38px;
        right: 8px;
        height: 2px;
        background: var(--line);
      }

      li.done:not(:last-child)::after {
        background: var(--brand);
      }
    }
  `,
})
export class LadderTrack {
  readonly current = input.required<LadderStep>();
  protected readonly steps = LADDER_STEPS;
  protected readonly labels = LADDER_STEP_LABELS;
}
