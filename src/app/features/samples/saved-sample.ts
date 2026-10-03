import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import type { FactField } from '@shared/facts';
import type { SavedSample } from '@shared/samples';
import { sampleDocumentPath } from '@shared/samples';
import { SamplesService } from '../../core/samples.service';
import { CasesService } from '../../core/cases.service';
import { workspaceActivity, workspaceFacts, workspaceStage } from '../../core/workspace-mapper';
import type { DocumentPreview } from '../../core/workspace-mapper';
import { workspacePlan } from '../../core/workspace-plan';
import { draftPresentation, draftStatements } from '../../core/workspace-draft';
import { renderPdfPagePreviews } from '../../core/pdf-preview';
import { CaseWorkspaceView } from '../../shared/ui/case-workspace-view';
import type { QuestionView } from '../../shared/ui/models';

@Component({
  selector: 'app-saved-sample', imports: [RouterLink, MatButtonModule, CaseWorkspaceView], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <section class="surface pad" role="alert"><h1>Saved run unavailable</h1><p>{{ error() }}</p><a routerLink="/">Back to samples</a></section> }
    @else if (sample(); as saved) {
      <app-case-workspace-view [heading]="saved.title" merchant="Synthetic consumer case" [documentCount]="saved.documents.length"
        [stage]="stage()" [facts]="facts()" [activity]="activity()" [question]="question()" [plan]="plan()"
        [approved]="!!saved.plan?.approved_at" [draft]="draft()" [readOnly]="true"
        (sourceRequested)="openSource($event)" (sourceRetry)="preview($event)">
        <section banner class="surface pad stack" aria-label="Saved run information">
          <p class="eyebrow">Saved run · fictional documents</p>
          <p>Recorded {{ saved.recordedAt.slice(0, 10) }}. Decisions use {{ saved.today }} as the date in India.
            Opening this record makes no model calls. {{ saved.logicalCalls }} logical calls / {{ saved.providerAttempts }} provider attempts were used in the recorded run.</p>
          @if (saved.warning) { <p role="note">{{ saved.warning }}</p> }
          <p class="muted small">{{ saved.provenance }}. Models attempted: {{ modelNames() }}.</p>
          <div class="row">
            <a routerLink="/">All samples</a>
            @if (remaining() > 0) { <a mat-stroked-button routerLink="/cases/new" [queryParams]="{sample:saved.id}">Run it live</a> }
            @else { <span role="status">{{ quotaMessage() }}</span> }
          </div>
          <details><summary>Documents in this saved run</summary><ul>
            @for (document of saved.documents; track document.id) {
              <li><a [href]="documentPath(document.id)" target="_blank" rel="noopener">{{ document.label }} · {{ document.file_name }}</a> · {{ document.read_status }}</li>
            }
          </ul></details>
        </section>
      </app-case-workspace-view>
    } @else { <p role="status">Opening the saved run…</p> }
  `,
  styles: `.pad{padding:18px;margin-bottom:16px}.small{font-size:.85rem}li{overflow-wrap:anywhere}`,
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
    const options = recorded.options.flatMap(option => typeof option === 'object' && option && 'id' in option && 'label' in option && typeof option.id === 'string' && typeof option.label === 'string' ? [{id:option.id,label:option.label}] : []);
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
