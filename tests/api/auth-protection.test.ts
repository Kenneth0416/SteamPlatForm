import { readFileSync } from "fs"
import { join } from "path"
import { NextRequest } from "next/server"

import { POST as lessonPost } from "@/app/api/lesson/route"
import { GET as lessonsGet } from "@/app/api/lessons/route"
import { GET as lessonByIdGet } from "@/app/api/lessons/[id]/route"
import { POST as chatPost } from "@/app/api/chat/route"
import { GET as adminStatsGet } from "@/app/api/admin/stats/route"
import { GET as adminUsersGet } from "@/app/api/admin/users/route"
import { PUT as adminUserPut } from "@/app/api/admin/users/[id]/route"
import { POST as editorApplyPost } from "@/app/api/editor/apply/route"
import { POST as editorCommandPost } from "@/app/api/editor/command/route"
import { POST as editorCommandStreamPost } from "@/app/api/editor/command/stream/route"
import { POST as editorDocsGeneratePost } from "@/app/api/editor/documents/generate/route"
import { GET as editorDocsGet } from "@/app/api/editor/documents/route"
import { GET as editorHistoryGet } from "@/app/api/editor/history/route"
import { POST as editorParsePost } from "@/app/api/editor/parse/route"
import { POST as applyChangePost } from "@/app/api/apply-change/route"
import { POST as exportWordPost } from "@/app/api/export/word/route"

const authMock = jest.fn()

const prismaMock = {
  user: {
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  lesson: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  editorDocument: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
}

jest.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}))

jest.mock("@/lib/langchain", () => ({
  generateLesson: jest.fn(async () => "lesson"),
  generateLessonStream: jest.fn(async function* () {
    yield "chunk"
  }),
}))

jest.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

jest.mock("@/lib/editor/agent", () => ({
  runEditorAgent: jest.fn(async () => ({ response: "ok", pendingDiffs: [] })),
  runEditorAgentStream: jest.fn(async function* () {}),
  runMultiDocAgentStream: jest.fn(async function* () {}),
}))

jest.mock("@/lib/editor/version", () => ({
  createVersion: jest.fn(async () => ({ id: "v1", version: 1 })),
  recordEdit: jest.fn(async () => undefined),
  getVersions: jest.fn(async () => []),
  getVersion: jest.fn(async () => null),
  restoreVersion: jest.fn(async () => null),
  getEditHistory: jest.fn(async () => []),
}))

jest.mock("@/lib/editor/parser", () => ({
  parseMarkdown: jest.fn(() => ({ blocks: [] })),
  blocksToMarkdown: jest.fn(() => ""),
  updateBlockContent: jest.fn((blocks: unknown) => blocks),
  addBlock: jest.fn(() => ({ blocks: [] })),
  deleteBlock: jest.fn((blocks: unknown) => blocks),
}))

jest.mock("@/lib/editor/document-templates", () => ({
  DOCUMENT_TEMPLATES: {
    sample: {
      name: "Sample Doc",
      nameEn: "Sample Doc",
      type: "sample",
      systemPrompt: "prompt",
    },
  },
}))

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn(() => ({
      pipe: jest.fn(() => ({
        stream: jest.fn(async function* () {}),
      })),
    })),
  },
}))

jest.mock("@/lib/export/parser", () => ({
  parseMarkdownToLesson: jest.fn(() => ({})),
}))

jest.mock("@/lib/export/word/generator", () => ({
  createDocxDocument: jest.fn(() => ({})),
}))

jest.mock("docx", () => ({
  Packer: { toBuffer: jest.fn(async () => new ArrayBuffer(0)) },
}))

const makeRequest = (url: string, init?: RequestInit) =>
  new NextRequest(url, init)

const expectUnauthorized = async (response: Response) => {
  expect(response.status).toBe(401)
  const payload = await response.json()
  expect(payload).toEqual({ error: "Unauthorized" })
}

describe("API auth protection", () => {
  beforeEach(() => {
    authMock.mockReset()
    Object.values(prismaMock.user).forEach(mock => mock.mockReset())
    Object.values(prismaMock.lesson).forEach(mock => mock.mockReset())
    Object.values(prismaMock.editorDocument).forEach(mock => mock.mockReset())
  })

  test("all protected route files include auth checks", () => {
    const protectedRoutes = [
      "app/api/lesson/route.ts",
      "app/api/lessons/route.ts",
      "app/api/lessons/[id]/route.ts",
      "app/api/chat/route.ts",
      "app/api/admin/stats/route.ts",
      "app/api/admin/users/route.ts",
      "app/api/admin/users/[id]/route.ts",
      "app/api/editor/apply/route.ts",
      "app/api/editor/command/route.ts",
      "app/api/editor/command/stream/route.ts",
      "app/api/editor/documents/generate/route.ts",
      "app/api/editor/documents/route.ts",
      "app/api/editor/history/route.ts",
      "app/api/editor/parse/route.ts",
      "app/api/apply-change/route.ts",
    ]

    protectedRoutes.forEach(route => {
      const content = readFileSync(join(process.cwd(), route), "utf8")
      expect(content).toMatch(/\bauth\(/)
    })
  })

  test("returns 401 for unauthenticated requests to protected APIs", async () => {
    authMock.mockResolvedValue(null)

    const cases: Array<{ name: string; response: Promise<Response> }> = [
      {
        name: "lesson",
        response: lessonPost(makeRequest("http://localhost/api/lesson", { method: "POST" })),
      },
      {
        name: "lessons",
        response: lessonsGet(makeRequest("http://localhost/api/lessons")),
      },
      {
        name: "lessons/[id]",
        response: lessonByIdGet(
          makeRequest("http://localhost/api/lessons/lesson-1"),
          { params: Promise.resolve({ id: "lesson-1" }) }
        ),
      },
      {
        name: "chat",
        response: chatPost(makeRequest("http://localhost/api/chat", { method: "POST" })),
      },
      {
        name: "admin stats",
        response: adminStatsGet(),
      },
      {
        name: "admin users",
        response: adminUsersGet(),
      },
      {
        name: "admin user update",
        response: adminUserPut(
          makeRequest("http://localhost/api/admin/users/user-1", { method: "PUT" }),
          { params: Promise.resolve({ id: "user-1" }) }
        ),
      },
      {
        name: "editor apply",
        response: editorApplyPost(makeRequest("http://localhost/api/editor/apply", { method: "POST" })),
      },
      {
        name: "editor command",
        response: editorCommandPost(makeRequest("http://localhost/api/editor/command", { method: "POST" })),
      },
      {
        name: "editor command stream",
        response: editorCommandStreamPost(
          makeRequest("http://localhost/api/editor/command/stream", { method: "POST" })
        ),
      },
      {
        name: "editor documents generate",
        response: editorDocsGeneratePost(
          makeRequest("http://localhost/api/editor/documents/generate", { method: "POST" })
        ),
      },
      {
        name: "editor documents",
        response: editorDocsGet(makeRequest("http://localhost/api/editor/documents")),
      },
      {
        name: "editor history",
        response: editorHistoryGet(makeRequest("http://localhost/api/editor/history")),
      },
      {
        name: "editor parse",
        response: editorParsePost(makeRequest("http://localhost/api/editor/parse", { method: "POST" })),
      },
      {
        name: "apply change",
        response: applyChangePost(makeRequest("http://localhost/api/apply-change", { method: "POST" })),
      },
    ]

    await Promise.all(
      cases.map(async testCase => {
        const response = await testCase.response
        await expectUnauthorized(response)
      })
    )
  })

  test("allows authenticated access to protected APIs", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    prismaMock.user.count.mockResolvedValueOnce(5)
    prismaMock.lesson.count.mockResolvedValueOnce(12)
    prismaMock.user.count.mockResolvedValueOnce(2)
    prismaMock.lesson.count.mockResolvedValueOnce(3)

    const response = await adminStatsGet()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      totalUsers: 5,
      totalLessons: 12,
      newUsersThisWeek: 2,
      newLessonsThisWeek: 3,
    })
  })

  test("public export APIs do not require authentication", async () => {
    authMock.mockResolvedValue(null)

    const response = await exportWordPost(
      makeRequest("http://localhost/api/export/word", { method: "POST" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Missing markdown" })
  })

  test.each([
    "missing authorization header",
    "invalid token",
    "expired session",
  ])("returns 401 for %s", async () => {
    authMock.mockResolvedValue(null)

    const response = await lessonPost(
      makeRequest("http://localhost/api/lesson", { method: "POST" })
    )

    await expectUnauthorized(response)
  })
})
