import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlannedScreen } from '../../shared/ui/planned-screen';

@Component({
  selector: 'app-case-new',
  imports: [PlannedScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-planned-screen
      heading="New case"
      summary="Add your order and refund documents."
      [items]="items"
    />
  `,
})
export class CaseNew {
  protected readonly items = [
    'Show the privacy notice and ask for consent before anything is uploaded.',
    'Accept up to 6 files (PNG, JPG or PDF, 5 MB each), straight from a phone.',
    'Upload them to private storage and open the case workspace.',
  ] as const;
}
