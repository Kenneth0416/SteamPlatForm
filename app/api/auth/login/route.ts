import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// POST /api/auth/login - 用戶登入
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 查找用戶
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 驗證密碼
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
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
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
