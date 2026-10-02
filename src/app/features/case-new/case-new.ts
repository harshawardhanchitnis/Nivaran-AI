import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

import { EvidenceTag } from '../../shared/ui/evidence-tag';
import { CasesService, CaseUploadError } from '../../core/cases.service';
import { UploadDropzone } from '../../shared/ui/upload-dropzone';
import { checkFiles, formatBytes } from './file-rules';

/**
 * New case: privacy notice with consent, then documents.
 *
 * Uses the existing notice, dropzone and file rules. CasesService persists the case and documents.
 */
@Component({
  selector: 'app-case-new',
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule, UploadDropzone, EvidenceTag, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="narrow stack">
      <header>
        <p class="eyebrow">New case</p>
        <h1>Add your documents</h1>
        <p class="muted">Whatever you have about the order and the refund. Screenshots are fine.</p>
      </header>

      <section class="notice surface" aria-labelledby="privacy-title">
        <h2 id="privacy-title"><mat-icon aria-hidden="true">shield</mat-icon> Before you upload</h2>
        <ul>
          <li>Your documents are sent to Google’s Gemini model to be read.</li>
          <li>On the free tier, Google may use that content to improve its products.</li>
          <li>Hide card numbers and anything you do not want to share before uploading.</li>
          <li>You can delete your case, files and records at any time.</li>
          <li>Nivaran never sends or files anything. You review and send the complaint yourself.</li>
        </ul>
        <mat-checkbox [checked]="consent()" [disabled]="saving()" (change)="consent.set($event.checked)">
          I understand and want to continue
        </mat-checkbox>
      </section>

      <app-upload-dropzone [disabled]="!consent() || saving() || createdCaseId() !== null" (filesPicked)="add($event)" />
      @if (!consent()) {
        <p class="muted small">Tick the box above to add documents.</p>
      }

      @if (problems().length > 0) {
        <ul class="problems" role="alert">
          @for (problem of problems(); track problem) {
            <li><mat-icon aria-hidden="true">error_outline</mat-icon>{{ problem }}</li>
          }
        </ul>
      }

      @if (files().length > 0) {
        <ul class="files surface" aria-label="Documents added">
          @for (file of files(); track file.name; let index = $index) {
            <li>
              <app-evidence-tag [label]="label(index)" />
              <span class="name">{{ file.name }}</span>
              <span class="size">{{ size(file.size) }}</span>
              <button mat-icon-button type="button" [disabled]="saving() || createdCaseId() !== null" [attr.aria-label]="'Remove ' + file.name" (click)="remove(file.name)">
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
      }

      <div class="row">
        <button mat-flat-button type="button" [disabled]="!canContinue()" (click)="continue()">
          {{ saving() ? 'Saving your documents…' : 'Continue' }}
        </button>
        @if (saving()) {
          <span class="muted small" role="status">Keep this page open while your documents are saved.</span>
        }
        @if (partialCaseId(); as id) {
          <a [routerLink]="['/cases', id]">Open the partial case</a>
        }
      </div>
    </div>
  `,
  styles: `
    .notice {
      padding: 18px 20px;
    }

    .notice h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.15rem;
    }

    .notice h2 mat-icon {
      color: var(--brand);
    }

    .notice ul {
      margin: 10px 0 8px;
      padding-left: 20px;
      color: var(--ink-2);
      line-height: 1.6;
    }

    .small {
      margin: 0;
      font-size: 0.85rem;
    }

    .problems {
      list-style: none;
      margin: 0;
      padding: 12px 14px;
      display: grid;
      gap: 6px;
      border-radius: var(--radius-sm);
      background: var(--st-conflict-bg);
      color: var(--st-conflict);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .problems li {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 8px;
    }

    .problems mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .files {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .files li {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 10px;
      padding: 6px 6px 6px 16px;
    }

    .files li + li {
      border-top: 1px solid var(--line);
    }

    .name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .size {
      color: var(--ink-3);
      font-family: var(--font-mono);
      font-size: 0.78rem;
    }
  `,
})
export class CaseNew {
  private readonly cases = inject(CasesService);
  private readonly router = inject(Router);
  protected readonly consent = signal(false);
  protected readonly files = signal<readonly File[]>([]);
  protected readonly problems = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly createdCaseId = signal<string | null>(null);
  protected readonly partialCaseId = signal<string | null>(null);
  protected readonly canContinue = computed(() => this.consent() && this.files().length > 0 && !this.saving());

  protected async continue(): Promise<void> {
    if (!this.canContinue()) return;
    this.saving.set(true);
    this.problems.set([]);
    this.partialCaseId.set(null);
    try {
      let id = this.createdCaseId();
      if (!id) {
        const created = await this.cases.createWithDocuments(this.files(), this.consent());
        id = created.case.id;
        this.createdCaseId.set(id);
      }
      const opened = await this.router.navigate(['/cases', id]);
      if (!opened) this.problems.set(['Your documents are saved. Choose Continue to open your case.']);
    } catch (error) {
      this.problems.set([this.createdCaseId()
        ? 'Your documents are saved. Choose Continue to open your case.'
        : error instanceof Error ? error.message : 'Could not save your documents. Please try again.']);
      if (error instanceof CaseUploadError) this.partialCaseId.set(error.caseId);
    } finally {
      this.saving.set(false);
    }
  }

  protected add(picked: File[]): void {
    if (!this.consent() || this.saving() || this.createdCaseId()) return;
    const result = checkFiles(picked, this.files());
    this.files.update((files) => [...files, ...result.accepted]);
    this.problems.set(result.problems);
  }

  protected remove(name: string): void {
    this.files.update((files) => files.filter((file) => file.name !== name));
    this.problems.set([]);
  }

  protected label(index: number): string {
    return `E${String(index + 1).padStart(2, '0')}`;
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }
}
