import type { StoredUser } from "@/types/auth"
import type { SavedLesson } from "@/types/lesson"

// Get all users (admin only)
export async function getAllUsers(): Promise<StoredUser[]> {
  try {
    const res = await fetch("/api/admin/users")
    if (!res.ok) throw new Error("Failed to fetch users")
    const data = await res.json()
    return data.users || []
  } catch (error) {
    console.error("Error fetching users:", error)
    return []
  }
}

// Get all lessons (admin only)
export async function getAllLessons(): Promise<SavedLesson[]> {
  try {
    const res = await fetch("/api/lessons")
    if (!res.ok) throw new Error("Failed to fetch lessons")
    const data = await res.json()
    return data.lessons || []
  } catch (error) {
    console.error("Error fetching lessons:", error)
    return []
  }
}

// Delete user (admin only)
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json()
      return { success: false, error: data.error || "Failed to delete user" }
    }
    return { success: true }
  } catch (error) {
    console.error("Error deleting user:", error)
    return { success: false, error: "Failed to delete user" }
  }
}

// Update user role (admin only)
export async function updateUserRole(userId: string, role: "user" | "admin"): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert lowercase role to uppercase for Prisma enum
    const dbRole = role === "admin" ? "ADMIN" : "USER"
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: dbRole }),
    })
    if (!res.ok) {
      const data = await res.json()
      return { success: false, error: data.error || "Failed to update role" }
    }
    return { success: true }
  } catch (error) {
    console.error("Error updating user role:", error)
    return { success: false, error: "Failed to update user role" }
  }
}

// Get system statistics
export async function getSystemStats(): Promise<{
  totalUsers: number
  totalLessons: number
  newUsersThisWeek: number
  newLessonsThisWeek: number
}> {
  try {
    const res = await fetch("/api/admin/stats")
    if (!res.ok) throw new Error("Failed to fetch stats")
    return await res.json()
  } catch (error) {
    console.error("Error fetching stats:", error)
    return { totalUsers: 0, totalLessons: 0, newUsersThisWeek: 0, newLessonsThisWeek: 0 }
  }
}
