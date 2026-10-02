import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from './supabase.service';

/**
 * Case screens need a session. An anonymous one is created on the spot, so nobody meets a
 * sign-up form. If that cannot happen, the Status page explains what is wrong.
 */
export const signedInGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (!supabase.configured) {
    return router.parseUrl('/status');
  }
  try {
    await supabase.ensureSignedIn();
    return true;
  } catch {
    return router.parseUrl('/status');
  }
};
