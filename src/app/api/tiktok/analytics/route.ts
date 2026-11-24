import { NextResponse } from "next/server";
import { sessionRead } from "@/lib/session";
import { APP_CONFIG } from "@/config/app";
import { readTikTok, explainTikTok, isAuthError } from "@/lib/tiktok-errors";
import type { TikTokUserInfo, TikTokVideo } from "@/types/tiktok";
const headers = {"Cache-Control":"no-store"};
type VideoPage = {videos:TikTokVideo[];cursor:number;has_more:boolean};
async function videoPage(token:string,cursor:number) {
  const res=await fetch(APP_CONFIG.tiktokVideoListUrl+"?fields=id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count",
    {method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({max_count:20,...(cursor?{cursor}:{})}),cache:"no-store"});
  const data=await readTikTok<VideoPage>(res);
  if(!Array.isArray(data.videos)) throw new Error("Invalid video list");
  return {data:data.videos,total:data.videos.length,cursor: data.cursor,has_more:data.has_more===true && Number.isSafeInteger(data.cursor) && data.cursor>0 && data.cursor!==cursor};
}
export async function GET(request:Request) {
  const raw=new URL(request.url).searchParams.get("cursor");
  const cursor=raw===null?0:Number(raw);
  if(!Number.isSafeInteger(cursor)||cursor<0||(raw!==null&&!/^\d+$/.test(raw))) return NextResponse.json({error:"Halaman video tidak valid."},{status:400,headers});
  try {
    if(raw!==null) return NextResponse.json({videos:await sessionRead(token=>videoPage(token,cursor))},{headers});
    const profile=await sessionRead(async token=>{
      const response=await fetch(APP_CONFIG.tiktokUserInfoUrl+"?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      return readTikTok<{user:TikTokUserInfo}>(response);
    });
    if(!profile.user?.open_id) throw new Error("Missing user");
    let videos;let video_error:null|string=null;
    try {videos=await sessionRead(token=>videoPage(token,0));} catch(error) {video_error=explainTikTok(error,"Daftar video belum dapat dimuat.");videos={data:[],total:0,cursor:0,has_more:false};}
    return NextResponse.json({user_info:profile.user,videos,video_error},{headers});
  } catch(error) {return NextResponse.json({error:explainTikTok(error,"Analitik TikTok belum dapat dimuat.")},{status:isAuthError(error)?401:502,headers});}
}
