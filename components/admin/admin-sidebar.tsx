"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, BookOpen, ArrowLeft } from "lucide-react"
import type { Lang } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"

interface AdminSidebarProps {
  lang: Lang
}

export function AdminSidebar({ lang }: AdminSidebarProps) {
  const pathname = usePathname()
  const t = getTranslation(lang).admin

  const navItems = [
    {
      href: "/admin",
      label: t.dashboard,
      icon: LayoutDashboard,
    },
    {
      href: "/admin/users",
      label: t.users,
      icon: Users,
    },
    {
      href: "/admin/lessons",
      label: t.lessons,
      icon: BookOpen,
    },
  ]

  return (
    <div className="w-64 border-r bg-muted/10 p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t.title}</h2>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors mt-4">
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">{t.backToHome}</span>
      </Link>
    </div>
  )
}
