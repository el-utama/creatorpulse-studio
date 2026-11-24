import {GatewayError,redis,seal,unseal,vaultHash,withSlotLock} from "./store";
import {refreshAccessToken} from "@/lib/tiktok";
import {APP_CONFIG} from "@/config/app";
import type {TikTokTokenResponse} from "@/types/tiktok";
import {createHash} from "node:crypto";
export type VaultAccount={slot:string;openId:string;name:string;access:string;refresh:string;expiresAt:number;updatedAt:string};
export const slotForId=(id:string)=>createHash("sha256").update(id).digest("hex").slice(0,32);
const validSlot=(slot:string)=>/^[a-f0-9]{32}$/.test(slot);
function decode(slot:string,raw:string){const a=unseal<VaultAccount>(raw,"vault:"+slot);if(a.slot!==slot||slotForId(a.openId)!==slot)throw new GatewayError(503,"Identitas vault tidak valid.");return a;}
export async function loadAccount(slot:string){
 if(!validSlot(slot))throw new GatewayError(400,"ID akun tidak valid.");
 const raw=await redis<string|null>(["HGET",vaultHash,slot]);
 if(!raw)throw new GatewayError(404,"Akun belum dihubungkan ke gateway.");
 return {account:decode(slot,raw),raw};
}
export async function listVault(){
 const entries=await redis<string[]>(["HGETALL",vaultHash]);
 const accounts=[];for(let i=0;i+1<entries.length&&accounts.length<3;i+=2){const a=decode(entries[i],entries[i+1]);accounts.push({id:a.slot,name:a.name,updatedAt:a.updatedAt,accessExpiresAt:new Date(a.expiresAt).toISOString()});}
 return accounts;
}
export async function saveAccount(a:VaultAccount){
 if(!validSlot(a.slot)||slotForId(a.openId)!==a.slot||!a.access||!a.refresh)throw new GatewayError(400,"Akun atau token tidak lengkap.");
 await withSlotLock(a.slot,async()=>{
 const result=await redis<number>(["EVAL","if redis.call('HEXISTS',KEYS[1],ARGV[1])==0 and redis.call('HLEN',KEYS[1])>=3 then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]) return 1",1,vaultHash,a.slot,seal(a,"vault:"+a.slot)]);
 if(result!==1)throw new GatewayError(409,"Maksimal tiga akun gateway.");
 });
}
export async function removeVault(slot:string){if(!validSlot(slot))throw new GatewayError(400,"ID akun tidak valid.");await withSlotLock(slot,()=>redis(["HDEL",vaultHash,slot]));}
export async function vaultToken(slot:string,force=false,previous?:string):Promise<string>{
 const {account:a}=await loadAccount(slot);
 if((!force&&a.expiresAt>Date.now()+30000)||(force&&previous&&a.access!==previous))return a.access;
 return withSlotLock(slot,async()=>{
  const {account:old,raw}=await loadAccount(slot);
  if((!force&&old.expiresAt>Date.now()+30000)||(force&&previous&&old.access!==previous))return old.access;
  let t:TikTokTokenResponse;
  try{t=await refreshAccessToken(old.refresh);}catch{throw new GatewayError(401,"Sesi TikTok perlu dihubungkan ulang.");}
  if(!t.access_token||!t.refresh_token||(t.open_id&&t.open_id!==old.openId))throw new GatewayError(401,"Sesi TikTok perlu dihubungkan ulang.");
  const next={...old,access:t.access_token,refresh:t.refresh_token,expiresAt:Date.now()+Math.max(60,Math.min(t.expires_in||3600,86400))*1000,updatedAt:new Date().toISOString()};
  const changed=await redis<number>(["EVAL","if redis.call('HGET',KEYS[1],ARGV[1])~=ARGV[2] then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]) return 1",1,vaultHash,slot,raw,seal(next,"vault:"+slot)]);
  if(changed!==1)throw new GatewayError(409,"Sesi akun berubah. Coba kembali.");
  return next.access;
 });
}
export async function readAccount<T>(slot:string,fn:(token:string)=>Promise<T>):Promise<T>{
 const {isAuthError}=await import("@/lib/tiktok-errors");
 const t=await vaultToken(slot);
 try{return await fn(t);}catch(error){if(!isAuthError(error))throw error;return fn(await vaultToken(slot,true,t));}
}
export async function profileIdentity(token:string){
 const res=await fetch(APP_CONFIG.tiktokUserInfoUrl+"?fields=open_id,display_name",{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)});
 const {readTikTok}=await import("@/lib/tiktok-errors");
 const {user}=await readTikTok<{user:{open_id:string;display_name:string}}>(res);
 if(typeof user?.open_id!=="string"||!user.open_id)throw new GatewayError(502,"Identitas TikTok tidak tersedia.");
 return user;
}
