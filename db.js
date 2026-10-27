import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
export function database(env=process.env) {
 if(env.TURSO_DATABASE_URL){
  if(!/^(libsql|https):\/\//.test(env.TURSO_DATABASE_URL)||!env.TURSO_AUTH_TOKEN)throw Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must both be configured.');
  return createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
 }
 if(env.NODE_ENV!=='production' && env.LOCAL_DATABASE_URL?.startsWith('file:'))return createClient({url:env.LOCAL_DATABASE_URL});
 throw Error('Database not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on the server.');
}
export async function migrate(db){
 const sql=await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8');
 await db.execute('PRAGMA foreign_keys=ON');
 await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean),'write');
}
