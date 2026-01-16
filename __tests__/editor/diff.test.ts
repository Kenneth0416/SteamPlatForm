import { generateDiff, generateWordDiff, formatDiffForDisplay } from '@/lib/editor/diff'

describe('DiffService', () => {
  describe('generateDiff', () => {
    it('should detect additions', () => {
      const result = generateDiff('line1\n', 'line1\nline2\n')

      expect(result.additions).toBeGreaterThan(0)
      expect(result.changes.some(c => c.type === 'add')).toBe(true)
    })

    it('should detect deletions', () => {
      const result = generateDiff('line1\nline2\n', 'line1\n')

      expect(result.deletions).toBeGreaterThan(0)
      expect(result.changes.some(c => c.type === 'remove')).toBe(true)
    })

    it('should detect unchanged content', () => {
      const result = generateDiff('same\n', 'same\n')

      expect(result.unchanged).toBeGreaterThan(0)
      expect(result.additions).toBe(0)
      expect(result.deletions).toBe(0)
    })

    it('should handle complete replacement', () => {
      const result = generateDiff('old content', 'new content')

      expect(result.additions).toBeGreaterThan(0)
      expect(result.deletions).toBeGreaterThan(0)
    })

    it('should handle empty strings', () => {
      const result = generateDiff('', 'new')
      expect(result.additions).toBeGreaterThan(0)

      const result2 = generateDiff('old', '')
      expect(result2.deletions).toBeGreaterThan(0)
    })
  })

  describe('generateWordDiff', () => {
    it('should detect word-level changes', () => {
      const changes = generateWordDiff('hello world', 'hello universe')

      expect(changes.some(c => c.type === 'remove' && c.value.includes('world'))).toBe(true)
      expect(changes.some(c => c.type === 'add' && c.value.includes('universe'))).toBe(true)
    })

    it('should preserve unchanged words', () => {
      const changes = generateWordDiff('the quick fox', 'the slow fox')

      expect(changes.some(c => c.type === 'unchanged' && c.value.includes('the'))).toBe(true)
      expect(changes.some(c => c.type === 'unchanged' && c.value.includes('fox'))).toBe(true)
    })
  })

  describe('formatDiffForDisplay', () => {
    it('should format additions with + prefix', () => {
      const diff = generateDiff('', 'new line\n')
      const formatted = formatDiffForDisplay(diff)

      expect(formatted).toContain('+')
    })

    it('should format deletions with - prefix', () => {
      const diff = generateDiff('old line\n', '')
      const formatted = formatDiffForDisplay(diff)

      expect(formatted).toContain('-')
    })
  })
})
