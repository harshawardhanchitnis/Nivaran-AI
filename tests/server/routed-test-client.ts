import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
/** No real database or model calls. The router sees an empty cooldown table. */
export function routingClient(rpc=vi.fn(async()=>({data:{allowed:true},error:null}))) {
  return { rpc, from:()=>({ select:()=>({returns:async()=>({data:[],error:null})}) }) } as unknown as SupabaseClient;
}
