import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { ActivityKind, ActivityView } from './models';

const ICONS: Record<ActivityKind, string> = {
  read: 'description',
  check: 'fact_check',
  found: 'search',
  ask: 'help',
  answer: 'reply',
  search: 'menu_book',
  decide: 'alt_route',
  plan: 'flag',
  error: 'error',
};

/** What the agent actually did, in order, in plain words. */
@Component({
  selector: 'app-activity-log',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="log" aria-label="What Nivaran did">
      @for (item of items(); track item.id) {
        <li [class]="'item ' + item.kind">
          <span class="dot"><mat-icon aria-hidden="true">{{ icons[item.kind] }}</mat-icon></span>
          <div class="body">
            <p class="title">{{ item.title }}</p>
            @if (item.detail) {
              <p class="detail">{{ item.detail }}</p>
            }
          </div>
          <time>{{ item.time }}</time>
        </li>
      }
      @if (busy()) {
        <li class="item working">
          <span class="dot"><span class="pulse"></span></span>
          <div class="body"><p class="title">Working on the next step…</p></div>
        </li>
      }
    </ol>
  `,
  styles: `
    .log {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .item {
      position: relative;
      display: grid;
      grid-template-columns: 34px 1fr auto;
      gap: 12px;
      padding-bottom: 18px;
    }

    /* The line that joins one step to the next. */
    .item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 16px;
      top: 34px;
      bottom: 0;
      width: 2px;
      background: var(--line);
    }

    .dot {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--surface);
      border: 1px solid var(--line-strong);
      color: var(--ink-2);
    }

    .dot mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .ask .dot,
    .found .dot {
      background: var(--st-conflict-bg);
      border-color: transparent;
      color: var(--st-conflict);
    }

    .answer .dot {
      background: var(--st-user-bg);
      border-color: transparent;
      color: var(--st-user);
    }

    .plan .dot,
    .decide .dot {
      background: var(--brand);
      border-color: transparent;
      color: #fff;
    }

    .error .dot {
      background: var(--st-conflict);
      border-color: transparent;
      color: #fff;
    }

    .title {
      margin: 6px 0 0;
      font-weight: 600;
    }

    .detail {
      margin: 2px 0 0;
      color: var(--ink-2);
      font-size: 0.9rem;
    }

    time {
      margin-top: 8px;
      color: var(--ink-3);
      font-family: var(--font-mono);
      font-size: 0.72rem;
    }

    .pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--brand);
      animation: pulse 1.2s ease-in-out infinite;
    }

    .working .title {
      color: var(--ink-2);
      font-weight: 500;
    }

    @keyframes pulse {
      50% {
        transform: scale(1.6);
        opacity: 0.35;
      }
    }
  `,
})
export class ActivityLog {
  readonly items = input.required<readonly ActivityView[]>();
  /** Shows a "working" row at the end while a step is running. */
  readonly busy = input(false);
  protected readonly icons = ICONS;
}
