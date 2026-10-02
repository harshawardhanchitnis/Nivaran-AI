// Generates a server-only signing secret and dashboard SQL without printing the secret.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const file='.env.local';
let env=await readFile(file,'utf8');
let secret=/^MODEL_COOLDOWN_SIGNING_SECRET=([a-f0-9]{64})\s*$/m.exec(env)?.[1];
if(!secret) {
  secret=randomBytes(32).toString('hex');
  env=env.replace(/^MODEL_COOLDOWN_SIGNING_SECRET=.*\r?\n?/m,'');
  await writeFile(file,`${env.trimEnd()}\nMODEL_COOLDOWN_SIGNING_SECRET=${secret}\n`);
}
await mkdir('tmp/model-routing',{recursive:true});
await writeFile('tmp/model-routing/configure-signing.sql',`-- Server-only signing configuration. Do not commit or share this file.\nbegin;\ninsert into public.app_settings(key,value) values ('model_cooldown_signing',jsonb_build_object('secret','${secret}'))\non conflict(key) do update set value=excluded.value;\ncommit;\n`);
console.log('Prepared .env.local and ignored tmp/model-routing/configure-signing.sql. Apply 0005, then that setup SQL. No secret was printed.');
