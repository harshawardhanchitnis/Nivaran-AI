import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA,MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector:'app-confirm-delete-case',imports:[MatDialogModule,MatButtonModule],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<h2 mat-dialog-title>Delete this case?</h2><mat-dialog-content>
    <p>{{data.title}}</p><p>This permanently removes the uploaded files, facts, activity, plans and drafts. You cannot undo it.</p>
  </mat-dialog-content><mat-dialog-actions align="end">
    <button id="delete-cancel" mat-button [mat-dialog-close]="false">Keep case</button>
    <button mat-flat-button [mat-dialog-close]="true">Delete case and files</button>
  </mat-dialog-actions>`,
})
export class ConfirmDeleteCase {protected readonly data=inject<{title:string}>(MAT_DIALOG_DATA);}
