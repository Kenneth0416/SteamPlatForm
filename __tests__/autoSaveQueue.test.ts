import {
  SAVE_QUEUE_STORAGE_KEY,
  clearQueue,
  cleanupOnlineListener,
  dequeueSave,
  enqueueSave,
  getQueue,
  setupOnlineListener,
} from '@/lib/autoSaveQueue'

describe('autoSaveQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    cleanupOnlineListener()
    jest.restoreAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    localStorage.clear()
    cleanupOnlineListener()
    jest.restoreAllMocks()
  })

  it('enqueueSave adds a new item with an id and timestamp', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const added = enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-123',
      payload: { markdown: 'Hello' },
    })

    expect(added).not.toBeNull()
    expect(added?.timestamp).toBe(1700000000000)
    expect(typeof added?.id).toBe('string')

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      id: added?.id,
      type: 'lesson',
      lessonId: 'lesson-123',
      payload: { markdown: 'Hello' },
      timestamp: 1700000000000,
    })
  })

  it('prefers crypto.randomUUID when available', () => {
    const originalCrypto = globalThis.crypto
    const mockRandomUUID = jest.fn(() => 'uuid-1234')
    const mockCrypto = { ...(originalCrypto || {}), randomUUID: mockRandomUUID } as Crypto

    Object.defineProperty(globalThis, 'crypto', { value: mockCrypto, configurable: true })

    try {
      const added = enqueueSave({
        type: 'lesson',
        lessonId: 'lesson-random',
        payload: { markdown: 'random' },
      })

      expect(added?.id).toBe('uuid-1234')
      expect(mockRandomUUID).toHaveBeenCalled()
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error allow cleanup when crypto was undefined
        delete globalThis.crypto
      }
    }
  })

  it('dequeueSave removes the matching item while preserving others', () => {
    const first = enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-1',
      payload: { markdown: 'A' },
    })
    const second = enqueueSave({
      type: 'document',
      lessonId: 'lesson-1',
      payload: { content: 'Doc', docId: 'doc-1' },
    })

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(getQueue()).toHaveLength(2)

    dequeueSave(first!.id)

    const remaining = getQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second!.id)
  })

  it('skips persistence when dequeueSave does not find a match', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')

    dequeueSave('missing-id')

    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })

  it('clearQueue removes all queued saves', () => {
    enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-2',
      payload: { markdown: 'B' },
    })

    expect(getQueue()).toHaveLength(1)

    clearQueue()

    expect(getQueue()).toHaveLength(0)
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBe('[]')
  })

  it('getQueue handles invalid JSON gracefully and clears the bad data', () => {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, 'not-json')

    const queue = getQueue()

    expect(queue).toEqual([])
    expect(console.error).toHaveBeenCalled()
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('getQueue clears non-array data from storage', () => {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify({ foo: 'bar' }))

    const queue = getQueue()

    expect(queue).toEqual([])
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('filters out invalid queue entries while keeping valid ones', () => {
    const validItem = {
      id: 'valid',
      type: 'lesson' as const,
      lessonId: 'lesson-filter',
      payload: { markdown: 'keep' },
      timestamp: 123,
    }
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([null, validItem, 123]))

    const queue = getQueue()

    expect(queue).toEqual([validItem])
  })

  it('returns queue unchanged when quota errors occur with a single item', () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw quotaError
      })

    const added = enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-single',
      payload: { markdown: 'solo' },
    })

    setItemSpy.mockRestore()

    expect(added).not.toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      '[autoSaveQueue] localStorage quota exceeded, trimming oldest item',
    )
    expect(getQueue()).toEqual([])
  })

  it('enqueueSave trims the oldest item when storage quota is exceeded', () => {
    const existingItem = {
      id: 'existing',
      type: 'lesson' as const,
      lessonId: 'lesson-3',
      payload: { markdown: 'old' },
      timestamp: 1,
    }
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([existingItem]))

    const originalSetItem = Storage.prototype.setItem
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
    let callCount = 0
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        callCount += 1
        if (callCount === 1) {
          throw quotaError
        }
        return originalSetItem.call(this, key, value)
      })

    const added = enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-3',
      payload: { markdown: 'new' },
    })

    setItemSpy.mockRestore()

    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe(added?.id)
    expect(queue[0].payload.markdown).toBe('new')
    expect(console.warn).toHaveBeenCalledWith(
      '[autoSaveQueue] localStorage quota exceeded, trimming oldest item',
    )
  })

  it('persists nothing when storage quota remains exceeded after trimming', () => {
    const existingItem = {
      id: 'persisted',
      type: 'lesson' as const,
      lessonId: 'lesson-4',
      payload: { markdown: 'old' },
      timestamp: 1,
    }
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([existingItem]))

    const originalSetItem = Storage.prototype.setItem
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
    let callCount = 0
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        callCount += 1
        if (callCount <= 2) {
          throw quotaError
        }
        return originalSetItem.call(this, key, value)
      })

    enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-4',
      payload: { markdown: 'new' },
    })

    setItemSpy.mockRestore()

    expect(console.error).toHaveBeenCalledWith(
      '[autoSaveQueue] Failed to persist trimmed queue:',
      expect.any(Error),
    )
    expect(getQueue()).toEqual([existingItem])
  })

  it('logs when persisting queue fails with non-quota errors', () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        throw new Error('unavailable')
      })

    enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-5',
      payload: { markdown: 'fail' },
    })

    expect(setItemSpy).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      '[autoSaveQueue] Failed to persist queue:',
      expect.any(Error),
    )

    setItemSpy.mockRestore()
  })

  it('no-ops gracefully when not running in a browser environment', () => {
    const originalWindow = global.window
    const originalLocalStorage = global.localStorage
    // @ts-expect-error intentional: simulate non-browser
    delete (global as any).window
    // @ts-expect-error intentional: simulate non-browser
    delete (global as any).localStorage

    try {
      expect(getQueue()).toEqual([])
      expect(
        enqueueSave({
          type: 'lesson',
          lessonId: 'offline',
          payload: { markdown: 'offline' },
        }),
      ).toBeNull()
      expect(() => dequeueSave('any')).not.toThrow()
      expect(() => clearQueue()).not.toThrow()
      expect(setupOnlineListener(jest.fn())).toBeUndefined()
    } finally {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      })
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      })
    }
  })

  it('setupOnlineListener triggers retry on reconnect and cleans up', async () => {
    const retryFn = jest.fn().mockResolvedValue(undefined)

    setupOnlineListener(retryFn)
    window.dispatchEvent(new Event('online'))
    await Promise.resolve()

    expect(retryFn).toHaveBeenCalledTimes(1)

    cleanupOnlineListener()
    window.dispatchEvent(new Event('online'))
    await Promise.resolve()

    expect(retryFn).toHaveBeenCalledTimes(1)
  })

  it('setupOnlineListener logs errors when retry rejects', async () => {
    const retryFn = jest.fn().mockRejectedValue(new Error('network down'))

    setupOnlineListener(retryFn)
    window.dispatchEvent(new Event('online'))
    await Promise.resolve()

    expect(retryFn).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(
      '[autoSaveQueue] Retry failed:',
      expect.any(Error),
    )
  })

  it('setupOnlineListener catches synchronous errors thrown by retry', () => {
    const retryFn = jest.fn(() => {
      throw new Error('sync fail')
    })

    setupOnlineListener(retryFn)
    window.dispatchEvent(new Event('online'))

    expect(console.error).toHaveBeenCalledWith(
      '[autoSaveQueue] Retry threw:',
      expect.any(Error),
    )
  })
})
