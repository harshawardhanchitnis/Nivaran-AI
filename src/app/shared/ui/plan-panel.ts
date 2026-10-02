import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DeadlineTimeline } from './deadline-timeline';
import { LadderTrack } from './ladder-track';
import type { PlanView } from './models';

/** The proposed next step: where the case stands, why, the dates, and the approval gate. */
@Component({
  selector: 'app-plan-panel',
  imports: [MatButtonModule, MatIconModule, LadderTrack, DeadlineTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="plan surface" aria-labelledby="plan-title">
      <div class="head">
        <p class="eyebrow">Recommended next step</p>
        <h2 id="plan-title" tabindex="-1">{{ plan().headline }}</h2>
        <p class="muted">{{ plan().summary }}</p>
      </div>

      <app-ladder-track [current]="plan().step" />

      <div class="columns">
        <div>
          <h3>Why this step</h3>
          <ul class="reasons">
            @for (reason of plan().reasons; track reason.text) {
              <li>
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <div>
                  <p>{{ reason.text }}</p>
                  @if (reason.sourceName) {
                    <p class="cite">
                      @if (reason.sourceUrl) {
                        <a [href]="reason.sourceUrl" target="_blank" rel="noopener">{{ reason.sourceName }}</a>
                      } @else {
                        {{ reason.sourceName }}
                      }
                      @if (reason.checkedOn) {
                        · checked {{ reason.checkedOn }}
                      }
                    </p>
                  }
                </div>
              </li>
            }
          </ul>
        </div>
        <div>
          <h3>Dates</h3>
          <app-deadline-timeline [items]="plan().timeline" />
        </div>
      </div>

      <p class="standing">
        <mat-icon aria-hidden="true">info</mat-icon>
        This order of steps is recommended practice, not a legal requirement, and Nivaran is not
        legal advice. Nothing is sent for you.
      </p>

      <div class="gate no-print">
        @if (approved()) {
          <p class="approved"><mat-icon aria-hidden="true">verified</mat-icon> You approved this plan.</p>
        } @else if (plan().step === 3) {
          <p>Information only. Nivaran prepares no complaint at this step.</p>
        } @else {
          @if (plan().step === 0) { <p>The promised date has not passed. There is nothing to send yet.</p> }
          @if (plan().waitingForReply) { <p>Your complaint is already recorded as sent. Wait for the dates, or record what happened.</p> }
          <button mat-flat-button type="button" [disabled]="busy()" (click)="approve.emit()">{{ plan().step === 0 || plan().waitingForReply ? 'Accept this waiting plan' : 'Approve and prepare the complaint' }}</button>
          <button mat-button type="button" [disabled]="busy()" (click)="edit.emit()">Request a change</button>
          <button mat-button type="button" [disabled]="busy()" (click)="decline.emit()">Reject this plan</button>
        }
      </div>
    </section>
  `,
  styles: `
    .plan {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .head p:last-child {
      margin: 0;
    }

    .columns {
      display: grid;
      gap: 20px;
    }

    h3 {
      margin-bottom: 10px;
    }

    .reasons {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }

    .reasons li {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 10px;
    }

    .reasons mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
      color: var(--brand);
    }

    .reasons p {
      margin: 0;
    }

    .cite {
      color: var(--ink-3);
      font-size: 0.8rem;
    }

    .standing {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 10px;
      margin: 0;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      background: var(--paper);
      color: var(--ink-2);
      font-size: 0.86rem;
    }

    .standing mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .gate {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }

    .approved {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--brand-ink);
      font-weight: 600;
    }

    @media (min-width: 760px) {
      .plan {
        padding: 28px;
      }

      .columns {
        grid-template-columns: 1.2fr 1fr;
        gap: 32px;
      }
    }
  `,
})
export class PlanPanel {
  readonly plan = input.required<PlanView>();
  readonly approved = input(false);
  readonly busy = input(false);
  readonly approve = output<void>();
  readonly decline = output<void>();
  readonly edit = output<void>();
}
