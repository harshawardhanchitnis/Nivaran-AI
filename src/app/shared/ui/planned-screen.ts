import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/**
 * Stand-in for a screen that has a route but no product logic yet. It states what the screen
 * will do, so the starter is honest about what exists. Replace each use during the build.
 */
@Component({
  selector: 'app-planned-screen',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ heading() }}</h1>
    <p class="muted">{{ summary() }}</p>

    <mat-card appearance="outlined">
      <mat-card-content>
        <p class="tag">Not built yet</p>
        <p>This screen will:</p>
        <ul>
          @for (item of items(); track item) {
            <li>{{ item }}</li>
          }
        </ul>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .tag {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      font: var(--mat-sys-label-medium);
    }

    ul {
      margin: 0;
      padding-left: 20px;
      line-height: 1.6;
    }
  `,
})
export class PlannedScreen {
  readonly heading = input.required<string>();
  readonly summary = input.required<string>();
  readonly items = input.required<readonly string[]>();
}
