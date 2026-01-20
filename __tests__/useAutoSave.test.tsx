import React from 'react'
import { act, render } from '@testing-library/react'
import type { LessonRequirements } from '@/types/lesson'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useEditorStore } from '@/stores/editorStore'
import { saveLesson } from '@/lib/api'
import { updateDocument } from '@/lib/editor/api'
import {
  enqueueSave,
  dequeueSave,
  getQueue,
  setupOnlineListener,
  cleanupOnlineListener,
} from '@/lib/autoSaveQueue'
import { toast as toastMock } from '@/hooks/use-toast'

jest.mock('unified', () => ({
  unified: () => ({
    use: jest.fn().mockReturnThis(),
    parse: jest.fn(() => ({ type: 'root', children: [] })),
  }),
}))
jest.mock('remark-parse', () => jest.fn())
jest.mock('remark-stringify', () => jest.fn())

jest.mock('@/lib/api', () => ({
  saveLesson: jest.fn(),
}))

jest.mock('@/lib/editor/api', () => ({
  updateDocument: jest.fn(),
}))

jest.mock('@/hooks/use-toast', () => {
  const toast = jest.fn()
  return {
    useToast: () => ({ toast }),
    toast,
  }
})

jest.mock('@/lib/autoSaveQueue', () => ({
  enqueueSave: jest.fn().mockResolvedValue(null),
  dequeueSave: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockResolvedValue([]),
  setupOnlineListener: jest.fn(),
  cleanupOnlineListener: jest.fn(),
}))

const requirements: LessonRequirements = {
  gradeLevel: 'p4-6',
  numberOfSessions: 2,
  durationPerSession: 45,
  classSize: 25,
  steamDomains: ['S', 'T'],
  lessonTopic: 'Robotics',
  schoolThemes: ['Innovation'],
  teachingApproach: 'project',
  difficultyLevel: 'intermediate',
}

const createDoc = (id: string, content: string, isDirty = true) => ({
  id,
  name: `Doc-${id}`,
  type: 'lesson' as const,
  content,
  blocks: [],
  isDirty,
  createdAt: new Date(),
})

const TestComponent = (props: Partial<Parameters<typeof useAutoSave>[0]>) => {
  useAutoSave({
    currentLesson: 'Updated lesson',
    currentRequirements: requirements,
    currentLessonId: 'lesson-1',
    streamingDocId: null,
    enabled: true,
    ...props,
  })
  return null
}

const DefaultEnabledComponent = (props: Omit<Parameters<typeof useAutoSave>[0], 'enabled'>) => {
  useAutoSave(props)
  return null
}

describe('useAutoSave', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()
    useEditorStore.getState().reset()
    ;(getQueue as jest.Mock).mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  const advanceTimers = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms)
      await Promise.resolve()
    })
  }

  it('triggers save after 5 seconds of inactivity', async () => {
    useEditorStore.setState({
      documents: [createDoc('doc-1', 'Draft')],
      activeDocId: 'doc-1',
    })
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'lesson-1' })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    // First render with initial content
    const { rerender } = render(<TestComponent currentLesson="Initial lesson" />)

    // Change content to trigger lessonChanged
    rerender(<TestComponent currentLesson="Changed lesson content" />)

    expect(saveLesson).not.toHaveBeenCalled()

    await advanceTimers(5000)

    expect(updateDocument).toHaveBeenCalledWith('doc-1', { content: 'Draft' })
  })

  it('uses the default enabled flag when omitted', async () => {
    useEditorStore.setState({
      documents: [createDoc('doc-1', 'Draft')],
      activeDocId: 'doc-1',
    })
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'lesson-1' })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    render(
      <DefaultEnabledComponent
        currentLesson="Changed lesson content"
        currentRequirements={requirements}
        currentLessonId="lesson-1"
        streamingDocId={null}
      />,
    )

    await advanceTimers(5000)

    expect(updateDocument).toHaveBeenCalledWith('doc-1', { content: 'Draft' })
  })

  it('resets the debounce timer when content changes before firing', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Draft')] })
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'lesson-1' })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    const { rerender } = render(<TestComponent currentLesson="First" />)

    await advanceTimers(1000)
    rerender(<TestComponent currentLesson="Second" />)

    await advanceTimers(4000)
    expect(saveLesson).not.toHaveBeenCalled()

    await advanceTimers(1000)
    expect(saveLesson).toHaveBeenCalledTimes(1)
    expect(saveLesson).toHaveBeenCalledWith('Second', requirements, 'lesson-1')
  })

  it('skips saving when streaming', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Draft')] })

    render(<TestComponent streamingDocId="streaming" />)
    await advanceTimers(6000)

    expect(saveLesson).not.toHaveBeenCalled()
    expect(updateDocument).not.toHaveBeenCalled()
  })

  it('skips saving when already saving', async () => {
    useEditorStore.setState({
      documents: [createDoc('doc-1', 'Draft')],
      isSaving: true,
    })

    render(<TestComponent />)
    await advanceTimers(6000)

    expect(saveLesson).not.toHaveBeenCalled()
  })

  it('stops scheduling saves when disabled', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Draft')] })
    const { rerender } = render(<TestComponent />)

    rerender(<TestComponent enabled={false} />)
    await advanceTimers(6000)

    expect(saveLesson).not.toHaveBeenCalled()
  })

  it('marks documents clean after successful save', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'lesson-1' })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    render(<TestComponent />)
    await advanceTimers(5000)

    expect(useEditorStore.getState().documents[0].isDirty).toBe(false)
  })

  it('queues failed saves and shows an error toast', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(saveLesson as jest.Mock).mockRejectedValue(new Error('fail'))
    ;(updateDocument as jest.Mock).mockRejectedValue(new Error('network'))

    // First render with initial content, then change to trigger lessonChanged
    const { rerender } = render(<TestComponent currentLesson="Initial" />)
    rerender(<TestComponent currentLesson="Changed lesson" />)
    await advanceTimers(5000)

    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lesson',
        lessonId: 'lesson-1',
      }),
    )
    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document',
        payload: expect.objectContaining({ docId: 'doc-1' }),
      }),
    )
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    )
  })

  it('queues failed documents with an unsaved lesson id fallback', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(updateDocument as jest.Mock).mockRejectedValue(new Error('network'))

    render(<TestComponent currentLessonId={undefined} />)
    await advanceTimers(5000)

    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document',
        lessonId: 'unsaved',
      }),
    )
  })

  it('saves dirty documents when requirements are missing', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    render(<TestComponent currentRequirements={null} />)
    await advanceTimers(5000)

    expect(saveLesson).not.toHaveBeenCalled()
    expect(updateDocument).toHaveBeenCalledWith('doc-1', { content: 'Dirty content' })
  })

  it('queues lesson save when authentication is required', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(saveLesson as jest.Mock).mockResolvedValue('auth_required')
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    // First render with initial content, then change to trigger lessonChanged
    const { rerender } = render(<TestComponent currentLesson="Initial" />)
    rerender(<TestComponent currentLesson="Changed lesson" />)
    await advanceTimers(5000)

    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lesson',
        lessonId: 'lesson-1',
      }),
    )
  })

  it('queues only document saves when lesson save succeeds but docs fail', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'lesson-1' })
    ;(updateDocument as jest.Mock).mockRejectedValue(new Error('network'))

    // First render with initial content, then change to trigger lessonChanged
    const { rerender } = render(<TestComponent currentLesson="Initial" />)
    rerender(<TestComponent currentLesson="Changed lesson" />)
    await advanceTimers(5000)

    expect(enqueueSave).toHaveBeenCalledTimes(1)
    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document',
        payload: expect.objectContaining({ docId: 'doc-1' }),
      }),
    )
  })

  it('skips lesson save when no lessonId is provided (only saves dirty docs)', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-1' })

    render(<TestComponent currentLessonId={undefined} />)
    await advanceTimers(5000)

    // Should not attempt to save lesson without lessonId
    expect(saveLesson).not.toHaveBeenCalled()
    // Should still save dirty documents
    expect(updateDocument).toHaveBeenCalledWith('doc-1', { content: 'Dirty content' })
  })

  it('resets last saved snapshots when lesson id changes', async () => {
    useEditorStore.setState({ documents: [] })
    const { rerender } = render(
      <TestComponent currentLesson="First lesson" currentLessonId="lesson-1" />,
    )

    rerender(
      <TestComponent
        currentLesson="Second lesson"
        currentLessonId="lesson-2"
        currentRequirements={{ ...requirements, lessonTopic: 'Math' }}
      />,
    )

    await advanceTimers(6000)
    expect(saveLesson).not.toHaveBeenCalled()
  })

  it('skips queued retries when already saving', async () => {
    useEditorStore.setState({ isSaving: true })
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: '',
        payload: { markdown: 'Queued lesson', requirements },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])

    render(<TestComponent enabled={false} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(getQueue).not.toHaveBeenCalled()
    expect(saveLesson).not.toHaveBeenCalled()
  })

  it('retries queued saves when available and cleans up listeners', async () => {
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: 'queued-lesson',
        payload: { markdown: 'Queued lesson', requirements },
        timestamp: Date.now(),
      },
      {
        id: 'q-doc',
        type: 'document' as const,
        lessonId: 'queued-lesson',
        payload: { docId: 'doc-queued', content: 'From queue' },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'queued-lesson' })
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-queued' })

    const { unmount } = render(<TestComponent enabled={false} />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(saveLesson).toHaveBeenCalledWith('Queued lesson', requirements, 'queued-lesson')
    expect(updateDocument).toHaveBeenCalledWith('doc-queued', { content: 'From queue' })
    expect(dequeueSave).toHaveBeenCalledTimes(2)
    expect(setupOnlineListener).toHaveBeenCalledTimes(1)

    unmount()
    expect(cleanupOnlineListener).toHaveBeenCalled()
  })

  it('skips queued retries while streaming', async () => {
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: 'queued-lesson',
        payload: { markdown: 'Queued lesson', requirements },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])

    render(<TestComponent streamingDocId="streaming-doc" enabled={false} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(saveLesson).not.toHaveBeenCalled()
  })

  it('uses returned ids when queued lessons are missing identifiers', async () => {
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: '',
        payload: { markdown: 'Queued lesson', requirements },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'from-result' })

    render(<TestComponent enabled={false} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(saveLesson).toHaveBeenCalledWith('Queued lesson', requirements, '')
    expect(dequeueSave).toHaveBeenCalledWith('q-lesson')
  })

  it('reuses queued lesson ids for later failures', async () => {
    useEditorStore.setState({ documents: [createDoc('doc-1', 'Dirty content')] })
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: '',
        payload: { markdown: 'Queued lesson', requirements },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])
    ;(saveLesson as jest.Mock).mockResolvedValue({ id: 'from-result' })
    ;(updateDocument as jest.Mock).mockRejectedValue(new Error('network'))

    render(<TestComponent currentLessonId={undefined} enabled={true} />)
    await act(async () => {
      await Promise.resolve()
    })

    await advanceTimers(5000)

    expect(enqueueSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document',
        lessonId: 'from-result',
      }),
    )
  })

  it('skips invalid queued document payloads', async () => {
    const queuedItems = [
      {
        id: 'q-doc-invalid',
        type: 'document' as const,
        lessonId: 'queued-lesson',
        payload: { docId: '', content: 123 },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])

    render(<TestComponent enabled={false} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(updateDocument).not.toHaveBeenCalled()
    expect(dequeueSave).not.toHaveBeenCalled()
  })

  it('ignores invalid queued lesson payloads', async () => {
    const queuedItems = [
      {
        id: 'q-lesson',
        type: 'lesson' as const,
        lessonId: 'queued-lesson',
        payload: { markdown: '', requirements: null },
        timestamp: Date.now(),
      },
      {
        id: 'q-doc',
        type: 'document' as const,
        lessonId: 'queued-lesson',
        payload: { docId: 'doc-queued', content: 'From queue' },
        timestamp: Date.now(),
      },
    ]
    ;(getQueue as jest.Mock).mockResolvedValueOnce(queuedItems).mockResolvedValue([])
    ;(updateDocument as jest.Mock).mockResolvedValue({ id: 'doc-queued' })

    render(<TestComponent enabled={false} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(saveLesson).not.toHaveBeenCalled()
    expect(dequeueSave).toHaveBeenCalledTimes(1)
    expect(dequeueSave).toHaveBeenCalledWith('q-doc')
  })
})
