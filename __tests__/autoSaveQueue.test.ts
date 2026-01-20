import { IDBDatabase, IDBKeyRange, IDBObjectStore, indexedDB as fakeIndexedDb } from 'fake-indexeddb'
import {
  SAVE_QUEUE_STORAGE_KEY,
  clearQueue,
  cleanupOnlineListener,
  dequeueSave,
  enqueueSave,
  getQueue,
  setupOnlineListener,
} from '@/lib/autoSaveQueue'

if (typeof globalThis.indexedDB === 'undefined') {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: fakeIndexedDb,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: IDBKeyRange,
    configurable: true,
    writable: true,
  })
}
if (typeof window !== 'undefined' && typeof window.indexedDB === 'undefined') {
  Object.defineProperty(window, 'indexedDB', {
    value: fakeIndexedDb,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'IDBKeyRange', {
    value: IDBKeyRange,
    configurable: true,
    writable: true,
  })
}

const createFailingRequest = (message: string) => {
  const request = {
    onsuccess: null as null | ((event: Event) => void),
    onerror: null as null | ((event: Event) => void),
    error: new Error(message),
  } as IDBRequest<unknown>

  setTimeout(() => request.onerror?.(new Event('error')), 0)
  return request
}

describe('autoSaveQueue', () => {
  beforeEach(async () => {
    localStorage.clear()
    cleanupOnlineListener()
    jest.restoreAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await clearQueue()
  })

  afterEach(async () => {
    localStorage.clear()
    cleanupOnlineListener()
    jest.restoreAllMocks()
    await clearQueue()
  })

  it('enqueueSave adds a new item with an id and timestamp', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const added = await enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-123',
      payload: { markdown: 'Hello' },
    })

    expect(added).not.toBeNull()
    expect(added?.timestamp).toBe(1700000000000)
    expect(typeof added?.id).toBe('string')

    const queue = await getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      id: added?.id,
      type: 'lesson',
      lessonId: 'lesson-123',
      payload: { markdown: 'Hello' },
      timestamp: 1700000000000,
    })
  })

  it('prefers crypto.randomUUID when available', async () => {
    const originalCrypto = globalThis.crypto
    const mockRandomUUID = jest.fn(() => 'uuid-1234')
    const mockCrypto = { ...(originalCrypto || {}), randomUUID: mockRandomUUID } as Crypto

    Object.defineProperty(globalThis, 'crypto', { value: mockCrypto, configurable: true })

    try {
      const added = await enqueueSave({
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

  it('dequeueSave removes the matching item while preserving others', async () => {
    const first = await enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-1',
      payload: { markdown: 'A' },
    })
    const second = await enqueueSave({
      type: 'document',
      lessonId: 'lesson-1',
      payload: { content: 'Doc', docId: 'doc-1' },
    })

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(await getQueue()).toHaveLength(2)

    await dequeueSave(first!.id)

    const remaining = await getQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second!.id)
  })

  it('clearQueue removes all queued saves', async () => {
    await enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-2',
      payload: { markdown: 'B' },
    })

    expect(await getQueue()).toHaveLength(1)

    await clearQueue()

    expect(await getQueue()).toHaveLength(0)
  })

  it('migrates valid localStorage data to IndexedDB and clears localStorage', async () => {
    const items = [
      {
        id: 'first',
        type: 'lesson' as const,
        lessonId: 'lesson-migrate',
        payload: { markdown: 'keep' },
        timestamp: 1,
      },
      {
        id: 'second',
        type: 'document' as const,
        lessonId: 'lesson-migrate',
        payload: { docId: 'doc-1', content: 'doc' },
        timestamp: 2,
      },
    ]
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify(items))

    const queue = await getQueue()

    expect(queue).toEqual(items)
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('filters invalid queue entries while keeping valid ones during migration', async () => {
    const validItem = {
      id: 'valid',
      type: 'lesson' as const,
      lessonId: 'lesson-filter',
      payload: { markdown: 'keep' },
      timestamp: 123,
    }
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([null, validItem, 123]))

    const queue = await getQueue()

    expect(queue).toEqual([validItem])
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('getQueue handles invalid JSON gracefully and clears the bad data', async () => {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, 'not-json')

    const queue = await getQueue()

    expect(queue).toEqual([])
    expect(console.error).toHaveBeenCalled()
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('clears non-array legacy data from localStorage', async () => {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify({ foo: 'bar' }))

    const queue = await getQueue()

    expect(queue).toEqual([])
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('clears legacy storage when no valid items remain', async () => {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([null, 123, 'bad']))

    const queue = await getQueue()

    expect(queue).toEqual([])
    expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('removes invalid items stored in IndexedDB', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('steam-lesson-save-queue-db', 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('queue')) {
          database.createObjectStore('queue', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite')
      const store = tx.objectStore('queue')
      store.put({ id: 'bad-item', type: 'lesson', lessonId: 'lesson', payload: null, timestamp: 'oops' })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    const queue = await getQueue()
    expect(queue).toEqual([])

    const remaining = await getQueue()
    expect(remaining).toEqual([])
  })

  it('logs when migration write fails', async () => {
    const originalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = () => {
      throw new Error('tx-fail')
    }

    try {
      const validItem = {
        id: 'legacy',
        type: 'lesson' as const,
        lessonId: 'lesson-legacy',
        payload: { markdown: 'keep' },
        timestamp: 1,
      }
      localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify([validItem]))

      await getQueue()

      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to migrate legacy queue:',
        expect.any(Error),
      )
      expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeTruthy()
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction
    }
  })

  it('logs when getQueue transaction fails', async () => {
    const originalGetAll = IDBObjectStore.prototype.getAll
    IDBObjectStore.prototype.getAll = () => {
      throw new Error('getAll-fail')
    }

    try {
      const queue = await getQueue()
      expect(queue).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to read queue:',
        expect.any(Error),
      )
    } finally {
      IDBObjectStore.prototype.getAll = originalGetAll
    }
  })

  it('logs when enqueueSave cannot persist', async () => {
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = () => createFailingRequest('put-fail') as IDBRequest<IDBValidKey>

    try {
      const result = await enqueueSave({
        type: 'lesson',
        lessonId: 'lesson-error',
        payload: { markdown: 'fail' },
      })

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to persist queue item:',
        expect.any(Error),
      )
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
  })

  it('logs when dequeueSave fails', async () => {
    const originalDelete = IDBObjectStore.prototype.delete
    IDBObjectStore.prototype.delete = () => createFailingRequest('delete-fail') as IDBRequest<undefined>

    try {
      await dequeueSave('missing-id')
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to dequeue item:',
        expect.any(Error),
      )
    } finally {
      IDBObjectStore.prototype.delete = originalDelete
    }
  })

  it('logs when clearQueue fails', async () => {
    const originalClear = IDBObjectStore.prototype.clear
    IDBObjectStore.prototype.clear = () => createFailingRequest('clear-fail') as IDBRequest<undefined>

    try {
      await clearQueue()
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to clear queue:',
        expect.any(Error),
      )
    } finally {
      IDBObjectStore.prototype.clear = originalClear
    }
  })

  it('logs when IndexedDB open fails', async () => {
    const originalIndexedDb = globalThis.indexedDB
    const originalWindowIndexedDb = typeof window !== 'undefined' ? window.indexedDB : undefined

    const failingIndexedDb = {
      open: () => {
        const request = {
          onerror: null as null | ((event: Event) => void),
          onsuccess: null as null | ((event: Event) => void),
          onupgradeneeded: null as null | ((event: Event) => void),
          error: new Error('open-fail'),
        } as IDBOpenDBRequest

        setTimeout(() => request.onerror?.(new Event('error')), 0)
        return request
      },
    } as IDBFactory

    Object.defineProperty(globalThis, 'indexedDB', {
      value: failingIndexedDb,
      configurable: true,
      writable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'indexedDB', {
        value: failingIndexedDb,
        configurable: true,
        writable: true,
      })
    }

    try {
      jest.resetModules()
      const { enqueueSave: freshEnqueueSave } = await import('@/lib/autoSaveQueue')
      const result = await freshEnqueueSave({
        type: 'lesson',
        lessonId: 'lesson-open-fail',
        payload: { markdown: 'fail' },
      })

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to open IndexedDB:',
        expect.any(Error),
      )
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDb,
        configurable: true,
        writable: true,
      })
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'indexedDB', {
          value: originalWindowIndexedDb,
          configurable: true,
          writable: true,
        })
      }
    }
  })

  it('skips migration when localStorage is unavailable', async () => {
    const originalLocalStorage = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    try {
      const queue = await getQueue()
      expect(queue).toEqual([])
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      })
    }
  })

  it('keeps legacy data when IndexedDB open fails during migration', async () => {
    const originalIndexedDb = globalThis.indexedDB
    const originalWindowIndexedDb = typeof window !== 'undefined' ? window.indexedDB : undefined

    const failingIndexedDb = {
      open: () => {
        const request = {
          onerror: null as null | ((event: Event) => void),
          onsuccess: null as null | ((event: Event) => void),
          onupgradeneeded: null as null | ((event: Event) => void),
          error: new Error('open-fail'),
        } as IDBOpenDBRequest

        setTimeout(() => request.onerror?.(new Event('error')), 0)
        return request
      },
    } as IDBFactory

    Object.defineProperty(globalThis, 'indexedDB', {
      value: failingIndexedDb,
      configurable: true,
      writable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'indexedDB', {
        value: failingIndexedDb,
        configurable: true,
        writable: true,
      })
    }

    try {
      localStorage.setItem(
        SAVE_QUEUE_STORAGE_KEY,
        JSON.stringify([
          {
            id: 'legacy',
            type: 'lesson',
            lessonId: 'lesson-legacy',
            payload: { markdown: 'keep' },
            timestamp: 1,
          },
        ]),
      )

      jest.resetModules()
      const { getQueue: freshGetQueue } = await import('@/lib/autoSaveQueue')
      await freshGetQueue()

      expect(localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)).toBeTruthy()
      expect(console.error).toHaveBeenCalledWith(
        '[autoSaveQueue] Failed to open IndexedDB:',
        expect.any(Error),
      )
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDb,
        configurable: true,
        writable: true,
      })
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'indexedDB', {
          value: originalWindowIndexedDb,
          configurable: true,
          writable: true,
        })
      }
    }
  })

  it('restores queue after module reload', async () => {
    await enqueueSave({
      type: 'lesson',
      lessonId: 'lesson-refresh',
      payload: { markdown: 'persisted' },
    })

    jest.resetModules()

    const freshModule = await import('@/lib/autoSaveQueue')
    const queue = await freshModule.getQueue()

    expect(queue).toHaveLength(1)
    expect(queue[0].lessonId).toBe('lesson-refresh')
  })

  it('no-ops gracefully when not running in a browser environment', async () => {
    const originalWindow = global.window
    const originalIndexedDb = global.indexedDB
    const originalLocalStorage = global.localStorage
    // @ts-expect-error intentional: simulate non-browser
    delete (global as any).window
    // @ts-expect-error intentional: simulate non-browser
    delete (global as any).indexedDB
    // @ts-expect-error intentional: simulate non-browser
    delete (global as any).localStorage

    try {
      expect(await getQueue()).toEqual([])
      expect(
        await enqueueSave({
          type: 'lesson',
          lessonId: 'offline',
          payload: { markdown: 'offline' },
        }),
      ).toBeNull()
      await expect(dequeueSave('any')).resolves.toBeUndefined()
      await expect(clearQueue()).resolves.toBeUndefined()
      expect(setupOnlineListener(jest.fn())).toBeUndefined()
    } finally {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      })
      Object.defineProperty(global, 'indexedDB', {
        value: originalIndexedDb,
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
