import { NextResponse } from "next/server";
import { sameOrigin,slotFor } from "@/lib/accounts";
import { profileIdentity } from "@/lib/gateway/vault";
import { historyConfigured,updateManual } from "@/lib/manual-history";
import { sessionRead } from "@/lib/session";
import { fetchPublishStatus } from "@/lib/tiktok";
import { explainTikTok,explainFailure,isAuthError } from "@/lib/tiktok-errors";
export async function POST(request: Request) {
  if(!sameOrigin(request))return NextResponse.json({error:"Origin not allowed."},{status:403});
  const body=await request.json().catch(()=>null);
  const ids=body?.publish_ids;
  const slot=body?.accountSlot;
  if(slot!==undefined&&(typeof slot!=="string"||!/^[a-f0-9]{32}$/.test(slot))) return NextResponse.json({error:"Akun tidak valid."},{status:400});
  if(!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=="string"||!ids[0].trim()) return NextResponse.json({error:"ID publikasi tidak valid."},{status:400});
  try {
    const result=await sessionRead(async token=>{const data=await fetchPublishStatus(token,ids[0]);if(historyConfigured()){try{const account=slotFor((await profileIdentity(token)).open_id);if(!slot||account===slot)await updateManual(account,ids[0],data.status,data.fail_reason);}catch{console.warn("manual_history_status_not_saved");}}return data;},slot);
    return NextResponse.json({status:result.status,failure_reason:result.status==="FAILED"?explainFailure(result.fail_reason):null},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return NextResponse.json({error:explainTikTok(error,"Status belum dapat diperiksa.")},{status:isAuthError(error)?401:502});}
}
