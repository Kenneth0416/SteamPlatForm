import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Verify user is authenticated and has admin role
 * @returns NextResponse with error if unauthorized, null if authorized
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  return null
}
