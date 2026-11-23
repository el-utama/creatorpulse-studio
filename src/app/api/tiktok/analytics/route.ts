import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { getUserInfo, getVideoList } from "@/lib/tiktok";

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
        const newTokens = await refreshTikTokToken(refreshToken);
        // Update cookie via response is not possible here; caller handles it
        return fn(newTokens.access_token);
      }
      throw err;
    }
  }

  async function refreshTikTokToken(refreshToken: string) {
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
    if (!res.ok) throw new Error("Refresh token failed");
    return res.json();
  }

  try {
    const [userInfo, videos] = await Promise.all([
      fetchWithRefresh(getUserInfo),
      fetchWithRefresh(getVideoList),
    ]);

    return NextResponse.json({
      user_info: userInfo,
      videos: {
        data: videos,
        total: videos.length,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}