'use client'

import { generateWordDiff } from '@/lib/editor/diff'
import type { PendingDiff, DiffChange } from '@/lib/editor/types'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiffItemProps {
  diff: PendingDiff
  onApply: () => void
  onReject: () => void
}

function DiffContent({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const changes = generateWordDiff(oldContent, newContent)

  return (
    <div className="font-mono text-sm whitespace-pre-wrap">
      {changes.map((change, i) => (
        <span
          key={i}
          className={cn(
            change.type === 'add' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            change.type === 'remove' && 'bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300'
          )}
        >
          {change.value}
        </span>
      ))}
    </div>
  )
}

export function DiffItem({ diff, onApply, onReject }: DiffItemProps) {
  const actionLabel = {
    update: 'Edit',
    add: 'Add',
    delete: 'Delete',
  }[diff.action]

  const actionColor = {
    update: 'text-yellow-600 dark:text-yellow-400',
    add: 'text-green-600 dark:text-green-400',
    delete: 'text-red-600 dark:text-red-400',
  }[diff.action]

  return (
    <div className="border rounded-lg p-4 mb-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', actionColor)}>
            {actionLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            Block: {diff.blockId}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button size="sm" onClick={onApply}>
            <Check className="h-4 w-4 mr-1" />
            Apply
          </Button>
        </div>
      </div>

      {diff.reason && (
        <p className="text-sm text-muted-foreground mb-3 italic">
          {diff.reason}
        </p>
      )}

      <div className="border rounded p-3 bg-muted/50">
        {diff.action === 'delete' ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
            <span className="text-red-800 dark:text-red-300 line-through">
              {diff.oldContent}
            </span>
          </div>
        ) : diff.action === 'add' ? (
          <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
            <span className="text-green-800 dark:text-green-300">
              {(() => {
                try {
                  const parsed = JSON.parse(diff.newContent)
                  return parsed.content
                } catch {
                  return diff.newContent
                }
              })()}
            </span>
          </div>
        ) : (
          <DiffContent oldContent={diff.oldContent} newContent={diff.newContent} />
        )}
      </div>
    </div>
  )
}
