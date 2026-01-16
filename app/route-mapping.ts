export const PUBLIC_ROUTE_PREFIXES = ["/auth", "/api/auth", "/api/export"]

export const STATIC_ROUTE_PREFIXES = ["/_next"]
export const STATIC_ROUTE_EXACT = ["/favicon.ico"]

const ROUTE_GROUP_PATTERN = /^\/\(.+\)(\/|$)/

const normalizePathname = (pathname: string): string => {
  if (!pathname) return "/"
  const trimmed = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`
  }
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1)
  }
  return trimmed
}

const isSegmentPrefix = (pathname: string, prefix: string): boolean => {
  if (pathname === prefix) return true
  return pathname.startsWith(`${prefix}/`)
}

export const isStaticAssetRoute = (pathname: string): boolean => {
  const normalized = normalizePathname(pathname)
  if (STATIC_ROUTE_EXACT.includes(normalized)) return true
  if (STATIC_ROUTE_PREFIXES.some((prefix) => isSegmentPrefix(normalized, prefix))) {
    return true
  }
  return normalized.includes(".")
}

export const isPublicRoute = (pathname: string): boolean => {
  const normalized = normalizePathname(pathname)
  const withoutRouteGroup = normalized.replace(ROUTE_GROUP_PATTERN, "/")
  return PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    isSegmentPrefix(withoutRouteGroup, prefix),
  )
}

export const isProtectedRoute = (pathname: string): boolean => {
  return !isStaticAssetRoute(pathname) && !isPublicRoute(pathname)
}

export const ROUTE_CLASSIFICATION = {
  publicPrefixes: PUBLIC_ROUTE_PREFIXES,
  staticPrefixes: STATIC_ROUTE_PREFIXES,
  staticExact: STATIC_ROUTE_EXACT,
}
