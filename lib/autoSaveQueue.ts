export interface SaveQueueItem {
  id: string
  type: 'lesson' | 'document'
  lessonId: string
  payload: { markdown?: string; requirements?: any; content?: string; docId?: string }
  timestamp: number
}

export const SAVE_QUEUE_STORAGE_KEY = 'steam-lesson-save-queue'

let onlineListener: ((event: Event) => void) | null = null

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const isQuotaExceededError = (error: unknown) => {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.code === 22 ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

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

const readQueueFromStorage = (): SaveQueueItem[] => {
  if (!isBrowser()) return []

  try {
    const raw = localStorage.getItem(SAVE_QUEUE_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(SAVE_QUEUE_STORAGE_KEY)
      return []
    }

    const validItems = parsed.filter(isValidQueueItem)

    return validItems
  } catch (error) {
    console.error('[autoSaveQueue] Failed to read queue:', error)
    localStorage.removeItem(SAVE_QUEUE_STORAGE_KEY)
    return []
  }
}

const persistQueue = (queue: SaveQueueItem[]): SaveQueueItem[] => {
  if (!isBrowser()) return queue

  try {
    localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify(queue))
    return queue
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('[autoSaveQueue] localStorage quota exceeded, trimming oldest item')
      const trimmedQueue = queue.length > 1 ? queue.slice(1) : queue
      if (trimmedQueue.length < queue.length) {
        try {
          localStorage.setItem(SAVE_QUEUE_STORAGE_KEY, JSON.stringify(trimmedQueue))
          return trimmedQueue
        } catch (innerError) {
          console.error('[autoSaveQueue] Failed to persist trimmed queue:', innerError)
          return trimmedQueue
        }
      }
      return queue
    }

    console.error('[autoSaveQueue] Failed to persist queue:', error)
    return queue
  }
}

export const getQueue = (): SaveQueueItem[] => {
  return readQueueFromStorage()
}

export const enqueueSave = (
  item: Omit<SaveQueueItem, 'id' | 'timestamp'>,
): SaveQueueItem | null => {
  if (!isBrowser()) return null

  const newItem: SaveQueueItem = { ...item, id: generateId(), timestamp: Date.now() }
  const queue = [...readQueueFromStorage(), newItem]

  const persistedQueue = persistQueue(queue)
  return persistedQueue.find((entry) => entry.id === newItem.id) || null
}

export const dequeueSave = (id: string): void => {
  if (!isBrowser()) return

  const queue = readQueueFromStorage()
  const filtered = queue.filter((item) => item.id !== id)

  if (filtered.length !== queue.length) {
    persistQueue(filtered)
  }
}

export const clearQueue = (): void => {
  if (!isBrowser()) return

  persistQueue([])
}

export const setupOnlineListener = (retryFn: () => Promise<void>): void => {
  if (!isBrowser()) return

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
  if (!isBrowser() || !onlineListener) return

  window.removeEventListener('online', onlineListener)
  onlineListener = null
}
