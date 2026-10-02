import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http.js';
import type { Availability, CooldownReason } from './router.js';
export const cooldownPayload = (key:string,until:number,reason:CooldownReason,issued:number) => `v1\n${key}\n${until}\n${reason}\n${issued}`;
export function cooldownStore(client:SupabaseClient, secret:string) {
  return {
    available:async ():Promise<Availability[]> => {
      const {data,error}=await client.from('model_availability').select('model_key,usable_after').returns<Availability[]>();
      if(error) throw new HttpError(503,'model_routing_unavailable','Model availability could not be loaded. Your progress is saved; try again.');
      return data??[];
    },
    exhaust:async (model:{key:string},until:number,reason:CooldownReason) => {
      const issued=Date.now();const reset=Math.ceil(until);
      const signature=createHmac('sha256',secret).update(cooldownPayload(model.key,reset,reason,issued)).digest('hex');
      const {error}=await client.rpc('record_model_cooldown',{p_model_key:model.key,p_until_ms:reset,p_reason:reason,p_issued_ms:issued,p_signature:signature});
      if(error) throw new HttpError(503,'model_routing_unavailable','A model cooldown could not be saved. Your progress is saved; try again.');
    },
  };
}
