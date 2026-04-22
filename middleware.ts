import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session");
  const { pathname } = request.nextUrl;

  // Public paths that don't need authentication
  const publicPaths = [
    "/login",
    "/banners",
    "/api/auth",
    "/booking",
    "/api/booking",
    "/api/ticket",
  ];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  // Static files and API paths other than protected ones
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath) {
    // If already logged in and visiting /login, redirect to dashboard
    if (pathname === "/login" && session?.value) {
      return NextResponse.redirect(new URL("/events", request.url));
    }
    return NextResponse.next();
  }

  // Protected routes: everything under (main) group — dashboard, editor, check, participants
  // Also protect the root "/" which redirects to /dashboard
  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
