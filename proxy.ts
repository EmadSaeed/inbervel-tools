import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const role = token?.role as string | undefined;
  const isAdmin = role === "ADMIN";
  const isMember = role === "MEMBER";
  const isAuthed = isAdmin || isMember;

  // ── Public auth pages — redirect away if already signed in ────────────────
  if (pathname === "/login") {
    if (isMember) return NextResponse.redirect(new URL("/business-dashboard", req.url));
    if (isAdmin) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    if (isAdmin) return NextResponse.redirect(new URL("/admin", req.url));
    if (isMember) return NextResponse.redirect(new URL("/business-dashboard", req.url));
    return NextResponse.next();
  }

  if (pathname === "/business-dashboard/login") {
    if (isMember) return NextResponse.redirect(new URL("/business-dashboard", req.url));
    if (isAdmin) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  // ── /business-dashboard — MEMBER only ────────────────────────────────────
  if (pathname.startsWith("/business-dashboard")) {
    if (isMember) return NextResponse.next();
    if (isAdmin) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.redirect(new URL("/business-dashboard/login", req.url));
  }

  // ── /admin — ADMIN only ───────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (isAdmin) return NextResponse.next();
    if (isMember) return NextResponse.redirect(new URL("/business-dashboard", req.url));
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // ── All other routes — lock down completely ───────────────────────────────
  if (isAdmin) return NextResponse.redirect(new URL("/admin", req.url));
  if (isMember) return NextResponse.redirect(new URL("/business-dashboard", req.url));

  // Unauthenticated users hitting any other page go to /login
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /api/* (API routes handle their own auth)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /Inbervel-logo.png, etc. (static files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};
