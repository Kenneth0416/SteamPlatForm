'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { LessonRequirements } from '@/types/lesson'
import type { EditorDocument } from '@/lib/editor/types'
import { saveLesson } from '@/lib/api'
import { updateDocument } from '@/lib/editor/api'
import {
  cleanupOnlineListener,
  dequeueSave,
  enqueueSave,
  getQueue,
  setupOnlineListener,
} from '@/lib/autoSaveQueue'
import { useEditorStore } from '@/stores/editorStore'
import { useToast } from './use-toast'

interface UseAutoSaveProps {
  currentLesson: string
  currentRequirements: LessonRequirements | null
  currentLessonId?: string
  streamingDocId: string | null
  enabled?: boolean // default true
}

const DEBOUNCE_MS = 5000

const serializeRequirements = (req: LessonRequirements | null) =>
  req ? JSON.stringify(req) : 'null'

export function useAutoSave({
  currentLesson,
  currentRequirements,
  currentLessonId,
  streamingDocId,
  enabled = true,
}: UseAutoSaveProps): void {
  const { documents, isSaving, setSaving, markDocumentsClean } = useEditorStore()
  const { toast } = useToast()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedLessonRef = useRef<string>(currentLesson)
  const lastSavedRequirementsRef = useRef<LessonRequirements | null>(currentRequirements)
  const lastLessonIdRef = useRef<string | undefined>(currentLessonId)

  useEffect(() => {
    if (lastLessonIdRef.current !== currentLessonId) {
      lastLessonIdRef.current = currentLessonId
      lastSavedLessonRef.current = currentLesson
      lastSavedRequirementsRef.current = currentRequirements
    }
  }, [currentLesson, currentLessonId, currentRequirements])

  const queueFailedSaves = useCallback(
    (shouldQueueLesson: boolean, failedDocs: EditorDocument[]) => {
      const lessonIdForQueue = currentLessonId || lastLessonIdRef.current || 'unsaved'

      if (shouldQueueLesson && currentRequirements) {
        enqueueSave({
          type: 'lesson',
          lessonId: lessonIdForQueue,
          payload: { markdown: currentLesson, requirements: currentRequirements },
        })
      }

      failedDocs.forEach((doc) => {
        enqueueSave({
          type: 'document',
          lessonId: lessonIdForQueue,
          payload: { docId: doc.id, content: doc.content },
        })
      })
    },
    [currentLesson, currentLessonId, currentRequirements],
  )

  const retryQueuedSaves = useCallback(async () => {
    if (streamingDocId || useEditorStore.getState().isSaving) return

    const queued = getQueue()
    if (queued.length === 0) return

    const cleanedDocIds: string[] = []
    setSaving(true)

    try {
      for (const item of queued) {
        try {
          if (item.type === 'lesson') {
            const { markdown, requirements } = item.payload
            if (!markdown || !requirements) continue

            const result = await saveLesson(markdown, requirements, item.lessonId)
            if (result && result !== 'auth_required') {
              lastSavedLessonRef.current = markdown
              lastSavedRequirementsRef.current = requirements
              lastLessonIdRef.current = item.lessonId || result?.id || lastLessonIdRef.current
              dequeueSave(item.id)
            }
          } else {
            const { docId, content } = item.payload
            if (!docId || typeof content !== 'string') continue

            await updateDocument(docId, { content })
            cleanedDocIds.push(docId)
            dequeueSave(item.id)
          }
        } catch {
          // Keep the item in the queue for the next retry attempt
        }
      }
    } finally {
      if (cleanedDocIds.length > 0) {
        markDocumentsClean(cleanedDocIds)
      }
      setSaving(false)
    }
  }, [markDocumentsClean, setSaving, streamingDocId])

  useEffect(() => {
    retryQueuedSaves()
    setupOnlineListener(retryQueuedSaves)
    return () => {
      cleanupOnlineListener()
    }
  }, [retryQueuedSaves])

  const runSave = useCallback(
    async (pendingDocs: EditorDocument[], lessonChanged: boolean) => {
      if (streamingDocId || useEditorStore.getState().isSaving) return

      // Only auto-save lesson if we have an existing lessonId (don't auto-create new lessons)
      const needsLessonSave = Boolean(currentLessonId) && Boolean(currentRequirements) && lessonChanged
      if (!needsLessonSave && pendingDocs.length === 0) return

      setSaving(true)

      let lessonFailed = false
      const failedDocs: EditorDocument[] = []
      const savedDocIds: string[] = []

      if (needsLessonSave && currentRequirements) {
        try {
          const result = await saveLesson(currentLesson, currentRequirements, currentLessonId)
          if (result && result !== 'auth_required') {
            lastSavedLessonRef.current = currentLesson
            lastSavedRequirementsRef.current = currentRequirements
            lastLessonIdRef.current = currentLessonId || result?.id || lastLessonIdRef.current
          } else {
            lessonFailed = true
          }
        } catch {
          lessonFailed = true
        }
      }

      for (const doc of pendingDocs) {
        try {
          await updateDocument(doc.id, { content: doc.content })
          savedDocIds.push(doc.id)
        } catch {
          failedDocs.push(doc)
        }
      }

      if (savedDocIds.length > 0) {
        markDocumentsClean(savedDocIds)
      }

      if (lessonFailed || failedDocs.length > 0) {
        queueFailedSaves(lessonFailed, failedDocs)
        toast({
          title: 'Auto-save failed',
          description: 'Changes will be retried when you are back online.',
          variant: 'destructive',
        })
      }

      setSaving(false)
    },
    [
      currentLesson,
      currentLessonId,
      currentRequirements,
      markDocumentsClean,
      queueFailedSaves,
      setSaving,
      streamingDocId,
      toast,
    ],
  )

  useEffect(() => {
    if (!enabled) {
      /* istanbul ignore next */
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      return
    }

    const dirtyDocs = documents.filter((doc) => doc.isDirty)
    const requirementsChanged =
      serializeRequirements(currentRequirements) !== serializeRequirements(lastSavedRequirementsRef.current)
    const lessonChanged = currentLesson !== lastSavedLessonRef.current || requirementsChanged

    if (streamingDocId || isSaving || (!lessonChanged && dirtyDocs.length === 0)) {
      return
    }

    /* istanbul ignore next */
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      runSave(dirtyDocs, lessonChanged)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [
    currentLesson,
    currentRequirements,
    documents,
    enabled,
    isSaving,
    runSave,
    streamingDocId,
  ])
}
