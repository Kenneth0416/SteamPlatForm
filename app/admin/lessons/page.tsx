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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t.title}</h1>

      {userIdFilter && (
        <div className="bg-muted px-3 py-1 rounded-md text-sm w-fit">
          Filtering by User ID: {userIdFilter}
          <Button variant="link" className="h-auto p-0 ml-2" onClick={() => (window.location.href = "/admin/lessons")}>
            Clear
          </Button>
        </div>
      )}

      <Input
        placeholder={t.searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.title_col}</TableHead>
              <TableHead>{t.grade}</TableHead>
              <TableHead>{t.domains}</TableHead>
              <TableHead>{t.createdAt}</TableHead>
              <TableHead>{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t.noLessons}
                </TableCell>
              </TableRow>
            ) : (
              filteredLessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell className="font-medium">{lesson.title || "Untitled"}</TableCell>
                  <TableCell>{lesson.requirements?.gradeLevel || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {lesson.requirements?.steamDomains?.map((domain) => (
                        <Badge key={domain} variant="outline">
                          {domain}
                        </Badge>
                      )) || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(lesson.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteClick(lesson.id)}>
                      {t.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
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
