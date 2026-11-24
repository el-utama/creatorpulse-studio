import {GatewayError,redis,seal,unseal} from "./store";
import {loadAccount,readAccount,profileIdentity,vaultToken} from "./vault";
import {initPublish,fetchPublishStatus} from "@/lib/tiktok";
import {explainTikTok,explainFailure} from "@/lib/tiktok-errors";
const hash="creatorpulse:v3:posts";
const uuid=(id:unknown):id is string=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
type State="draft"|"approved"|"sending"|"submitted"|"uncertain"|"cancelled";
type Post={id:string;accountId:string;accountName:string;videoUrl:string;caption:string;mode:"inbox";state:State;createdAt:string;updatedAt:string;approvedUntil?:number;publishId?:string;status?:string;error?:string;events:{action:string;at:string;actor:string}[]};
async function load(id:string){
 if(!uuid(id))throw new GatewayError(400,"ID publikasi tidak valid.");
 const raw=await redis<string|null>(["HGET",hash,id]);
 if(!raw)throw new GatewayError(404,"Rencana publikasi tidak ditemukan.");
 return {post:unseal<Post>(raw,"post:"+id),raw};
}
async function change(post:Post,raw:string,patch:Partial<Post>,action:string,actor:string){
 const at=new Date().toISOString();
 const next={...post,...patch,updatedAt:at,events:[...post.events,{action,at,actor}].slice(-30)};
 const ok=await redis<number>(["EVAL","if redis.call('HGET',KEYS[1],ARGV[1])~=ARGV[2] then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]) return 1",1,hash,post.id,raw,seal(next,"post:"+post.id)]);
 if(ok!==1)throw new GatewayError(409,"Status berubah, muat ulang rencana.");
 return next;
}
export async function prepare(input:unknown){
 const x=input as Record<string,unknown>|null;
 if(!x||!uuid(x.requestId)||typeof x.accountId!=="string"||typeof x.videoUrl!=="string"||x.videoUrl.length>2000||typeof x.caption!=="string"||x.caption.length>2200||x.mode!=="inbox")throw new GatewayError(400,"ID permintaan, akun, URL, caption dan mode inbox wajib valid.");
 let url:URL;try{url=new URL(x.videoUrl);if(url.protocol!=="https:"||url.username||url.password||url.hash)throw Error();}catch{throw new GatewayError(400,"Gunakan URL HTTPS dari domain yang diverifikasi TikTok.");}
 const {account}=await loadAccount(x.accountId);
 const at=new Date().toISOString();
 const post:Post={id:x.requestId,accountId:account.slot,accountName:account.name,videoUrl:url.href,caption:x.caption,mode:"inbox",state:"draft",createdAt:at,updatedAt:at,events:[{action:"prepared",at,actor:"agent"}]};
 const result=await redis<number>(["EVAL","-- post_create\nif redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 2 end if redis.call('HLEN',KEYS[1])>=100 then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]) return 1",1,hash,post.id,seal(post,"post:"+post.id)]);
 if(result===0)throw new GatewayError(409,"Antrean mencapai kapasitas 100 rencana; hubungi operator.");
 if(result===2){const {post:old}=await load(post.id);if(old.accountId!==post.accountId||old.videoUrl!==post.videoUrl||old.caption!==post.caption)throw new GatewayError(409,"ID permintaan sudah digunakan untuk payload berbeda.");return old;}
 return post;
}
export async function getPost(id:string){return (await load(id)).post;}
export async function listPosts(){
 const ids=await redis<string[]>(["HKEYS",hash]);
 return (await Promise.all(ids.slice(0,100).map(getPost))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function approve(id:string,input:unknown){
 const x=input as Record<string,unknown>|null;
 const {post,raw}=await load(id);
 if(post.state!=="draft"&&!(post.state==="approved"&&(post.approvedUntil||0)<Date.now()))throw new GatewayError(409,"Rencana tidak dapat disetujui.");
 if(!x||x.confirm!==true||x.accountId!==post.accountId||x.videoUrl!==post.videoUrl||x.caption!==post.caption||x.mode!=="inbox")throw new GatewayError(400,"Konfirmasi harus sesuai dengan rencana yang ditinjau.");
 await loadAccount(post.accountId);
 return change(post,raw,{state:"approved",approvedUntil:Date.now()+15*60000},"approved","operator");
}
export async function cancel(id:string){
 const {post,raw}=await load(id);
 if(!["draft","approved"].includes(post.state))throw new GatewayError(409,"Rencana sudah dikirim atau tidak dapat dibatalkan.");
 return change(post,raw,{state:"cancelled"},"cancelled","operator");
}
export async function execute(id:string){
 const {post,raw}=await load(id);
 if(post.state==="submitted")return post;
 if(post.state!=="approved"||(post.approvedUntil||0)<=Date.now())throw new GatewayError(409,"Persetujuan tidak tersedia atau kedaluwarsa. Jangan mengulang permintaan yang belum pasti.");
 const token=await vaultToken(post.accountId),{account}=await loadAccount(post.accountId);
 const identity=await profileIdentity(token);
 if(identity.open_id!==account.openId)throw new GatewayError(409,"Identitas akun tidak cocok.");
 if((post.approvedUntil||0)<=Date.now())throw new GatewayError(409,"Persetujuan kedaluwarsa.");
 const sending=await change(post,raw,{state:"sending"},"execution_claimed","agent");
 const claimed=await load(id);
 if(claimed.post.state!=="sending")throw new GatewayError(409,"Status eksekusi berubah.");
 let publishId:string|undefined;
 try{
  const result=await initPublish(token,{source_info:{source:"PULL_FROM_URL",video_url:sending.videoUrl}},"inbox");
  publishId=result.publish_id;
  return await change(claimed.post,claimed.raw,{state:"submitted",publishId,status:"PROCESSING_UPLOAD"},"tiktok_accepted","agent");
 }catch(error){
  const message=explainTikTok(error,"Hasil pengiriman belum pasti. Jangan kirim ulang.");
  try{return await change(claimed.post,claimed.raw,{state:"uncertain",publishId,error:message},"execution_uncertain","agent");}catch{throw new GatewayError(503,"Hasil belum pasti; periksa TikTok sebelum tindakan berikutnya.");}
 }
}
export async function checkStatus(id:string){
 const {post,raw}=await load(id);
 if(!post.publishId||!["submitted","uncertain"].includes(post.state))return post;
 const result=await readAccount(post.accountId,t=>fetchPublishStatus(t,post.publishId!));
 return change(post,raw,{status:result.status,error:result.status==="FAILED"?explainFailure(result.fail_reason):undefined},"status_checked","agent");
}
