import {createHash,randomUUID} from "node:crypto";
import {GatewayError,redis,trendList,withSlotLock} from "./store";
const types=["topic","hashtag","music","video","keyword"];
const sources=["tiktok_creative_center","tiktok_discovery_api","google_trends","web_research","manual"];
const str=(v:unknown,n:number)=>typeof v==="string"&&v.trim().length>0&&v.length<=n?v.trim():null;
export type Observation={id:string;type:string;topic:string;region:string;source:string;sourceUrl:string;observedAt:string;receivedAt:string;evidence:string;changePct:number|null;metric:string|null};
export function normalizeObservation(input:unknown):Observation{
 if(!input||typeof input!=="object")throw new GatewayError(400,"Observasi tidak valid.");
 const x=input as Record<string,unknown>;
 const topic=str(x.topic,200),evidence=str(x.evidence,2000),region=str(x.region,2)?.toUpperCase(),sourceUrl=str(x.sourceUrl,1500),source=str(x.source,50),type=str(x.type,20);
 if(!topic||!evidence||!region||!/^[A-Z]{2}$/.test(region)||!source||!sources.includes(source)||!type||!types.includes(type)||!sourceUrl)throw new GatewayError(400,"Topik, tipe, negara, sumber, tautan dan bukti wajib diisi.");
 try{const u=new URL(sourceUrl);if(u.protocol!=="https:"||u.username||u.password)throw Error();if(source==="tiktok_creative_center"&&u.hostname!=="ads.tiktok.com")throw Error();if(source==="tiktok_discovery_api"&&u.hostname!=="ads.tiktok.com"&&u.hostname!=="business-api.tiktok.com")throw Error();if(source==="google_trends"&&u.hostname!=="trends.google.com")throw Error();}catch{throw new GatewayError(400,"Tautan sumber HTTPS tidak cocok.");}
 const time=typeof x.observedAt==="string"?Date.parse(x.observedAt):NaN;
 if(!Number.isFinite(time)||time>Date.now()+300000||time<Date.now()-90*86400000)throw new GatewayError(400,"Waktu observasi tidak valid atau terlalu lama.");
 const changePct=x.changePct==null?null:x.changePct;
 if(changePct!==null&&(typeof changePct!=="number"||!Number.isFinite(changePct)||changePct<-100||changePct>100000))throw new GatewayError(400,"Perubahan persentase tidak valid.");
 const metric=str(x.metric,150);
 if(changePct!==null&&!metric)throw new GatewayError(400,"Definisi metrik wajib untuk persentase perubahan.");
 return {id:randomUUID(),type,topic,region,source,sourceUrl,observedAt:new Date(time).toISOString(),receivedAt:new Date().toISOString(),evidence,changePct:changePct as number|null,metric};
}
// Stable identity for a source's daily observation. Preserve query parameters
// (they may identify different datasets), but ignore URL fragments.
function observationIdentity(o:Observation){
 const url=new URL(o.sourceUrl);url.hash="";
 const topic=o.topic.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
 return JSON.stringify([o.region,o.type,o.source,url.href,topic,o.observedAt.slice(0,10)]);
}
async function storedTrends(){
 const entries=await redis<string[]>(["LRANGE",trendList,0,499]);
 return entries.map(s=>JSON.parse(s) as Observation);
}
export async function recordTrend(x:unknown){
 const observation=normalizeObservation(x),identity=observationIdentity(observation);
 // Use the existing restricted Bridge lock protocol. No schema or host upgrade.
 // The lock covers read + append for the same identity within the retained 500 rows.
 const lock=createHash("sha256").update("trend-dedup:v1:"+identity).digest("hex").slice(0,32);
 return withSlotLock(lock,async()=>{
  const existing=(await storedTrends()).find(o=>observationIdentity(o)===identity);
  if(existing)return {observation:existing,duplicate:true};
  const inserted=await redis(["EVAL","redis.call('LPUSH',KEYS[1],ARGV[1]); redis.call('LTRIM',KEYS[1],0,499); return 1",1,trendList,JSON.stringify(observation)]);
  if(inserted!==1)throw new GatewayError(503,"Penyimpanan observasi belum terkonfirmasi.");
  return {observation,duplicate:false};
 });
}
export async function listTrends(region:string,days:number){
 const entries=await storedTrends();
 const cutoff=Date.now()-days*86400000;
 return entries.filter(x=>x.region===region&&Date.parse(x.observedAt)>=cutoff).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
}
