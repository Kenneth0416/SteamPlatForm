"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LanguageToggle } from "@/components/steam-agent/language-toggle"
import { Settings, LogOut, UserIcon, Shield, ArrowLeft, BookOpen } from "lucide-react"
import type { Lang } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"

interface HeaderProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  title?: string
  showBackButton?: boolean
}

export function Header({ lang, onLangChange, title, showBackButton }: HeaderProps) {
  const { data: session } = useSession()
  const t = getTranslation(lang)

  const handleLogout = () => {
    signOut({ callbackUrl: "/auth/login" })
  }

  return (
    <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <h1 className="text-2xl font-bold text-primary">{title || t.appTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          {session?.user && (
            <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
              {t.auth.welcome}, {session.user.name}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title={t.auth.logout}>
            <LogOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profile">
              <UserIcon className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/library">
              <BookOpen className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
          {session?.user?.role === "admin" && (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <Shield className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <LanguageToggle currentLang={lang} onToggle={onLangChange} />
        </div>
      </div>
    </header>
  )
}
