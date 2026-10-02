import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { FactField } from '@shared/facts';

import { EvidenceTag } from './evidence-tag';
import type { FactView } from './models';
import { StatusChip } from './status-chip';

/** The fact sheet. Every row is a button that opens where the value came from. */
@Component({
  selector: 'app-fact-list',
  imports: [MatIconModule, StatusChip, EvidenceTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="facts surface">
      @for (fact of facts(); track fact.field) {
        <li>
          <button
            type="button"
            class="fact"
            [class.selected]="fact.field === selected()"
            [attr.aria-pressed]="fact.field === selected()"
            [attr.data-fact-field]="fact.field"
            (click)="factSelected.emit(fact.field)"
          >
            <span class="main">
              <span class="eyebrow">{{ fact.label }}</span>
              @if (fact.value) {
                <span class="value">{{ fact.value }}</span>
              } @else {
                <span class="value empty">Not found yet</span>
              }
              @if (fact.note) {
                <span class="note">{{ fact.note }}</span>
              }
            </span>
            <span class="meta">
              <app-status-chip [status]="fact.status" />
              <span class="tags">
                @for (source of fact.sources; track source.id ?? source.evidence) {
                  <app-evidence-tag [label]="source.evidence" />
                }
              </span>
            </span>
            <mat-icon class="chevron" aria-hidden="true">chevron_right</mat-icon>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .facts {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    li + li {
      border-top: 1px solid var(--line);
    }

    .fact {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas: 'main chevron' 'meta chevron';
      gap: 8px 8px;
      align-items: center;
      width: 100%;
      padding: 14px 12px 14px 16px;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 120ms ease;
    }

    .fact:hover {
      background: #faf9f5;
    }

    .fact.selected {
      background: var(--highlight-soft);
      box-shadow: inset 3px 0 0 var(--brand);
    }

    .fact:focus-visible {
      outline-offset: -2px;
    }

    .main {
      grid-area: main;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .eyebrow {
      margin: 0 0 2px;
    }

    .value {
      font-size: 1.02rem;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .value.empty {
      color: var(--ink-3);
      font-weight: 500;
      font-style: italic;
    }

    .note {
      margin-top: 2px;
      color: var(--ink-2);
      font-size: 0.85rem;
    }

    .meta {
      grid-area: meta;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .tags {
      display: inline-flex;
      gap: 4px;
    }

    .chevron {
      grid-area: chevron;
      color: var(--ink-3);
    }

    @media (min-width: 640px) {
      .fact {
        grid-template-columns: 1fr auto auto;
        grid-template-areas: 'main meta chevron';
        padding-inline: 20px 14px;
      }

      .meta {
        justify-content: flex-end;
      }
    }
  `,
})
export class FactList {
  readonly facts = input.required<readonly FactView[]>();
  readonly selected = input<FactField | null>(null);
  readonly factSelected = output<FactField>();
}
