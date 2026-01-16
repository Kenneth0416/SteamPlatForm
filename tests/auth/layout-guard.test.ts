import React from "react"

import RootLayout from "@/app/layout"
import AuthLayout from "@/app/auth/layout"

const redirectMock = jest.fn((url: string) => {
  const error = new Error("NEXT_REDIRECT")
  ;(error as Error & { url?: string }).url = url
  throw error
})

const headersMock = jest.fn()
const authMock = jest.fn()

jest.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}))

jest.mock("next/headers", () => ({
  headers: () => headersMock(),
}))

jest.mock("next/font/google", () => ({
  DM_Sans: () => ({ variable: "--font-dm-sans" }),
  Space_Mono: () => ({ variable: "--font-space-mono" }),
  Source_Serif_4: () => ({ variable: "--font-source-serif" }),
}))

jest.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}))

const createHeaders = (values: Record<string, string>) => {
  const normalized = new Map<string, string>()
  Object.entries(values).forEach(([key, value]) => {
    normalized.set(key.toLowerCase(), value)
  })

  return {
    get: (name: string) => normalized.get(name.toLowerCase()) ?? null,
  }
}

describe("layout guard", () => {
  beforeEach(() => {
    redirectMock.mockClear()
    headersMock.mockReset()
    authMock.mockReset()
  })

  test("redirects unauthenticated users from protected routes", async () => {
    authMock.mockResolvedValue(null)
    headersMock.mockReturnValue(
      createHeaders({ "next-url": "http://localhost/library" }),
    )

    await expect(
      RootLayout({ children: <div>Protected</div> }),
    ).rejects.toHaveProperty("url", "/auth/login")
  })

  test("allows unauthenticated users to access auth routes", async () => {
    authMock.mockResolvedValue(null)
    headersMock.mockReturnValue(
      createHeaders({ "x-pathname": "/auth/login" }),
    )

    await expect(
      RootLayout({ children: <div>Login</div> }),
    ).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  test("redirects authenticated users away from auth routes", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    headersMock.mockReturnValue(
      createHeaders({ "x-pathname": "/auth/register" }),
    )

    await expect(
      RootLayout({ children: <div>Register</div> }),
    ).rejects.toHaveProperty("url", "/")
  })

  test("allows authenticated users to access protected routes", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    headersMock.mockReturnValue(
      createHeaders({ "x-pathname": "/admin" }),
    )

    await expect(
      RootLayout({ children: <div>Admin</div> }),
    ).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  test("auth layout redirects authenticated users", async () => {
    authMock.mockResolvedValue({ user: { id: "user-2" } })

    await expect(
      AuthLayout({ children: <div>Auth</div> }),
    ).rejects.toHaveProperty("url", "/")
  })
})
