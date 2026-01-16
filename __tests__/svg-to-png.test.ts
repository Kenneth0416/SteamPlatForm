import fs from "fs"
import path from "path"

import { convertMarkdownSvgImagesToPng } from "@/lib/export/svg-to-png"
import { Resvg } from "@resvg/resvg-js"

jest.mock("@resvg/resvg-js", () => {
  const resvgMock = jest.fn().mockImplementation(() => ({
    render: jest.fn(() => ({
      asPng: jest.fn(() => Buffer.from("png-data")),
    })),
  }))

  return { Resvg: resvgMock }
})

const FONT_PATH = path.resolve(process.cwd(), "public/fonts/SourceHanSansCN-Regular.ttf")

describe("convertMarkdownSvgImagesToPng", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("registers bundled fallback fonts and replaces SVG data URLs", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="20">中文Text</text></svg>`
    const markdown = `![chart](data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")})`

    const result = await convertMarkdownSvgImagesToPng(markdown)
    const mockedResvg = jest.mocked(Resvg)

    expect(mockedResvg).toHaveBeenCalledTimes(1)
    const [patchedSvg, options] = mockedResvg.mock.calls[0]
    expect(patchedSvg).toContain("font-family: 'Source Han Sans CN Medium'")
    expect(patchedSvg).toContain("<style>")
    expect(options.font?.fontFiles).toEqual([FONT_PATH])
    expect(fs.existsSync(FONT_PATH)).toBe(true)
    expect(options.font?.defaultFontFamily).toBe("Source Han Sans CN Medium")
    expect(result).toContain("data:image/png;base64,cG5nLWRhdGE=")
  })

  it("supports UTF-8 encoded SVG data URLs", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">流程图</text></svg>`
    const markdown = `![flow](${`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`})`

    await convertMarkdownSvgImagesToPng(markdown)
    const mockedResvg = jest.mocked(Resvg)

    expect(mockedResvg).toHaveBeenCalledTimes(1)
    const [patchedSvg] = mockedResvg.mock.calls[0]
    expect(patchedSvg).toContain("流程图")
  })

  it("falls back gracefully when bundled fonts are missing", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>missing font</text></svg>`
    const markdown = `![chart](data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")})`
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false)
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    const result = await convertMarkdownSvgImagesToPng(markdown)

    expect(result).toBe(markdown)
    expect(jest.mocked(Resvg)).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    existsSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
