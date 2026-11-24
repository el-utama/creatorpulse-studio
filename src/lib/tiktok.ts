import { readTikTok } from "@/lib/tiktok-errors";
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
  body: Record<string, unknown>,
  mode: "inbox" | "profile"
): Promise<TikTokPublishInitResponse> {
  const res = await fetch(mode === "inbox" ? APP_CONFIG.tiktokPublishInitInbox : APP_CONFIG.tiktokPublishInitProfile, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await readTikTok<TikTokPublishInitResponse>(res);
  if (!result.publish_id) throw new Error("Missing publication ID");
  return result;
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
      publish_id: publishId,
    }),
  });

  const result = await readTikTok<TikTokPublishStatusResponse>(res);
  if (!result.status) throw new Error("Missing publication status");
  return result;
}

export async function uploadVideoChunk(
  uploadUrl: string,
  fileBuffer: Uint8Array,
  contentType: string
): Promise<Response> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length.toString(),
      "Content-Range": `bytes 0-${fileBuffer.length - 1}/${fileBuffer.length}`,
    },
    body: fileBuffer as unknown as BodyInit,
  });
  if (response.status !== 201) throw new Error(`Video transfer not confirmed: ${response.status}`);
  return response;
}
export interface CreatorCapabilities {
  creator_nickname: string;
  creator_username: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}
export async function getCreatorCapabilities(token: string): Promise<CreatorCapabilities> {
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},cache:"no-store",body:"{}"});
  const data = await readTikTok<CreatorCapabilities>(res);
  if (!Array.isArray(data.privacy_level_options)) throw new Error("Creator capabilities unavailable");
  const options = data.privacy_level_options.filter((value: unknown) => typeof value === "string");
  return { ...data, privacy_level_options: process.env.TIKTOK_DIRECT_POST_AUDITED === "true" ? options : options.filter((value: string) => value === "SELF_ONLY") };
}
