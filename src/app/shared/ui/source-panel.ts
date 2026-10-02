import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { EvidenceTag } from './evidence-tag';
import type { FactView } from './models';
import { StatusChip } from './status-chip';

/**
 * "Where this comes from": the document, page and exact quote behind a fact.
 * The host decides placement (side panel on wide screens, bottom sheet on phones).
 */
@Component({
  selector: 'app-source-panel',
  imports: [MatButtonModule, MatIconModule, EvidenceTag, StatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel surface" aria-labelledby="source-title">
      <header>
        <div>
          <p class="eyebrow">Where this comes from</p>
          <h2 id="source-title">{{ fact().label }}</h2>
        </div>
        <button mat-icon-button type="button" aria-label="Close source" (click)="closed.emit()">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div class="summary">
        <span class="value">{{ fact().value ?? 'Not found yet' }}</span>
        <app-status-chip [status]="fact().status" />
      </div>

      @for (source of fact().sources; track source.id ?? source.evidence) {
        <article class="doc">
          <div class="doc-head">
            <app-evidence-tag [label]="source.evidence" />
            <span class="doc-name">{{ source.documentKind }}</span>
            @if (source.page) {
              <span class="doc-page">Page {{ source.page }}</span>
            }
          </div>
          @if (source.imageUrl) {
            <img class="shot" [src]="source.imageUrl" [alt]="source.documentKind + ', ' + source.documentName" />
          }
          @if (source.pdfImageUrl) {
            <img class="shot" [src]="source.pdfImageUrl" [alt]="source.documentName + ', page ' + (source.page ?? 1)" />
          }
          @if (source.pdfUrl) {
            <p class="file"><a [href]="source.pdfUrl" target="_blank" rel="noopener">Open original PDF in a new tab</a></p>
          }
          @if (source.previewLoading) { <p class="file" role="status">Opening your document…</p> }
          @if (source.previewError) {
            <p class="file" role="alert">{{ source.previewError }}</p>
            @if (source.documentId) {
              <button mat-stroked-button type="button" (click)="retry.emit(source.documentId)">Retry opening document</button>
            }
          }
          <blockquote>
            {{ source.before }}<mark>{{ source.quote }}</mark>{{ source.after }}
          </blockquote>
          <p class="file">{{ source.documentName }} · says: <strong>{{ source.value }}</strong></p>
        </article>
      } @empty {
        <div class="none">
          @switch (fact().status) {
            @case ('user') {
              <p>You told Nivaran this. No document supports it yet.</p>
            }
            @case ('missing') {
              <p>None of your documents mention this. Nivaran will ask you for it, or for a document that shows it.</p>
            }
            @default {
              <p>There is no source to show for this fact.</p>
            }
          }
        </div>
      }

      @if (fact().status === 'conflict') {
        <p class="caution">These sources disagree. You decide which is right.</p>
      }

      <p class="footnote">
        A quote shows what the document says. It is not proof that it happened.
      </p>
    </section>
  `,
  styles: `
    .panel {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .value {
      font-size: 1.15rem;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .doc {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: #fdfcf9;
      overflow: hidden;
    }

    .doc-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px dashed var(--line-strong);
      font-size: 0.85rem;
      font-weight: 600;
    }

    .doc-name {
      flex: 1;
      min-width: 0;
    }

    .doc-page {
      color: var(--ink-2);
      font-weight: 500;
      white-space: nowrap;
    }

    .shot {
      display: block;
      width: 100%;
      max-height: 280px;
      object-fit: contain;
      background: #f1efe9;
    }


    blockquote {
      margin: 0;
      padding: 14px 14px 10px;
      font-family: var(--font-display);
      font-size: 1.02rem;
      line-height: 1.6;
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .file {
      margin: 0;
      padding: 0 14px 12px;
      color: var(--ink-2);
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }

    .none {
      padding: 14px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-sm);
      color: var(--ink-2);
    }

    .none p {
      margin: 0;
    }

    .caution {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--st-conflict-bg);
      color: var(--st-conflict);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .footnote {
      margin: 0;
      color: var(--ink-2);
      font-size: 0.8rem;
    }
  `,
})
export class SourcePanel {
  readonly fact = input.required<FactView>();
  readonly closed = output<void>();
  readonly retry = output<string>();
}
