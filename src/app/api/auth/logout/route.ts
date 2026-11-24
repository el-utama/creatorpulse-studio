import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST() {
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });

  // Hapus semua cookie sesi
  response.cookies.set(APP_CONFIG.cookieNames.accessToken, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set(APP_CONFIG.cookieNames.refreshToken, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set(APP_CONFIG.cookieNames.oauthState, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });

  return response;
}