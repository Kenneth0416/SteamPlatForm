"use client"

import type React from "react"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { LanguageToggle } from "@/components/steam-agent/language-toggle"
import type { Lang } from "@/types/lesson"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useSession()
  const [currentLang, setCurrentLang] = useState<Lang>("en")

  if (status === "loading") {
    return null
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar lang={currentLang} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b p-4 flex justify-end">
          <LanguageToggle currentLang={currentLang} onToggle={setCurrentLang} />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
