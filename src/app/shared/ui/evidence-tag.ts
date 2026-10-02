import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The small label that ties a value to a document: E01, E02, ... */
@Component({
  selector: 'app-evidence-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tag"><span class="visually-hidden">Evidence </span>{{ label() }}</span>`,
  styles: `
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink-2);
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 500;
      line-height: 1.5;
      vertical-align: middle;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class EvidenceTag {
  readonly label = input.required<string>();
}
