import {
  collectVditorCustomProperties,
  findVditorSelectors,
  getRootRuleIndex,
  getVditorDependencySpec,
  getVditorImportIndex,
  readGlobalsCss,
  referencedDesignTokens,
} from '@/lib/vditor-assets'

describe('vditor setup', () => {
  const css = readGlobalsCss()

  it('adds vditor as a direct dependency', () => {
    const spec = getVditorDependencySpec()
    expect(spec).toBeDefined()
    expect(spec).toBe('^3.10.8')
    expect(spec).toMatch(/^\^\d+\.\d+\.\d+/)
  })

  it('imports Vditor base styles before custom theme rules', () => {
    const importIndex = getVditorImportIndex()
    const rootRuleIndex = getRootRuleIndex(css)
    expect(importIndex).toBeGreaterThanOrEqual(0)
    expect(rootRuleIndex).toBeGreaterThan(importIndex)
    expect(getRootRuleIndex()).toBe(rootRuleIndex)
  })

  it('defines custom properties that lean on shared design tokens', () => {
    const propertiesFromFile = collectVditorCustomProperties()
    const propertiesFromArg = collectVditorCustomProperties(css)
    expect(propertiesFromFile).toEqual(propertiesFromArg)
    expect(propertiesFromFile).toEqual(
      expect.arrayContaining(['--vditor-surface', '--vditor-toolbar-icon-active', '--vditor-code-surface']),
    )

    const defaultTokens = referencedDesignTokens(css)
    expect(defaultTokens).toEqual(
      expect.arrayContaining(['--background', '--foreground', '--border', '--muted', '--primary', '--ring']),
    )
    expect(referencedDesignTokens(css, ['--ring'])).toEqual(['--ring'])
  })

  it('scopes overrides to the Vditor root to prevent global conflicts', () => {
    const selectors = findVditorSelectors(css)
    const selectorsFromFile = findVditorSelectors()
    expect(selectorsFromFile).toEqual(selectors)
    expect(selectors.length).toBeGreaterThan(0)
    expect(selectors.every(selector => selector.startsWith('.vditor'))).toBe(true)
    expect(css).toContain('color-mix(in srgb, var(--muted) 35%, transparent)')
    expect(css).toContain('outline: 2px solid var(--vditor-ring)')
    expect(css).toContain('background-color: var(--vditor-surface);')
  })
})
