import type { EditorDocument } from './types'
import type { Lang } from '@/types/lesson'

const BASE_URL = '/api/editor/documents'

export async function fetchDocuments(lessonId: string): Promise<EditorDocument[]> {
  const res = await fetch(`${BASE_URL}?lessonId=${lessonId}`)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export async function createDocument(
  lessonId: string,
  name: string,
  type: string,
  content = ''
): Promise<EditorDocument> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId, name, type, content }),
  })
  if (!res.ok) throw new Error('Failed to create document')
  return res.json()
}

export async function updateDocument(
  id: string,
  data: { name?: string; content?: string }
): Promise<EditorDocument> {
  const res = await fetch(BASE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error('Failed to update document')
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}?id=${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete document')
}

export interface GenerateDocumentStreamParams {
  templateKey: string
  lessonId: string
  lang: Lang
  existingDocuments: { name: string; content: string }[]
}

export interface GenerateDocumentStreamResult {
  name: string
  type: string
}

export async function generateDocumentStream(
  params: GenerateDocumentStreamParams,
  onChunk: (text: string) => void,
  onComplete: (result: GenerateDocumentStreamResult) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      throw new Error('Failed to generate document')
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let docMeta: GenerateDocumentStreamResult | null = null
    let completed = false

    const processBuffer = (flush = false) => {
      const parts = buffer.split('\n')
      buffer = flush ? '' : parts.pop() || ''
      const lines = flush && buffer ? [...parts, buffer] : parts

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') {
          if (docMeta) {
            onComplete(docMeta)
          } else {
            onError(new Error('Stream ended without metadata'))
          }
          completed = true
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            onError(new Error(parsed.error))
            completed = true
            return
          }
          if (parsed.done && parsed.name) {
            docMeta = { name: parsed.name, type: parsed.type }
          } else if (typeof parsed.text === 'string') {
            onChunk(parsed.text)
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    while (!completed) {
      const { done, value } = await reader.read()
      if (value) {
        buffer += decoder.decode(value, { stream: !done })
        processBuffer()
      }
      if (done) break
    }

    if (!completed) {
      buffer += decoder.decode()
      processBuffer(true)
    }

    if (!completed) {
      if (docMeta) {
        onComplete(docMeta)
      } else {
        onError(new Error('Stream ended without completion signal'))
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}
