import { Injectable, inject } from '@angular/core';
import type { ApiErrorBody } from '@shared/api';

import { SupabaseService } from './supabase.service';

/** An error from /api, with the server's code and a message that is safe to show. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Calls the Vercel Functions under /api, sending the caller's access token when there is one. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly supabase = inject(SupabaseService);

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = await this.supabase.accessToken();
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(`/api/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection and try again.');
    }

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = (data as ApiErrorBody | null)?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'http_error',
        error?.message ?? `The server answered with status ${response.status}.`,
      );
    }
    return data as T;
  }
}
