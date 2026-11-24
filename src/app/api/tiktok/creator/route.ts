import { NextResponse } from "next/server";
import { sessionRead } from "@/lib/session";
import { getCreatorCapabilities } from "@/lib/tiktok";
import { explainTikTok,isAuthError } from "@/lib/tiktok-errors";
export async function GET() {
  try {return NextResponse.json(await sessionRead(getCreatorCapabilities),{headers:{"Cache-Control":"no-store"}});}
  catch(error) {return NextResponse.json({error:explainTikTok(error,"Pengaturan publikasi akun belum tersedia.")},{status:isAuthError(error)?401:502});}
}
