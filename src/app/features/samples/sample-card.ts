import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import type { SampleCard as SampleCardData } from './sample-catalogue';

/** A saved run as a clickable card. */
@Component({
  selector: 'app-sample-card',
  imports: [RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="card surface" [routerLink]="['/samples', sample().id]">
      <span class="top">
        <span class="icon"><mat-icon aria-hidden="true">{{ sample().icon }}</mat-icon></span>
        <span [class]="'outcome ' + sample().tone">{{ sample().outcome }}</span>
      </span>
      <span class="title">{{ sample().title }}</span>
      <span class="desc">{{ sample().description }}</span>
      @if (detailed()) {
        <ul>
          @for (line of sample().shows; track line) {
            <li><mat-icon aria-hidden="true">check</mat-icon>{{ line }}</li>
          }
        </ul>
      }
      <span class="open">Open saved run <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
    </a>
  `,
  styles: `
    :host { display: block; }

    .card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      padding: 18px;
      color: inherit;
      text-decoration: none;
      transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
    }

    .card:hover {
      transform: translateY(-2px);
      border-color: var(--brand);
      box-shadow: var(--shadow-2);
    }

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--brand-soft);
      color: var(--brand);
    }

    .outcome {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-align: right;
    }

    .good { background: var(--st-document-bg); color: var(--st-document); }
    .mixed { background: var(--st-needs_check-bg); color: var(--st-needs_check); }
    .neutral { background: var(--st-missing-bg); color: var(--st-missing); }

    .title {
      margin-top: 4px;
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 560;
    }

    .desc {
      color: var(--ink-2);
      font-size: 0.9rem;
    }

    ul {
      list-style: none;
      display: grid;
      gap: 4px;
      margin: 4px 0 0;
      padding: 0;
      font-size: 0.86rem;
    }

    li {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 6px;
    }

    li mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--brand);
    }

    .open {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
      padding-top: 8px;
      color: var(--brand);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .open mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
  `,
})
export class SampleCard {
  readonly sample = input.required<SampleCardData>();
  /** Show the "what it shows" list. */
  readonly detailed = input(false);
}
