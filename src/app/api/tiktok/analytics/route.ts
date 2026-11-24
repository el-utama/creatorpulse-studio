import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(APP_CONFIG.cookieNames.accessToken)?.value;
  const refreshToken = cookieStore.get(APP_CONFIG.cookieNames.refreshToken)?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = accessToken;

  async function fetchWithRefresh<T>(
    fn: (token: string) => Promise<T>
  ): Promise<T> {
    try {
      return await fn(token);
    } catch (err: any) {
      if (refreshToken && err.message.includes("401")) {
        const res = await fetch(
          "https://open.tiktokapis.com/v2/oauth/token/",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_key: process.env.TIKTOK_CLIENT_KEY!,
              client_secret: process.env.TIKTOK_CLIENT_SECRET!,
              refresh_token: refreshToken,
              grant_type: "refresh_token",
            }),
          }
        );
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Refresh failed: ${res.status} ${errText}`);
        }
        const data = await res.json();
        return fn(data.access_token);
      }
      throw err;
    }
  }

  try {
    const [userInfo, videos] = await Promise.all([
      fetchWithRefresh((token) =>
        fetch(
          `${APP_CONFIG.tiktokUserInfoUrl}?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        ).then(async (r) => {
          if (!r.ok) {
            const t = await r.text();
            throw new Error(`User info failed: ${r.status} ${t}`);
          }
          return r.json();
        })
      ),
      fetchWithRefresh((token) =>
        fetch(
          `${APP_CONFIG.tiktokVideoListUrl}?fields=id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              max_count: 20,
            }),
            cache: "no-store",
          }
        ).then(async (r) => {
          if (!r.ok) {
            const t = await r.text();
            throw new Error(`Video list failed: ${r.status} ${t}`);
          }
          return r.json();
        })
      ),
    ]);

    return NextResponse.json({
      user_info: userInfo.data?.user_info ?? userInfo.data?.user ?? userInfo.user_info ?? userInfo.user ?? null,
      videos: {
        data: videos.data?.videos ?? [],
        total: videos.data?.videos?.length ?? 0,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}