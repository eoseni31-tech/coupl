import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
const opts={N:32768,r:8,p:3,maxmem:64*1024*1024};
export const randomToken=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=await derive(password,salt,64,opts);return `scrypt$${salt}$${hash.toString('hex')}`;}
export async function verifyPassword(password,encoded){const [,salt,hex]=encoded.split('$');const actual=await derive(password,salt,64,opts);const expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
