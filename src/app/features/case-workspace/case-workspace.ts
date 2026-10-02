import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import type { FactField } from '@shared/facts';
import type { AgentAnswerRequest } from '@shared/api';
import { CaseWorkspaceService, type WorkspaceRows } from '../../core/case-workspace.service';
import { continueReading, waitForReading } from '../../core/reading-loop';
import { workspaceActivity, workspaceFacts, workspaceQuestion, workspaceStage, type DocumentPreview } from '../../core/workspace-mapper';
import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';

@Component({
  selector: 'app-case-workspace',
  imports: [CaseWorkspaceView, RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows(); as data) {
      <app-case-workspace-view [heading]="data.case.title" [merchant]="data.case.merchant_name ?? 'Your refund case'"
        [documentCount]="data.documents.length" [stage]="stage()" [facts]="facts()" [activity]="activity()"
        [busy]="busy()" [question]="question()" [answerBusy]="answerBusy()"
        (answered)="saveAnswer({ optionId: $event })" (textAnswered)="saveAnswer($event)"
        (sourceRequested)="openSources($event)" (sourceRetry)="retrySource($event)">
        <div banner class="notice" aria-live="polite">
          @if (error(); as message) {
            <p role="alert">{{ message }}</p>
            <button mat-stroked-button type="button" [disabled]="busy()" (click)="reload()">Try again</button>
          } @else if (waiting()) {
            <p>Waiting for the model. Your progress is saved; Nivaran will continue shortly.</p>
          } @else if (busy()) {
            <p>{{ data.run?.phase === 'reading' ? 'Reading your documents, one at a time.' : 'Checking the next step.' }} You can leave and return to this case.</p>
          } @else if (data.run?.status === 'failed') {
            <p role="status">{{ data.run?.error ?? 'Nivaran could not finish. Your facts are saved.' }}</p>
          } @else if (data.run?.status === 'waiting_for_user') {
            <p>Answer the question below to continue. Your progress is saved.</p>
          } @else if (data.run?.phase === 'investigating') {
            <p>Your documents have been read. Open a fact to review its source and exact quote.</p>
          } @else if (data.documents.length === 0) {
            <p>This case has no documents yet. <a routerLink="/cases/new">Start a case with your documents.</a></p>
          }
        </div>
      </app-case-workspace-view>
    } @else {
      <h1>Your refund case</h1>
      @if (error(); as message) {
        <p role="alert">{{ message }}</p>
        <button mat-stroked-button type="button" (click)="reload()">Try again</button>
        <p><a routerLink="/cases">Back to My cases</a></p>
      } @else { <p role="status">Loading your saved case…</p> }
    }
  `,
  styles: `.notice { color: var(--ink-2); margin-bottom: 16px; } .notice p { margin-bottom: 8px; }`,
})
export class CaseWorkspace {
  readonly caseId = input.required<string>();
  private readonly service = inject(CaseWorkspaceService);
  private controller: AbortController | null = null;
  private generation = 0;
  private readonly previewExpires = new Map<string, number>();
  protected readonly rows = signal<WorkspaceRows | null>(null);
  protected readonly previews = signal<Record<string, DocumentPreview>>({});
  protected readonly busy = signal(false);
  protected readonly answerBusy = signal(false);
  protected readonly waiting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly facts = computed(() => {
    const data = this.rows();
    return data ? workspaceFacts(data.documents, data.evidence, data.facts, this.previews()) : [];
  });
  protected readonly activity = computed(() => workspaceActivity(this.rows()?.events ?? []));
  protected readonly question = computed(() => workspaceQuestion(this.rows()?.questions ?? [], this.rows()?.run ?? null));
  protected readonly stage = computed(() => workspaceStage(this.rows()?.run ?? null));

  constructor() {
    effect(() => { const id = this.caseId(); untracked(() => { void this.open(id); }); });
    inject(DestroyRef).onDestroy(() => { this.controller?.abort(); this.clearPreviews(); });
  }

  protected reload(): void { void this.open(this.caseId()); }

  private async open(caseId: string): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    this.error.set(null); this.waiting.set(false); this.busy.set(true);
    this.rows.set(null); this.clearPreviews();
    const refresh = async () => {
      const data = await this.service.load(caseId);
      if (!controller.signal.aborted) this.rows.set(data);
    };
    try {
      await refresh();
      if (controller.signal.aborted) return;
      const initial = this.rows();
      if (!initial || !initial.documents.length && !initial.run) return;
      await this.continueRun(initial, controller, refresh);
    } catch (error) {
      if (generation === this.generation) this.error.set(error instanceof Error ? error.message : 'Could not load your case. Try again.');
    } finally {
      if (generation === this.generation) { this.busy.set(false); this.waiting.set(false); }
    }
  }

  private async continueRun(data: WorkspaceRows, controller: AbortController, refresh: () => Promise<void>): Promise<void> {
    const latest = data.questions?.at(-1);
    await continueReading(data.run, {
      start: () => this.service.start(data.case.id), advance: run => this.service.advance(run),
      current: async () => this.rows()?.run ?? null, refresh,
      wait: ms => waitForReading(ms, controller.signal), delay: value => this.waiting.set(value),
      signal: controller.signal, resumeWaiting: !!latest?.answered_at && latest.id !== data.run?.agent_state?.answered_question_id,
    });
  }

  protected async saveAnswer(answer: AgentAnswerRequest['answer']): Promise<void> {
    const question = this.question(); const controller = this.controller; const data = this.rows();
    if (!question || !controller || !data || this.answerBusy() || this.busy()) return;
    const generation = this.generation;
    this.answerBusy.set(true); this.busy.set(true); this.error.set(null);
    const refresh = async () => {
      const latest = await this.service.load(data.case.id);
      if (!controller.signal.aborted) this.rows.set(latest);
    };
    try {
      await this.service.answer(question.id, answer);
      if (controller.signal.aborted) return;
      await refresh();
      const latest = this.rows();
      if (latest) await this.continueRun(latest, controller, refresh);
    } catch (error) {
      if (generation === this.generation) this.error.set(error instanceof Error ? error.message : 'Could not save your answer. Try again.');
      if (!controller.signal.aborted) { try { await refresh(); } catch { /* Keep the loaded case usable while offline. */ } }
    } finally {
      if (generation === this.generation) { this.answerBusy.set(false); this.busy.set(false); this.waiting.set(false); }
    }
  }

  protected openSources(field: FactField): void {
    const fact = this.facts().find(fact => fact.field === field);
    const ids = new Set(fact?.sources.map(source => source.documentId).filter((id): id is string => !!id));
    for (const id of ids) void this.loadSource(id);
  }

  protected retrySource(documentId: string): void {
    this.previewExpires.delete(documentId);
    void this.loadSource(documentId);
  }

  private async loadSource(id: string): Promise<void> {
    if ((this.previewExpires.get(id) ?? 0) > Date.now() || this.previews()[id]?.loading) return;
    const document = this.rows()?.documents.find(document => document.id === id);
    if (!document) return;
    const generation = this.generation;
    Object.values(this.previews()[id]?.pageImages ?? {}).forEach(url => URL.revokeObjectURL(url));
    this.previews.update(previews => ({ ...previews, [id]: { loading: true } }));
    try {
      const url = await this.service.sourceUrl(document);
      if (generation !== this.generation) return;
      const pages = this.rows()?.evidence.filter(item => item.document_id === id).map(item => item.page ?? 1) ?? [1];
      const pageImages = document.mime_type === 'application/pdf' ? await this.service.pdfPages(url, pages) : undefined;
      if (generation !== this.generation || this.controller?.signal.aborted) {
        Object.values(pageImages ?? {}).forEach(url => URL.revokeObjectURL(url)); return;
      }
      this.previewExpires.set(id, Date.now() + 540_000);
      this.previews.update(previews => ({ ...previews, [id]: { url, pageImages } }));
    } catch (error) {
      if (generation === this.generation) this.previews.update(previews => ({ ...previews, [id]: {
        error: error instanceof Error ? error.message : 'Could not open the source. Try again.',
      } }));
    }
  }

  private clearPreviews(): void {
    Object.values(this.previews()).flatMap(preview => Object.values(preview.pageImages ?? {})).forEach(url => URL.revokeObjectURL(url));
    this.previews.set({}); this.previewExpires.clear();
  }
}
