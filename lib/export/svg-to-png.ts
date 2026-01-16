import { Resvg } from "@resvg/resvg-js"
import fs from "fs"
import path from "path"

const FALLBACK_FONT_FAMILY = "Source Han Sans CN Medium"
const BUNDLED_FONT_FILES = [
  path.resolve(process.cwd(), "public/fonts/SourceHanSansCN-Regular.ttf"),
]

function decodeSvgDataUrl(src: string): string | null {
  const base64Match = src.match(/^data:image\/svg\+xml;base64,(.+)$/)
  if (base64Match) {
    try {
      return Buffer.from(base64Match[1], "base64").toString("utf8")
    } catch {
      return null
    }
  }

  const utfMatch = src.match(/^data:image\/svg\+xml(?:;charset=utf-8)?;utf8,(.+)$/)
  if (utfMatch) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return null
    }
  }

  return null
}

function patchSvgFonts(svg: string): string {
  const fontRule = `* { font-family: '${FALLBACK_FONT_FAMILY}', 'Noto Sans', 'DejaVu Sans', sans-serif !important; }`

  if (/<style[\s>]/i.test(svg)) {
    return svg.replace(/<style[^>]*>/i, match => `${match}\n${fontRule}`)
  }

  return svg.replace(/<svg[^>]*>/i, match => `${match}\n<style>${fontRule}</style>`)
}

function resolveBundledFontFiles(): string[] {
  const availableFonts = BUNDLED_FONT_FILES.filter(filePath => fs.existsSync(filePath))
  if (!availableFonts.length) {
    throw new Error(`Bundled fallback font missing: ${BUNDLED_FONT_FILES.join(", ")}`)
  }
  return availableFonts
}

function renderSvgToPngBase64(svg: string): string {
  const patched = patchSvgFonts(svg)
  const fontFiles = resolveBundledFontFiles()
  const resvg = new Resvg(patched, {
    fitTo: { mode: "width", value: 1024 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: FALLBACK_FONT_FAMILY,
      sansSerifFamily: FALLBACK_FONT_FAMILY,
      fontFiles,
    },
    background: "white",
  })
  const pngData = resvg.render().asPng()
  return Buffer.from(pngData).toString("base64")
}

export async function convertMarkdownSvgImagesToPng(markdown: string): Promise<string> {
  const pattern = /!\[[^\]]*]\((data:image\/svg\+xml[^)]+)\)/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  let output = ""

  while ((match = pattern.exec(markdown))) {
    output += markdown.slice(lastIndex, match.index)
    const src = match[1]
    const svg = decodeSvgDataUrl(src)
    if (svg) {
      try {
        const pngBase64 = renderSvgToPngBase64(svg)
        output += match[0].replace(src, `data:image/png;base64,${pngBase64}`)
      } catch (error) {
        console.error("Failed to convert SVG to PNG during PDF export:", error)
        output += match[0]
      }
    } else {
      output += match[0]
    }
    lastIndex = pattern.lastIndex
  }

  output += markdown.slice(lastIndex)
  return output
}
