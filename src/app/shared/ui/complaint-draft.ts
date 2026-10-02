import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { EvidenceTag } from './evidence-tag';
import type { DraftSegment } from './models';

/**
 * The complaint, drawn as a letter. Values inserted from the fact sheet carry their evidence
 * label; anything that is not in the fact sheet is flagged; the user's own details are marked as
 * filled in on their device.
 */
@Component({
  selector: 'app-complaint-draft',
  imports: [MatIconModule, EvidenceTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="letter" aria-label="Complaint draft">
      <p class="body">
        @for (segment of segments(); track $index) {
          @switch (segment.kind) {
            @case ('text') {
              <span>{{ segment.text }}</span>
            }
            @case ('value') {
              <span class="value">{{ segment.text }}</span>
              <app-evidence-tag class="tag" [label]="segment.evidence" />
            }
            @case ('flag') {
              <span class="flag" title="Not in your fact sheet">{{ segment.text }}</span>
            }
            @case ('you') {
              <span class="you">{{ segment.text }}</span>
            }
            @case ('break') {
              <span class="break"></span>
            }
          }
        }
      </p>
    </article>

    @if (flagCount() > 0) {
      <p class="lint bad" role="status">
        <mat-icon aria-hidden="true">report</mat-icon>
        {{ flagCount() }} {{ flagCount() === 1 ? 'value is' : 'values are' }} not in your fact sheet.
        Keep each as “Your statement” or remove it.
      </p>
    } @else {
      <p class="lint good" role="status">
        <mat-icon aria-hidden="true">verified</mat-icon>
        Every amount, date and ID here was checked against your fact sheet.
      </p>
    }

    <ul class="legend">
      <li><span class="value">Underlined</span> values carry their source label</li>
      <li><span class="flag">Wavy</span> is not in your fact sheet</li>
      <li><span class="you">Dashed</span> is filled in on your device only</li>
    </ul>
  `,
  styles: `
    .letter {
      padding: 28px 22px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: var(--shadow-2);
    }

    .body {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.04rem;
      line-height: 1.75;
      overflow-wrap: anywhere;
    }

    .break {
      display: block;
      height: 0.9em;
    }

    .value {
      font-weight: 600;
      text-decoration: underline;
      text-decoration-color: var(--brand);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }

    .tag {
      margin: 0 3px 0 4px;
    }

    .flag {
      padding: 0 2px;
      border-radius: 3px;
      background: var(--st-conflict-bg);
      color: var(--st-conflict);
      font-weight: 600;
      text-decoration: underline wavy var(--st-conflict);
      text-underline-offset: 3px;
    }

    .you {
      border-bottom: 1.5px dashed var(--st-user);
      color: var(--st-user);
    }

    .lint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 14px 0 0;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .lint mat-icon {
      flex: none;
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .lint.good {
      background: var(--st-document-bg);
      color: var(--st-document);
    }

    .lint.bad {
      background: var(--st-conflict-bg);
      color: var(--st-conflict);
    }

    .legend {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      margin: 12px 0 0;
      padding: 0;
      color: var(--ink-2);
      font-size: 0.8rem;
    }

    @media (min-width: 640px) {
      .letter {
        padding: 44px 48px;
      }
    }

    @media print {
      .letter {
        border: 0;
        box-shadow: none;
        padding: 0;
      }

      .lint,
      .legend {
        display: none;
      }
    }
  `,
})
export class ComplaintDraft {
  readonly segments = input.required<readonly DraftSegment[]>();
  protected readonly flagCount = computed(() => this.segments().filter((segment) => segment.kind === 'flag').length);
}
