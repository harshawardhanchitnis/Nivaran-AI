import { Injectable, computed, signal } from '@angular/core';
import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';

/**
 * The single Supabase client for the browser, plus the current session as a signal.
 *
 * Judges and first-time users never see a sign-up form: `ensureSignedIn()` creates an anonymous
 * session, and row-level security keeps each session's data private.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  /** False until SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set (see .env.example). */
  readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);

  private readonly supabase: SupabaseClient | null = this.configured
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

  private readonly currentSession = signal<Session | null>(null);
  readonly session = this.currentSession.asReadonly();
  readonly userId = computed(() => this.currentSession()?.user.id ?? null);

  /** Resolves once a stored session, if any, has been restored. */
  private readonly restored: Promise<void>;

  constructor() {
    if (!this.supabase) {
      this.restored = Promise.resolve();
      return;
    }
    this.supabase.auth.onAuthStateChange((_event, session) => this.currentSession.set(session));
    this.restored = this.supabase.auth.getSession().then(({ data }) => this.currentSession.set(data.session));
  }

  /** The client, or an error that tells the developer what is missing. */
  get client(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase is not configured. Copy .env.example to .env.local and fill it in.');
    }
    return this.supabase;
  }

  /** Returns the current session, creating an anonymous one if there is none. */
  async ensureSignedIn(): Promise<Session> {
    await this.restored;
    const existing = this.currentSession();
    if (existing) {
      return existing;
    }
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(error?.message ?? 'Could not start a session.');
    }
    this.currentSession.set(data.session);
    return data.session;
  }

  /** A fresh access token for calling /api, or null when signed out or not configured. */
  async accessToken(): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
}
