"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Lang, GradeLevel, STEAMDomain, SavedLesson, SortBy } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"
import { getAllSavedLessons, deleteLesson, toggleFavorite, archiveLesson, duplicateLesson } from "@/lib/api"
import { Header } from "@/components/layout/header"
import { LessonCard } from "@/components/library/lesson-card"
import { LessonFilters } from "@/components/library/lesson-filters"
import { EmptyLibraryState } from "@/components/library/empty-library-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Search, PlusCircle } from "lucide-react"
import Link from "next/link"

export default function LibraryPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [lang, setLang] = useState<Lang>("en")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGrades, setSelectedGrades] = useState<GradeLevel[]>([])
  const [selectedDomains, setSelectedDomains] = useState<STEAMDomain[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const [lessons, setLessons] = useState<SavedLesson[]>([])

  const t = getTranslation(lang)

  useEffect(() => {
    loadLessons()
  }, [searchQuery, selectedGrades, selectedDomains, showArchived, showFavoritesOnly, sortBy, session])

  const loadLessons = async () => {
    if (!session?.user?.id) return

    const filtered = await getAllSavedLessons(
      searchQuery,
      {
        userId: session.user.id,
        gradeLevels: selectedGrades,
        domains: selectedDomains,
        showArchived,
        showFavoriteOnly: showFavoritesOnly,
      },
      sortBy,
      "desc",
    )
    setLessons(filtered)
  }

  const handleGradeChange = (grade: GradeLevel, checked: boolean) => {
    setSelectedGrades((prev) => (checked ? [...prev, grade] : prev.filter((g) => g !== grade)))
  }

  const handleDomainChange = (domain: STEAMDomain, checked: boolean) => {
    setSelectedDomains((prev) => (checked ? [...prev, domain] : prev.filter((d) => d !== domain)))
  }

  const handleClearFilters = () => {
    setSelectedGrades([])
    setSelectedDomains([])
    setShowArchived(false)
    setShowFavoritesOnly(false)
    setSearchQuery("")
  }

  const handleEdit = (id: string) => {
    router.push(`/?lessonId=${id}`)
  }

  const handleDuplicate = async (id: string) => {
    await duplicateLesson(id)
    loadLessons()
  }

  const handleArchive = async (id: string) => {
    await archiveLesson(id)
    loadLessons()
  }

  const handleDeleteClick = (id: string) => {
    setLessonToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (lessonToDelete) {
      await deleteLesson(lessonToDelete)
      loadLessons()
    }
    setDeleteDialogOpen(false)
    setLessonToDelete(null)
  }

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id)
    loadLessons()
  }

  if (status === "loading") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header lang={lang} onLangChange={setLang} title={t.library.title} showBackButton />

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.library.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.library.sortBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">{t.library.sortNewest}</SelectItem>
                <SelectItem value="createdAt">{t.library.sortOldest}</SelectItem>
                <SelectItem value="title">{t.library.sortTitle}</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/">
                <PlusCircle className="h-4 w-4 mr-2" />
                {t.library.createNew}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <aside className="md:col-span-1">
            <LessonFilters
              lang={lang}
              selectedGrades={selectedGrades}
              selectedDomains={selectedDomains}
              showArchived={showArchived}
              showFavoritesOnly={showFavoritesOnly}
              onGradeChange={handleGradeChange}
              onDomainChange={handleDomainChange}
              onShowArchivedChange={setShowArchived}
              onShowFavoritesChange={setShowFavoritesOnly}
              onClearFilters={handleClearFilters}
            />
          </aside>

          <div className="md:col-span-3">
            {lessons.length === 0 ? (
              <EmptyLibraryState lang={lang} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    lang={lang}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onArchive={handleArchive}
                    onDelete={handleDeleteClick}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.library.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.library.confirmDeleteMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.library.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t.library.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
