import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { SampleCard } from './sample-card';
import { SAMPLE_CARDS } from './sample-catalogue';

/** /saved-runs: every recorded sample in one place, plus the guided tour. */
@Component({
  selector: 'app-saved-runs',
  imports: [RouterLink, MatButtonModule, MatIconModule, SampleCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <p class="eyebrow">For judges and first-time visitors</p>
      <h1>See Nivaran work, without uploading anything</h1>
      <p class="lede muted">
        Each saved run is a real recording of the agent working through fictional documents. Opening
        one makes no model calls. Failures were recorded too, and they are shown, not hidden.
      </p>
      <ul class="pills" aria-label="About saved runs">
        <li><mat-icon aria-hidden="true">bolt</mat-icon>Opens instantly</li>
        <li><mat-icon aria-hidden="true">savings</mat-icon>No model calls</li>
        <li><mat-icon aria-hidden="true">description</mat-icon>Fictional seller and documents</li>
        <li><mat-icon aria-hidden="true">visibility</mat-icon>Failures disclosed</li>
      </ul>
    </header>

    <section class="grid" aria-label="Saved runs">
      @for (sample of samples; track sample.id) {
        <app-sample-card [sample]="sample" [detailed]="true" />
      }
      <a class="tour surface" routerLink="/demo">
        <span class="icon"><mat-icon aria-hidden="true">touch_app</mat-icon></span>
        <span class="title">Guided tour</span>
        <span class="desc">
          An invented example you can click through yourself: answer the question, approve the plan,
          and watch a made-up ID get flagged in the complaint.
        </span>
        <span class="tag">Illustration, not a model run</span>
        <span class="open">Start the tour <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
      </a>
    </section>

    <section class="how surface">
      <div>
        <h2>What to look at in each run</h2>
        <p class="muted">Every saved run opens on the same four tabs as a real case.</p>
      </div>
      <ol>
        <li><strong>Facts</strong> Tap any fact to open the document page and the exact words it came from.</li>
        <li><strong>Activity</strong> Every step the agent took, in order, in plain words.</li>
        <li><strong>Plan</strong> The next step chosen by code, its reasons, sources and deadlines.</li>
        <li><strong>Complaint</strong> The draft, with each amount, date and ID tied to its evidence.</li>
      </ol>
    </section>

    <section class="cta">
      <h2>Have a refund of your own?</h2>
      <p class="muted">No sign-up. You review everything, and you send the complaint yourself.</p>
      <a mat-flat-button routerLink="/cases/new">Start a case</a>
    </section>
  `,
  styles: `
    .head {
      max-width: 760px;
      margin-bottom: 24px;
    }

    .lede {
      font-size: 1.05rem;
    }

    .pills {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0 0;
      padding: 0;
    }

    .pills li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--ink-2);
    }

    .pills mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--brand);
    }

    .grid {
      display: grid;
      gap: 14px;
    }

    .tour {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 18px;
      border-style: dashed;
      color: inherit;
      text-decoration: none;
    }

    .tour:hover {
      border-color: var(--brand);
    }

    .icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--highlight-soft);
      color: var(--st-needs_check);
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 560;
    }

    .desc {
      color: var(--ink-2);
      font-size: 0.9rem;
    }

    .tag {
      align-self: flex-start;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--st-missing-bg);
      color: var(--st-missing);
      font-size: 0.72rem;
      font-weight: 600;
    }

    .open {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
      color: var(--brand);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .open mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .how {
      display: grid;
      gap: 16px;
      margin-top: 28px;
      padding: 22px;
    }

    .how ol {
      display: grid;
      gap: 10px;
      margin: 0;
      padding-left: 20px;
      line-height: 1.5;
    }

    .how strong {
      display: block;
    }

    .cta {
      margin-top: 28px;
      padding: 28px 22px;
      border-radius: var(--radius);
      background: var(--ink);
      color: #fff;
      text-align: center;
    }

    .cta h2 {
      color: #fff;
    }

    .cta .muted {
      color: #c9ccd6;
    }

    @media (min-width: 700px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1000px) {
      .grid {
        grid-template-columns: repeat(3, 1fr);
      }

      .how {
        grid-template-columns: 1fr 2fr;
        align-items: start;
      }
    }
  `,
})
export class SavedRuns {
  protected readonly samples = SAMPLE_CARDS;
}
