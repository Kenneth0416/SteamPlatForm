"use client"

import { useState, useEffect } from "react"
import { Users, BookOpen, TrendingUp, Calendar } from "lucide-react"
import { StatsCard } from "@/components/admin/stats-card"
import { getSystemStats } from "@/lib/adminStorage"
import { getTranslation } from "@/lib/translations"
import type { Lang } from "@/types/lesson"

export default function AdminDashboard() {
  const [currentLang] = useState<Lang>("en")
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLessons: 0,
    newUsersThisWeek: 0,
    newLessonsThisWeek: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      const data = await getSystemStats()
      setStats(data)
    }
    loadStats()
  }, [])

  const t = getTranslation(currentLang).admin

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t.dashboard}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t.stats.totalUsers} value={stats.totalUsers} icon={Users} />
        <StatsCard title={t.stats.totalLessons} value={stats.totalLessons} icon={BookOpen} />
        <StatsCard title={t.stats.newUsersThisWeek} value={stats.newUsersThisWeek} icon={TrendingUp} />
        <StatsCard title={t.stats.newLessonsThisWeek} value={stats.newLessonsThisWeek} icon={Calendar} />
      </div>
    </div>
  )
}
