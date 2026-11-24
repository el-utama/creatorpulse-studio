import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(APP_CONFIG.cookieNames.oauthState)?.value;

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
      console.error("TikTok token exchange failed:", tokenRes.status);
      return NextResponse.redirect(
        new URL(
          "/?error=token_exchange_failed",
          process.env.APP_URL || "http://localhost:3000"
        )
      );
    }

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error("No access_token in TikTok response");
      return NextResponse.redirect(
        new URL(
          "/?error=no_access_token",
          process.env.APP_URL || "http://localhost:3000"
        )
      );
    }

    const maxAge = tokens.expires_in || 3600;
    const refreshMaxAge = tokens.refresh_expires_in || 7 * 24 * 60 * 60;
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.redirect(
      new URL("/dashboard", process.env.APP_URL || "http://localhost:3000")
    );

    // Set cookies via NextResponse.cookies() for reliability
    response.cookies.set(APP_CONFIG.cookieNames.accessToken, tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    response.cookies.set(APP_CONFIG.cookieNames.refreshToken, tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: refreshMaxAge,
    });

    response.cookies.set(APP_CONFIG.cookieNames.oauthState, "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_exception", process.env.APP_URL || "http://localhost:3000")
    );
  }
}