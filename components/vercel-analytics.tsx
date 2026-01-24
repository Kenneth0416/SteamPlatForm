"use client"

import { useEffect } from "react"

export function VercelAnalytics() {
  useEffect(() => {
    // 只在 Vercel 环境加载 Analytics
    if (process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL) {
      import("@vercel/analytics/next").then(({ Analytics }) => {
        // Analytics 组件会自动初始化
      })
    }
  }, [])

  return null
}
