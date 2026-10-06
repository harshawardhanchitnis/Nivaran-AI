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
import type { FactField } from '@shared/facts';
import { isFactField } from '@shared/facts';
import type { AgentAnswerRequest } from '@shared/api';
import type { RecordOutcomeRequest } from '@shared/api';
import { CasesService } from '../../core/cases.service';
import { OutcomePanel, type OutcomeSubmission } from '../../shared/ui/outcome-panel';
import { CaseWorkspaceService, type WorkspaceRows } from '../../core/case-workspace.service';
import { continueReading, waitForReading } from '../../core/reading-loop';
import {
  workspaceActivity,
  workspaceFacts,
  workspaceQuestion,
  workspaceStage,
  type DocumentPreview,
} from '../../core/workspace-mapper';
import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';
import { indiaCalendarDate, workspacePlan, sentPlanView } from '../../core/workspace-plan';
import { DraftEditor } from '../../shared/ui/draft-editor';
import { SentPanel } from '../../shared/ui/sent-panel';
import { downloadPlanDates } from '../../core/calendar-download';
import { ReplacementUpload } from '../../shared/ui/replacement-upload';
import {
  draftPresentation,
  draftStatements,
  workspaceDraftContext,
} from '../../core/workspace-draft';

@Component({
  selector: 'app-case-workspace',
  imports: [CaseWorkspaceView, DraftEditor, SentPanel, OutcomePanel, ReplacementUpload, RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows(); as data) {
      <app-case-workspace-view
        [heading]="data.case.title"
        [merchant]="merchant()"
        [documentCount]="data.documents.length"
        [stage]="stage()"
        [facts]="facts()"
        [requiredFields]="requiredFields()"
        [activity]="activity()"
        [busy]="busy()"
        [question]="question()"
        [answerBusy]="answerBusy()"
        [plan]="plan()"
        [approved]="approved()"
        [reviewBusy]="reviewBusy()"
        [draft]="draftSegments()"
        [draftId]="data.draft?.id ?? null"
        [customDraft]="true"
        (approve)="reviewPlan('approve')"
        (decline)="reviewPlan('reject')"
        (edit)="reviewPlan('change')"
        (answered)="saveAnswer({ optionId: $event })"
        (textAnswered)="saveAnswer($event)"
        (sourceRequested)="openSources($event)"
        (sourceRetry)="retrySource($event)"
      >
        <div banner class="notice no-print" aria-live="polite">
          @if (canAddDocument()) {
            <app-replacement-upload [busy]="replacementBusy()" [uploaded]="replacementDocumentId() !== null"
              (submitted)="addReplacement($event)" (retry)="addReplacement()" />
          }
          @if (error(); as message) {
            <p role="alert">{{ message }}</p>
            <button mat-stroked-button type="button" [disabled]="busy()" (click)="reload()">
              Try again
            </button>
          } @else if (waiting()) {
            <p>Model cooldown: retrying in {{ cooldownSeconds() }} seconds. Your progress is saved.</p>
          } @else if (busy()) {
            <p>
              {{
                data.run?.phase === 'reading'
                  ? 'Reading your documents, one at a time.'
                  : 'Checking the next step.'
              }}
              You can leave and return to this case.
            </p>
          } @else if (data.run?.status === 'failed') {
            <p role="status">
              {{ data.run?.error ?? 'Nivaran could not finish. Your facts are saved.' }}
            </p>
          } @else if (data.run?.status === 'waiting_for_user') {
            <p>Answer the question below to continue. Your progress is saved.</p>
          } @else if (data.plan?.rejected_at) {
            <p>You rejected this plan. Nothing has been drafted or sent.</p>
          } @else if (approved()) {
            <p>
              {{
                data.plan?.sent_on
                  ? 'You recorded sending this complaint on ' + data.plan?.sent_on + '.'
                  : 'You approved this plan.'
              }}
              {{
                plan()?.step === 0
                  ? 'Wait until the promised date; there is nothing to send yet.'
                  : data.plan?.sent_on
                    ? 'The dates are based on your recorded sent date.'
                    : 'Nothing has been sent.'
              }}
            </p>
          } @else if (data.run?.status === 'plan_ready') {
            <p>
              {{
                plan()
                  ? 'Review the Plan tab and choose whether to accept, request a change, or reject it.'
                  : 'The checked sources for this plan are unavailable. Your facts are saved; try again later.'
              }}
            </p>
          } @else if (terminalOutcome() === 'resolved') {
            <p>You recorded that the refund arrived. This case is resolved.</p>
          } @else if (terminalOutcome() === 'bank_delay') {
            <p>
              The merchant states the refund was processed and supplied a reference. Take the
              reference to your bank to trace it. Nivaran stops here.
            </p>
          } @else if (data.run?.phase === 'investigating') {
            <p>Your documents have been read. Open a fact to review its source and exact quote.</p>
          } @else if (data.documents.length === 0) {
            <p>
              This case has no documents yet.
              <a routerLink="/cases/new">Start a case with your documents.</a>
            </p>
          }
          @if (busy() && data.documents.length) {
            <ul class="document-progress" aria-label="Document reading progress">
              @for (document of data.documents; track document.id) {
                <li><strong>{{ document.label }}</strong> {{ document.file_name }} · {{ readLabel(document.read_status) }}</li>
              }
            </ul>
          }
          @if (plan()?.step === 0) {
            <button mat-stroked-button type="button" (click)="calendar()">
              Add refund date to calendar
            </button>
            @if (draftMessage(); as message) {
              <p role="status">{{ message }}</p>
            }
          }
          @if (data.sentComplaint && data.case.status !== 'resolved') {
            <app-outcome-panel [previous]="data.sentComplaint.outcome" [completedRequest]="completedOutcome()" [existingFiles]="existingFiles()" [busy]="outcomeBusy() || busy() || draftBusy()" (outcomeRequested)="recordOutcome($event)"/>
          }
        </div>
        @if (data.draft; as draft) {
          <app-draft-editor
            complaint-editor
            [draft]="draft"
            [context]="draftContext()!"
            [busy]="draftBusy()"
            (saveRequested)="saveDraft($event)"
            (copyRequested)="copyDraft($event)"
            (printRequested)="printDraft()"
          />
        }
        <div draft-tools class="notice no-print">
          @if (draftMessage(); as message) {
            <p role="status">{{ message }}</p>
          }
          @if (canPrepareDraft()) {
            <button mat-flat-button type="button" [disabled]="draftBusy()" (click)="prepareDraft()">
              {{ draftBusy() ? 'Preparing complaint…' : 'Prepare complaint' }}
            </button>
            <button mat-stroked-button type="button" [disabled]="draftBusy()" (click)="prepareDraft('basic')">
              Use basic complaint without AI wording
            </button>
            <p class="muted">The basic version uses your approved facts and costs no model call. Review it before sending.</p>
          }
          @if (data.draft) {
            <a [routerLink]="['/cases', caseId(), 'pack']">Open printable pack</a>
          }
          @if (data.draft && data.plan?.ladder_step === 1) {
            <app-sent-panel
              [plan]="sentPlan()!"
              [today]="today()"
              [busy]="sentBusy()"
              (recordRequested)="markSent($event)"
              (calendarRequested)="calendar()"
            />
          }
        </div>
      </app-case-workspace-view>
    } @else {
      <h1>Your refund case</h1>
      @if (error(); as message) {
        <p role="alert">{{ message }}</p>
        <button mat-stroked-button type="button" (click)="reload()">Try again</button>
        <p><a routerLink="/cases">Back to My cases</a></p>
      } @else {
        <p role="status">Loading your saved case…</p>
      }
    }
  `,
  styles: `
    .notice {
      color: var(--ink-2);
      margin-bottom: 16px;
    }
    .notice p {
      margin-bottom: 8px;
    }
    .document-progress { padding-left: 20px; font-size: .9rem; }
    .document-progress li { overflow-wrap: anywhere; margin: 4px 0; }
  `,
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
  protected readonly replacementBusy = signal(false);
  protected readonly replacementDocumentId = signal<string|null>(null);
  protected readonly canAddDocument = computed(() => {
    const data=this.rows();const question=data?.questions.at(-1);
    return !this.busy() && !!data && (data.run?.status==='failed' || data.run?.status==='waiting_for_user' && question?.kind==='document_request') && (data.documents.length<6 || data.documents.some(d=>d.read_status==='pending'));
  });
  protected async addReplacement(file?: File):Promise<void> {
    const data=this.rows();if(!data||this.replacementBusy()||this.busy()||!this.canAddDocument())return;
    this.replacementBusy.set(true);this.error.set(null);
    try {
      let documentId=this.replacementDocumentId();
      if(!documentId) { if(!file)return; const document=await this.cases.addReplyDocument(data.case.id,file,true);documentId=document.id;this.replacementDocumentId.set(documentId); }
      await this.service.resumeDocumentReading(data.case.id,documentId);
      this.replacementDocumentId.set(null);
      await this.reload();
    } catch(error) {this.error.set(error instanceof Error?error.message:'Could not add the clearer file. Earlier facts are saved.');}
    finally {this.replacementBusy.set(false);}
  }
  protected readonly reviewBusy = signal(false);
  protected readonly draftBusy = signal(false);
  protected readonly sentBusy = signal(false);
  protected readonly outcomeBusy = signal(false);
  protected readonly completedOutcome=signal<string|null>(null);
  private readonly cases=inject(CasesService);
  private pendingOutcome:RecordOutcomeRequest|null=null;
  protected readonly existingFiles=computed(()=>(this.rows()?.documents??[]).map(d=>({name:d.file_name,type:d.mime_type,size:d.size_bytes})));
  protected readonly draftMessage = signal<string | null>(null);
  protected readonly today = signal(indiaCalendarDate());
  protected readonly waiting = signal(false);
  private readonly clockNow = signal(Date.now());
  private readonly cooldownUntil = signal(0);
  protected readonly cooldownSeconds = computed(() => Math.max(0, Math.ceil((this.cooldownUntil() - this.clockNow()) / 1000)));
  protected readLabel(status: string): string { return ({ pending: 'Queued', reading: 'Reading', read: 'Read', failed: 'Needs a clearer file', unreadable: 'Needs a clearer file' } as Record<string,string>)[status] ?? status; }
  protected readonly error = signal<string | null>(null);
  protected readonly facts = computed(() => {
    const data = this.rows();
    return data ? workspaceFacts(data.documents, data.evidence, data.facts, this.previews()) : [];
  });
  protected readonly merchant = computed(() => this.rows()?.case.merchant_name ?? this.facts().find(f => f.field === 'merchant_name' && ['document','user'].includes(f.status))?.value ?? 'Your refund case');
  protected readonly requiredFields = computed(() => {
    const fields = this.rows()?.run?.agent_state?.next_step?.['requiredFields'];
    const questionField = this.rows()?.questions.at(-1)?.field;
    return [...new Set([...(Array.isArray(fields) ? fields.filter((f): f is FactField => typeof f === 'string' && isFactField(f)) : []), ...(questionField && isFactField(questionField) && this.question() ? [questionField] : [])])];
  });
  protected readonly activity = computed(() => workspaceActivity(this.rows()?.events ?? []));
  protected readonly question = computed(() =>
    workspaceQuestion(this.rows()?.questions ?? [], this.rows()?.run ?? null, this.rows()?.documents ?? [], this.rows()?.evidence ?? []),
  );
  protected readonly plan = computed(() => {
    const data = this.rows();
    return data
      ? workspacePlan(data.plan ?? null, data.guidance ?? [], data.facts, this.today())
      : null;
  });
  protected readonly approved = computed(() => !!this.rows()?.plan?.approved_at);
  protected readonly sentPlan = computed(() => sentPlanView(this.rows()?.plan ?? null));
  protected readonly canPrepareDraft = computed(() => {
    const data = this.rows();
    return (
      !!data?.plan?.approved_at &&
      !data.plan.rejected_at &&
      [1, 2].includes(data.plan.ladder_step) &&
      !(data.plan.ladder_step === 1 && data.plan.sent_on) &&
      !data.draft
    );
  });
  protected readonly draftContext = computed(() => {
    const data = this.rows();
    return data ? workspaceDraftContext(data, this.today()) : null;
  });
  protected readonly draftSegments = computed(() => {
    const data = this.rows();
    const context = this.draftContext();
    return data?.draft && context
      ? draftPresentation(
          data.draft,
          data.draft.rendered_md ?? '',
          context,
          { name: '', contact: '', address: '' },
          draftStatements(data.draft),
        ).segments
      : null;
  });
  protected readonly terminalOutcome = computed(
    () => this.rows()?.run?.agent_state?.next_step?.['outcome'],
  );
  protected readonly stage = computed(() =>
    this.rows()?.run?.status === 'waiting_for_user'
      ? 'Needs your answer'
      : this.rows()?.case.status === 'sent'
        ? 'Complaint sent'
        : this.approved()
          ? 'Plan approved'
          : this.rows()?.plan?.rejected_at
            ? 'Plan rejected'
            : this.terminalOutcome() === 'resolved'
              ? 'Refund arrived'
              : this.terminalOutcome() === 'bank_delay'
                ? 'Trace with your bank'
                : workspaceStage(this.rows()?.run ?? null),
  );

  constructor() {
    const ticker = setInterval(() => { if (this.waiting()) this.clockNow.set(Date.now()); }, 1000);
    effect(() => {
      const id = this.caseId();
      untracked(() => {
        void this.open(id);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(ticker);
      this.controller?.abort();
      this.clearPreviews();
    });
  }

  protected reload(): void {
    void this.open(this.caseId());
  }

  private async open(caseId: string): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    this.error.set(null);
    this.waiting.set(false);
    this.busy.set(true);
    this.today.set(indiaCalendarDate());
    this.draftMessage.set(null);
    this.draftBusy.set(false);
    this.sentBusy.set(false);
    this.outcomeBusy.set(false);
    this.pendingOutcome=null;
    this.completedOutcome.set(null);
    this.rows.set(null);
    this.clearPreviews();
    const refresh = async () => {
      const data = await this.service.load(caseId);
      if (!controller.signal.aborted) this.rows.set(data);
    };
    try {
      await refresh();
      if (controller.signal.aborted) return;
      const initial = this.rows();
      if (!initial || (!initial.documents.length && !initial.run)) return;
      if (initial.run?.status==='failed' || initial.run?.status==='waiting_for_user' && initial.questions.at(-1)?.kind==='document_request') {
        this.replacementDocumentId.set(initial.documents.filter(d=>d.read_status==='pending').at(-1)?.id ?? null);
      }
      await this.continueRun(initial, controller, refresh);
    } catch (error) {
      if (generation === this.generation)
        this.error.set(
          error instanceof Error ? error.message : 'Could not load your case. Try again.',
        );
    } finally {
      if (generation === this.generation) {
        this.busy.set(false);
        this.waiting.set(false);
      }
    }
  }

  private async continueRun(
    data: WorkspaceRows,
    controller: AbortController,
    refresh: () => Promise<void>,
  ): Promise<void> {
    const latest = data.questions?.at(-1);
    await continueReading(data.run, {
      start: () => this.service.start(data.case.id),
      advance: (run) => this.service.advance(run),
      current: async () => this.rows()?.run ?? null,
      refresh,
      wait: (ms) => waitForReading(ms, controller.signal),
      cooldown: (ms) => { this.clockNow.set(Date.now()); this.cooldownUntil.set(Date.now() + ms); },
      delay: (value) => { if (!controller.signal.aborted) this.waiting.set(value); },
      signal: controller.signal,
      resumeWaiting:
        !!latest?.answered_at && latest.id !== data.run?.agent_state?.answered_question_id,
    });
  }

  protected async saveAnswer(answer: AgentAnswerRequest['answer']): Promise<void> {
    const question = this.question();
    const controller = this.controller;
    const data = this.rows();
    if (!question || !controller || !data || this.answerBusy() || this.busy()) return;
    const generation = this.generation;
    this.answerBusy.set(true);
    this.busy.set(true);
    this.error.set(null);
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
      if (generation === this.generation)
        this.error.set(
          error instanceof Error ? error.message : 'Could not save your answer. Try again.',
        );
      if (!controller.signal.aborted) {
        try {
          await refresh();
        } catch {
          /* Keep the loaded case usable while offline. */
        }
      }
    } finally {
      if (generation === this.generation) {
        this.answerBusy.set(false);
        this.busy.set(false);
        this.waiting.set(false);
      }
    }
  }

  protected async reviewPlan(action: 'approve' | 'reject' | 'change'): Promise<void> {
    const data = this.rows();
    const plan = this.plan();
    const generation = this.generation;
    if (!data || !plan?.id || this.busy() || this.reviewBusy()) return;
    this.reviewBusy.set(true);
    this.error.set(null);
    try {
      await this.service.reviewPlan(plan.id, action);
      const latest = await this.service.load(data.case.id);
      if (generation === this.generation) {
        this.rows.set(latest);
        if (action === 'approve' && this.canPrepareDraft()) this.draftMessage.set('Plan approved. Choose AI wording or a basic complaint without a model call on the Complaint tab.');
      }
    } catch (error) {
      if (generation === this.generation)
        this.error.set(
          error instanceof Error ? error.message : 'Could not save your plan decision. Try again.',
        );
    } finally {
      if (generation === this.generation) this.reviewBusy.set(false);
    }
  }

  protected async prepareDraft(mode: 'model' | 'basic' = 'model'): Promise<void> {
    const data = this.rows();
    const generation = this.generation;
    if (!data?.plan || !this.canPrepareDraft() || this.draftBusy()) return;
    this.draftBusy.set(true);
    this.draftMessage.set(null);
    try {
      const result = await this.service.prepareDraft(data.plan.id, mode);
      if (generation !== this.generation) return;
      if (result.draft) {
        const draft = result.draft;
        this.rows.update((rows) => (rows ? { ...rows, draft } : rows));
      } else
        this.draftMessage.set(
          'The models are temporarily unavailable. Your approved plan is saved. Try preparing the complaint again shortly.',
        );
    } catch (error) {
      if (generation === this.generation)
        this.draftMessage.set(
          error instanceof Error
            ? error.message
            : 'Could not prepare the complaint. Your approved plan is saved.',
        );
    } finally {
      if (generation === this.generation) this.draftBusy.set(false);
    }
  }
  protected async saveDraft(edit: { text: string; userStatements: string[] }): Promise<void> {
    const draft = this.rows()?.draft;
    const generation = this.generation;
    if (!draft || this.draftBusy()) return;
    this.draftBusy.set(true);
    this.draftMessage.set(null);
    try {
      const result = await this.service.saveDraftEdit({ draftId: draft.id, ...edit });
      if (generation === this.generation) {
        this.rows.update((rows) => (rows ? { ...rows, draft: result.draft } : rows));
        this.draftMessage.set('Edits saved. Nivaran does not send your complaint.');
      }
    } catch (error) {
      if (generation === this.generation)
        this.draftMessage.set(
          error instanceof Error
            ? error.message
            : 'Could not save edits. Your text is still on this page.',
        );
    } finally {
      if (generation === this.generation) this.draftBusy.set(false);
    }
  }
  protected async copyDraft(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.draftMessage.set('Complaint text copied with its source labels.');
    } catch {
      this.draftMessage.set(
        'Copy is unavailable in this browser. Open the printable pack or select the preview text to copy it.',
      );
    }
  }
  protected printDraft(): void {
    window.print();
  }
  protected async markSent(sentOn: string): Promise<void> {
    const data = this.rows();
    const generation = this.generation;
    if (!data?.plan || this.sentBusy()) return;
    this.sentBusy.set(true);
    this.draftMessage.set(null);
    try {
      await this.service.markSent(data.plan.id, sentOn);
      const latest = await this.service.load(data.case.id);
      if (generation === this.generation) {
        this.rows.set(latest);
        this.draftMessage.set(
          'Sent date saved as Your statement. Review the updated dates on the Plan tab.',
        );
      }
    } catch (error) {
      if (generation === this.generation)
        this.draftMessage.set(
          error instanceof Error
            ? error.message
            : 'Could not record the date. Your complaint is safe.',
        );
    } finally {
      if (generation === this.generation) this.sentBusy.set(false);
    }
  }
  protected calendar(): void {
    const data = this.rows();
    if (!data?.plan) return;
    try {
      downloadPlanDates(data.plan, data.case.title);
      this.draftMessage.set(
        'Calendar file downloaded. Import it in your calendar; adjust dates if receipt was later.',
      );
    } catch {
      this.draftMessage.set(
        'Could not create the calendar file. Review the saved dates and try again.',
      );
    }
  }

  protected async recordOutcome(update: OutcomeSubmission): Promise<void> {
    const data=this.rows();const controller=this.controller;const generation=this.generation;
    if (!data?.sentComplaint || !controller || this.busy() || this.outcomeBusy()) return;
    this.outcomeBusy.set(true);this.busy.set(true);this.error.set(null);
    const refresh=async()=>{
      const latest=await this.service.load(data.case.id);
      if (generation===this.generation) this.rows.set(latest);
    };
    try {
      if (this.pendingOutcome?.requestId!==update.requestId) {
        const reply=update.file ? await this.cases.addReplyDocument(data.case.id,update.file,update.consent) : null;
        if (generation!==this.generation) return;
        this.pendingOutcome={planId:data.sentComplaint.id,requestId:update.requestId,outcome:update.outcome,...(reply?{replyDocumentId:reply.id}:{})};
      }
      await this.service.recordOutcome(this.pendingOutcome);
      if (generation!==this.generation) return;
      this.completedOutcome.set(update.requestId);
      this.pendingOutcome=null;
      await refresh();
      const latest=this.rows();
      if (latest) await this.continueRun(latest,controller,refresh);
    } catch (error) {
      if (generation===this.generation) {
        this.error.set(error instanceof Error?error.message:'Could not save the update. Your earlier complaint is safe; try again.');
        try { await refresh(); } catch { /* Keep the saved screen usable while offline. */ }
      }
    } finally {
      if (generation===this.generation) {this.outcomeBusy.set(false);this.busy.set(false);this.waiting.set(false);}
    }
  }

  protected openSources(field: FactField): void {
    const fact = this.facts().find((fact) => fact.field === field);
    const ids = new Set(
      fact?.sources.map((source) => source.documentId).filter((id): id is string => !!id),
    );
    for (const id of ids) void this.loadSource(id);
  }

  protected retrySource(documentId: string): void {
    this.previewExpires.delete(documentId);
    void this.loadSource(documentId);
  }

  private async loadSource(id: string): Promise<void> {
    if ((this.previewExpires.get(id) ?? 0) > Date.now() || this.previews()[id]?.loading) return;
    const document = this.rows()?.documents.find((document) => document.id === id);
    if (!document) return;
    const generation = this.generation;
    Object.values(this.previews()[id]?.pageImages ?? {}).forEach((url) => URL.revokeObjectURL(url));
    this.previews.update((previews) => ({ ...previews, [id]: { loading: true } }));
    try {
      const url = await this.service.sourceUrl(document);
      if (generation !== this.generation) return;
      const pages = this.rows()
        ?.evidence.filter((item) => item.document_id === id)
        .map((item) => item.page ?? 1) ?? [1];
      const pageImages =
        document.mime_type === 'application/pdf'
          ? await this.service.pdfPages(url, pages)
          : undefined;
      if (generation !== this.generation || this.controller?.signal.aborted) {
        Object.values(pageImages ?? {}).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      this.previewExpires.set(id, Date.now() + 540_000);
      this.previews.update((previews) => ({ ...previews, [id]: { url, pageImages } }));
    } catch (error) {
      if (generation === this.generation)
        this.previews.update((previews) => ({
          ...previews,
          [id]: {
            error: error instanceof Error ? error.message : 'Could not open the source. Try again.',
          },
        }));
    }
  }

  private clearPreviews(): void {
    Object.values(this.previews())
      .flatMap((preview) => Object.values(preview.pageImages ?? {}))
      .forEach((url) => URL.revokeObjectURL(url));
    this.previews.set({});
    this.previewExpires.clear();
  }
}
