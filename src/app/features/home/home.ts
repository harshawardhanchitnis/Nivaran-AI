import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { EvidenceTag } from '../../shared/ui/evidence-tag';
import { StatusChip } from '../../shared/ui/status-chip';
import { SAMPLE_CASES } from '@shared/samples';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatIconModule, StatusChip, EvidenceTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">For online orders in India</p>
        <h1>Refund promised.<br />Money <em>not</em> received?</h1>
        <p class="lede">
          Add your order and refund messages. Nivaran builds a fact sheet you can check against your
          own documents, tells you the right next step and its dates, and prepares a complaint for
          you to review and send yourself.
        </p>
        <div class="row">
          <a mat-flat-button routerLink="/cases/new">Start a case</a>
          <a mat-stroked-button routerLink="/samples/clean-overdue">See a saved run</a>
        </div>
        <p class="small muted">No sign-up. Nothing is sent or filed for you.</p>
      </div>

      <!-- A still of the fact sheet, built from the real components. Decorative. -->
      <div class="preview" aria-hidden="true">
        <div class="sheet surface">
          <p class="eyebrow">Fact sheet</p>
          <div class="line">
            <div>
              <span class="k">Amount paid</span>
              <span class="v">₹9,999</span>
            </div>
            <span class="tags"><app-status-chip status="document" /><app-evidence-tag label="E01" /></span>
          </div>
          <div class="line">
            <div>
              <span class="k">Refund amount</span>
              <span class="v">₹9,999 or ₹8,999</span>
            </div>
            <span class="tags"><app-status-chip status="conflict" /></span>
          </div>
          <div class="line">
            <div>
              <span class="k">Refund received</span>
              <span class="v">No</span>
            </div>
            <span class="tags"><app-status-chip status="user" /></span>
          </div>
        </div>
        <div class="quote surface">
          <app-evidence-tag label="E02" />
          <p>…a refund of <mark>₹9,999 will be credited</mark> within 7 working days.</p>
        </div>
      </div>
    </section>

    <section class="steps" aria-labelledby="samples-title">
      <h2 id="samples-title">Try a saved case</h2>
      <p class="muted">Real recorded runs using fictional documents. Opening them makes no model calls. Failures are shown too.</p>
      <div class="sample-grid">
        @for (sample of samples; track sample.id) {
          <article class="surface card">
            <p class="eyebrow">Saved run</p><h3>{{ sample.title }}</h3><p>{{ sample.description }}</p>
            <a mat-stroked-button [routerLink]="['/samples',sample.id]">Open {{ sample.title.toLowerCase() }}</a>
          </article>
        }
      </div>
    </section>
    <section class="steps" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <ol>
        @for (step of steps; track step.title) {
          <li class="surface">
            <span class="icon"><mat-icon aria-hidden="true">{{ step.icon }}</mat-icon></span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </li>
        }
      </ol>
    </section>

    <section class="two">
      <div class="surface card">
        <h2>What Nivaran covers</h2>
        <ul class="ticks">
          <li><mat-icon aria-hidden="true">check</mat-icon>An online order you paid for and then cancelled.</li>
          <li><mat-icon aria-hidden="true">check</mat-icon>A return the seller accepted or picked up.</li>
          <li><mat-icon aria-hidden="true">check</mat-icon>A refund the seller confirmed in writing.</li>
        </ul>
        <p class="muted small">For anything else, call the National Consumer Helpline on 1915.</p>
      </div>
      <div class="surface card">
        <h2>You stay in control</h2>
        <ul class="ticks">
          <li><mat-icon aria-hidden="true">link</mat-icon>Every fact opens the document and the exact words it came from.</li>
          <li><mat-icon aria-hidden="true">how_to_reg</mat-icon>Nothing is drafted until you approve the plan.</li>
          <li><mat-icon aria-hidden="true">delete_outline</mat-icon>Delete your case and files whenever you like.</li>
        </ul>
        <p class="muted small">Nivaran is not legal advice.</p>
      </div>
    </section>
  `,
  styles: `
    .sample-grid { display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)) }
    .hero {
      display: grid;
      gap: 28px;
      padding: 12px 0 8px;
    }

    h1 {
      font-size: clamp(2.3rem, 8vw, 3.6rem);
      margin-bottom: 14px;
    }

    h1 em {
      font-style: italic;
      color: var(--brand);
    }

    .lede {
      max-width: 56ch;
      font-size: 1.08rem;
      color: var(--ink-2);
    }

    .small {
      margin: 12px 0 0;
      font-size: 0.85rem;
    }

    .preview {
      position: relative;
      padding: 0 4px 72px 0;
    }

    .sheet {
      padding: 16px 16px 6px;
      box-shadow: var(--shadow-2);
      transform: rotate(-1deg);
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }

    .k {
      display: block;
      color: var(--ink-3);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .v {
      font-weight: 600;
    }

    .tags {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }

    .quote {
      position: absolute;
      right: 0;
      bottom: 0;
      width: min(86%, 320px);
      padding: 12px 14px;
      box-shadow: var(--shadow-2);
      transform: rotate(1.5deg);
    }

    .quote p {
      margin: 6px 0 0;
      font-family: var(--font-display);
      line-height: 1.5;
    }

    .steps {
      margin-top: 44px;
    }

    .steps ol {
      list-style: none;
      display: grid;
      gap: 12px;
      margin: 14px 0 0;
      padding: 0;
      counter-reset: step;
    }

    .steps li {
      padding: 18px;
    }

    .steps p {
      margin: 0;
      color: var(--ink-2);
    }

    .icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin-bottom: 12px;
      border-radius: 12px;
      background: var(--brand-soft);
      color: var(--brand);
    }

    .two {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }

    .card {
      padding: 22px;
    }

    .ticks {
      list-style: none;
      display: grid;
      gap: 10px;
      margin: 12px 0 14px;
      padding: 0;
    }

    .ticks li {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 10px;
      line-height: 1.45;
    }

    .ticks mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
      color: var(--brand);
    }

    @media (min-width: 900px) {
      .hero {
        grid-template-columns: 1.15fr 1fr;
        align-items: center;
        gap: 48px;
        padding-top: 36px;
      }

      .steps ol {
        grid-template-columns: repeat(4, 1fr);
      }

      .two {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class Home {
  protected readonly samples = SAMPLE_CASES;
  protected readonly steps = [
    { icon: 'upload_file', title: 'Add your documents', text: 'Invoice, cancellation or return message, refund message, support chat.' },
    { icon: 'fact_check', title: 'Check the facts', text: 'Each fact shows its source. Nivaran asks only when documents disagree or something is missing.' },
    { icon: 'alt_route', title: 'See the next step', text: 'Who to write to now, why, and the dates that matter after you send.' },
    { icon: 'edit_note', title: 'Approve and send', text: 'A complaint with every amount, date and ID tied to your evidence. You send it.' },
  ] as const;
}
