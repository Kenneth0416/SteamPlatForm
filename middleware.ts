import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and API auth routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/api/health") ||  // 健康检查端点
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value

  const isAuthPage = pathname.startsWith("/auth")

  // Redirect logged-in users away from auth pages
  if (isAuthPage && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Redirect non-logged-in users to login
  if (!isAuthPage && !sessionToken) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
