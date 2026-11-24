import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_CONFIG } from "@/config/app";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const active=request.cookies.get("creatorpulse_active")?.value;
  const slot=active && /^[a-f0-9]{32}$/.test(active)?active:null;
  const accessToken=request.cookies.get(slot?"creatorpulse_account_"+slot+"_a":APP_CONFIG.cookieNames.accessToken)?.value;
  const refreshToken=request.cookies.get(slot?"creatorpulse_account_"+slot+"_r":APP_CONFIG.cookieNames.refreshToken)?.value;

  const anotherAccount=request.cookies.getAll().some(c=>/^creatorpulse_account_[a-f0-9]{32}_[arv]$/.test(c.name)&&!!c.value);
  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!accessToken && !refreshToken && !anotherAccount) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Redirect authenticated users away from landing page
  if (pathname === "/" && (accessToken||refreshToken||anotherAccount) && !request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|privacy|terms).*)"],
};