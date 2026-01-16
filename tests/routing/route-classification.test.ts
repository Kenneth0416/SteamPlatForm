import {
  PUBLIC_ROUTE_PREFIXES,
  isProtectedRoute,
  isPublicRoute,
  isStaticAssetRoute,
} from "../../app/route-mapping"

describe("route classification mapping", () => {
  test("public route prefixes include required entries", () => {
    expect(PUBLIC_ROUTE_PREFIXES).toEqual(
      expect.arrayContaining(["/auth", "/api/auth", "/api/export"]),
    )
  })

  test("public routes are detected for auth and export paths", () => {
    expect(isPublicRoute("/auth/login")).toBe(true)
    expect(isPublicRoute("/auth/register")).toBe(true)
    expect(isPublicRoute("/api/auth/login")).toBe(true)
    expect(isPublicRoute("/api/auth/callback")).toBe(true)
    expect(isPublicRoute("/api/export/pdf")).toBe(true)
    expect(isPublicRoute("/api/export/word/123")).toBe(true)
  })

  test("public route detection is segment-aware", () => {
    expect(isPublicRoute("/authentic")).toBe(false)
    expect(isPublicRoute("/api/authentication")).toBe(false)
    expect(isPublicRoute("/api/exports")).toBe(false)
  })

  test("protected routes exclude static assets and public routes", () => {
    expect(isProtectedRoute("/")).toBe(true)
    expect(isProtectedRoute("/library")).toBe(true)
    expect(isProtectedRoute("/library/123")).toBe(true)
    expect(isProtectedRoute("/admin/users/42")).toBe(true)
    expect(isProtectedRoute("/editor/lesson-1")).toBe(true)
    expect(isProtectedRoute("/profile")).toBe(true)
    expect(isProtectedRoute("/settings")).toBe(true)
  })

  test("static asset routes are excluded from protection", () => {
    expect(isStaticAssetRoute("/_next/static/chunk.js")).toBe(true)
    expect(isStaticAssetRoute("/favicon.ico")).toBe(true)
    expect(isStaticAssetRoute("/images/logo.svg")).toBe(true)
    expect(isStaticAssetRoute("/styles/app.css")).toBe(true)
    expect(isProtectedRoute("/_next/image")).toBe(false)
  })

  test("route group and normalization edge cases", () => {
    expect(isPublicRoute("/(auth)/login")).toBe(true)
    expect(isProtectedRoute("/(admin)/users")).toBe(true)
    expect(isPublicRoute("auth/login")).toBe(true)
    expect(isProtectedRoute("library/")).toBe(true)
  })
})
