import { ReadWriteGuard } from '../../../lib/editor/tools/middleware'

describe('ReadWriteGuard', () => {
  let guard: ReadWriteGuard

  beforeEach(() => {
    guard = new ReadWriteGuard()
  })

  describe('markBlocksRead', () => {
    it('should mark multiple blocks as read', () => {
      guard.markBlocksRead(['block-1', 'block-2', 'block-3'])

      expect(guard.hasReadBlock('block-1')).toBe(true)
      expect(guard.hasReadBlock('block-2')).toBe(true)
      expect(guard.hasReadBlock('block-3')).toBe(true)
      expect(guard.hasReadBlock('block-4')).toBe(false)
    })

    it('should handle empty array', () => {
      guard.markBlocksRead([])
      expect(guard.hasReadBlock('block-1')).toBe(false)
    })

    it('should handle duplicate IDs', () => {
      guard.markBlocksRead(['block-1', 'block-1', 'block-1'])
      expect(guard.hasReadBlock('block-1')).toBe(true)
    })
  })

  describe('hasReadBlocks', () => {
    it('should return true if all blocks are read', () => {
      guard.markBlocksRead(['block-1', 'block-2', 'block-3'])
      expect(guard.hasReadBlocks(['block-1', 'block-2'])).toBe(true)
    })

    it('should return false if any block is not read', () => {
      guard.markBlocksRead(['block-1', 'block-2'])
      expect(guard.hasReadBlocks(['block-1', 'block-3'])).toBe(false)
    })

    it('should return true for empty array', () => {
      expect(guard.hasReadBlocks([])).toBe(true)
    })
  })

  describe('canEdit', () => {
    it('should return error if document not read', () => {
      const result = guard.canEdit('block-1')

      expect(result.allowed).toBe(false)
      expect(result.error).toContain('list_blocks')
      expect(result.error).toContain('Use list_blocks to see document structure first')
    })

    it('should return error if block not read', () => {
      guard.markDocumentRead()
      const result = guard.canEdit('block-1')

      expect(result.allowed).toBe(false)
      expect(result.error).toContain('read_blocks')
      expect(result.error).toContain('block-1')
    })

    it('should return allowed=true if block is read', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')

      const result = guard.canEdit('block-1')

      expect(result.allowed).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('canDelete', () => {
    it('should return error if document not read', () => {
      const result = guard.canDelete('block-1')

      expect(result.allowed).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return error if block not read', () => {
      guard.markDocumentRead()
      const result = guard.canDelete('block-1')

      expect(result.allowed).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return allowed=true if block is read', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')

      const result = guard.canDelete('block-1')

      expect(result.allowed).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('canAdd', () => {
    it('should return error if document not read', () => {
      const result = guard.canAdd()

      expect(result.allowed).toBe(false)
      expect(result.error).toContain('list_blocks')
    })

    it('should return allowed=true if document is read', () => {
      guard.markDocumentRead()
      const result = guard.canAdd()

      expect(result.allowed).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('canEditBlocks', () => {
    it('should return errors for all blocks if document not read', () => {
      const result = guard.canEditBlocks(['block-1', 'block-2'])

      expect(result.allowed).toBe(false)
      expect(result.errors.size).toBe(2)
      expect(result.errors.get('block-1')).toContain('list_blocks')
      expect(result.errors.get('block-2')).toContain('list_blocks')
    })

    it('should return errors for unread blocks', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')

      const result = guard.canEditBlocks(['block-1', 'block-2', 'block-3'])

      expect(result.allowed).toBe(false)
      expect(result.errors.size).toBe(2)
      expect(result.errors.has('block-1')).toBe(false)
      expect(result.errors.get('block-2')).toContain('read_block')
      expect(result.errors.get('block-3')).toContain('read_block')
    })

    it('should return allowed=true if all blocks are read', () => {
      guard.markDocumentRead()
      guard.markBlocksRead(['block-1', 'block-2'])

      const result = guard.canEditBlocks(['block-1', 'block-2'])

      expect(result.allowed).toBe(true)
      expect(result.errors.size).toBe(0)
    })

    it('should return allowed=true for empty array', () => {
      guard.markDocumentRead()
      const result = guard.canEditBlocks([])
      expect(result.allowed).toBe(true)
    })
  })

  describe('canDeleteBlocks', () => {
    it('should return errors for all blocks if document not read', () => {
      const result = guard.canDeleteBlocks(['block-1', 'block-2'])

      expect(result.allowed).toBe(false)
      expect(result.errors.size).toBe(2)
      expect(result.errors.get('block-1')).toContain('list_blocks')
      expect(result.errors.get('block-2')).toContain('list_blocks')
    })

    it('should return errors for unread blocks', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')

      const result = guard.canDeleteBlocks(['block-1', 'block-2', 'block-3'])

      expect(result.allowed).toBe(false)
      expect(result.errors.size).toBe(2)
      expect(result.errors.has('block-1')).toBe(false)
      expect(result.errors.get('block-2')).toContain('read_block')
      expect(result.errors.get('block-3')).toContain('read_block')
    })

    it('should return allowed=true if all blocks are read', () => {
      guard.markDocumentRead()
      guard.markBlocksRead(['block-1', 'block-2'])

      const result = guard.canDeleteBlocks(['block-1', 'block-2'])

      expect(result.allowed).toBe(true)
      expect(result.errors.size).toBe(0)
    })

    it('should return allowed=true for empty array', () => {
      guard.markDocumentRead()
      const result = guard.canDeleteBlocks([])
      expect(result.allowed).toBe(true)
    })

    it('should handle mixed read and unread blocks', () => {
      guard.markDocumentRead()
      guard.markBlocksRead(['block-1', 'block-3'])

      const result = guard.canDeleteBlocks(['block-1', 'block-2', 'block-3', 'block-4'])

      expect(result.allowed).toBe(false)
      expect(result.errors.size).toBe(2)
      expect(result.errors.has('block-1')).toBe(false)
      expect(result.errors.has('block-3')).toBe(false)
      expect(result.errors.get('block-2')).toContain('read_block')
      expect(result.errors.get('block-4')).toContain('read_block')
    })

    it('should return specific error message for document not read', () => {
      const result = guard.canDeleteBlocks(['block-1'])

      expect(result.allowed).toBe(false)
      expect(result.errors.get('block-1')).toBe('Must call list_blocks before deleting.')
    })

    it('should return specific error message for block not read', () => {
      guard.markDocumentRead()
      const result = guard.canDeleteBlocks(['block-1'])

      expect(result.allowed).toBe(false)
      expect(result.errors.get('block-1')).toBe('Must call read_blocks first.')
    })
  })

  describe('reset', () => {
    it('should clear all read blocks', () => {
      guard.markDocumentRead()
      guard.markBlocksRead(['block-1', 'block-2'])

      guard.reset()

      expect(guard.hasReadDocument()).toBe(false)
      expect(guard.hasReadBlock('block-1')).toBe(false)
      expect(guard.hasReadBlock('block-2')).toBe(false)
    })
  })

  describe('onDocumentChange', () => {
    it('should clear all read state', () => {
      guard.markDocumentRead()
      guard.markBlocksRead(['block-1', 'block-2'])

      guard.onDocumentChange()

      expect(guard.hasReadDocument()).toBe(false)
      expect(guard.hasReadBlock('block-1')).toBe(false)
    })
  })
})
