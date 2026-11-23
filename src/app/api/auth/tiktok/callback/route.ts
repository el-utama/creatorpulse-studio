import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=missing_params", process.env.APP_URL || "http://localhost:3000")
    );
  }

  // Validasi state dari cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split("; ")
    .find((c) => c.startsWith(`${APP_CONFIG.cookieNames.oauthState}=`))
    ?.split("=")
    .slice(1)
    .join("");

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL("/?error=invalid_state", process.env.APP_URL || "http://localhost:3000")
    );
  }

  try {
    const tokenRes = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!,
          client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
        }),
      }
    );

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("TikTok token exchange failed:", tokenRes.status, errorText);
      return NextResponse.redirect(
        new URL(
          `/?error=token_exchange_failed&detail=${encodeURIComponent(errorText.slice(0, 200))}`,
          process.env.APP_URL || "http://localhost:3000"
        )
      );
    }

    const tokens = await tokenRes.json();

    const maxAge = tokens.expires_in || 3600;
    const refreshMaxAge = 7 * 24 * 60 * 60;

    const isProduction = process.env.NODE_ENV === "production";
    const secureFlag = isProduction ? "Secure" : "";

    const response = NextResponse.redirect(
      new URL("/dashboard", process.env.APP_URL || "http://localhost:3000")
    );

    // Set cookies via Set-Cookie header directly for reliability
    response.headers.set(
      "Set-Cookie",
      `${APP_CONFIG.cookieNames.accessToken}=${tokens.access_token}; Path=/; HttpOnly; ${secureFlag}; SameSite=Lax; Max-Age=${maxAge}`
    );
    response.headers.append(
      "Set-Cookie",
      `${APP_CONFIG.cookieNames.refreshToken}=${tokens.refresh_token}; Path=/; HttpOnly; ${secureFlag}; SameSite=Lax; Max-Age=${refreshMaxAge}`
    );
    response.headers.append(
      "Set-Cookie",
      `${APP_CONFIG.cookieNames.oauthState}=; Path=/; HttpOnly; ${secureFlag}; SameSite=Lax; Max-Age=0`
    );

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_exception", process.env.APP_URL || "http://localhost:3000")
    );
  }
}