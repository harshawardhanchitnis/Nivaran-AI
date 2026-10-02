import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stack">
      <div>
        <h1>Refund promised, money not received?</h1>
        <p class="muted">
          Add your order and refund messages. Nivaran builds a fact sheet you can check against the
          original documents, tells you the right next step and its dates, and prepares a complaint
          for you to review and send yourself.
        </p>
        <div class="row">
          <a mat-flat-button routerLink="/cases/new">Start a case</a>
          <a mat-button routerLink="/cases">My cases</a>
        </div>
      </div>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>What Nivaran covers</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <ul>
            <li>An online order you paid for and then cancelled.</li>
            <li>A return the seller accepted or picked up.</li>
            <li>A refund the seller confirmed in writing.</li>
          </ul>
          <p class="muted">
            For anything else, call the National Consumer Helpline on 1915.
          </p>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: `
    ul {
      margin: 8px 0 12px;
      padding-left: 20px;
      line-height: 1.6;
    }
  `,
})
export class Home {}
