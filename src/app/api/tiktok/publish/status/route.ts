import { NextResponse } from "next/server";
import { sessionToken } from "@/lib/session";
import { fetchPublishStatus } from "@/lib/tiktok";

export async function POST(request: Request) {
  const token = await sessionToken();
  if (!token) return NextResponse.json({error:"Sesi berakhir. Hubungkan kembali akun TikTok."},{status:401});
  const body = await request.json().catch(() => null);
  const ids = body?.publish_ids;
  if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== "string" || !ids[0].trim()) return NextResponse.json({error:"ID publikasi tidak valid."},{status:400});
  try {
    return NextResponse.json(await fetchPublishStatus(token,ids[0]),{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Status belum dapat diperiksa."},{status:502});
  }
}
