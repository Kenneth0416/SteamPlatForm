import * as Diff from 'diff'
import type { DiffChange } from './types'

export interface DiffResult {
  changes: DiffChange[]
  additions: number
  deletions: number
  unchanged: number
}

export function generateDiff(oldContent: string, newContent: string): DiffResult {
  const changes = Diff.diffLines(oldContent, newContent)

  let additions = 0
  let deletions = 0
  let unchanged = 0

  const result: DiffChange[] = changes.map(change => {
    if (change.added) {
      additions += change.count || 1
      return { type: 'add' as const, value: change.value }
    }
    if (change.removed) {
      deletions += change.count || 1
      return { type: 'remove' as const, value: change.value }
    }
    unchanged += change.count || 1
    return { type: 'unchanged' as const, value: change.value }
  })

  return { changes: result, additions, deletions, unchanged }
}

export function generateWordDiff(oldContent: string, newContent: string): DiffChange[] {
  const changes = Diff.diffWords(oldContent, newContent)
  return changes.map(change => {
    if (change.added) return { type: 'add' as const, value: change.value }
    if (change.removed) return { type: 'remove' as const, value: change.value }
    return { type: 'unchanged' as const, value: change.value }
  })
}

export function formatDiffForDisplay(diff: DiffResult): string {
  return diff.changes.map(change => {
    const prefix = change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '
    return change.value.split('\n').map(line => line ? `${prefix} ${line}` : '').join('\n')
  }).join('')
}
