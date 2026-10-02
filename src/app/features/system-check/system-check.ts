import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { HealthResponse, LlmCheckResponse, WhoAmIResponse } from '@shared/api';
import { EVIDENCE_BUCKET } from '@shared/limits';

import { ApiService } from '../../core/api.service';
import { SupabaseService } from '../../core/supabase.service';

type CheckState = 'idle' | 'running' | 'pass' | 'fail' | 'skipped';

interface Check {
  id: 'config' | 'api' | 'signin' | 'database' | 'storage' | 'whoami';
  label: string;
  state: CheckState;
  detail: string;
}

const INITIAL_CHECKS: readonly Check[] = [
  { id: 'config', label: 'Browser settings', state: 'idle', detail: '' },
  { id: 'api', label: 'API reachable', state: 'idle', detail: '' },
  { id: 'signin', label: 'Anonymous sign-in', state: 'idle', detail: '' },
  { id: 'database', label: 'Database and row-level security', state: 'idle', detail: '' },
  { id: 'storage', label: 'Evidence storage', state: 'idle', detail: '' },
  { id: 'whoami', label: 'API acts as the signed-in user', state: 'idle', detail: '' },
];

const STATE_ICONS: Record<CheckState, string> = {
  idle: 'radio_button_unchecked',
  running: 'hourglass_top',
  pass: 'check_circle',
  fail: 'error',
  skipped: 'remove_circle_outline',
};

const STATE_LABELS: Record<CheckState, string> = {
  idle: 'Not run',
  running: 'Running',
  pass: 'Passed',
  fail: 'Failed',
  skipped: 'Skipped',
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * /status: proves each link in the chain (settings, API, sign-in, database, storage, model)
 * and says what to fix when one fails. Run it first after setup and after every deploy.
 */
@Component({
  selector: 'app-system-check',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stack">
      <div>
        <h1>Status</h1>
        <p class="muted">Checks that every part Nivaran depends on is set up and reachable.</p>
        <button mat-flat-button type="button" [disabled]="running()" (click)="runChecks()">
          {{ running() ? 'Checking…' : 'Run checks' }}
        </button>
      </div>

      <ul class="checks" aria-live="polite">
        @for (check of checks(); track check.id) {
          <li [class]="'check ' + check.state">
            <mat-icon aria-hidden="true">{{ icons[check.state] }}</mat-icon>
            <div>
              <p class="check-title">
                {{ check.label }}
                <span class="check-state">{{ labels[check.state] }}</span>
              </p>
              @if (check.detail) {
                <p class="check-detail">{{ check.detail }}</p>
              }
            </div>
          </li>
        }
      </ul>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Model call</mat-card-title>
          <mat-card-subtitle>Each test spends one request from the free quota.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="row">
            <button mat-stroked-button type="button" [disabled]="modelBusy()" (click)="testModel('vision')">
              Test vision lineup
            </button>
            <button mat-stroked-button type="button" [disabled]="modelBusy()" (click)="testModel('text')">
              Test text lineup
            </button>
          </div>
          <p class="check-detail" aria-live="polite">{{ modelResult() }}</p>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: `
    .checks {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .check {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .check mat-icon {
      flex: none;
      color: var(--status-wait);
    }

    .check.pass mat-icon {
      color: var(--status-pass);
    }

    .check.fail mat-icon {
      color: var(--status-fail);
    }

    .check-title {
      margin: 0;
      font: var(--mat-sys-title-small);
    }

    .check-state {
      margin-left: 8px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .check-detail {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
      overflow-wrap: anywhere;
    }
  `,
})
export class SystemCheck {
  private readonly supabase = inject(SupabaseService);
  private readonly api = inject(ApiService);

  protected readonly icons = STATE_ICONS;
  protected readonly labels = STATE_LABELS;
  protected readonly checks = signal<readonly Check[]>(INITIAL_CHECKS);
  protected readonly running = signal(false);
  protected readonly modelBusy = signal(false);
  protected readonly modelResult = signal('');

  protected async runChecks(): Promise<void> {
    this.running.set(true);
    this.checks.set(INITIAL_CHECKS);
    try {
      const configured = await this.step('config', async () => {
        if (!this.supabase.configured) {
          throw new Error(
            'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not set. Copy .env.example to .env.local, fill it in and restart.',
          );
        }
        return 'Supabase URL and publishable key are present.';
      });

      await this.step('api', async () => {
        const health = await this.api.get<HealthResponse>('health');
        const flags = health.configured;
        return `Region ${health.region}. Server settings: Supabase ${yesNo(flags.supabase)}, Google model key ${yesNo(flags.primaryModel)}, Groq model key ${yesNo(flags.fallbackModel)}.`;
      });

      if (!configured) {
        this.skip(['signin', 'database', 'storage', 'whoami'], 'Needs the browser settings first.');
        return;
      }

      const signedIn = await this.step('signin', async () => {
        const session = await this.supabase.ensureSignedIn();
        return `Signed in as ${session.user.id.slice(0, 8)}… (${session.user.is_anonymous ? 'anonymous' : 'registered'}).`;
      });
      if (!signedIn) {
        this.skip(['database', 'storage', 'whoami'], 'Needs a session. In Supabase, turn on anonymous sign-ins.');
        return;
      }

      await this.step('database', async () => {
        const { count, error } = await this.supabase.client
          .from('guidance')
          .select('id', { count: 'exact', head: true });
        if (error) {
          throw new Error(`${error.message}. Has supabase/migrations/0001_init.sql been run?`);
        }
        return `Tables are reachable. Guidance snippets loaded: ${count ?? 0}.`;
      });

      await this.step('storage', async () => {
        const userId = this.supabase.userId() ?? '';
        const { error } = await this.supabase.client.storage.from(EVIDENCE_BUCKET).list(userId, { limit: 1 });
        if (error) {
          throw new Error(`${error.message}. The "${EVIDENCE_BUCKET}" bucket is created by the migration.`);
        }
        return `The private "${EVIDENCE_BUCKET}" bucket is reachable.`;
      });

      await this.step('whoami', async () => {
        const who = await this.api.get<WhoAmIResponse>('whoami');
        if (who.userId !== this.supabase.userId()) {
          throw new Error('The API saw a different user than the browser.');
        }
        if (!who.database.ok) {
          throw new Error(`The API could not read the database as you: ${who.database.message}`);
        }
        return `The API verified your token and read your rows (${who.database.caseCount} cases).`;
      });
    } finally {
      this.running.set(false);
    }
  }

  protected async testModel(task: 'vision' | 'text'): Promise<void> {
    this.modelBusy.set(true);
    this.modelResult.set(`Testing the ${task} lineup…`);
    try {
      if (this.supabase.configured) {
        await this.supabase.ensureSignedIn();
      }
      const result = await this.api.post<LlmCheckResponse>('llm-check', { task });
      this.modelResult.set(
        `${result.provider} ${result.modelId} answered "${result.text}" in ${result.milliseconds} ms.`,
      );
    } catch (error) {
      this.modelResult.set(`Failed: ${messageOf(error)}`);
    } finally {
      this.modelBusy.set(false);
    }
  }

  /** Runs one check and records the outcome. Returns true when it passed. */
  private async step(id: Check['id'], work: () => Promise<string>): Promise<boolean> {
    this.patch(id, { state: 'running', detail: '' });
    try {
      this.patch(id, { state: 'pass', detail: await work() });
      return true;
    } catch (error) {
      this.patch(id, { state: 'fail', detail: messageOf(error) });
      return false;
    }
  }

  private skip(ids: readonly Check['id'][], detail: string): void {
    for (const id of ids) {
      this.patch(id, { state: 'skipped', detail });
    }
  }

  private patch(id: Check['id'], change: Pick<Check, 'state' | 'detail'>): void {
    this.checks.update((checks) => checks.map((check) => (check.id === id ? { ...check, ...change } : check)));
  }
}

function yesNo(value: boolean): string {
  return value ? 'set' : 'missing';
}
