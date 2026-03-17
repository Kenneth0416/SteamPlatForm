import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import * as XLSX from "xlsx"
import * as fs from "fs"
import path from "path"

/**
 * POST /api/admin/bulk-create-students
 *
 * 批量創建學生賬號
 *
 * 请求体：
 * {
 *   password: string (默認 INT6136)
 * }
 *
 * 響應：
 * {
 *   created: number,
 *   skipped: number,
 *   errors: number,
 *   users: Array<{name, email}>
 * }
 */
export async function POST(request: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json()
    const { password = "INT6136" } = body

    // 讀取 Excel 文件
    const excelPath = path.join(process.cwd(), "ClassList_202601_INT6136_23637.xls")

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: "Excel file not found" }, { status: 404 })
    }

    const buffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // 找到表頭行
    let headerRowIndex = -1
    for (let i = 0; i < data.length; i++) {
      if (data[i] && (data[i] as string[]).includes("Student ID")) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ error: "Student ID header not found" }, { status: 400 })
    }

    const headerRow = data[headerRowIndex] as string[]
    const getColumnIndex = (name: string) => headerRow.indexOf(name)

    const studentIdCol = getColumnIndex("Student ID")
    const englishNameCol = getColumnIndex("English Name")
    const emailCol = getColumnIndex("EdUHK Email")

    // 解析學生數據
    const students: Array<{ studentId: string; englishName: string; email: string }> = []
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as string[]
      if (!row || !row.length) continue

      const email = row[emailCol]
      if (!email || !email.includes("@")) continue

      students.push({
        studentId: row[studentIdCol] || "",
        englishName: row[englishNameCol] || "",
        email: email.toLowerCase().trim(),
      })
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10)

    const created = []
    const skipped = []
    const errors = []

    for (const student of students) {
      try {
        // 檢查是否已存在
        const existing = await prisma.user.findUnique({
          where: { email: student.email },
        })

        if (existing) {
          skipped.push({ name: student.englishName, email: student.email })
          continue
        }

        // 創建用戶
        const user = await prisma.user.create({
          data: {
            name: student.englishName || student.email.split("@")[0],
            email: student.email,
            password: hashedPassword,
          },
        })

        created.push({ name: user.name, email: user.email })
      } catch (err) {
        errors.push({ email: student.email, error: String(err) })
      }
    }

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      users: created,
      skippedUsers: skipped,
      errorDetails: errors,
      password,
    })
  } catch (error) {
    console.error("Bulk create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
