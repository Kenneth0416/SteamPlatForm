import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { withRateLimit } from "@/lib/rateLimit"

// POST /api/auth/register - 用戶註冊
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json()
      const { email, name, password } = body

      if (!email || !name || !password) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      // 密碼強度驗證
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
      }

      // 檢查用戶是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 })
      }

      // 加密密碼
      const hashedPassword = await bcrypt.hash(password, 10)

      // 創建用戶
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      })

      return NextResponse.json({ user })
    } catch (error) {
      console.error("Error registering user:", error)
      return NextResponse.json({ error: "Failed to register user" }, { status: 500 })
    }
  })
}
