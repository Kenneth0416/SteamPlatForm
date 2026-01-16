import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  // 已登录用户访问公开路由时重定向到首页
  if (session) {
    redirect("/")
  }

  return <>{children}</>
}
