import { NextResponse } from "next/server";
import { sessionToken } from "@/lib/session";
import { getCreatorCapabilities } from "@/lib/tiktok";

export async function GET() {
  const token = await sessionToken();
  if (!token) return NextResponse.json({error:"Hubungkan kembali akun TikTok."},{status:401});
  try {
    return NextResponse.json(await getCreatorCapabilities(token), {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Pengaturan publikasi akun belum tersedia."},{status:502});
  }
}
