/**
 * Editor Agent Runtime Utilities
 * - ToolTrace: Ring buffer for recent tool calls
 * - ReadCache: Cache for read_block/read_blocks results
 * - stuckDetector: Detect repeated list/read calls without progress
 */

export interface ToolTraceEntry {
  name: string
  args: Record<string, unknown>
  status: 'calling' | 'success' | 'error'
  timestamp: number
}

export class ToolTrace {
  private buffer: ToolTraceEntry[] = []
  private maxSize: number

  constructor(maxSize: number = 30) {
    this.maxSize = maxSize
  }

  add(entry: ToolTraceEntry): void {
    this.buffer.push(entry)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getRecent(n?: number): ToolTraceEntry[] {
    const count = n ?? this.buffer.length
    return this.buffer.slice(-count)
  }

  clear(): void {
    this.buffer = []
  }

  size(): number {
    return this.buffer.length
  }
}

export class ReadCache {
  private cache: Map<string, string> = new Map()

  get(blockId: string): string | undefined {
    return this.cache.get(blockId)
  }

  set(blockId: string, content: string): void {
    this.cache.set(blockId, content)
  }

  has(blockId: string): boolean {
    return this.cache.has(blockId)
  }

  invalidate(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

export interface StuckResult {
  isStuck: boolean
  reason?: string
}

const REPEAT_THRESHOLD = 3
const NO_PROGRESS_THRESHOLD = 10

/**
 * Detect if the agent is stuck in a loop
 * Stuck conditions:
 * 1. list_blocks called ≥3 times consecutively
 * 2. read_blocks with same blockIds ≥3 times consecutively
 * 3. ≥10 calls without any edit_blocks/add_block/delete_block
 */
export function detectStuck(trace: ToolTrace): StuckResult {
  const entries = trace.getRecent()
  if (entries.length < REPEAT_THRESHOLD) {
    return { isStuck: false }
  }

  // Check for consecutive list_blocks
  const recentN = entries.slice(-REPEAT_THRESHOLD)
  const allList = recentN.every(e => e.name === 'list_blocks' && e.status === 'success')
  if (allList) {
    return { isStuck: true, reason: `list_blocks called ${REPEAT_THRESHOLD} times consecutively` }
  }

  // Check for consecutive read with same args
  const readTools = ['read_blocks']
  const allRead = recentN.every(e => readTools.includes(e.name) && e.status === 'success')
  if (allRead) {
    const argsStrings = recentN.map(e => JSON.stringify(e.args))
    const allSameArgs = argsStrings.every(a => a === argsStrings[0])
    if (allSameArgs) {
      return { isStuck: true, reason: `${recentN[0].name} called ${REPEAT_THRESHOLD} times with same args` }
    }
  }

  // Check for no progress (no edit/add/delete in last N calls)
  if (entries.length >= NO_PROGRESS_THRESHOLD) {
    const recentCalls = entries.slice(-NO_PROGRESS_THRESHOLD)
    const mutationTools = ['edit_blocks', 'add_block', 'delete_block']
    const hasMutation = recentCalls.some(e => mutationTools.includes(e.name) && e.status === 'success')
    if (!hasMutation) {
      return { isStuck: true, reason: `${NO_PROGRESS_THRESHOLD} calls without any edit/add/delete` }
    }
  }

  return { isStuck: false }
}
