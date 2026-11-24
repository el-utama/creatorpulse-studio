export const APP_CONFIG = {
  name: "CreatorPulse Studio",
  description:
    "Manajemen konten dan analitik kreator TikTok: login, posting video, dan analitik performa.",
  contactEmail: "hello@example.com",
  scopes: [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.list",
    "video.upload",
    "video.publish",
  ],
  tiktokAuthorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
  tiktokTokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
  tiktokUserInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
  tiktokVideoListUrl: "https://open.tiktokapis.com/v2/video/list/",
  tiktokPublishInitInbox:
    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
  tiktokPublishInitProfile:
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
  tiktokPublishStatus:
    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
  cookieNames: {
    accessToken: "creatorpulse_access_token",
    refreshToken: "creatorpulse_refresh_token",
    oauthState: "creatorpulse_oauth_state",
  },
  maxDirectUploadMB: 4,
} as const;

export type Scopes = (typeof APP_CONFIG.scopes)[number];