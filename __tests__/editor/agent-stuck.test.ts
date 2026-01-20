import { ToolTrace, ReadCache, detectStuck, ToolTraceEntry } from '../../lib/editor/agent/runtime'

describe('ToolTrace', () => {
  it('should store entries up to maxSize', () => {
    const trace = new ToolTrace(3)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })
    trace.add({ name: 'edit_blocks', args: { edits: [{ blockId: 'b1' }] }, status: 'success', timestamp: 3 })
    expect(trace.size()).toBe(3)
  })

  it('should overwrite old entries when exceeding maxSize', () => {
    const trace = new ToolTrace(2)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })
    trace.add({ name: 'edit_blocks', args: { edits: [{ blockId: 'b1' }] }, status: 'success', timestamp: 3 })

    const recent = trace.getRecent()
    expect(recent.length).toBe(2)
    expect(recent[0].name).toBe('read_blocks')
    expect(recent[1].name).toBe('edit_blocks')
  })

  it('should return correct number of recent entries', () => {
    const trace = new ToolTrace(10)
    for (let i = 0; i < 5; i++) {
      trace.add({ name: `tool_${i}`, args: {}, status: 'success', timestamp: i })
    }

    expect(trace.getRecent(2).length).toBe(2)
    expect(trace.getRecent(10).length).toBe(5)
    expect(trace.getRecent().length).toBe(5)
  })

  it('should clear all entries', () => {
    const trace = new ToolTrace(10)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })

    trace.clear()
    expect(trace.size()).toBe(0)
    expect(trace.getRecent()).toEqual([])
  })
})

describe('ReadCache', () => {
  it('should get/set/has correctly', () => {
    const cache = new ReadCache()

    expect(cache.has('b1')).toBe(false)
    expect(cache.get('b1')).toBeUndefined()

    cache.set('b1', 'content1')
    expect(cache.has('b1')).toBe(true)
    expect(cache.get('b1')).toBe('content1')
  })

  it('should invalidate all entries', () => {
    const cache = new ReadCache()
    cache.set('b1', 'content1')
    cache.set('b2', 'content2')

    expect(cache.size()).toBe(2)

    cache.invalidate()
    expect(cache.size()).toBe(0)
    expect(cache.has('b1')).toBe(false)
  })
})

describe('detectStuck', () => {
  const makeEntry = (name: string, args: Record<string, unknown> = {}, status: 'success' | 'error' = 'success'): ToolTraceEntry => ({
    name,
    args,
    status,
    timestamp: Date.now()
  })

  it('should NOT trigger stuck for normal operation sequence', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('list_blocks'))
    trace.add(makeEntry('read_blocks', { blockIds: ['b1'] }))
    trace.add(makeEntry('edit_blocks', { edits: [{ blockId: 'b1' }] }))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })

  it('should trigger stuck for 3 consecutive list_blocks', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('list_blocks'))
    trace.add(makeEntry('list_blocks'))
    trace.add(makeEntry('list_blocks'))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(true)
    expect(result.reason).toContain('list_blocks')
  })

  it('should trigger stuck for 3 consecutive read_blocks with same blockIds', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('read_blocks', { blockIds: ['b1'] }))
    trace.add(makeEntry('read_blocks', { blockIds: ['b1'] }))
    trace.add(makeEntry('read_blocks', { blockIds: ['b1'] }))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(true)
    expect(result.reason).toContain('read_blocks')
  })

  it('should NOT trigger stuck for read_blocks with different blockIds', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('read_blocks', { blockIds: ['b1'] }))
    trace.add(makeEntry('read_blocks', { blockIds: ['b2'] }))
    trace.add(makeEntry('read_blocks', { blockIds: ['b3'] }))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })

  it('should trigger stuck for 10 calls without edit/add/delete', () => {
    const trace = new ToolTrace()
    for (let i = 0; i < 10; i++) {
      trace.add(makeEntry(i % 2 === 0 ? 'list_blocks' : 'read_blocks', { blockIds: [`b${i}`] }))
    }

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(true)
    expect(result.reason).toContain('without any edit/add/delete')
  })

  it('should NOT trigger stuck for exactly 9 calls without mutation', () => {
    const trace = new ToolTrace()
    for (let i = 0; i < 9; i++) {
      trace.add(makeEntry('read_blocks', { blockIds: [`b${i}`] }))
    }

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })

  it('should NOT trigger stuck for exactly 2 consecutive list_blocks', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('list_blocks'))
    trace.add(makeEntry('list_blocks'))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })

  it('should NOT trigger stuck when edit breaks the pattern', () => {
    const trace = new ToolTrace()
    for (let i = 0; i < 8; i++) {
      trace.add(makeEntry('read_blocks', { blockIds: [`b${i}`] }))
    }
    trace.add(makeEntry('edit_blocks', { edits: [{ blockId: 'b1', content: 'new' }] }))
    trace.add(makeEntry('read_blocks', { blockIds: ['b9'] }))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })

  it('should handle mixed list + read pattern triggering no-progress', () => {
    const trace = new ToolTrace()
    for (let i = 0; i < 5; i++) {
      trace.add(makeEntry('list_blocks'))
      trace.add(makeEntry('read_blocks', { blockIds: [`b${i}`] }))
    }

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(true)
    expect(result.reason).toContain('without any edit/add/delete')
  })

  it('should NOT trigger stuck for failed tool calls', () => {
    const trace = new ToolTrace()
    trace.add(makeEntry('list_blocks', {}, 'error'))
    trace.add(makeEntry('list_blocks', {}, 'error'))
    trace.add(makeEntry('list_blocks', {}, 'error'))

    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })
})
