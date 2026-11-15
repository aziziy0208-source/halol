import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-name";

/**
 * Optimistic gate for /admin: without a session cookie, go to the sign-in page.
 * This is only a fast first filter — the real check (valid session, 2FA, role)
 * runs on the server in every admin page and server action (src/lib/auth).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isSignIn = pathname === "/admin/login";

  if (!isSignIn && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
