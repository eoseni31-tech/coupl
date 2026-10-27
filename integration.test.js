import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { createApp } from '../server/app.js';
import { role } from '../server/role.js';
import { hashPassword,digest,randomToken } from '../server/auth.js';
test(role+' project: real HTTP and SQL checks',async t=>{
 const db=createClient({url:':memory:'});const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8');await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean),'write');
 const hash=await hashPassword('Strong-test-password-123');const tokens=[randomToken(),randomToken()];const ids=[randomUUID(),randomUUID()];
 for(let i=0;i<2;i++){const couple=randomUUID();await db.execute({sql:'INSERT INTO sgw_couples(id,email,password_hash) VALUES(?,?,?)',args:[couple,`couple${i}@example.com`,hash]});await db.execute({sql:'INSERT INTO sgw_weddings(id,couple_id,slug,names) VALUES(?,?,?,?)',args:[ids[i],couple,'wedding-'+i,'Couple '+i]});await db.execute({sql:'INSERT INTO sgw_invitations(id,wedding_id,token_hash,guest_name,max_guests) VALUES(?,?,?,?,2)',args:[randomUUID(),ids[i],digest(tokens[i]),'Guest '+i]});}
 const app=createApp({db,env:{APP_ORIGIN:'https://'+role+'.example.com',NODE_ENV:'production'}});const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.close();db.close();});const base='http://127.0.0.1:'+server.address().port;
 const req=(path,body,cookie='',origin='https://'+role+'.example.com')=>fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});
 await t.test('root responds and server files are not public',async()=>{assert.equal((await req('/')).status,200);for(const path of ['/server/app.js','/.env','/views/dashboard.html'])assert.equal((await req(path)).status,404);});
 await t.test('the other website has no routes here',async()=>{if(role==='guest'){assert.equal((await req('/couple')).status,404);assert.equal((await req('/api/couple/dashboard')).status,404);assert.equal((await req('/api/auth/login',{email:'couple0@example.com',password:'wrong'})).status,404);}else{assert.equal((await req('/api/guest',{action:'invite',token:tokens[0]})).status,404);assert.ok(!(await(await req('/')).text()).includes('id="envelope-gate"'));}});
 await t.test('cross-site mutation rejected',async()=>{assert.equal((await req(role==='guest'?'/api/guest':'/api/auth/login',{},'','https://attacker.example.com')).status,403);});
 if(role==='guest'){
  let cookie;
  await t.test('invitation cookie is HttpOnly Secure and restores access on refresh',async()=>{const r=await req('/api/guest',{action:'invite',token:tokens[0]});assert.equal(r.status,200);const header=r.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/; Secure/);cookie=header.split(';')[0];assert.equal((await req('/api/guest',{action:'invite'},cookie)).status,200);assert.equal((await req('/api/guest',{action:'invite'})).status,401);});
  await t.test('RSVP persists and repeat submissions update the same record',async()=>{const body={action:'rsvp',name:'Guest A',attendance:'yes',guests:2,message:'Thank you'};assert.equal((await req('/api/guest',body,cookie)).status,200);assert.equal((await req('/api/guest',{...body,name:'Updated'},cookie)).status,200);const rows=(await db.execute('SELECT * FROM sgw_rsvps')).rows;assert.equal(rows.length,1);assert.equal(rows[0].name,'Updated');assert.equal(rows[0].wedding_id,ids[0]);});
  await t.test('invalid allowance and spoofed wedding rejected',async()=>{const body={action:'rsvp',token:tokens[0],name:'Guest A',attendance:'yes',guests:3};assert.equal((await req('/api/guest',body)).status,400);assert.equal((await req('/api/guest',{...body,guests:1,wedding_id:ids[1]})).status,400);});
  await t.test('gift saved once and remains unverified',async()=>{const body={action:'gift',token:tokens[0],donorName:'Donor',amount:'15000.50',reference:'reported',idempotencyKey:randomUUID()};assert.equal((await req('/api/guest',body)).status,200);assert.equal((await req('/api/guest',body)).status,200);assert.equal((await req('/api/guest',{...body,status:'paid'})).status,400);const rows=(await db.execute('SELECT * FROM sgw_gifts')).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'unverified');assert.equal(Number(rows[0].amount_minor),1500050);});
  await t.test('registry reservation repeated safely',async()=>{const body={action:'reserve',token:tokens[0],gift:'Cookware set'};assert.equal((await req('/api/guest',body)).status,200);assert.equal((await req('/api/guest',body)).status,200);assert.equal((await db.execute("SELECT * FROM sgw_gifts WHERE kind='reservation'")).rows.length,1);});
 }else{
  let cookie;
  await t.test('dashboard page and data are protected',async()=>{assert.equal((await req('/couple')).status,302);assert.equal((await req('/api/couple/dashboard')).status,401);});
  await t.test('login rejects wrong password, valid login issues Secure HttpOnly cookie',async()=>{assert.equal((await req('/api/auth/login',{email:'couple0@example.com',password:'wrong'})).status,401);const r=await req('/api/auth/login',{email:'couple0@example.com',password:'Strong-test-password-123'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/; Secure/);cookie=r.headers.get('set-cookie').split(';')[0];assert.equal((await req('/couple',null,cookie)).status,200);});
  await t.test('couple cannot select another wedding through URL',async()=>{const data=await(await req('/api/couple/dashboard?wedding_id='+ids[1],null,cookie)).json();assert.equal(data.wedding.id,ids[0]);});
  await t.test('logout invalidates session',async()=>{assert.equal((await req('/api/auth/logout',{},cookie)).status,200);assert.equal((await req('/api/couple/dashboard',null,cookie)).status,401);});
 }
});
