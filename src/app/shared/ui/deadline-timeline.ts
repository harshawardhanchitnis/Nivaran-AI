import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { TimelineItemView } from './models';

/** The case as dates: what happened, where today falls, and what is due next. */
@Component({
  selector: 'app-deadline-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline" aria-label="Timeline">
      @for (item of items(); track item.id) {
        <li [class]="item.tone">
          <span class="dot" aria-hidden="true"></span>
          <div>
            <p class="date">{{ item.date }}</p>
            <p class="label">{{ item.label }}</p>
            @if (item.note) {
              <p class="note">{{ item.note }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    li {
      position: relative;
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 12px;
      padding-bottom: 16px;
    }

    li:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 18px;
      bottom: -4px;
      width: 2px;
      background: var(--line);
    }

    li.upcoming:not(:last-child)::before,
    li.today:not(:last-child)::before {
      background: repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 8px);
    }

    .dot {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      border-radius: 50%;
      border: 2px solid var(--line-strong);
      background: var(--surface);
      z-index: 1;
    }

    .past .dot {
      background: var(--ink-3);
      border-color: var(--ink-3);
    }

    .overdue .dot {
      background: var(--st-conflict);
      border-color: var(--st-conflict);
    }

    .today .dot {
      background: var(--brand);
      border-color: var(--brand);
      box-shadow: 0 0 0 4px var(--brand-soft);
    }

    p {
      margin: 0;
    }

    .date {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--ink-3);
    }

    .label {
      font-weight: 600;
    }

    .note {
      color: var(--ink-2);
      font-size: 0.88rem;
    }

    .overdue .note {
      color: var(--st-conflict);
      font-weight: 600;
    }

    .today .label {
      color: var(--brand-ink);
    }
  `,
})
export class DeadlineTimeline {
  readonly items = input.required<readonly TimelineItemView[]>();
}
