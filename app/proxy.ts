import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/_next/:path*", "/favicon.ico", "/:path*\\.png", "/:path*\\.svg"],
}

export default proxy
