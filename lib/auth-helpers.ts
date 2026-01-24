import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"

/**
 * Convert Prisma UserRole (enum) to lowercase string for compatibility
 */
export function roleToString(role: UserRole): "user" | "admin" {
  return role.toLowerCase() as "user" | "admin"
}

/**
 * Convert string to Prisma UserRole
 */
export function stringToRole(role: string): UserRole {
  return role.toUpperCase() as UserRole
}

/**
 * Verify user is authenticated and has admin role
 * @returns NextResponse with error if unauthorized, null if authorized
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Prisma enum uses uppercase values (USER, ADMIN)
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  return null
}
