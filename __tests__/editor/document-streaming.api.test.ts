import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  generateDocumentStream,
  updateDocument,
  type GenerateDocumentStreamParams,
} from '@/lib/editor/api'
import type { Lang } from '@/types/lesson'

const encoder = new TextEncoder()
const params: GenerateDocumentStreamParams = {
  templateKey: 'worksheet',
  lessonId: 'lesson-1',
  lang: 'en' as Lang,
  existingDocuments: [],
}

function createStreamResponse(chunks: string[], status = 200) {
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })
  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
  } as Response
}

describe('generateDocumentStream', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('performs document CRUD requests and bubbles failures', async () => {
    const mockJson = jest.fn().mockResolvedValue([{ id: 'doc-1' }])
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: mockJson }) as any

    const docs = await fetchDocuments('lesson-1')

    expect(global.fetch).toHaveBeenCalledWith('/api/editor/documents?lessonId=lesson-1')
    expect(docs).toEqual([{ id: 'doc-1' }])

    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any

    await expect(fetchDocuments('oops')).rejects.toThrow('Failed to fetch documents')
    await expect(createDocument('l', 'name', 'type')).rejects.toThrow('Failed to create document')
    await expect(updateDocument('id', {})).rejects.toThrow('Failed to update document')
    await expect(deleteDocument('id')).rejects.toThrow('Failed to delete document')
  })

  it('posts, updates, and deletes documents with payloads', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ id: 'created' }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ id: 'updated' }) })
      .mockResolvedValueOnce({ ok: true }) as any

    const created = await createDocument('lesson-x', 'Doc', 'custom', 'seed')
    const updated = await updateDocument('doc-1', { content: 'next' })
    await deleteDocument('gone')

    expect(global.fetch).toHaveBeenCalledWith('/api/editor/documents', expect.objectContaining({ method: 'POST' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/editor/documents', expect.objectContaining({ method: 'PUT' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/editor/documents?id=gone', { method: 'DELETE' })
    expect(created.id).toBe('created')
    expect(updated.id).toBe('updated')
  })

  it('decodes incremental SSE chunks and completes when the done marker arrives last', async () => {
    const onChunk = jest.fn()
    const onComplete = jest.fn()
    const onError = jest.fn()

    global.fetch = jest.fn().mockResolvedValue(
      createStreamResponse([
        'data: {"text":"Hello"}\n',
        'data: {"text":" wor',
        'ld"}\n\ndata: {"done":true,"name":"Doc","type":"lesson"}\n\ndata: [DONE]',
      ])
    ) as any

    await generateDocumentStream(params, onChunk, onComplete, onError)

    expect(onChunk).toHaveBeenCalledWith('Hello')
    expect(onChunk).toHaveBeenCalledWith(' world')
    expect(onComplete).toHaveBeenCalledWith({ name: 'Doc', type: 'lesson' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('surfaces stream errors and halts further decoding', async () => {
    const onChunk = jest.fn()
    const onComplete = jest.fn()
    const onError = jest.fn()

    global.fetch = jest.fn().mockResolvedValue(
      createStreamResponse([
        'data: {"text":"start"}\n',
        'data: {"error":"boom"}\n',
        'data: {"text":"after"}\n',
      ])
    ) as any

    await generateDocumentStream(params, onChunk, onComplete, onError)

    expect(onChunk).toHaveBeenCalledWith('start')
    expect(onChunk).not.toHaveBeenCalledWith('after')
    expect(onComplete).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toContain('boom')
  })

  it('fails fast when the request is rejected', async () => {
    const onError = jest.fn()
    global.fetch = jest.fn().mockResolvedValue(createStreamResponse([], 500)) as any

    await generateDocumentStream(params, jest.fn(), jest.fn(), onError)

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('reports when the stream finishes without metadata', async () => {
    const onError = jest.fn()
    global.fetch = jest.fn().mockResolvedValue(createStreamResponse(['data: [DONE]'])) as any

    await generateDocumentStream(params, jest.fn(), jest.fn(), onError)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Stream ended without metadata' }))
  })

  it('completes when metadata arrives without a done marker', async () => {
    const onComplete = jest.fn()
    global.fetch = jest.fn().mockResolvedValue(
      createStreamResponse([
        'data: {"done":true,"name":"Doc","type":"lesson"}',
      ])
    ) as any

    await generateDocumentStream(params, jest.fn(), onComplete, jest.fn())

    expect(onComplete).toHaveBeenCalledWith({ name: 'Doc', type: 'lesson' })
  })

  it('errors when the stream ends without completion signals', async () => {
    const onError = jest.fn()
    global.fetch = jest.fn().mockResolvedValue(createStreamResponse(['data: {"text":"tail"}'])) as any

    await generateDocumentStream(params, jest.fn(), jest.fn(), onError)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Stream ended without completion signal' }))
  })
})
