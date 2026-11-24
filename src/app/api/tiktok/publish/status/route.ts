import { NextResponse } from "next/server";
import { sessionRead } from "@/lib/session";
import { fetchPublishStatus } from "@/lib/tiktok";
import { explainTikTok,explainFailure,isAuthError } from "@/lib/tiktok-errors";
export async function POST(request: Request) {
  const body=await request.json().catch(()=>null);
  const ids=body?.publish_ids;
  if(!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=="string"||!ids[0].trim()) return NextResponse.json({error:"ID publikasi tidak valid."},{status:400});
  try {
    const result=await sessionRead(token=>fetchPublishStatus(token,ids[0]));
    return NextResponse.json({status:result.status,failure_reason:result.status==="FAILED"?explainFailure(result.fail_reason):null},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return NextResponse.json({error:explainTikTok(error,"Status belum dapat diperiksa.")},{status:isAuthError(error)?401:502});}
}
