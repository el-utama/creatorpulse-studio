import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { APP_CONFIG } from "@/config/app";
import { readTikTok } from "@/lib/tiktok-errors";
import type { TikTokTokenResponse } from "@/types/tiktok";

export const MAX_ACCOUNTS=3;
export const ACTIVE_COOKIE="creatorpulse_active";
export const ADD_COOKIE="creatorpulse_add_account";
const prefix="creatorpulse_account_";
const options={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
type Jar=Awaited<ReturnType<typeof cookies>>;
type Account={slot:string;name:string};
export const validSlot=(s:unknown):s is string=>typeof s==="string" && /^[a-f0-9]{32}$/.test(s);
export const slotFor=(id:string)=>createHash("sha256").update(id).digest("hex").slice(0,32);
export const slotNames=(slot:string)=>({access:prefix+slot+"_a",refresh:prefix+slot+"_r",meta:prefix+slot+"_m"});
export function accounts(jar:Jar):Account[]{
 return jar.getAll().flatMap(c=>{
  const m=c.name.match(/^creatorpulse_account_([a-f0-9]{32})_m$/);
  if(!m)return [];
  const slot=m[1],n=slotNames(slot);
  if(!jar.get(n.access)?.value&&!jar.get(n.refresh)?.value)return [];
  let name="Akun TikTok";try{name=JSON.parse(c.value).name.slice(0,80)||name;}catch{}
  return [{slot,name}];
 }).slice(0,MAX_ACCOUNTS);
}
export function currentSlot(jar:Jar){const active=jar.get(ACTIVE_COOKIE)?.value;return validSlot(active)?active:null;}
export function tokenNames(jar:Jar){const active=currentSlot(jar);return active?slotNames(active):{access:APP_CONFIG.cookieNames.accessToken,refresh:APP_CONFIG.cookieNames.refreshToken};}
export function clearLegacy(jar:Jar){for(const name of [APP_CONFIG.cookieNames.accessToken,APP_CONFIG.cookieNames.refreshToken])jar.set(name,"",{...options,maxAge:0});}
export function activate(jar:Jar,slot:string){jar.set(ACTIVE_COOKIE,slot,{...options,maxAge:365*86400});}
export function removeSlot(jar:Jar,slot:string){for(const name of Object.values(slotNames(slot)))jar.set(name,"",{...options,maxAge:0});}
export function clearAccounts(jar:Jar){for(const c of jar.getAll())if(/^creatorpulse_account_[a-f0-9]{32}_[arm]$/.test(c.name))jar.set(c.name,"",{...options,maxAge:0});for(const name of [ACTIVE_COOKIE,ADD_COOKIE,APP_CONFIG.cookieNames.oauthState])jar.set(name,"",{...options,maxAge:0});clearLegacy(jar);}
export function cookieTTL(value:unknown,fallback:number){return typeof value==="number"&&Number.isFinite(value)&&value>0?Math.min(Math.floor(value),365*86400):fallback;}
export async function identity(token:string){
 const res=await fetch(APP_CONFIG.tiktokUserInfoUrl+"?fields=open_id,display_name",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 const {user}=await readTikTok<{user:{open_id:string;display_name?:string}}>(res);
 if(typeof user?.open_id!=="string"||!user.open_id)throw Error("Account identity unavailable");
 return {slot:slotFor(user.open_id),name:typeof user.display_name==="string"?user.display_name.slice(0,80):"Akun TikTok"};
}
export function storeAccount(jar:Jar,account:Account,tokens:Partial<TikTokTokenResponse>){
 const known=accounts(jar),names=slotNames(account.slot);
 if(!known.some(a=>a.slot===account.slot)&&known.length>=MAX_ACCOUNTS)throw Error("account_limit");
 if(!tokens.access_token)throw Error("missing_token");
 const maxAge=cookieTTL(tokens.refresh_expires_in,7*86400);
 const meta=JSON.stringify({name:account.name});
 // Bound browser cookie and Vercel request-header usage; reject before changing session.
 const oldNames=new Set([...Object.values(names),APP_CONFIG.cookieNames.accessToken,APP_CONFIG.cookieNames.refreshToken]);
 const size=(name:string,value:string)=>name.length+encodeURIComponent(value).length+4;
 const projected=jar.getAll().filter(c=>!oldNames.has(c.name)).reduce((n,c)=>n+size(c.name,c.value),0)+size(names.access,tokens.access_token)+size(names.refresh,tokens.refresh_token||"")+size(names.meta,meta);
 if(projected>10000||[tokens.access_token,tokens.refresh_token||""].some(t=>encodeURIComponent(t).length>3700))throw Error("cookie_limit");
 jar.set(names.access,tokens.access_token,{...options,maxAge:cookieTTL(tokens.expires_in,3600)});
 jar.set(names.refresh,tokens.refresh_token||"",{...options,maxAge:tokens.refresh_token?maxAge:0});
 jar.set(names.meta,meta,{...options,maxAge});
}
export function sameOrigin(request:Request){
 const origin=request.headers.get("origin");
 const expected=new URL(process.env.APP_URL||request.url).origin;
 return request.headers.get("sec-fetch-site")!=="cross-site" && (!origin||origin===expected);
}
