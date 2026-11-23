import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_CONFIG } from "@/config/app";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(APP_CONFIG.cookieNames.accessToken)?.value;

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!accessToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Redirect authenticated users away from landing page
  if (pathname === "/" && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|privacy|terms).*)"],
};