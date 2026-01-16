import fs from "node:fs"
import path from "node:path"

import { config, proxy } from "../../app/proxy"

const projectRoot = path.resolve(__dirname, "..", "..")
const proxyPath = path.join(projectRoot, "app", "proxy.ts")
const middlewarePath = path.join(projectRoot, "middleware.ts")

const matcherValues = Array.isArray(config?.matcher) ? config.matcher : []

describe("proxy configuration", () => {
  test("proxy.ts exists and exports handler + config", () => {
    expect(fs.existsSync(proxyPath)).toBe(true)
    expect(typeof proxy).toBe("function")
    expect(Array.isArray(matcherValues)).toBe(true)
    expect(matcherValues.length).toBeGreaterThan(0)
  })

  test("middleware.ts has been removed", () => {
    expect(fs.existsSync(middlewarePath)).toBe(false)
  })

  test("static asset routes are matched by proxy config", () => {
    const hasMatcher = (snippet: string) =>
      matcherValues.some((matcher) => matcher.includes(snippet))

    expect(hasMatcher("_next")).toBe(true)
    expect(hasMatcher("favicon.ico")).toBe(true)
    expect(hasMatcher(".png")).toBe(true)
    expect(hasMatcher(".svg")).toBe(true)
  })

  test("proxy handler avoids auth logic", () => {
    const content = fs.readFileSync(proxyPath, "utf8")

    expect(content).not.toMatch(/authjs/i)
    expect(content).not.toMatch(/session-token/i)
    expect(content).not.toMatch(/cookies?/i)
    expect(content).not.toMatch(/redirect/i)
  })

  test("proxy handler runs without redirects", () => {
    const response = proxy({} as any)
    expect(response).toBeDefined()
  })
})
