import { database, migrate } from '../server/db.js';
import { hashPassword, randomToken, digest } from '../server/auth.js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { createInterface } from 'node:readline/promises';
const db=database();const [command,...args]=process.argv.slice(2);
// Interactive password input uses terminal echo suppression; secrets never go in shell arguments.
async function password(){
 if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal to enter a password privately.');
 process.stdout.write('New password (at least 12 characters; hidden): ');
 process.stdin.setRawMode(true);process.stdin.resume();
 const value=await new Promise((resolve,reject)=>{let result='';const onData=data=>{for(const c of data.toString()){if(c==='\u0003'){cleanup();reject(Error('Cancelled'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(result);return;}if(c==='\u007f'||c==='\b')result=result.slice(0,-1);else result+=c;}};const cleanup=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};process.stdin.on('data',onData);});
 return z.string().min(12).max(256).parse(value);
}
try{
 if(command==='migrate'){
  if(process.env.TURSO_DATABASE_URL){const rl=createInterface({input:process.stdin,output:process.stdout});const reply=await rl.question('This will add SGW tables to the configured remote database. Type APPLY to continue: ');rl.close();if(reply!=='APPLY')throw Error('Migration cancelled.');}
  await migrate(db);console.log('Additive SGW schema applied. No existing tables were deleted.');
 }else if(command==='create-couple'){
  const email=z.email().parse(args[0]).toLowerCase();const slug=z.string().regex(/^[a-z0-9-]{1,80}$/).parse(args[1]);const names=z.string().min(1).max(120).parse(args[2]);
  const details=args[3]?JSON.parse(await readFile(args[3],'utf8')):{};
  const id=randomUUID(),weddingId=randomUUID(),hash=await hashPassword(await password());
  await db.batch([{sql:'INSERT INTO sgw_couples(id,email,password_hash) VALUES(?,?,?)',args:[id,email,hash]},{sql:'INSERT INTO sgw_weddings(id,couple_id,slug,names,details_json) VALUES(?,?,?,?,?)',args:[weddingId,id,slug,names,JSON.stringify(details)]}],'write');
  console.log('Account created. Wedding ID: '+weddingId);
 }else if(command==='invite'){
  const weddingId=z.uuid().parse(args[0]);const guest=z.string().min(1).max(60).parse(args[1]);const max=z.coerce.number().int().min(1).max(20).parse(args[2]||1);
  if(!(await db.execute({sql:'SELECT id FROM sgw_weddings WHERE id=?',args:[weddingId]})).rows.length)throw Error('Wedding not found.');
  const guestOrigin=process.env.GUEST_SITE_ORIGIN;if(!guestOrigin||new URL(guestOrigin).origin!==guestOrigin)throw Error('Set GUEST_SITE_ORIGIN to the guest website origin before creating invitations.');
  const token=randomToken();const id=randomUUID();await db.execute({sql:'INSERT INTO sgw_invitations(id,wedding_id,token_hash,guest_name,max_guests) VALUES(?,?,?,?,?)',args:[id,weddingId,digest(token),guest,max]});
  console.log('Invitation ID: '+id+'\nPrivate guest link (treat as a secret; share only with this guest):\n'+guestOrigin+'/?invite='+token);
 }else if(command==='reset-password'){
  const email=z.email().parse(args[0]).toLowerCase();const hash=await hashPassword(await password());
  const row=(await db.execute({sql:'SELECT id FROM sgw_couples WHERE email=?',args:[email]})).rows[0];if(!row)throw Error('Account not found.');
  await db.batch([{sql:'UPDATE sgw_couples SET password_hash=? WHERE id=?',args:[hash,row.id]},{sql:'DELETE FROM sgw_sessions WHERE couple_id=?',args:[row.id]}],'write');console.log('Password updated and all existing sessions revoked.');
 }else if(command==='revoke-invite'){
  await db.execute({sql:'UPDATE sgw_invitations SET revoked=1 WHERE id=?',args:[z.uuid().parse(args[0])]});console.log('Invitation revoked.');
 }else if(command==='cleanup'){
  await db.batch([{sql:'DELETE FROM sgw_sessions WHERE expires_at<=?',args:[Date.now()]},{sql:'DELETE FROM sgw_rate_limits WHERE expires_at<=?',args:[Date.now()]}],'write');console.log('Expired sessions and rate-limit entries removed.');
 }else throw Error('Commands: migrate | create-couple EMAIL SLUG "NAMES" [DETAILS_JSON_FILE] | invite WEDDING_ID "GUEST NAME" MAX_GUESTS | reset-password EMAIL | revoke-invite INVITATION_ID | cleanup');
}finally{db.close();}
