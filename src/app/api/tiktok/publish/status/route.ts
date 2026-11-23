import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { fetchPublishStatus } from "@/lib/tiktok";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(APP_CONFIG.cookieNames.accessToken)?.value;
  const refreshToken = cookieStore.get(APP_CONFIG.cookieNames.refreshToken)?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = accessToken;

  try {
    const body = await request.json();
    const { publish_ids } = body;

    if (!publish_ids || !Array.isArray(publish_ids)) {
      return NextResponse.json(
        { error: "publish_ids array is required" },
        { status: 400 }
      );
    }

    async function fetchWithRefresh(publishId: string) {
      try {
        return await fetchPublishStatus(token, publishId);
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
          if (!res.ok) throw new Error("Refresh token failed");
          const data = await res.json();
          return fetchPublishStatus(data.access_token, publishId);
        }
        throw err;
      }
    }

    const result = await fetchWithRefresh(publish_ids[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Publish status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch publish status" },
      { status: 500 }
    );
  }
}