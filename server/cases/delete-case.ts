import type { SupabaseClient } from '@supabase/supabase-js';
import { EVIDENCE_BUCKET } from '../../shared/limits.js';
import { HttpError } from '../http.js';

export interface CaseDeletionStore {
  ownedCase(caseId:string):Promise<boolean>;
  hasActiveClaim(caseId:string):Promise<boolean>;
  documentPaths(caseId:string):Promise<string[]>;
  list(prefix:string,offset:number):Promise<string[]>;
  remove(paths:string[]):Promise<void>;
  removeCase(caseId:string):Promise<void>;
}
const failed = () => new HttpError(503,'case_delete_failed','Could not finish deleting this case. Its remaining records are saved; retry Delete case.');
export function createCaseDeletionStore(client:SupabaseClient,userId:string):CaseDeletionStore {
  const storage=client.storage.from(EVIDENCE_BUCKET);
  return {
    async ownedCase(caseId) {const {data,error}=await client.from('cases').select('id').eq('id',caseId).eq('user_id',userId).maybeSingle();if(error)throw failed();return !!data;},
    async hasActiveClaim(caseId) {const {data,error}=await client.from('agent_runs').select('id').eq('case_id',caseId).not('processing_token','is',null).gte('processing_started_at',new Date(Date.now()-120_000).toISOString());if(error)throw failed();return !!data?.length;},
    async documentPaths(caseId) {const {data,error}=await client.from('documents').select('storage_path').eq('case_id',caseId);if(error)throw failed();return (data??[]).map(row=>String(row.storage_path));},
    async list(prefix,offset) {const {data,error}=await storage.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw failed();return (data??[]).map(row=>row.name);},
    async remove(paths) {if((await storage.remove(paths)).error)throw failed();},
    async removeCase(caseId) {if((await client.from('cases').delete().eq('id',caseId).eq('user_id',userId)).error)throw failed();},
  };
}
function ownedPath(path:string,prefix:string):boolean {
  if(!path.startsWith(prefix+'/'))return false;
  const name=path.slice(prefix.length+1);
  return name.length>0 && !/[\\/\u0000-\u001f]/.test(name) && name!=='.' && name!=='..';
}
/** Confirmed user action only. Never offered as an agent tool. */
export async function deleteCase(store:CaseDeletionStore,userId:string,caseId:string):Promise<{deleted:true}> {
  if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(caseId))throw new HttpError(400,'case_delete_invalid','Choose a case from My cases.');
  // Hidden foreign cases behave like a replay; their prefixes are never touched.
  if(!await store.ownedCase(caseId))return {deleted:true};
  if(await store.hasActiveClaim(caseId))throw new HttpError(409,'case_step_running','A case step is still finishing. Wait briefly, then retry Delete case.');
  const prefix=`${userId}/${caseId}`;const paths=new Set(await store.documentPaths(caseId));
  // Include orphan uploads whose document insert failed. The exact flat case prefix is bounded.
  for(let offset=0;offset<10_000;offset+=100) {
    const names=await store.list(prefix,offset);
    names.forEach(name=>paths.add(`${prefix}/${name}`));
    if(names.length<100)break;
    if(offset===9_900)throw failed();
  }
  if([...paths].some(path=>!ownedPath(path,prefix)))throw new HttpError(409,'case_storage_path_invalid','This case contains an unexpected file path. Its records have been retained.');
  const all=[...paths];for(let start=0;start<all.length;start+=100)await store.remove(all.slice(start,start+100));
  if((await store.list(prefix,0)).length)throw failed();
  await store.removeCase(caseId);
  return {deleted:true};
}
