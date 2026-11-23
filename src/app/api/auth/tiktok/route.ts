import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";
import { generateState } from "@/lib/utils";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // 10 menit
};

export async function GET() {
  const state = generateState();

  const response = NextResponse.redirect(
    `${APP_CONFIG.tiktokAuthorizeUrl}?${new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
      response_type: "code",
      scope: APP_CONFIG.scopes.join(","),
      state,
    }).toString()}`
  );

  response.cookies.set(APP_CONFIG.cookieNames.oauthState, state, COOKIE_OPTIONS);

  return response;
}