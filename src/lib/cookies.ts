import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

export async function setCookie(
  name: string,
  value: string,
  maxAge?: number
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    ...cookieOptions,
    maxAge,
  });
}

export async function getCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function deleteCookie(name: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(name, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function deleteAllSessionCookies(): Promise<void> {
  await deleteCookie(APP_CONFIG.cookieNames.accessToken);
  await deleteCookie(APP_CONFIG.cookieNames.refreshToken);
  await deleteCookie(APP_CONFIG.cookieNames.oauthState);
}

export async function getAccessToken(): Promise<string | undefined> {
  return getCookie(APP_CONFIG.cookieNames.accessToken);
}

export async function getRefreshToken(): Promise<string | undefined> {
  return getCookie(APP_CONFIG.cookieNames.refreshToken);
}

export async function getOAuthState(): Promise<string | undefined> {
  return getCookie(APP_CONFIG.cookieNames.oauthState);
}