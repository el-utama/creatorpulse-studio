import { cookies } from "next/headers";
import { bindingEpoch } from "@/lib/gateway/store";
import { vaultToken } from "@/lib/gateway/vault";
import { accounts, currentSlot, slotNames, tokenNames, validSlot } from "@/lib/accounts";
import { refreshAccessToken } from "@/lib/tiktok";

export async function sessionToken(forceRefresh = false, requestedSlot?: string): Promise<string | null> {
  const jar = await cookies();
  if(requestedSlot !== undefined && (!validSlot(requestedSlot) || !accounts(jar).some(a=>a.slot===requestedSlot))) return null;
  const slot=requestedSlot??currentSlot(jar),names=requestedSlot?slotNames(requestedSlot):tokenNames(jar);
  const bound=slot?jar.get("creatorpulse_account_"+slot+"_v")?.value:undefined;
  if(slot&&bound){const epoch=bindingEpoch(slot,bound);if(!epoch)return null;try{return await vaultToken(slot,forceRefresh,undefined,epoch);}catch{return null;}}
  const access = jar.get(names.access)?.value;
  if (access && !forceRefresh) return access;
  const refresh = jar.get(names.refresh)?.value;
  if (!refresh) return null;
  try {
    const tokens = await refreshAccessToken(refresh);
    if (!tokens.access_token) return null;
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    jar.set(names.access, tokens.access_token, { ...options, maxAge: tokens.expires_in || 3600 });
    if (tokens.refresh_token) jar.set(names.refresh, tokens.refresh_token, { ...options, maxAge: tokens.refresh_expires_in || 604800 });
    return tokens.access_token;
  } catch { return null; }
}

// Retry read-only operations once; never replay publication initialization.
export async function sessionRead<T>(fn: (token:string)=>Promise<T>, requestedSlot?: string): Promise<T> {
  const {isAuthError,TikTokApiError} = await import("@/lib/tiktok-errors");
  const token=await sessionToken(false,requestedSlot);
  if(!token) throw new TikTokApiError("access_token_invalid",401);
  try {return await fn(token);} catch(error) {
    if(!isAuthError(error)) throw error;
    const renewed=await sessionToken(true,requestedSlot);
    if(!renewed) throw new TikTokApiError("access_token_invalid",401);
    return fn(renewed);
  }
}
