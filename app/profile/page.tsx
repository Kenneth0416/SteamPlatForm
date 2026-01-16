"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { Lang } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"
import { getUserStats } from "@/lib/authStorage"
import { Header } from "@/components/layout/header"
import { ProfileForm } from "@/components/profile/profile-form"
import { PasswordForm } from "@/components/profile/password-form"
import { AccountStats } from "@/components/profile/account-stats"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [currentLang, setCurrentLang] = useState<Lang>("en")
  const [stats, setStats] = useState({ totalLessons: 0, accountAge: 0 })
  const [refreshKey, setRefreshKey] = useState(0)

  const t = getTranslation(currentLang)

  useEffect(() => {
    const loadStats = async () => {
      if (session?.user?.id) {
        const userStats = await getUserStats(session.user.id)
        setStats(userStats)
      }
    }
    loadStats()
  }, [session?.user?.id, refreshKey])

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1)
  }

  if (status === "loading" || !session?.user) {
    return null
  }

  const user = {
    id: session.user.id,
    name: session.user.name || "",
    email: session.user.email || "",
    role: session.user.role as "user" | "admin",
    createdAt: new Date(),
  }

  return (
    <div className="min-h-screen bg-background">
      <Header lang={currentLang} onLangChange={setCurrentLang} title={t.profile.title} showBackButton />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <ProfileForm user={user} lang={currentLang} onUpdate={handleUpdate} />
            <PasswordForm lang={currentLang} />
          </div>
          <div>
            <AccountStats totalLessons={stats.totalLessons} accountAge={stats.accountAge} lang={currentLang} />
          </div>
        </div>
      </main>
    </div>
  )
}
