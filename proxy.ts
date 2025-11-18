import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/auth/jwt-edge";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always allow API and static assets (including anything in /public)
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/hoasurvey_logo.png") ||
    pathname.match(/^\/([a-zA-Z0-9_\-]+)\.(png|jpg|jpeg|gif|svg|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Allow setup and login pages - they handle their own checks
  if (pathname === "/setup" || pathname === "/login") {
    return NextResponse.next();
  }

  // Allow forgot-password and reset-password pages (public flows)
  if (
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password")
  ) {
    return NextResponse.next();
  }

  // Allow survey and invite pages (public)
  if (pathname.startsWith("/survey/") || pathname.startsWith("/invite/")) {
    return NextResponse.next();
  }

  // For all other routes, check authentication
  const token = request.cookies.get("auth-token")?.value;

  // If no token, redirect to login (login page will check setup status)
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify token
  const payload = await verifyToken(token);
  if (!payload || !payload.adminId) {
    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }

  // Add admin info to headers for API routes (safe coerce to string)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-admin-id", payload.adminId || "");
  requestHeaders.set("x-admin-role", payload.role || "");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|hoasurvey_logo.png|(?:[a-zA-Z0-9_\-]+)\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
  ],
};
