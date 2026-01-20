export interface SaveQueueItem {
  id: string
  type: 'lesson' | 'document'
  lessonId: string
  payload: { markdown?: string; requirements?: any; content?: string; docId?: string }
  timestamp: number
}

export const SAVE_QUEUE_STORAGE_KEY = 'steam-lesson-save-queue'
export const SAVE_QUEUE_DB_NAME = 'steam-lesson-save-queue-db'
const SAVE_QUEUE_STORE_NAME = 'queue'

let onlineListener: ((event: Event) => void) | null = null
let dbPromise: Promise<IDBDatabase | null> | null = null
let migrationPromise: Promise<void> | null = null

const hasWindow = () => typeof window !== 'undefined'
const getIndexedDb = () => (globalThis as typeof globalThis & { indexedDB?: IDBFactory }).indexedDB
const hasIndexedDb = () => typeof getIndexedDb() !== 'undefined'
const getLocalStorage = () => (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage
const hasLocalStorage = () => typeof getLocalStorage() !== 'undefined'

const isValidQueueItem = (value: any): value is SaveQueueItem => {
  if (!value || typeof value !== 'object') return false
  const { id, type, lessonId, payload, timestamp } = value

  const isValidType = type === 'lesson' || type === 'document'
  const isValidPayload = payload && typeof payload === 'object'

  return (
    typeof id === 'string' &&
    isValidType &&
    typeof lessonId === 'string' &&
    isValidPayload &&
    typeof timestamp === 'number'
  )
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `save_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const openQueueDb = async (): Promise<IDBDatabase | null> => {
  if (!hasIndexedDb()) return null
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>((resolve, reject) => {
  const indexedDb = getIndexedDb()
  const request = indexedDb!.open(SAVE_QUEUE_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SAVE_QUEUE_STORE_NAME)) {
        db.createObjectStore(SAVE_QUEUE_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error('[autoSaveQueue] Failed to open IndexedDB:', request.error)
      reject(request.error)
    }
  }).catch(() => {
    dbPromise = null
    return null
  })

  return dbPromise
}

const runQueueTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> => {
  const db = await openQueueDb()
  if (!db) return null

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVE_QUEUE_STORE_NAME, mode)
    const store = tx.objectStore(SAVE_QUEUE_STORE_NAME)
    let result: Promise<T>

    try {
      result = operation(store)
    } catch (error) {
      tx.abort()
      reject(error)
      return
    }

    tx.oncomplete = () => {
      result.then(resolve).catch(reject)
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const migrateFromLocalStorage = async (): Promise<void> => {
  if (!hasLocalStorage()) return

  const storage = getLocalStorage()!
  const raw = storage.getItem(SAVE_QUEUE_STORAGE_KEY)
  if (!raw) return

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error('[autoSaveQueue] Failed to read legacy queue:', error)
    storage.removeItem(SAVE_QUEUE_STORAGE_KEY)
    return
  }

  if (!Array.isArray(parsed)) {
    storage.removeItem(SAVE_QUEUE_STORAGE_KEY)
    return
  }

  const validItems = parsed.filter(isValidQueueItem)
  if (validItems.length === 0) {
    storage.removeItem(SAVE_QUEUE_STORAGE_KEY)
    return
  }

  const db = await openQueueDb()
  if (!db) return

  try {
    await runQueueTransaction('readwrite', async (store) => {
      validItems.forEach((item) => store.put(item))
      return Promise.resolve()
    })
    storage.removeItem(SAVE_QUEUE_STORAGE_KEY)
  } catch (error) {
    console.error('[autoSaveQueue] Failed to migrate legacy queue:', error)
  }
}

const ensureMigration = async (): Promise<void> => {
  const storage = hasLocalStorage() ? getLocalStorage() : undefined
  const hasLegacyData = Boolean(storage?.getItem(SAVE_QUEUE_STORAGE_KEY))
  if (!migrationPromise || hasLegacyData) {
    migrationPromise = migrateFromLocalStorage()
  }
  await migrationPromise
}

export const getQueue = async (): Promise<SaveQueueItem[]> => {
  if (!hasIndexedDb()) return []

  try {
    await ensureMigration()
    const items =
      (await runQueueTransaction('readonly', (store) => requestToPromise(store.getAll()))) || []

    const validItems = items.filter(isValidQueueItem).sort((a, b) => a.timestamp - b.timestamp)
    if (validItems.length !== items.length) {
      const invalidItems = items.filter((item) => !isValidQueueItem(item) && item?.id)
      if (invalidItems.length > 0) {
        await runQueueTransaction('readwrite', async (store) => {
          invalidItems.forEach((item) => store.delete(item.id))
          return Promise.resolve()
        })
      }
    }

    return validItems
  } catch (error) {
    console.error('[autoSaveQueue] Failed to read queue:', error)
    return []
  }
}

export const enqueueSave = async (
  item: Omit<SaveQueueItem, 'id' | 'timestamp'>,
): Promise<SaveQueueItem | null> => {
  if (!hasIndexedDb()) return null

  try {
    await ensureMigration()
    const newItem: SaveQueueItem = { ...item, id: generateId(), timestamp: Date.now() }
    const persisted = await runQueueTransaction('readwrite', (store) =>
      requestToPromise(store.put(newItem)),
    )
    if (persisted === null) return null
    return newItem
  } catch (error) {
    console.error('[autoSaveQueue] Failed to persist queue item:', error)
    return null
  }
}

export const dequeueSave = async (id: string): Promise<void> => {
  if (!hasIndexedDb()) return

  try {
    await runQueueTransaction('readwrite', (store) => requestToPromise(store.delete(id)))
  } catch (error) {
    console.error('[autoSaveQueue] Failed to dequeue item:', error)
  }
}

export const clearQueue = async (): Promise<void> => {
  if (!hasIndexedDb()) return

  try {
    await runQueueTransaction('readwrite', (store) => requestToPromise(store.clear()))
  } catch (error) {
    console.error('[autoSaveQueue] Failed to clear queue:', error)
  }
}

export const setupOnlineListener = (retryFn: () => Promise<void>): void => {
  if (!hasWindow()) return

  cleanupOnlineListener()

  const handler = () => {
    try {
      const result = retryFn()
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        ;(result as Promise<unknown>).catch((error) => {
          console.error('[autoSaveQueue] Retry failed:', error)
        })
      }
    } catch (error) {
      console.error('[autoSaveQueue] Retry threw:', error)
    }
  }

  onlineListener = handler
  window.addEventListener('online', handler)
}

export const cleanupOnlineListener = (): void => {
  if (!hasWindow() || !onlineListener) return

  window.removeEventListener('online', onlineListener)
  onlineListener = null
}
