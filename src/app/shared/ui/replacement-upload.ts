import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { UploadDropzone } from './upload-dropzone';
@Component({
  selector:'app-replacement-upload',imports:[UploadDropzone,MatCheckboxModule,MatButtonModule],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<section class="surface pad" aria-labelledby="replacement-title">
    <h2 id="replacement-title">Add the missing or clearer file</h2>
    <p>Use a readable screenshot or PDF. Earlier evidence stays saved. Up to six files per case.</p>
    <p class="muted">Documents and extracted facts may go to Google Gemini or Groq Qwen. Google may use free-tier content to improve its products. Hide card numbers and private details first.</p>
    <mat-checkbox [checked]="consent()" [disabled]="busy() || uploaded()" (change)="consent.set($event.checked)">I understand and consent to this upload</mat-checkbox>
    @if (uploaded()) { <p>Your file is saved.</p><button mat-stroked-button [disabled]="busy()" (click)="retry.emit()">Retry continuing with the saved file</button> }
    @else {
      <app-upload-dropzone [disabled]="!consent() || busy()" (filesPicked)="pick($event)" />
      @if (file(); as chosen) { <p>{{ chosen.name }}</p><button mat-flat-button [disabled]="busy() || !consent()" (click)="submit()">{{busy() ? 'Saving…' : 'Add file and continue'}}</button> }
      @if (problem()) { <p role="alert">{{problem()}}</p> }
    }
  </section>`,styles:`.pad{padding:16px}h2{font-size:1.2rem}`,
})
export class ReplacementUpload {
  readonly busy=input(false); readonly uploaded=input(false);
  readonly submitted=output<File>(); readonly retry=output<void>();
  protected readonly consent=signal(false);protected readonly file=signal<File|null>(null);protected readonly problem=signal('');
  protected pick(files:File[]):void { if(!this.consent()||this.busy())return;this.problem.set(files.length!==1?'Choose one clearer file at a time.':'');this.file.set(files.length===1?files[0]!:null); }
  protected submit():void { const file=this.file();if(file&&this.consent()&&!this.busy())this.submitted.emit(file); }
}
