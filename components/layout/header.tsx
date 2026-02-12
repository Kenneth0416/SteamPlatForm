"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LanguageToggle } from "@/components/steam-agent/language-toggle"
import { Settings, LogOut, UserIcon, Shield, ArrowLeft, BookOpen, Bell, LayoutGrid } from "lucide-react"
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
    <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between">
        {/* Left: Back button + App title */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" asChild className="hover:bg-purple-100">
              <Link href="/">
                <ArrowLeft className="h-5 w-5 text-purple-600" />
              </Link>
            </Button>
          )}
          <Link href="/" className="flex items-center gap-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              {title || "DesignScaffold-STE(A)M"} 🚀
            </h1>
          </Link>
        </div>

        {/* Center: Welcome badge */}
        {session?.user && (
          <div className="hidden md:flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700">
              {t.auth.welcome}, {session.user.name} 😊
            </span>
          </div>
        )}

        {/* Right: Icon buttons group */}
        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="hover:bg-purple-100 text-purple-600">
            <Bell className="h-5 w-5" />
          </Button>

          {/* Dashboard / Library */}
          <Button variant="ghost" size="icon" asChild className="hover:bg-purple-100 text-purple-600">
            <Link href="/library">
              <LayoutGrid className="h-5 w-5" />
            </Link>
          </Button>

          {/* User avatar */}
          <Button variant="ghost" size="icon" asChild className="hover:bg-purple-100">
            <Link href="/profile">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-400 text-white text-sm font-semibold">
                {session?.user?.name?.charAt(0)?.toUpperCase() || <UserIcon className="h-4 w-4" />}
              </span>
            </Link>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon" asChild className="hover:bg-purple-100 text-purple-600">
            <Link href="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>

          {/* Admin */}
          {session?.user?.role === "admin" && (
            <Button variant="ghost" size="icon" asChild className="hover:bg-purple-100 text-purple-600">
              <Link href="/admin">
                <Shield className="h-5 w-5" />
              </Link>
            </Button>
          )}

          {/* Logout */}
          <Button variant="ghost" size="icon" onClick={handleLogout} title={t.auth.logout} className="hover:bg-red-100 text-purple-600 hover:text-red-500">
            <LogOut className="h-5 w-5" />
          </Button>

          {/* Language toggle */}
          <div className="ml-1 border-l border-purple-200 pl-2">
            <LanguageToggle currentLang={lang} onToggle={onLangChange} />
          </div>
        </div>
      </div>
    </header>
  )
}
