import type { LessonPlan, LessonRequirements, SavedLesson, SortBy, SortOrder } from "@/types/lesson"

const API_BASE = "/api"

// 課程相關 API
export async function fetchLessons(
  userId: string,
  options?: {
    search?: string
    showArchived?: boolean
    showFavoriteOnly?: boolean
    sortBy?: SortBy
    sortOrder?: SortOrder
  }
): Promise<SavedLesson[]> {
  const params = new URLSearchParams({ userId })
  if (options?.search) params.set("search", options.search)
  if (options?.showArchived) params.set("showArchived", "true")
  if (options?.showFavoriteOnly) params.set("showFavoriteOnly", "true")
  if (options?.sortBy) params.set("sortBy", options.sortBy)
  if (options?.sortOrder) params.set("sortOrder", options.sortOrder)

  const res = await fetch(`${API_BASE}/lessons?${params}`)
  if (!res.ok) throw new Error("Failed to fetch lessons")

  const data = await res.json()
  return data.lessons.map(mapDbLessonToSavedLesson)
}

export async function fetchLessonById(id: string): Promise<SavedLesson | null> {
  const res = await fetch(`${API_BASE}/lessons/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch lesson")

  const data = await res.json()
  return mapDbLessonToSavedLesson(data.lesson)
}

export async function createLesson(
  userId: string,
  lessonPlan: LessonPlan,
  requirements: LessonRequirements
): Promise<SavedLesson> {
  const res = await fetch(`${API_BASE}/lessons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, lessonPlan, requirements }),
  })
  if (!res.ok) throw new Error("Failed to create lesson")

  const data = await res.json()
  return mapDbLessonToSavedLesson(data.lesson)
}

export async function updateLesson(
  id: string,
  updates: {
    lessonPlan?: LessonPlan
    requirements?: LessonRequirements
    tags?: string[]
    isFavorite?: boolean
    isArchived?: boolean
  }
): Promise<SavedLesson> {
  const res = await fetch(`${API_BASE}/lessons/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error("Failed to update lesson")

  const data = await res.json()
  return mapDbLessonToSavedLesson(data.lesson)
}

export async function deleteLesson(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lessons/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete lesson")
}

export async function toggleFavorite(id: string, currentValue: boolean): Promise<SavedLesson> {
  return updateLesson(id, { isFavorite: !currentValue })
}

export async function archiveLesson(id: string): Promise<SavedLesson> {
  return updateLesson(id, { isArchived: true })
}

// 用戶認證 API
export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Login failed")
  }

  return res.json()
}

export async function registerUser(email: string, name: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Registration failed")
  }

  return res.json()
}

// 輔助函數：將數據庫格式轉換為前端格式
function mapDbLessonToSavedLesson(dbLesson: any): SavedLesson {
  return {
    id: dbLesson.id,
    userId: dbLesson.userId,
    title: dbLesson.title || "",
    lessonPlan: dbLesson.lessonPlan as LessonPlan,
    requirements: dbLesson.requirements as LessonRequirements,
    createdAt: dbLesson.createdAt,
    updatedAt: dbLesson.updatedAt,
    tags: dbLesson.tags || [],
    isFavorite: dbLesson.isFavorite || false,
    isArchived: dbLesson.isArchived || false,
  }
}
