import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { refreshAccessToken } from "@/lib/tiktok";

export async function sessionToken(forceRefresh = false): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get(APP_CONFIG.cookieNames.accessToken)?.value;
  if (access && !forceRefresh) return access;
  const refresh = jar.get(APP_CONFIG.cookieNames.refreshToken)?.value;
  if (!refresh) return null;
  try {
    const tokens = await refreshAccessToken(refresh);
    if (!tokens.access_token) return null;
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    jar.set(APP_CONFIG.cookieNames.accessToken, tokens.access_token, { ...options, maxAge: tokens.expires_in || 3600 });
    if (tokens.refresh_token) jar.set(APP_CONFIG.cookieNames.refreshToken, tokens.refresh_token, { ...options, maxAge: tokens.refresh_expires_in || 604800 });
    return tokens.access_token;
  } catch { return null; }
}
