import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  console.log('[ProtectedLayout] session:', !!session)

  if (!session) {
    console.log('[ProtectedLayout] Redirecting to /auth/login')
    redirect("/auth/login")
  }

  return <>{children}</>
}
