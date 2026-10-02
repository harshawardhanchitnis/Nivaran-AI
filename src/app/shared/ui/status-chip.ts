import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FACT_STATUS_LABELS, type FactStatus } from '@shared/facts';

const ICONS: Record<FactStatus, string> = {
  document: 'description',
  user: 'person',
  conflict: 'compare_arrows',
  missing: 'help_outline',
  needs_check: 'visibility',
};

/** One of the five fact statuses, shown with an icon and words (never colour alone). */
@Component({
  selector: 'app-status-chip',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="'chip ' + status()">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      {{ label() }}
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px 3px 6px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }

    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .document { color: var(--st-document); background: var(--st-document-bg); }
    .user { color: var(--st-user); background: var(--st-user-bg); }
    .conflict { color: var(--st-conflict); background: var(--st-conflict-bg); }
    .missing { color: var(--st-missing); background: var(--st-missing-bg); }
    .needs_check { color: var(--st-needs_check); background: var(--st-needs_check-bg); }
  `,
})
export class StatusChip {
  readonly status = input.required<FactStatus>();
  protected readonly icon = computed(() => ICONS[this.status()]);
  protected readonly label = computed(() => FACT_STATUS_LABELS[this.status()]);
}
