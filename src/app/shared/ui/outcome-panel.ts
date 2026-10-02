import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import type { PlanOutcome } from '@shared/database';
import { UploadDropzone } from './upload-dropzone';
import { checkFiles, type FileLike } from '../../features/case-new/file-rules';
export interface OutcomeSubmission {requestId:string;outcome:PlanOutcome;file:File|null;consent:boolean}
@Component({
  selector:'app-outcome-panel',
  imports:[ReactiveFormsModule,MatButtonModule,UploadDropzone],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<section class="surface outcome-panel no-print" aria-labelledby="outcome-title">
    <h2 id="outcome-title">What happened?</h2>
    <p>Record the merchant's response after your complaint. This is saved as Your statement; Nivaran recalculates the next step from your facts.</p>
    @if (previousLabel(); as label) { <p>Previously recorded: <strong>{{label}}</strong>. Choose again to record a newer update.</p> }
    <fieldset [disabled]="busy()">
      <legend>Choose what happened after you sent the complaint</legend>
      @for (option of options; track option.id) {
        <label class="choice"><input type="radio" name="case-outcome" [value]="option.id" [formControl]="choiceControl"/>{{option.label}}</label>
      }
    </fieldset>
    @if (choice()==='refused') {
      <h3>Add the written reply</h3>
      <p>Choose one PNG, JPG or PDF. It counts towards your case's six-file limit and will be read like your other evidence.</p>
      <p>Your reply is sent to Google's Gemini or Groq's Qwen model to be read. Google's free tier may use it to improve products. Hide card numbers and anything you do not want to share.</p>
      <label class="choice"><input type="checkbox" [formControl]="consentControl"/>I agree to upload this reply for reading.</label>
      <app-upload-dropzone [disabled]="busy()" (filesPicked)="pick($event)"/>
      @if (file(); as chosen) { <p class="filename">Selected: {{chosen.name}}</p> }
      @for (problem of problems(); track problem) { <p role="alert">{{problem}}</p> }
    }
    <button mat-flat-button type="button" [disabled]="busy() || !choice() || (choice()==='refused' && (!file() || !consent()))" (click)="submit()">{{busy()?'Saving update…':'Record outcome'}}</button>
  </section>`,
  styles:`.outcome-panel{padding:20px;display:grid;gap:12px;margin-top:16px}fieldset{border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px}legend{font-weight:600;padding:0 4px}.choice{display:flex;align-items:flex-start;gap:10px;padding:8px 0}.choice input{flex:none;margin-top:4px;accent-color:var(--brand)}.filename{overflow-wrap:anywhere}button{justify-self:start}`,
})
export class OutcomePanel {
  readonly busy=input(false);
  readonly previous=input<PlanOutcome|null>(null);
  readonly existingFiles=input<readonly FileLike[]>([]);
  readonly completedRequest=input<string|null>(null);
  readonly outcomeRequested=output<OutcomeSubmission>();
  protected readonly choiceControl=new FormControl<PlanOutcome|null>(null);
  protected readonly consentControl=new FormControl(false,{nonNullable:true});
  protected readonly choice=toSignal(this.choiceControl.valueChanges,{initialValue:null});
  protected readonly consent=toSignal(this.consentControl.valueChanges,{initialValue:false});
  protected readonly file=signal<File|null>(null);
  protected readonly problems=signal<string[]>([]);
  protected readonly options:readonly {id:PlanOutcome;label:string}[]=[
    {id:'refunded',label:'Refund arrived'}, {id:'acknowledged',label:'Acknowledged, but no refund'},
    {id:'no_reply',label:'No reply and no refund'}, {id:'refused',label:'Refused in writing'},
  ];
  protected readonly previousLabel=computed(()=>this.options.find(o=>o.id===this.previous())?.label??null);
  private request:{key:string;id:string}|null=null;
  constructor() {
    effect(()=>{if(this.completedRequest()===this.request?.id) this.request=null;});
  }
  protected pick(files:File[]):void {
    this.file.set(null);
    const checked=checkFiles(files,this.existingFiles());
    this.problems.set(files.length!==1?['Choose one written reply at a time.']:checked.problems);
    if(files.length===1 && !checked.problems.length) this.file.set(checked.accepted[0]??null);
  }
  protected submit():void {
    const outcome=this.choice();const file=outcome==='refused'?this.file():null;
    if (!outcome || this.busy() || (outcome==='refused' && (!file || !this.consent()))) return;
    const key=`${outcome}/${file?.name}/${file?.lastModified}/${file?.size}`;
    if (this.request?.key!==key) this.request={key,id:crypto.randomUUID()};
    this.outcomeRequested.emit({requestId:this.request.id,outcome,file,consent:this.consent()});
  }
}
