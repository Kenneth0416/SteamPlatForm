import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { withRateLimit } from "@/lib/rateLimit"

// 虛擬 bcrypt hash 用於恆定時間比較（防止時序攻擊）
const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567"

// POST /api/auth/login - 用戶登入
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json()
      const { email, password } = body

      if (!email || !password) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      // 查找用戶
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, password: true, role: true },
      })

      // 安全：使用恆定時間比較防止時序攻擊
      // 即使用戶不存在也執行 bcrypt.compare，使響應時間一致
      const isValid = user
        ? await bcrypt.compare(password, user.password)
        : await bcrypt.compare(password, DUMMY_HASH)

      if (!isValid || !user) {
        // 統一錯誤信息，不洩露用戶是否存在
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }

      // 返回用戶信息（不包含密碼）
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Error logging in:", error)
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to login" },
        { status: 500 }
      )
    }
  })
}
