import { ReadWriteGuard } from '@/lib/editor/tools/middleware'

describe('ReadWriteGuard', () => {
  let guard: ReadWriteGuard

  beforeEach(() => {
    guard = new ReadWriteGuard()
  })

  describe('document read tracking', () => {
    it('should initially report document as not read', () => {
      expect(guard.hasReadDocument()).toBe(false)
    })

    it('should track document read', () => {
      guard.markDocumentRead()
      expect(guard.hasReadDocument()).toBe(true)
    })
  })

  describe('block read tracking', () => {
    it('should initially report block as not read', () => {
      expect(guard.hasReadBlock('block-1')).toBe(false)
    })

    it('should track block read', () => {
      guard.markBlockRead('block-1')
      expect(guard.hasReadBlock('block-1')).toBe(true)
    })

    it('should track multiple blocks independently', () => {
      guard.markBlockRead('block-1')
      expect(guard.hasReadBlock('block-1')).toBe(true)
      expect(guard.hasReadBlock('block-2')).toBe(false)
    })
  })

  describe('canEdit', () => {
    it('should deny edit if document not read', () => {
      const result = guard.canEdit('block-1')
      expect(result.allowed).toBe(false)
      expect(result.error).toContain('list_blocks')
    })

    it('should deny edit if block not read', () => {
      guard.markDocumentRead()
      const result = guard.canEdit('block-1')
      expect(result.allowed).toBe(false)
      expect(result.error).toContain('read_block')
    })

    it('should allow edit if both document and block read', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')
      const result = guard.canEdit('block-1')
      expect(result.allowed).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('canDelete', () => {
    it('should follow same rules as canEdit', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')
      const result = guard.canDelete('block-1')
      expect(result.allowed).toBe(true)
    })
  })

  describe('canAdd', () => {
    it('should deny add if document not read', () => {
      const result = guard.canAdd()
      expect(result.allowed).toBe(false)
    })

    it('should allow add if document read', () => {
      guard.markDocumentRead()
      const result = guard.canAdd()
      expect(result.allowed).toBe(true)
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')
      guard.reset()

      expect(guard.hasReadDocument()).toBe(false)
      expect(guard.hasReadBlock('block-1')).toBe(false)
    })
  })

  describe('onDocumentChange', () => {
    it('should clear all state on document change', () => {
      guard.markDocumentRead()
      guard.markBlockRead('block-1')
      guard.onDocumentChange()

      expect(guard.hasReadDocument()).toBe(false)
      expect(guard.hasReadBlock('block-1')).toBe(false)
    })
  })
})
