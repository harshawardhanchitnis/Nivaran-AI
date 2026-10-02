import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PlannedScreen } from '../../shared/ui/planned-screen';

@Component({
  selector: 'app-case-workspace',
  imports: [PlannedScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-planned-screen
      heading="Case workspace"
      [summary]="'Case ' + caseId()"
      [items]="items"
    />
  `,
})
export class CaseWorkspace {
  /** Bound from the :caseId route parameter. */
  readonly caseId = input.required<string>();

  protected readonly items = [
    'Show the fact sheet: every fact has a status and opens its source page and exact quote.',
    'Show the activity log of the real steps the agent took.',
    'Ask one-tap questions when documents disagree or something is missing.',
    'Show the next step, its reasons and its dates, and wait for your approval.',
    'After you send the complaint: record what happened and move to the next step.',
  ] as const;
}
