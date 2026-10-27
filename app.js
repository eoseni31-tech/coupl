import express from 'express';
import helmet from 'helmet';
import { parse, serialize } from 'cookie';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { database } from './db.js';
import { randomToken, digest, verifyPassword, hashPassword } from './auth.js';
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const invitationPath=fileURLToPath(new URL('../index.html',import.meta.url));
const viewsDir=fileURLToPath(new URL('../views/',import.meta.url));
const inlineHashes=[];
const text=(max)=>z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v));
const note=z.string().trim().max(300).default('');
const loginSchema=z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(1).max(256)}).strict();
const rsvpSchema=z.object({name:text(60),attendance:z.enum(['yes','no']),guests:z.number().int().min(0).max(20),message:note}).strict();
const giftSchema=z.object({donorName:text(60),amount:z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/),reference:z.string().trim().max(100).default(''),idempotencyKey:z.uuid()}).strict();
const items=new Set(['Air fryer','Washing machine','Blender','Rechargeable fan','Cookware set','A personal blessing']);
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function createApp({db:injected,env=process.env}={}){
 const app=express();let connection=injected;
 const origin=env.APP_ORIGIN;
 if(!origin||new URL(origin).origin!==origin)throw Error('APP_ORIGIN must be the exact site origin, without a trailing slash.');
 const secure=origin.startsWith('https:');
 if(env.NODE_ENV==='production'&&!secure)throw Error('Production requires an HTTPS APP_ORIGIN.');
 const cookieName=secure?'__Host-sgw_session':'sgw_session';
 const guestCookieName=secure?'__Host-sgw_invite':'sgw_invite';
 const db=()=>connection??=(database(env));
 const query=async(sql,args=[])=>db().execute({sql,args});
 app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",...inlineHashes],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'",'data:'],mediaSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:secure?[]:null}},referrerPolicy:{policy:'no-referrer'},strictTransportSecurity:secure?undefined:false}));
 app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api',(req,res,next)=>{
  if(req.method==='POST' && (req.get('origin')!==origin || req.get('sec-fetch-site')==='cross-site'))return res.status(403).json({ok:false,message:'Please submit from this website.'});
  if(req.method==='POST'&&!req.is('application/json'))return res.status(415).json({ok:false,message:'Send a JSON request.'});
  next();
 });
 app.use(express.json({limit:'16kb'}));
 const cookieValue=req=>{try{return parse(req.headers.cookie||'')[cookieName]||'';}catch{return '';}};
 const setCookie=(res,token,maxAge)=>res.append('Set-Cookie',serialize(cookieName,token,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge}));
 async function session(req){const token=cookieValue(req);if(!token)return null;const r=await query('SELECT couple_id FROM sgw_sessions WHERE token_hash=? AND expires_at>?',[digest(token),Date.now()]);return r.rows[0]||null;}
 async function protect(req,res,next){req.session=await session(req);if(!req.session){if(req.path.startsWith('/api/'))return res.status(401).json({ok:false,message:'Please sign in to continue.'});return res.redirect('/couple/login');}next();}
 async function rate(key,max,seconds){const bucket=Math.floor(Date.now()/(seconds*1000));const k=digest(key)+':'+bucket;const result=await query('INSERT INTO sgw_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',[k,Date.now()+seconds*1000]);if(Number(result.rows[0].count)>max)throw new HttpError(429,'Too many attempts. Please try again later.');}
 let dummy;
 app.post('/api/auth/login',async(req,res)=>{
  const input=loginSchema.parse(req.body);
  // Durable global and account limits also work across serverless instances.
  await rate('login-global',100,900);await rate('login-email:'+input.email,10,900);
  const row=(await query('SELECT id,password_hash FROM sgw_couples WHERE email=?',[input.email])).rows[0];
  dummy??=hashPassword(randomToken());
  const valid=await verifyPassword(input.password,row?.password_hash||await dummy);
  if(!row||!valid)throw new HttpError(401,'Email or password is incorrect.');
  const token=randomToken();const old=cookieValue(req);
  await db().batch([{sql:'DELETE FROM sgw_sessions WHERE token_hash=? OR expires_at<=?',args:[digest(old),Date.now()]},{sql:'INSERT INTO sgw_sessions(token_hash,couple_id,expires_at) VALUES(?,?,?)',args:[digest(token),row.id,Date.now()+8*3600*1000]}],'write');
  setCookie(res,token,8*3600);res.json({ok:true});
 });
 app.post('/api/auth/logout',protect,async(req,res)=>{await query('DELETE FROM sgw_sessions WHERE token_hash=?',[digest(cookieValue(req))]);setCookie(res,'',0);res.json({ok:true});});
 app.get('/api/couple/dashboard',protect,async(req,res)=>{
  const wedding=(await query('SELECT id,slug,names,details_json FROM sgw_weddings WHERE couple_id=?',[req.session.couple_id])).rows[0];
  if(!wedding)throw new HttpError(404,'No wedding has been assigned to this account. Please contact your planner.');
  const [rsvps,gifts]=await Promise.all([query('SELECT id,name,attendance,guests,message,created_at,updated_at FROM sgw_rsvps WHERE wedding_id=? ORDER BY updated_at DESC',[wedding.id]),query('SELECT id,donor_name,kind,item,amount_minor,currency,status,reference,verified_at,created_at FROM sgw_gifts WHERE wedding_id=? ORDER BY created_at DESC',[wedding.id])]);
  res.json({ok:true,wedding:{id:wedding.id,slug:wedding.slug,names:wedding.names,details:JSON.parse(wedding.details_json)},rsvps:rsvps.rows,gifts:gifts.rows});
 });
 app.get(['/', '/couple/login'],(req,res)=>res.sendFile(viewsDir+'login.html'));
 app.get(['/couple','/couple/'],protect,(req,res)=>res.sendFile(viewsDir+'dashboard.html'));
 for(const asset of ['dashboard.css','dashboard.js','login.js'])app.get('/assets/'+asset,(req,res)=>res.sendFile(publicDir+asset));
 app.use((req,res)=>res.status(404).json({ok:false,message:'Page not found.'}));
 app.use((error,req,res,next)=>{
  if(error instanceof z.ZodError)return res.status(400).json({ok:false,message:'Please check your entries and try again.'});
  const status=error.status||500;
  res.status(status).json({ok:false,message:status>=500?'The service is unavailable. Please try again or contact your planner.':error.message});
 });
 return app;
}
