import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PlannedScreen } from '../../shared/ui/planned-screen';

@Component({
  selector: 'app-case-pack',
  imports: [PlannedScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-planned-screen
      heading="Complaint pack"
      [summary]="'Case ' + caseId()"
      [items]="items"
    />
  `,
})
export class CasePack {
  /** Bound from the :caseId route parameter. */
  readonly caseId = input.required<string>();

  protected readonly items = [
    'Show the complaint, the timeline and the evidence index, laid out for printing.',
    'Let you edit the complaint, and flag any amount, date or ID that is not in the fact sheet.',
    'Fill in your name and contact details in the browser only.',
    'Print to PDF, copy the text, and download the deadlines as a calendar file.',
  ] as const;
}
