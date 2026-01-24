import type { UserRole } from "@prisma/client"

export interface User {
  id: string
  name: string
  email: string
  role: "user" | "admin"  // Lowercase for frontend compatibility, mapped from Prisma UserRole enum
  createdAt: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

export interface StoredUser extends User {
  password: string // Simple hash for development
}

// Type helper to convert between Prisma enum and frontend string
export type FrontendRole = "user" | "admin"
export type DbRole = UserRole

export function toFrontendRole(role: DbRole): FrontendRole {
  return role.toLowerCase() as FrontendRole
}

export function toDbRole(role: FrontendRole): DbRole {
  return role.toUpperCase() as DbRole
}
