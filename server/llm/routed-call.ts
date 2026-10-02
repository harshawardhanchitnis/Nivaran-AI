import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnv } from '../env.js';
import { HttpError } from '../http.js';
import { chargeModelCall } from '../usage.js';
import { cooldownStore } from './cooldowns.js';
import { getModelById, type ModelHandle } from './provider.js';
import { modelLineup, routeModelCall, type ModelTask } from './router.js';

export function createRoutedModelCall(client:SupabaseClient) {
  return async <T>(task:ModelTask, attempt:(model:ModelHandle,signal:AbortSignal)=>Promise<T>) => {
    const env=readEnv();
    if(!env.modelCooldownSigningSecret || env.modelCooldownSigningSecret.length<32)
      throw new HttpError(503,'model_routing_not_configured','Model routing setup is incomplete. Your progress is saved.');
    const models=modelLineup(task,env).filter(model=>model.provider==='google'?!!env.googleApiKey:!!env.groqApiKey);
    if(!models.length) throw new HttpError(503,'model_not_configured','No suitable model is configured for this task.');
    return routeModelCall(models,{now:Date.now,timeoutMs:env.modelAttemptTimeoutMs,
      charge:()=>chargeModelCall(client),...cooldownStore(client,env.modelCooldownSigningSecret),
      attempt:(model,signal)=>attempt(getModelById(model.provider,model.modelId,env),signal)});
  };
}
