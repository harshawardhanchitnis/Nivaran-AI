import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ALLOWED_MIME_TYPES, MAX_FILES_PER_CASE, MAX_FILE_BYTES } from '@shared/limits';

/** Pick files from the phone gallery, the file system, or by dropping them. Emits raw files. */
@Component({
  selector: 'app-upload-dropzone',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="zone"
      [class.over]="over()"
      [class.disabled]="disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        type="file"
        multiple
        [accept]="accept"
        [disabled]="disabled()"
        (change)="onPick($event)"
      />
      <span class="icon"><mat-icon aria-hidden="true">upload_file</mat-icon></span>
      <span class="title">Add your documents</span>
      <span class="hint">
        Invoice, cancellation or return message, refund message, support chat.
      </span>
      <span class="limits">Up to {{ maxFiles }} files · PNG, JPG or PDF · {{ maxMb }} MB each</span>
    </label>
  `,
  styles: `
    .zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 28px 18px;
      border: 2px dashed var(--line-strong);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
    }

    .zone:hover,
    .zone.over,
    .zone:focus-within {
      border-color: var(--brand);
      background: var(--brand-soft);
    }

    .zone.disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }

    .icon {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand);
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 560;
    }

    .hint {
      color: var(--ink-2);
    }

    .limits {
      color: var(--ink-3);
      font-size: 0.82rem;
    }
  `,
})
export class UploadDropzone {
  readonly disabled = input(false);
  readonly filesPicked = output<File[]>();

  protected readonly over = signal(false);
  protected readonly accept = ALLOWED_MIME_TYPES.join(',');
  protected readonly maxFiles = MAX_FILES_PER_CASE;
  protected readonly maxMb = MAX_FILE_BYTES / (1024 * 1024);

  protected onPick(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.emit(element.files);
    element.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      this.over.set(true);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    if (!this.disabled()) {
      this.emit(event.dataTransfer?.files ?? null);
    }
  }

  private emit(list: FileList | null): void {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) {
      this.filesPicked.emit(files);
    }
  }
}
