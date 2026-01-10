import type { User, StoredUser } from "@/types/auth"

const SESSION_KEY = "steam_session"

export async function register(name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || "Registration failed" }
    }

    setCurrentUser({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      createdAt: new Date(data.user.createdAt),
    })

    return { success: true }
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, error: "Network error" }
  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || "Login failed" }
    }

    setCurrentUser({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      createdAt: new Date(),
    })

    return { success: true }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Network error" }
  }
}

export function logout(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error("[v0] Error during logout:", error)
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error("[v0] Error getting current user:", error)
    return null
  }
}

export function setCurrentUser(user: User): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch (error) {
    console.error("[v0] Error setting current user:", error)
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null
}

export async function updateUserProfile(userId: string, name: string, email: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement API call when backend is ready
  const currentUser = getCurrentUser()
  if (currentUser && currentUser.id === userId) {
    setCurrentUser({
      ...currentUser,
      name,
      email,
    })
  }
  return { success: true }
}

export async function updateUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement API call when backend is ready
  return { success: true }
}

export async function getUserStats(userId: string): Promise<{ totalLessons: number; accountAge: number }> {
  try {
    const res = await fetch(`/api/lessons?userId=${userId}`)
    if (res.ok) {
      const data = await res.json()
      return {
        totalLessons: data.lessons?.length || 0,
        accountAge: 0, // TODO: Calculate from user createdAt
      }
    }
  } catch (error) {
    console.error("Error getting user stats:", error)
  }
  return { totalLessons: 0, accountAge: 0 }
}

export function isAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === "admin"
}
