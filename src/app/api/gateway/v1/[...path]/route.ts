import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {APP_CONFIG} from "@/config/app";
import {accounts,currentSlot,slotNames,sameOrigin} from "@/lib/accounts";
import {GatewayError,config,binding,limitAgent,gatewayEnvironment} from "@/lib/gateway/store";
import {listVault,readAccount,enrollAccount,removeVault,profileIdentity,slotForId} from "@/lib/gateway/vault";
import {prepare,approve,cancel,execute,checkStatus,getPost,listPosts,archive,MAX_LOCAL_VIDEO} from "@/lib/gateway/posts";
import {recordTrend,listTrends} from "@/lib/gateway/trends";
import {readTikTok,explainTikTok,isAuthError} from "@/lib/tiktok-errors";
import {getCreatorCapabilities} from "@/lib/tiktok";
import {historyCapability} from "@/lib/manual-history";
import {recordHermesValidation,readHermesValidation} from "@/lib/gateway/hermes-validation";
import {sessionToken} from "@/lib/session";
import {operatorSessionActive,openOperatorSession,clearOperatorSession,requireBrowserRequest,authorizeGateway} from "@/lib/gateway/operator-session";
const headers={"Cache-Control":"no-store"};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type Ctx={params:Promise<{path:string[]}>};
function fail(error:unknown){if(!(error instanceof GatewayError)&&!isAuthError(error))console.warn("gateway_unexpected_failure",{kind:error instanceof Error?error.name:"unknown"});return reply({error:error instanceof GatewayError?error.message:explainTikTok(error,"Gateway belum dapat menyelesaikan permintaan.")},error instanceof GatewayError?error.status:isAuthError(error)?401:502);}
function cursorOf(url:URL){const raw=url.searchParams.get("cursor")||"0",n=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n))throw new GatewayError(400,"Cursor tidak valid.");return n;}
export async function GET(request:Request,ctx:Ctx){
 const p=(await ctx.params).path,url=new URL(request.url);
 if(p.join("/") === "health")return reply({version:"3.7-environment",environment:gatewayEnvironment(),storage:"local_bridge",directPublicEnabled:process.env.TIKTOK_DIRECT_POST_AUDITED==="true",configured:!!config(),posting:config()?"approval_required_inbox_and_direct":"disabled",trends:"observations_only"});
 try{
  if(p.join("/") === "operator-session")return reply({authenticated:await operatorSessionActive(request)});
  if(p.join("/") === "hermes-validation"){await authorizeGateway(request,true);return reply(await readHermesValidation());}
  const access=await authorizeGateway(request);
  if(access==="bearer")await limitAgent(request);
  if(p.join("/") === "manual-history-capability")return reply({version:await historyCapability()?1:0});
  if(p.join("/") === "posts")return reply({posts:await listPosts()});
  if(p[0]==="posts"&&p.length===2)return reply(await getPost(p[1]));
  if(p.join("/") === "accounts")return reply({accounts:await listVault(),limit:3,...(access==="browser"&&["sandbox","local"].includes(gatewayEnvironment())?{hermesValidation:await readHermesValidation()}:{})});
  if(p[0]==="accounts"&&p.length===3){
   const slot=p[1];
   if(p[2]==="capabilities")return reply(await readAccount(slot,getCreatorCapabilities));
   if(p[2]==="analytics")return reply(await readAccount(slot,async token=>readTikTok(await fetch(APP_CONFIG.tiktokUserInfoUrl+"?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count",{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)}))));
   if(p[2]==="videos"){const cursor=cursorOf(url);return reply(await readAccount(slot,async token=>readTikTok(await fetch(APP_CONFIG.tiktokVideoListUrl+"?fields=id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({max_count:20,...(cursor?{cursor}:{})}),cache:"no-store",signal:AbortSignal.timeout(10000)}))));}
  }
  if(p.join("/") === "trends"){
   const region=(url.searchParams.get("region")||"ID").toUpperCase(),days=Number(url.searchParams.get("days")||"7");
   if(!/^[A-Z]{2}$/.test(region)||!Number.isInteger(days)||days<1||days>90)throw new GatewayError(400,"Filter tren tidak valid.");
   return reply({region,days,provenance:"agent_submitted_unverified",observations:await listTrends(region,days)});
  }
  return reply({error:"Endpoint tidak ditemukan."},404);
 }catch(e){return fail(e);}
}
export async function POST(request:Request,ctx:Ctx){
 const p=(await ctx.params).path;
 try{
  if(p.join("/") === "hermes-validation")return reply(await recordHermesValidation(request),201);
  if(p.join("/") === "operator-session"){await openOperatorSession(request);return reply({authenticated:true});}
  if(p.join("/") === "operator-session/lock"){requireBrowserRequest(request);await clearOperatorSession();return reply({authenticated:false});}
  if(p.join("/") === "enroll"){
   await authorizeGateway(request,true);
   if(!sameOrigin(request))throw new GatewayError(403,"Origin tidak diizinkan.");
   const jar=await cookies(),slot=currentSlot(jar);
   if(!slot||!accounts(jar).some(a=>a.slot===slot))throw new GatewayError(400,"Hubungkan kembali akun melalui dashboard terlebih dahulu.");
   const n=slotNames(slot),token=await sessionToken(),refresh=jar.get(n.refresh)?.value;
   if(!token)throw new GatewayError(401,"Hubungkan kembali akun TikTok terlebih dahulu.");
   const user=await profileIdentity(token);
   if(slotForId(user.open_id)!==slot)throw new GatewayError(409,"Akun aktif berubah.");
   const {epoch,alreadyEnrolled}=await enrollAccount({slot,openId:user.open_id,name:user.display_name||"Akun TikTok",access:token,refresh:refresh||"",expiresAt:Date.now()+60000,updatedAt:new Date().toISOString()});
   // A duplicate request must not replace the existing browser session either.
   // The browser has independently authenticated this same account above.
   if(alreadyEnrolled)return reply({success:true,id:slot,name:user.display_name,alreadyEnrolled:true});
   // Move the active browser session onto the vault; do not keep rotating refresh tokens in cookies.
   const options={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
   jar.set(n.access,"",{...options,maxAge:0});jar.set(n.refresh,"",{...options,maxAge:0});
   jar.set("creatorpulse_account_"+slot+"_v",binding(slot,epoch),{...options,maxAge:365*86400});
   return reply({success:true,id:slot,name:user.display_name,alreadyEnrolled});
  }
  await authorizeGateway(request);
  if(p.join("/") === "posts")return reply(await prepare(await request.json().catch(()=>null)),201);
  if(p[0]==="posts"&&p.length===3){
   if(p[2]==="approve"){await authorizeGateway(request,true);return reply(await approve(p[1],await request.json().catch(()=>null)));}
   if(p[2]==="archive"){await authorizeGateway(request,true);return reply(await archive(p[1]));}
   if(p[2]==="cancel"){await authorizeGateway(request,true);return reply(await cancel(p[1]));}
   if(p[2]==="execute")return reply(await execute(p[1]));
   if(p[2]==="execute-file"){
    if(!["sandbox","local"].includes(gatewayEnvironment()))throw new GatewayError(403,"Local agent upload is Sandbox-only.");
    if(request.headers.get("content-type")!=="video/mp4"||!request.body)throw new GatewayError(400,"MP4 body required.");
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_LOCAL_VIDEO){await reader.cancel();throw new GatewayError(413,"Local video exceeds 4 MiB.");}chunks.push(value);}}finally{reader.releaseLock();}
    return reply(await execute(p[1],Buffer.concat(chunks,size)));
   }
   if(p[2]==="status")return reply(await checkStatus(p[1]));
  }
  if(p.join("/") === "trends"){const body=await request.json().catch(()=>null);const saved=await recordTrend(body);return reply({...saved,provenance:"agent_submitted_unverified"},saved.duplicate?200:201);}
  if(p[0]==="accounts"&&p.length===3&&p[2]==="disconnect"){await authorizeGateway(request,true);await removeVault(p[1]);return reply({success:true});}
  return reply({error:"Endpoint tidak ditemukan. Gunakan antrean posts."},404);
 }catch(e){return fail(e);}
}
