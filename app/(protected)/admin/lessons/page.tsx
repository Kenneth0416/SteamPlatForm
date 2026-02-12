"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getAllLessons } from "@/lib/adminStorage"
import { deleteLesson } from "@/lib/api"
import { getTranslation } from "@/lib/translations"
import type { Lang } from "@/types/lesson"
import type { SavedLesson } from "@/types/lesson"
import { format } from "date-fns"

export default function LessonsManagement() {
  const searchParams = useSearchParams()
  const userIdFilter = searchParams.get("userId")

  const [currentLang] = useState<Lang>("en")
  const [lessons, setLessons] = useState<SavedLesson[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)

  const t = getTranslation(currentLang).admin.lessonsPage

  useEffect(() => {
    loadLessons()
  }, [userIdFilter])

  const loadLessons = async () => {
    const allLessons = await getAllLessons()
    if (userIdFilter) {
      setLessons(allLessons.filter((l) => l.userId === userIdFilter))
    } else {
      setLessons(allLessons)
    }
  }

  const filteredLessons = lessons.filter((lesson) =>
    !searchQuery || lesson.title?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleDeleteClick = (lessonId: string) => {
    setLessonToDelete(lessonId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (lessonToDelete) {
      await deleteLesson(lessonToDelete)
      loadLessons()
      setDeleteDialogOpen(false)
      setLessonToDelete(null)
    }
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#f0e6ff] p-6 bg-bubbles">
      <h1 className="text-2xl font-bold text-purple-900">{t.title}</h1>

      {userIdFilter && (
        <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-md text-sm w-fit">
          Filtering by User ID: {userIdFilter}
          <Button variant="link" className="h-auto p-0 ml-2 text-purple-600" onClick={() => (window.location.href = "/admin/lessons")}>
            Clear
          </Button>
        </div>
      )}

      <Input
        placeholder={t.searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm rounded-full bg-white border-purple-300 focus:border-purple-500 focus:ring-purple-500"
      />

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-purple-50 border-b border-purple-100">
              <TableHead className="text-purple-700 font-semibold">{t.title_col}</TableHead>
              <TableHead className="text-purple-700 font-semibold">{t.grade}</TableHead>
              <TableHead className="text-purple-700 font-semibold">{t.domains}</TableHead>
              <TableHead className="text-purple-700 font-semibold">{t.createdAt}</TableHead>
              <TableHead className="text-purple-700 font-semibold">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-purple-400">
                  {t.noLessons}
                </TableCell>
              </TableRow>
            ) : (
              filteredLessons.map((lesson) => {
                const domainColors: Record<string, string> = {
                  S: "bg-blue-100 text-blue-700",
                  T: "bg-green-100 text-green-700",
                  E: "bg-orange-100 text-orange-700",
                  A: "bg-pink-100 text-pink-700",
                  M: "bg-purple-100 text-purple-700",
                }
                return (
                <TableRow key={lesson.id} className="hover:bg-purple-50/50 border-b border-purple-100">
                  <TableCell className="font-medium">{lesson.title || "Untitled"}</TableCell>
                  <TableCell>{lesson.requirements?.gradeLevel || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {lesson.requirements?.steamDomains?.map((domain: string) => (
                        <span
                          key={domain}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${domainColors[domain] || "bg-gray-100 text-gray-700"}`}
                        >
                          {domain}
                        </span>
                      )) || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(lesson.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <button
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      onClick={() => handleDeleteClick(lesson.id)}
                    >
                      {t.delete}
                    </button>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t.deleteButton}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
