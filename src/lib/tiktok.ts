import { APP_CONFIG } from "@/config/app";
import type {
  TikTokTokenResponse,
  TikTokUserInfo,
  TikTokVideo,
  TikTokPublishInitResponse,
  TikTokPublishStatusResponse,
} from "@/types/tiktok";

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

export function getTikTokAuthorizeUrl(state: string, scopes: string): string {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY!,
    redirect_uri: TIKTOK_REDIRECT_URI!,
    response_type: "code",
    scope: scopes,
    state,
  });
  return `${APP_CONFIG.tiktokAuthorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<TikTokTokenResponse> {
  const res = await fetch(APP_CONFIG.tiktokTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY!,
      client_secret: TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok token exchange failed: ${res.status} ${errorText}`
    );
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TikTokTokenResponse> {
  const res = await fetch(APP_CONFIG.tiktokTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY!,
      client_secret: TIKTOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok token refresh failed: ${res.status} ${errorText}`
    );
  }

  return res.json();
}

export async function getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const fields = [
    "open_id",
    "union_id",
    "avatar_url",
    "display_name",
    "bio_description",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");

  const res = await fetch(
    `${APP_CONFIG.tiktokUserInfoUrl}?fields=${fields}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok user info failed: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return data.user_info;
}

export async function getVideoList(
  accessToken: string
): Promise<TikTokVideo[]> {
  const fields = [
    "id",
    "title",
    "video_description",
    "cover_image_url",
    "create_time",
    "share_url",
    "view_count",
    "like_count",
    "comment_count",
    "share_count",
  ].join(",");

  const res = await fetch(APP_CONFIG.tiktokVideoListUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields,
      max_count: 20,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok video list failed: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return data.videos?.data ?? [];
}

export async function initPublish(
  accessToken: string,
  body: Record<string, unknown>
): Promise<TikTokPublishInitResponse> {
  const res = await fetch(APP_CONFIG.tiktokPublishInitProfile, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok publish init failed: ${res.status} ${errorText}`
    );
  }

  return res.json();
}

export async function fetchPublishStatus(
  accessToken: string,
  publishId: string
): Promise<TikTokPublishStatusResponse> {
  const res = await fetch(APP_CONFIG.tiktokPublishStatus, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      publish_ids: [publishId],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `TikTok publish status fetch failed: ${res.status} ${errorText}`
    );
  }

  return res.json();
}

export async function uploadVideoChunk(
  uploadUrl: string,
  fileBuffer: Uint8Array,
  contentType: string
): Promise<Response> {
  return fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length.toString(),
    },
    body: fileBuffer as unknown as BodyInit,
  });
}