export interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  avatar_url: string;
  display_name: string;
  bio_description?: string;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
}

export interface TikTokVideo {
  id: string;
  title: string;
  video_description?: string;
  cover_image_url: string;
  create_time: number | string;
  share_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  scope: string;
  token_type: string;
}

export interface TikTokPublishInitResponse {
  publish_id: string;
  upload_url: string;
}

export interface TikTokPublishStatusResponse {
  publish_id: string;
  status: string;
  fail_reason?: string;
  error_code?: number;
  error_message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}