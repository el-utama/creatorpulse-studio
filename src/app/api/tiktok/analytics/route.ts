import { NextResponse } from "next/server";
import { sessionToken } from "@/lib/session";
import { APP_CONFIG } from "@/config/app";

const headers = {"Cache-Control":"no-store"};
export async function GET() {
  let token = await sessionToken();
  if (!token) return NextResponse.json({error:"Sesi berakhir."},{status:401,headers});
  const fetchProfile = (access: string) => fetch(
    APP_CONFIG.tiktokUserInfoUrl + "?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count",
    {headers:{Authorization:`Bearer ${access}`},cache:"no-store"}
  );
  try {
    let response = await fetchProfile(token);
    if (response.status === 401) {
      token = await sessionToken(true);
      if (!token) return NextResponse.json({error:"Sesi berakhir."},{status:401,headers});
      response = await fetchProfile(token);
    }
    if (response.status === 401) return NextResponse.json({error:"Sesi berakhir."},{status:401,headers});
    const profile = await response.json();
    const user = profile.data?.user;
    if (!response.ok || profile.error?.code !== "ok" || !user?.open_id) return NextResponse.json({error:"Profil TikTok belum dapat dimuat."},{status:502,headers});
    let videos: unknown[] = [];
    let video_error: string | null = null;
    try {
      const result = await fetch(APP_CONFIG.tiktokVideoListUrl + "?fields=id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count",
        {method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({max_count:20}),cache:"no-store"});
      const data = await result.json();
      if (!result.ok || data.error?.code !== "ok" || !Array.isArray(data.data?.videos)) throw new Error();
      videos = data.data.videos;
    } catch { video_error = "Daftar video belum dapat dimuat."; }
    return NextResponse.json({user_info:user,videos:{data:videos,total:videos.length},video_error},{headers});
  } catch {
    return NextResponse.json({error:"Analitik TikTok belum dapat dimuat."},{status:502,headers});
  }
}
