'use client'

import type { PendingDiff } from '@/lib/editor/types'
import { DiffItem } from './DiffItem'
import { Button } from '@/components/ui/button'
import { CheckCheck, XCircle } from 'lucide-react'

interface DiffViewerProps {
  diffs: PendingDiff[]
  onApply: (diffId: string) => void
  onReject: (diffId: string) => void
  onApplyAll: () => void
  onRejectAll: () => void
}

export function DiffViewer({
  diffs,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll,
}: DiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No pending changes
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {diffs.length > 1 && (
        <div className="flex gap-2 pb-2 border-b">
          <Button variant="outline" size="sm" onClick={onRejectAll}>
            <XCircle className="h-4 w-4 mr-1" />
            Reject All ({diffs.length})
          </Button>
          <Button size="sm" onClick={onApplyAll}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Apply All ({diffs.length})
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {diffs.map(diff => (
          <DiffItem
            key={diff.id}
            diff={diff}
            onApply={() => onApply(diff.id)}
            onReject={() => onReject(diff.id)}
          />
        ))}
      </div>
    </div>
  )
}
