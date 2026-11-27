import {createHmac,timingSafeEqual} from "node:crypto";
import {GatewayError,gatewayEnvironment,requiredConfig,redis,seal,unseal,authorize,limitAgent} from "./store";
import {listVault} from "./vault";

const TTL=86400;
const context="creatorpulse:hermes-validation:v1";
export type HermesValidation={schema:1;reportedAt:string;commit:string;accounts:number;adapter_readonly:"passed";hermes_cli_test_exit:0;source:"controller_report"};
export type HermesValidationState={state:"reported";report:HermesValidation}|{state:"none"|"unavailable"};

// Compatibility with the installed Bridge's existing bounded ephemeral protocol.
// Use a keyed, domain-separated digest, not a publication account/request tuple.
// This is one expiring diagnostic record, never a publication or vault record.
// A future Bridge protocol may provide a dedicated diagnostics namespace.
function storageKey(){
 const c=requiredConfig();
 return "creatorpulse:publish:v1:"+createHmac("sha256",c.key).update(JSON.stringify([context,gatewayEnvironment(),c.agent])).digest("hex");
}
function enabled(){return ["sandbox","local"].includes(gatewayEnvironment());}
function validInput(x:unknown):x is Pick<HermesValidation,"schema"|"commit"|"accounts"|"adapter_readonly"|"hermes_cli_test_exit">{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const p=x as Record<string,unknown>;
 return Object.keys(p).sort().join(",")==="accounts,adapter_readonly,commit,hermes_cli_test_exit,schema"&&p.schema===1&&typeof p.commit==="string"&&/^[a-f0-9]{40}$/.test(p.commit)&&typeof p.accounts==="number"&&Number.isInteger(p.accounts)&&p.accounts>=1&&p.accounts<=3&&p.adapter_readonly==="passed"&&p.hermes_cli_test_exit===0;
}
export async function recordHermesValidation(request:Request){
 if(!enabled())throw new GatewayError(404,"Diagnostics not enabled.");
 authorize(request);
 const supplied=Buffer.from(request.headers.get("authorization")||""),expected=Buffer.from("Bearer "+requiredConfig().agent);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new GatewayError(403,"Agent credential required.");
 if(request.headers.get("x-creatorpulse-environment")!==gatewayEnvironment())throw new GatewayError(403,"Environment mismatch.");
 await limitAgent(request);
 const text=await request.text();
 if(text.length>1024)throw new GatewayError(400,"Invalid diagnostic report.");
 let payload:unknown;try{payload=JSON.parse(text)}catch{throw new GatewayError(400,"Invalid diagnostic report.");}
 if(!validInput(payload))throw new GatewayError(400,"Invalid diagnostic report.");
 if((await listVault()).length!==payload.accounts)throw new GatewayError(409,"Enrollment changed; repeat validation.");
 const report:HermesValidation={...payload,reportedAt:new Date().toISOString(),source:"controller_report"};
 if(await redis(["SET",storageKey(),seal(report,context),"EX",TTL])!=="OK")throw new GatewayError(503,"Diagnostic report not stored.");
 return {state:"reported",report} as const;
}
export async function readHermesValidation():Promise<HermesValidationState>{
 if(!enabled())return {state:"none"};
 try{
  const raw=await redis<string|null>(["GET",storageKey()]);
  if(raw===null)return {state:"none"};
  const report=unseal<HermesValidation>(raw,context);
  const {reportedAt,source,...payload}=report;
  const time=Date.parse(reportedAt),age=Date.now()-time;
  if(source!=="controller_report"||!validInput(payload)||!Number.isFinite(age)||age<0)return {state:"unavailable"};
  if(age>=TTL*1000)return {state:"none"};
  return {state:"reported",report};
 }catch{return {state:"unavailable"};}
}
