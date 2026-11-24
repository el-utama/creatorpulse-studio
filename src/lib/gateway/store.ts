import {createCipheriv,createDecipheriv,randomBytes,timingSafeEqual,createHmac} from "node:crypto";
export class GatewayError extends Error {constructor(public status:number,message:string){super(message)}}
export const vaultHash="creatorpulse:v3:vault";
export const trendList="creatorpulse:v3:trends";
export function config(){
 const url=process.env.CREATORPULSE_BRIDGE_URL,token=process.env.CREATORPULSE_BRIDGE_TOKEN;
 const operator=process.env.CREATORPULSE_OPERATOR_KEY,agent=process.env.CREATORPULSE_AGENT_KEY;
 const key=Buffer.from(process.env.CREATORPULSE_VAULT_KEY||"","base64");
 if(!url||!token||token.length<32||!operator||!agent||operator.length<32||agent.length<32||operator===agent||key.length!==32)return null;
 try{const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/storage/v1")return null;}catch{return null;}
 return {url,token,operator,agent,key};
}
export function requiredConfig(){const c=config();if(!c)throw new GatewayError(503,"Gateway belum dikonfigurasi.");return c;}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function authorize(request:Request,owner=false){
 const c=requiredConfig(),header=request.headers.get("authorization")||"";
 if(!header.startsWith("Bearer "))throw new GatewayError(401,"Bearer credential diperlukan.");
 const value=header.slice(7);
 if(!equal(value,c.operator)&&(owner||!equal(value,c.agent)))throw new GatewayError(403,"Akses gateway ditolak.");
}
export async function redis<T=unknown>(command:(string|number)[]):Promise<T>{
 const c=requiredConfig();
 const res=await fetch(c.url,{method:"POST",headers:{Authorization:"Bearer "+c.token,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data||data.error)throw new GatewayError(503,"Penyimpanan gateway tidak tersedia.");
 return data.result as T;
}
export function seal(value:unknown,context:string){
 const {key}=requiredConfig(),iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64url");
}
export function unseal<T>(value:string,context:string):T{
 const {key}=requiredConfig(),data=Buffer.from(value,"base64url");
 const decipher=createDecipheriv("aes-256-gcm",key,data.subarray(0,12));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(data.subarray(12,28));
 return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString("utf8")) as T;
}
export function binding(slot:string){return createHmac("sha256",requiredConfig().key).update("browser-slot:"+slot).digest("base64url");}
export function validBinding(slot:string,value:string|undefined){try{return !!value&&equal(binding(slot),value);}catch{return false;}}
export async function withSlotLock<T>(slot:string,fn:()=>Promise<T>):Promise<T>{
 const key="creatorpulse:v3:lock:"+slot,nonce=randomBytes(24).toString("hex");
 if(await redis(["SET",key,nonce,"NX","PX",60000])!=="OK")throw new GatewayError(409,"Akun sedang diproses; coba lagi.");
 try{return await fn();}finally{try{await redis(["EVAL","if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,key,nonce]);}catch{/* lock expires */}}
}
