import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import type { DraftRow } from '@shared/database';
import type { DraftRenderContext } from '@shared/draft-render';
import type { DraftFlag } from '@shared/draft-lint';
import { baseDraftFlags, draftPresentation, draftStatements } from '../../core/workspace-draft';
import { ComplaintDraft } from './complaint-draft';
@Component({
  selector: 'app-draft-editor',
  imports: [ComplaintDraft, ReactiveFormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft().lint['generationKind'] === 'code_basic') {
      <p class="surface controls" role="note">Basic complaint assembled by code from your approved facts. No AI wording was generated.</p>
    }
    <p class="save-state no-print" role="status">{{ unsaved() ? 'You have unsaved edits.' : 'Showing saved version ' + draft().version + '.' }} {{ flags().length }} value flags to review.</p>
    <div class="review-layout">
    <app-complaint-draft [segments]="presentation().segments" />
    <section class="controls surface no-print" aria-labelledby="draft-edit-title">
      <h2 id="draft-edit-title">Review and edit</h2>
      <p>
        Check the prose as well as the values. Amounts written only in words are not detected. Flags
        do not prevent you from saving or copying.
      </p>
      <label for="complaint-text">Complaint text</label>
      <textarea id="complaint-text" rows="12" [formControl]="editor" maxlength="20000"></textarea>
      <p class="muted">
        {{ practice() ? 'Practice edits stay only in this page and disappear when you leave or restart.' : 'Edited complaint text is saved to your case.' }} Use the private fields below for your contact details.
      </p>
      <div aria-live="polite">
        @for (flag of flags(); track flag.start) {
          <div class="flag-row">
            <strong class="mono">{{ flag.text }}</strong
            ><span>Not in your fact sheet</span>
            <button mat-button type="button" (click)="keep(flag)">Keep as Your statement</button>
            <button mat-button type="button" (click)="remove(flag)">Remove</button>
          </div>
        }
      </div>
      <div [formGroup]="privateDetails" class="private-fields">
        <h3>Your details — on this device only</h3>
        <p>
          These fields stay in this page. They are filled into the preview, printed pack and copied
          text, and are never saved or sent to the model.
        </p>
        <label for="private-name">Your name</label
        ><input id="private-name" formControlName="name" autocomplete="name" maxlength="200" />
        <label for="private-contact">Your contact details</label
        ><input id="private-contact" formControlName="contact" autocomplete="off" maxlength="500" />
        <label for="private-address">Your address</label
        ><textarea
          id="private-address"
          formControlName="address"
          rows="3"
          autocomplete="street-address"
          maxlength="1000"
        ></textarea>
      </div>
      <div class="actions">
        <button
          mat-flat-button
          type="button"
          [disabled]="busy() || editor.invalid"
          (click)="save()"
        >
          Save edits
        </button>
        <button mat-stroked-button type="button" (click)="copyRequested.emit(presentation().text)">
          Copy text
        </button>
        <button mat-stroked-button type="button" (click)="printRequested.emit()">
          Print / save PDF
        </button>
      </div>
    </section></div>`,
  styles: `
    :host {
      display: block;
    }
    .controls {
      padding: 20px;
      margin-top: 20px;
      display: grid;
      gap: 10px;
    }
    .review-layout { display: grid; gap: 20px; align-items: start; }
    .save-state { color: var(--ink-2); padding: 12px 0; }
    @media (min-width: 1100px) { .review-layout { grid-template-columns: 1fr 1fr; } .controls { margin-top: 0; } }
    @media print { .review-layout { display: block; } }
    label {
      font-weight: 600;
    }
    input,
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
    }
    textarea {
      resize: vertical;
    }
    .actions,
    .flag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .flag-row {
      padding: 10px;
      background: var(--st-conflict-bg);
      border-radius: var(--radius-sm);
      overflow-wrap: anywhere;
    }
    .private-fields {
      display: grid;
      gap: 8px;
      margin-top: 16px;
    }
    @media print {
      app-complaint-draft {
        display: block;
      }
    }
  `,
})
export class DraftEditor {
  readonly practice = input(false);
  readonly draft = input.required<DraftRow>();
  readonly context = input.required<DraftRenderContext>();
  readonly busy = input(false);
  readonly saveRequested = output<{ text: string; userStatements: string[] }>();
  readonly copyRequested = output<string>();
  readonly printRequested = output<void>();
  protected readonly editor = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(20000)],
  });
  private readonly editedText = toSignal(this.editor.valueChanges, { initialValue: '' });
  protected readonly privateDetails = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    contact: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
  });
  private readonly privateValues = toSignal(this.privateDetails.valueChanges, {
    initialValue: { name: '', contact: '', address: '' },
  });
  private readonly statements = signal<string[]>([]);
  protected readonly unsaved = computed(() => this.editedText() !== (this.draft().rendered_md ?? '') ||
    JSON.stringify(this.statements()) !== JSON.stringify(draftStatements(this.draft())));
  protected readonly presentation = computed(() => {
    const details = this.privateValues();
    return draftPresentation(
      this.draft(),
      this.editedText(),
      this.context(),
      { name: details.name ?? '', contact: details.contact ?? '', address: details.address ?? '' },
      this.statements(),
    );
  });
  protected readonly flags = computed(() =>
    baseDraftFlags(this.draft(), this.editedText(), this.context(), this.statements()),
  );
  constructor() {
    let previousDraft: string | undefined;
    let previousPlan: string | undefined;
    effect(() => {
      const draft = this.draft();
      if (draft.id !== previousDraft) {
        this.editor.setValue(draft.rendered_md ?? '');
        this.statements.set(draftStatements(draft));
        previousDraft = draft.id;
      }
      if (draft.plan_id !== previousPlan) {
        this.privateDetails.reset();
        previousPlan = draft.plan_id;
      }
    });
  }
  protected keep(flag: DraftFlag): void {
    this.statements.update((values) => [...new Set([...values, flag.text])].slice(0, 50));
    const text = this.editor.value;
    this.editor.setValue(text.slice(0, flag.end) + ' [your statement]' + text.slice(flag.end));
  }
  protected remove(flag: DraftFlag): void {
    const text = this.editor.value;
    this.editor.setValue(text.slice(0, flag.start) + text.slice(flag.end));
  }
  protected save(): void {
    if (!this.editor.invalid && !this.busy())
      this.saveRequested.emit({ text: this.editor.value, userStatements: this.statements() });
  }
}
