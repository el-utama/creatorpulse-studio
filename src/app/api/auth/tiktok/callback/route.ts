import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";
import { exchangeCodeForToken } from "@/lib/tiktok";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

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
    .join("=");

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL("/?error=invalid_state", process.env.APP_URL || "http://localhost:3000")
    );
  }

  try {
    const tokens = await exchangeCodeForToken(code);

    const maxAge = tokens.expires_in || 3600;
    const refreshMaxAge = 7 * 24 * 60 * 60; // 7 hari untuk refresh token

    const response = NextResponse.redirect(
      new URL("/dashboard", process.env.APP_URL || "http://localhost:3000")
    );

    // Simpan access_token di cookie HTTP-only
    response.cookies.set(APP_CONFIG.cookieNames.accessToken, tokens.access_token, {
      ...COOKIE_OPTIONS,
      maxAge,
    });

    // Simpan refresh_token di cookie HTTP-only
    response.cookies.set(APP_CONFIG.cookieNames.refreshToken, tokens.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: refreshMaxAge,
    });

    // Hapus cookie state setelah berhasil
    response.cookies.set(APP_CONFIG.cookieNames.oauthState, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=token_exchange_failed", process.env.APP_URL || "http://localhost:3000")
    );
  }
}