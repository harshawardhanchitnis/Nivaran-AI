import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlannedScreen } from '../../shared/ui/planned-screen';

@Component({
  selector: 'app-my-cases',
  imports: [PlannedScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-planned-screen
      heading="My cases"
      summary="Your cases stay private to this browser session."
      [items]="items"
    />
  `,
})
export class MyCases {
  protected readonly items = [
    'List your cases with their current step and next date.',
    'Open the sample cases, each as a saved run that uses no model calls.',
    'Delete a case and every file and record that belongs to it.',
  ] as const;
}
