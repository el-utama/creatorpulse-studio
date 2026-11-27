import {config,redis,GatewayError} from "@/lib/gateway/store";
import {slotFor,validSlot} from "@/lib/accounts";
import {sessionRead} from "@/lib/session";
import {profileIdentity} from "@/lib/gateway/vault";
import {fetchPublishStatus} from "@/lib/tiktok";
export type ManualRecord={requestId:string;id:string|null;createdAt:string;mode:"inbox"|"profile"|"unknown";state:"pending"|"accepted"|"rejected"|"uncertain";status:string|null;updatedAt:string;failureReason:string|null;imported:number};
export const historyConfigured=()=>!!process.env.CREATORPULSE_BRIDGE_URL;
export async function historyCapability(){if(!config())return false;try{return await redis(["MANUAL_CAPS"])===1}catch{return false}}
export async function historySlot(slot?:string){
 if(slot!==undefined&&!validSlot(slot))throw new GatewayError(400,"Invalid account slot.");
 return sessionRead(async token=>{const account=await profileIdentity(token);const actual=slotFor(account.open_id);if(slot&&slot!==actual)throw new GatewayError(403,"Account identity mismatch.");return actual;},slot);
}
export const validPublicationId=(id:unknown):id is string=>typeof id==="string"&&/^[A-Za-z0-9_.~-]{1,256}$/.test(id);
const safeCode=(code:unknown)=>typeof code==="string"&&/^[a-z0-9_]{1,100}$/.test(code)?code:"";
const safeStatus=(status:unknown)=>typeof status==="string"&&/^[A-Z0-9_]{1,64}$/.test(status)?status:"UNKNOWN";
export async function listManual(account:string){return redis<ManualRecord[]>(["MANUAL_LIST",account]);}
export async function beginManual(account:string,requestId:string,mode:string){return redis<ManualRecord|null>(["MANUAL_BEGIN",account,requestId,mode]);}
export async function acceptManual(account:string,requestId:string,id:string){if(!validPublicationId(id)||await redis(["MANUAL_ACCEPT",account,requestId,id])!==1)throw new GatewayError(503,"Publication history not confirmed.");}
export async function rejectManual(account:string,requestId:string,state:"rejected"|"uncertain",code:string){await redis(["MANUAL_REJECT",account,requestId,state,safeCode(code)||"unknown"]);}
export async function updateManual(account:string,id:string,status:unknown,reason:unknown){if(validPublicationId(id))await redis(["MANUAL_STATUS",account,id,safeStatus(status),safeCode(reason)]);}
export async function importManual(slot:string|undefined,value:unknown){
 if(!value||typeof value!=="object")throw new GatewayError(400,"Invalid history record.");
 const r=value as Record<string,unknown>;
 if(!validPublicationId(r.id)||typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>Date.now()||Date.parse(r.createdAt)<Date.UTC(2020,0,1))throw new GatewayError(400,"Invalid publication record.");
 const id=r.id,createdAt=new Date(r.createdAt).toISOString(),mode=r.mode==="inbox"||r.mode==="profile"?r.mode:"unknown";
 // A client-supplied ID is never trusted: TikTok must confirm it under the same verified account token.
 return sessionRead(async token=>{const identity=await profileIdentity(token),account=slotFor(identity.open_id);if(slot&&account!==slot)throw new GatewayError(403,"Account identity mismatch.");
 const result=await fetchPublishStatus(token,id);
 if(result.publish_id&&result.publish_id!==id)throw new GatewayError(409,"Publication identity mismatch.");
 return redis<ManualRecord>(["MANUAL_IMPORT",account,id,createdAt,mode,safeStatus(result.status),safeCode(result.fail_reason)]);},slot);
}
