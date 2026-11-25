import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {GatewayError,authorize,config,gatewayEnvironment,requiredConfig} from "./store";
import {sameOrigin} from "@/lib/accounts";

// Host-only, bounded browser session. No Operator Key in the cookie or browser storage.
export const OPERATOR_COOKIE="creatorpulse_operator_session";
const TTL=8*60*60;
const options={httpOnly:true,secure:process.env.NODE_ENV==="production"&&process.env.VERCEL_ENV!==undefined,sameSite:"strict" as const,path:"/"};
function signature(payload:string){
 const c=requiredConfig();
 return createHmac("sha256",c.key).update(JSON.stringify(["operator-session-v1",gatewayEnvironment(),c.operator,payload])).digest("base64url");
}
export function validOperatorSession(value:string|undefined){
 try{
  if(!value||!/^\d{10,12}\.[a-f0-9]{48}\.[A-Za-z0-9_-]{43}$/.test(value)||!config())return false;
  const [expires,nonce,mac]=value.split("."),now=Math.floor(Date.now()/1000),end=Number(expires);
  if(!Number.isSafeInteger(end)||end<=now||end>now+TTL)return false;
  const expected=signature(expires+"."+nonce);
  return timingSafeEqual(Buffer.from(mac),Buffer.from(expected));
 }catch{return false;}
}
export function requireBrowserRequest(request:Request){
 if(request.headers.get("x-creatorpulse-operator-session")!=="1"||!sameOrigin(request))throw new GatewayError(403,"Origin sesi operator tidak diizinkan.");
}
export async function operatorSessionActive(request:Request){
 requireBrowserRequest(request);
 return validOperatorSession((await cookies()).get(OPERATOR_COOKIE)?.value);
}
export async function openOperatorSession(request:Request){
 requireBrowserRequest(request);
 // Only explicit operator bearer can create a session, never an agent key or cookie.
 authorize(request,true);
 const payload=(Math.floor(Date.now()/1000)+TTL)+"."+randomBytes(24).toString("hex");
 (await cookies()).set(OPERATOR_COOKIE,payload+"."+signature(payload),{...options,maxAge:TTL});
}
export async function clearOperatorSession(){
 (await cookies()).set(OPERATOR_COOKIE,"",{...options,maxAge:0});
}
// Do not reconstruct the framework Request: authenticate browser cookies separately.
export async function authorizeGateway(request:Request,owner=false):Promise<"browser"|"bearer">{
 if(request.headers.has("authorization")||request.headers.get("x-creatorpulse-operator-session")!=="1"){
  authorize(request,owner);
  return "bearer";
 }
 const environment=request.headers.get("x-creatorpulse-environment");
 if(environment&&environment!==gatewayEnvironment())throw new GatewayError(403,"Environment mismatch.");
 if(!await operatorSessionActive(request))throw new GatewayError(401,"Sesi operator berakhir. Buka akses kembali.");
 return "browser";
}
