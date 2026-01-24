import { PrismaClient, UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seed...")

  // 检查是否已存在管理员
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@admin.com" },
  })

  if (existingAdmin) {
    console.log("✅ Admin user already exists, skipping seed")
    console.log(`   Email: ${existingAdmin.email}`)
    console.log(`   Role: ${existingAdmin.role}`)
    return
  }

  // 安全：使用环境变量或生成强随机密码
  const defaultPassword = process.env.SEED_ADMIN_PASSWORD ||
                          crypto.randomBytes(16).toString('hex')
  const hashedPassword = await bcrypt.hash(defaultPassword, 10)

  const admin = await prisma.user.create({
    data: {
      email: "admin@admin.com",
      name: "Administrator",
      password: hashedPassword,
      role: UserRole.ADMIN,  // 使用枚举值
    },
  })

  console.log("✅ Default admin user created successfully!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("📧 Email: admin@admin.com")
  console.log(`🔑 Password: ${defaultPassword}`)
  console.log("⚠️  IMPORTANT: Please save the password and change it after first login!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
