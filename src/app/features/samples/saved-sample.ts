import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { FactField } from '@shared/facts';
import type { SavedSample } from '@shared/samples';
import { sampleDocumentPath } from '@shared/samples';
import { SamplesService } from '../../core/samples.service';
import { CasesService } from '../../core/cases.service';
import { workspaceActivity, workspaceFacts, workspaceStage, questionOptions } from '../../core/workspace-mapper';
import type { DocumentPreview } from '../../core/workspace-mapper';
import { workspacePlan } from '../../core/workspace-plan';
import { draftPresentation, draftStatements } from '../../core/workspace-draft';
import { renderPdfPagePreviews } from '../../core/pdf-preview';
import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';
import type { QuestionView } from '../../shared/ui/models';

@Component({
  selector: 'app-saved-sample', imports: [RouterLink, MatButtonModule, MatIconModule, CaseWorkspaceView], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <section class="surface pad" role="alert"><h1>Saved run unavailable</h1><p>{{ error() }}</p><a routerLink="/saved-runs">Back to saved runs</a></section> }
    @else if (sample(); as saved) {
      <app-case-workspace-view [heading]="saved.title" merchant="Synthetic consumer case" [documentCount]="saved.documents.length"
        [stage]="stage()" [facts]="facts()" [activity]="activity()" [question]="question()" [plan]="plan()"
        [approved]="!!saved.plan?.approved_at" [draft]="draft()" [readOnly]="true"
        (sourceRequested)="openSource($event)" (sourceRetry)="preview($event)">
        <section banner class="surface pad stack saved" aria-label="Saved run information">
          <div class="saved-head">
            <span class="icon-tile"><mat-icon aria-hidden="true">play_circle</mat-icon></span>
            <div>
              <p class="eyebrow">Saved run · fictional documents</p>
              <p class="lead">A real recording of the agent working on this case. Opening this record makes no model calls, and nothing you do here changes it.</p>
            </div>
          </div>
          <ul class="facts-row" aria-label="About this recording">
            <li><mat-icon aria-hidden="true">event</mat-icon>Recorded {{ saved.recordedAt.slice(0, 10) }}</li>
            <li><mat-icon aria-hidden="true">today</mat-icon>Decisions use {{ saved.today }} as today (India)</li>
            <li><mat-icon aria-hidden="true">description</mat-icon>{{ saved.documents.length }} documents</li>
          </ul>
          @if (saved.warning) { <p class="warning" role="note"><mat-icon aria-hidden="true">info</mat-icon><span>{{ saved.warning }}</span></p> }
          <div class="row">
            <a mat-stroked-button routerLink="/saved-runs"><mat-icon aria-hidden="true">arrow_back</mat-icon>All saved runs</a>
            @if (remaining() > 0) { <a mat-flat-button routerLink="/cases/new" [queryParams]="{sample:saved.id}">Run it live</a> }
            @else { <span class="muted small" role="status">{{ quotaMessage() }}</span> }
          </div>
          <details><summary>Run details for reviewers</summary>
            <p class="small">{{ saved.provenance }}. {{ saved.logicalCalls }} logical model calls / {{ saved.providerAttempts }} provider attempts. Models attempted: {{ modelNames() }}.</p>
            <ul>
              @for (document of saved.documents; track document.id) {
                <li><a [href]="documentPath(document.id)" target="_blank" rel="noopener">{{ document.label }} · {{ document.file_name }}</a> · {{ document.read_status }}</li>
              }
            </ul>
          </details>
        </section>
      </app-case-workspace-view>
    } @else { <p role="status">Opening the saved run…</p> }
  `,
  styles: `.pad{padding:18px;margin-bottom:16px}.small{font-size:.85rem;margin:8px 0}li{overflow-wrap:anywhere}.saved-head{display:flex;gap:14px;align-items:flex-start}.saved-head .eyebrow{margin-bottom:2px}.lead{margin:0;color:var(--ink-2)}.facts-row{list-style:none;display:flex;flex-wrap:wrap;gap:8px 18px;margin:0;padding:0;font-size:.86rem;color:var(--ink-2)}.facts-row li{display:inline-flex;align-items:center;gap:6px}.facts-row mat-icon{width:18px;height:18px;font-size:18px;color:var(--brand)}.warning{display:grid;grid-template-columns:20px 1fr;gap:8px;margin:0;padding:10px 12px;border-radius:var(--radius-sm);background:var(--st-needs_check-bg);color:var(--st-needs_check);font-size:.88rem}.warning mat-icon{width:18px;height:18px;font-size:18px}details summary{cursor:pointer;color:var(--ink-2);font-size:.88rem;font-weight:600}a mat-icon{width:18px;height:18px;font-size:18px}`,
})
export class SavedSampleView {
  private readonly samples = inject(SamplesService);
  private readonly cases = inject(CasesService);
  protected readonly sample = signal<SavedSample | null>(null);
  protected readonly error = signal('');
  protected readonly remaining = signal(0);
  protected readonly quotaMessage = signal('Checking whether live calls remain…');
  protected readonly previews = signal<Record<string, DocumentPreview>>({});
  private destroyed = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.releasePreviews(); });
    const id = inject(ActivatedRoute).snapshot.paramMap.get('sampleId') ?? '';
    void this.load(id);
  }
  private async load(id: string): Promise<void> {
    try { const sample = await this.samples.load(id); if (!this.destroyed) this.sample.set(sample); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not open this saved run.'); return; }
    // Read-only quota advice: it never charges or invokes a provider.
    try { const budget = await this.cases.modelBudget(); this.remaining.set(budget.remaining); this.quotaMessage.set(budget.remaining ? '' : 'Live calls are unavailable today. Saved runs remain available.'); }
    catch { this.quotaMessage.set('Live availability could not be checked. Saved runs remain available.'); }
  }
  protected readonly stage = computed(() => workspaceStage(this.sample()?.run ?? null));
  protected readonly facts = computed(() => { const saved = this.sample(); return saved ? workspaceFacts(saved.documents, saved.evidence, saved.facts, this.previews()) : []; });
  protected readonly activity = computed(() => workspaceActivity(this.sample()?.events ?? []));
  protected readonly plan = computed(() => {
    const saved = this.sample(); const plan = saved ? workspacePlan(saved.plan, saved.guidance, saved.facts, saved.today) : null;
    return plan ? { ...plan, timeline: plan.timeline.map(item => item.id === 'today' ? { ...item, label: 'Recorded decision date' } : item) } : null;
  });
  protected readonly draft = computed(() => {
    const saved = this.sample(); if (!saved?.draft?.rendered_md) return null;
    return draftPresentation(saved.draft, saved.draft.rendered_md,
      { facts: saved.facts, documents: saved.documents, evidence: saved.evidence, dates: saved.plan?.dates ?? {}, today: saved.today },
      {name:'',contact:'',address:''}, draftStatements(saved.draft)).segments;
  });
  protected readonly question = computed<QuestionView | null>(() => {
    const recorded = this.sample()?.questions.at(-1); if (!recorded) return null;
    const saved = this.sample()!;
    const options = questionOptions(recorded, saved.documents, saved.evidence);
    const answer = recorded.answer; const optionId = answer && typeof answer === 'object' && 'optionId' in answer ? answer.optionId : null;
    const label = options.find(option => option.id === optionId)?.label ?? (typeof answer === 'string' ? answer : answer ? JSON.stringify(answer) : null);
    return {id:recorded.id,prompt:recorded.prompt,options,why:label ? `Recorded answer: ${label}. This view cannot change it.` : 'This question remained unanswered in the recorded run.'};
  });
  protected readonly modelNames = computed(() => Object.entries(this.sample()?.models ?? {}).map(([name, attempts]) => `${name} (${attempts})`).join('; '));
  protected documentPath(id: string): string { const saved = this.sample(); const doc = saved?.documents.find(row => row.id === id); return saved && doc ? sampleDocumentPath(saved, doc) : ''; }
  protected async openSource(field: FactField): Promise<void> {
    const documents = this.sample()?.evidence.filter(row => row.field === field && row.document_id).map(row => row.document_id!) ?? [];
    await Promise.all([...new Set(documents)].map(id => this.preview(id)));
  }
  protected async preview(id: string): Promise<void> {
    const saved = this.sample(); const document = saved?.documents.find(row => row.id === id);
    if (!saved || !document || this.previews()[id]?.loading || this.previews()[id]?.pageImages || this.previews()[id]?.url && !this.previews()[id]?.error) return;
    const url = sampleDocumentPath(saved, document);
    this.previews.update(rows => ({...rows,[id]:{url,loading:true}}));
    try {
      let pageImages: Record<number,string> | undefined;
      if (document.mime_type === 'application/pdf') {
        const response = await fetch(url); if (!response.ok) throw new Error('Could not open the sample PDF.');
        const pages = saved.evidence.filter(row => row.document_id === id).map(row => row.page ?? 1);
        pageImages = await renderPdfPagePreviews(await response.arrayBuffer(), pages.length ? pages : [1]);
      }
      if (this.destroyed) { Object.values(pageImages ?? {}).forEach(URL.revokeObjectURL); return; }
      this.previews.update(rows => ({...rows,[id]:{url,pageImages,loading:false}}));
    } catch { if (!this.destroyed) this.previews.update(rows => ({...rows,[id]:{url,loading:false,error:'Could not open this source. Retry, or open the document link.'}})); }
  }
  private releasePreviews(): void { Object.values(this.previews()).forEach(preview => Object.values(preview.pageImages ?? {}).forEach(url => URL.revokeObjectURL(url))); }
}
