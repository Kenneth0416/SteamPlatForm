// Tracks which blocks have been read in the current session
// Enforces read-before-write constraint for LLM tools

export class ReadWriteGuard {
  private readBlocks: Set<string> = new Set()
  private documentRead: boolean = false

  markDocumentRead(): void {
    this.documentRead = true
  }

  markBlockRead(blockId: string): void {
    this.readBlocks.add(blockId)
  }

  markBlocksRead(blockIds: string[]): void {
    for (const id of blockIds) {
      this.readBlocks.add(id)
    }
  }

  hasReadDocument(): boolean {
    return this.documentRead
  }

  hasReadBlock(blockId: string): boolean {
    return this.readBlocks.has(blockId)
  }

  hasReadBlocks(blockIds: string[]): boolean {
    return blockIds.every(id => this.readBlocks.has(id))
  }

  canEdit(blockId: string): { allowed: boolean; error?: string } {
    if (!this.documentRead) {
      return {
        allowed: false,
        error: 'Must call list_blocks before editing. Use list_blocks to see document structure first.',
      }
    }
    if (!this.readBlocks.has(blockId)) {
      return {
        allowed: false,
        error: `Must call read_blocks(["${blockId}"]) before editing. Read the block content first to ensure accurate edits.`,
      }
    }
    return { allowed: true }
  }

  canEditBlocks(blockIds: string[]): { allowed: boolean; errors: Map<string, string> } {
    const errors = new Map<string, string>()
    if (!this.documentRead) {
      for (const id of blockIds) {
        errors.set(id, 'Must call list_blocks before editing.')
      }
      return { allowed: false, errors }
    }
    for (const id of blockIds) {
      if (!this.readBlocks.has(id)) {
        errors.set(id, `Must call read_blocks first.`)
      }
    }
    return { allowed: errors.size === 0, errors }
  }

  canDelete(blockId: string): { allowed: boolean; error?: string } {
    return this.canEdit(blockId)
  }

  canDeleteBlocks(blockIds: string[]): { allowed: boolean; errors: Map<string, string> } {
    const errors = new Map<string, string>()
    if (!this.documentRead) {
      for (const id of blockIds) {
        errors.set(id, 'Must call list_blocks before deleting.')
      }
      return { allowed: false, errors }
    }
    for (const id of blockIds) {
      if (!this.readBlocks.has(id)) {
        errors.set(id, `Must call read_blocks first.`)
      }
    }
    return { allowed: errors.size === 0, errors }
  }

  canAdd(): { allowed: boolean; error?: string } {
    if (!this.documentRead) {
      return {
        allowed: false,
        error: 'Must call list_blocks before adding blocks. Use list_blocks to see document structure first.',
      }
    }
    return { allowed: true }
  }

  reset(): void {
    this.readBlocks.clear()
    this.documentRead = false
  }

  // Called when document content changes
  onDocumentChange(): void {
    this.readBlocks.clear()
    this.documentRead = false
  }
}
