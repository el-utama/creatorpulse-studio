import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { accounts,activate,clearLegacy,currentSlot,identity,storeAccount,slotFor,ADD_COOKIE,MAX_ACCOUNTS } from "@/lib/accounts";
import { sessionToken } from "@/lib/session";
import { exchangeCodeForToken } from "@/lib/tiktok";

export async function GET(request: Request) {
 const {searchParams}=new URL(request.url),jar=await cookies();
 const code=searchParams.get("code"),state=searchParams.get("state");
 const base=process.env.APP_URL||"http://localhost:3000";
 const adding=jar.get(ADD_COOKIE)?.value==="1";
 const fail=(error:string)=>NextResponse.redirect(new URL(adding?"/dashboard?account_error="+error:"/?error="+error,base));
 if(!state||state!==jar.get(APP_CONFIG.cookieNames.oauthState)?.value)return fail("invalid_state");
 jar.delete(APP_CONFIG.cookieNames.oauthState);jar.delete(ADD_COOKIE);
 if(!code)return fail("authorization_cancelled");
 try {
  const tokens=await exchangeCodeForToken(code);
  if(!tokens.access_token)return fail("token_exchange_failed");
  const account=await identity(tokens.access_token).catch(()=>{
    if(typeof tokens.open_id!=="string"||!tokens.open_id)throw Error("identity_unavailable");
    return {slot:slotFor(tokens.open_id),name:"Akun TikTok"};
  });
  const legacy=!currentSlot(jar) && !!(jar.get(APP_CONFIG.cookieNames.accessToken)?.value||jar.get(APP_CONFIG.cookieNames.refreshToken)?.value);
  if(legacy&&adding){
    const oldToken=await sessionToken();
    if(!oldToken)return fail("existing_session_expired");
    const old=await identity(oldToken);
    if(old.slot!==account.slot){
      if(accounts(jar).length>=MAX_ACCOUNTS-1)return fail("account_limit");
      storeAccount(jar,old,{access_token:oldToken,refresh_token:jar.get(APP_CONFIG.cookieNames.refreshToken)?.value,expires_in:60,refresh_expires_in:7*86400});
      // Keep the old account usable if storing the new one fails.
      activate(jar,old.slot);clearLegacy(jar);
    }
  }
  storeAccount(jar,account,tokens);activate(jar,account.slot);clearLegacy(jar);
  return NextResponse.redirect(new URL("/dashboard?account_changed=1",base));
 } catch(error) {
  const reason=error instanceof Error?error.message:"";
  return fail(reason==="account_limit"||reason==="cookie_limit"?reason:"connection_failed");
 }
}
