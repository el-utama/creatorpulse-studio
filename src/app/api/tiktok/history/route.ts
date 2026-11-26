import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {accounts,sameOrigin,validSlot} from "@/lib/accounts";
import {GatewayError,gatewayEnvironment} from "@/lib/gateway/store";
import {authorizeGateway} from "@/lib/gateway/operator-session";
import {loadAccount} from "@/lib/gateway/vault";
import {historyConfigured,historyCapability,historySlot,listManual,importManual} from "@/lib/manual-history";
import {isAuthError,explainTikTok} from "@/lib/tiktok-errors";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
function fail(e:unknown){return reply({error:e instanceof GatewayError?e.message:explainTikTok(e,"Publication history unavailable.")},e instanceof GatewayError?e.status:isAuthError(e)?401:502);}
function requestedSlot(request:Request){const slot=new URL(request.url).searchParams.get("account");if(slot!==null&&!validSlot(slot))throw new GatewayError(400,"Invalid account slot.");return slot??undefined;}
export async function GET(request:Request){
 try{
 const slot=requestedSlot(request);
 // Explicit operator read of an already-enrolled browser account; no TikTok API
 // or token refresh is required for stored history. Never use this for writes.
 if(request.headers.get("x-creatorpulse-operator-session")==="1"){
  if(!["sandbox","local"].includes(gatewayEnvironment()))throw new GatewayError(403,"Operator history access unavailable.");
  if(await authorizeGateway(request,true)!=="browser")throw new GatewayError(403,"Browser operator session required.");
  if(!slot||!accounts(await cookies()).some(a=>a.slot===slot))throw new GatewayError(403,"Account is not connected in this browser.");
  if(!await historyCapability())throw new GatewayError(503,"Central history requires the updated Local Bridge.");
  await loadAccount(slot);
  return reply({configured:true,records:await listManual(slot),limit:200,access:"operator"});
 }
 if(!historyConfigured())return reply({configured:false,records:[]});
 if(!await historyCapability())throw new GatewayError(503,"Central history requires the updated Local Bridge.");
 const account=await historySlot(slot);return reply({configured:true,records:await listManual(account),limit:200});
 }catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{if(!sameOrigin(request))throw new GatewayError(403,"Origin not allowed.");if(!historyConfigured()||!await historyCapability())throw new GatewayError(503,"Central history unavailable.");
 const slot=requestedSlot(request);const record=await importManual(slot,await request.json().catch(()=>null));return reply({record});}catch(e){return fail(e);}
}
