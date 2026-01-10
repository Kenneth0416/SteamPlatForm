import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()

const paths = {
  globalsCss: path.join(rootDir, 'app', 'globals.css'),
  packageJson: path.join(rootDir, 'package.json'),
}

export function readGlobalsCss(): string {
  return fs.readFileSync(paths.globalsCss, 'utf8')
}

export function readPackageJson(): Record<string, any> {
  return JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'))
}

export function getVditorDependencySpec(): string | undefined {
  return readPackageJson().dependencies?.vditor
}

export function getVditorImportIndex(css?: string): number {
  const content = css ?? readGlobalsCss()
  return content.indexOf("@import 'vditor/dist/index.css';")
}

export function getRootRuleIndex(css?: string): number {
  const content = css ?? readGlobalsCss()
  return content.indexOf(':root')
}

export function collectVditorCustomProperties(css?: string): string[] {
  const content = css ?? readGlobalsCss()
  return Array.from(content.matchAll(/--vditor-[a-z0-9-]+\s*:/gi)).map(match =>
    match[0].replace(':', '').trim(),
  )
}

export function findVditorSelectors(css?: string): string[] {
  const content = css ?? readGlobalsCss()
  const selectors: string[] = []
  const selectorPattern = /(^|\n)\s*([^@][^{\n]*vditor[^{\n]*)\s*\{/gi
  let match: RegExpExecArray | null
  while ((match = selectorPattern.exec(content)) !== null) {
    selectors.push(match[2].trim())
  }
  return selectors
}

export function referencedDesignTokens(css?: string, tokens: string[] = []): string[] {
  const content = css ?? readGlobalsCss()
  const tokenList =
    tokens.length > 0
      ? tokens
      : ['--background', '--foreground', '--border', '--muted', '--muted-foreground', '--primary', '--ring', '--card']
  return tokenList.filter(token => content.includes(`var(${token})`))
}
