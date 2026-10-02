import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CaseWorkspaceService, type WorkspaceRows } from '../../core/case-workspace.service';
import { indiaCalendarDate, workspacePlan, sentPlanView } from '../../core/workspace-plan';
import { workspaceDraftContext } from '../../core/workspace-draft';
import { DraftEditor } from '../../shared/ui/draft-editor';
import { DeadlineTimeline } from '../../shared/ui/deadline-timeline';
import { EvidenceTag } from '../../shared/ui/evidence-tag';
import { SentPanel } from '../../shared/ui/sent-panel';
import { downloadPlanDates } from '../../core/calendar-download';

@Component({
  selector: 'app-case-pack',
  imports: [RouterLink, MatButtonModule, DraftEditor, DeadlineTimeline, EvidenceTag, SentPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="no-print"><a [routerLink]="['/cases', caseId()]">Back to your case</a></p>
    <h1>Complaint pack</h1>
    @if (rows(); as data) {
      @if (data.draft && plan(); as current) {
        <p>{{ data.case.title }}</p>
        <p>
          Nivaran is not legal advice. The ladder order is recommended practice. Review this pack
          and send it yourself. Nivaran never sends or files it.
        </p>
        <div class="no-print" aria-live="polite">
          @if (message(); as message) {
            <p role="status">{{ message }}</p>
          }
        </div>
        <h2>Complaint</h2>
        <app-draft-editor
          [draft]="data.draft"
          [context]="context()!"
          [busy]="busy()"
          (saveRequested)="save($event)"
          (copyRequested)="copy($event)"
          (printRequested)="print()"
        />
        @if (data.plan?.ladder_step === 1) {
          <app-sent-panel
            [plan]="sentPlan()!"
            [today]="today()"
            [busy]="busy()"
            (recordRequested)="markSent($event)"
            (calendarRequested)="calendar()"
          />
        }
        <section class="surface pack-section" aria-labelledby="pack-timeline">
          <h2 id="pack-timeline">Timeline</h2>
          <app-deadline-timeline [items]="current.timeline" />
        </section>
        <section class="surface pack-section" aria-labelledby="pack-evidence">
          <h2 id="pack-evidence">Evidence index</h2>
          <p>
            The labels refer to your uploaded documents. A document states what it says; it does not
            establish that the refund reached your account.
          </p>
          @if (index().length) {
            <ol class="evidence-index">
              @for (document of index(); track document.id) {
                <li>
                  <app-evidence-tag [label]="document.label" /><span
                    >{{ document.fileName }}<small>{{ document.details }}</small></span
                  >
                </li>
              }
            </ol>
          } @else {
            <p>No uploaded documents. Values labelled “Your statement” came from you.</p>
          }
        </section>
        <section class="surface pack-section" aria-labelledby="pack-sources">
          <h2 id="pack-sources">Checked guidance sources</h2>
          <ul>
            @for (reason of current.reasons; track $index) {
              @if (reason.sourceUrl) {
                <li>
                  <a [href]="reason.sourceUrl" target="_blank" rel="noopener noreferrer">{{
                    reason.sourceName
                  }}</a>
                  — checked {{ reason.checkedOn }}
                </li>
              }
            }
          </ul>
        </section>
      } @else {
        <p role="status">
          Your pack appears after you approve the plan and prepare a complaint on the case screen.
        </p>
      }
    } @else if (error(); as message) {
      <p role="alert">{{ message }}</p>
      <button mat-stroked-button type="button" (click)="reload()">Try again</button>
    } @else {
      <p role="status">Loading your saved pack…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 760px;
    }
    .pack-section {
      padding: 20px;
      margin-top: 24px;
    }
    .evidence-index {
      list-style: none;
      padding: 0;
    }
    .evidence-index li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
      overflow-wrap: anywhere;
    }
    .evidence-index small {
      display: block;
      color: var(--ink-2);
    }
    @media print {
      .pack-section {
        box-shadow: none;
        border: 0;
        padding: 0;
      }
      h2 {
        break-after: avoid;
      }
      li {
        break-inside: avoid;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      a::after {
        content: ' (' attr(href) ')';
        font-size: 0.8em;
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class CasePack {
  readonly caseId = input.required<string>();
  private readonly service = inject(CaseWorkspaceService);
  private generation = 0;
  protected readonly rows = signal<WorkspaceRows | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly today = signal(indiaCalendarDate());
  protected readonly sentPlan = computed(() => sentPlanView(this.rows()?.plan ?? null));
  protected readonly plan = computed(() => {
    const data = this.rows();
    return data?.plan?.approved_at
      ? workspacePlan(data.plan, data.guidance, data.facts, this.today())
      : null;
  });
  protected readonly context = computed(() => {
    const data = this.rows();
    return data ? workspaceDraftContext(data, this.today()) : null;
  });
  protected readonly index = computed(() => {
    const data = this.rows();
    return (data?.documents ?? []).map((document) => {
      const pages = [
        ...new Set(
          data?.evidence
            .filter((e) => e.document_id === document.id)
            .map((e) => e.page)
            .filter((p): p is number => p !== null) ?? [],
        ),
      ].sort((a, b) => a - b);
      return {
        id: document.id,
        label: document.label,
        fileName: document.file_name,
        details: [
          document.doc_type?.replaceAll('_', ' ') ?? 'Document',
          pages.length
            ? `Quoted on page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}`
            : 'No quote recorded',
        ].join(' · '),
      };
    });
  });
  constructor() {
    effect(() => {
      const id = this.caseId();
      untracked(() => {
        void this.open(id);
      });
    });
    inject(DestroyRef).onDestroy(() => this.generation++);
  }
  protected reload(): void {
    void this.open(this.caseId());
  }
  private async open(id: string): Promise<void> {
    const generation = ++this.generation;
    this.rows.set(null);
    this.error.set(null);
    this.message.set(null);
    this.busy.set(false);
    this.today.set(indiaCalendarDate());
    try {
      const data = await this.service.load(id);
      if (generation === this.generation) this.rows.set(data);
    } catch (error) {
      if (generation === this.generation)
        this.error.set(
          error instanceof Error ? error.message : 'Could not load your pack. Try again.',
        );
    }
  }
  protected async save(edit: { text: string; userStatements: string[] }): Promise<void> {
    const draft = this.rows()?.draft;
    const generation = this.generation;
    if (!draft || this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const result = await this.service.saveDraftEdit({ draftId: draft.id, ...edit });
      if (generation === this.generation) {
        this.rows.update((rows) => (rows ? { ...rows, draft: result.draft } : rows));
        this.message.set('Edits saved. Your private fields remain on this page.');
      }
    } catch (error) {
      if (generation === this.generation)
        this.message.set(
          error instanceof Error
            ? error.message
            : 'Could not save edits. Your text is still on this page.',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.message.set('Complaint text copied with its source labels.');
    } catch {
      this.message.set(
        'Copy is unavailable in this browser. Select the preview text to copy it, or print the pack.',
      );
    }
  }
  protected print(): void {
    window.print();
  }
  protected async markSent(sentOn: string): Promise<void> {
    const data = this.rows();
    const generation = this.generation;
    if (!data?.plan || this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      await this.service.markSent(data.plan.id, sentOn);
      const latest = await this.service.load(data.case.id);
      if (generation === this.generation) {
        this.rows.set(latest);
        this.message.set('Sent date saved as Your statement. The timeline has been updated.');
      }
    } catch (error) {
      if (generation === this.generation)
        this.message.set(
          error instanceof Error ? error.message : 'Could not record the date. Try again.',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  protected calendar(): void {
    const data = this.rows();
    if (!data?.plan) return;
    try {
      downloadPlanDates(data.plan, data.case.title);
      this.message.set(
        'Calendar file downloaded. Import it in your calendar; adjust dates if receipt was later.',
      );
    } catch {
      this.message.set('Could not create the calendar file. Check the dates and try again.');
    }
  }
}
