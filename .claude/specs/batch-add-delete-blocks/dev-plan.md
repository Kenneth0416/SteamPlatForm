# Development Plan: Batch add_blocks & delete_blocks

## Overview
Replace singular `add_block` and `delete_block` tools with batched versions `add_blocks` and `delete_blocks` to match the existing `edit_blocks` pattern, improving performance by reducing LLM call overhead.

## Tasks

### Task 1: Extend ReadWriteGuard with batch delete validation
**Type:** default  
**Priority:** High  
**Estimated Effort:** 1 hour

**Files:**
- `lib/editor/tools/middleware.ts`
- `__tests__/editor/tools/middleware.test.ts`

**Description:**
Add `canDeleteBlocks(blockIds: string[])` method to ReadWriteGuard following the pattern of `canEditBlocks()` (middleware.ts:50-64).

**Acceptance Criteria:**
- Method returns `{allowed: boolean, errors: Map<string, string>}`
- Each block checked individually via `canDelete()`
- Returns `allowed=false` if any block fails
- Error map contains specific block-level errors
- Test coverage ≥90%

**Test Command:**
```bash
npm test __tests__/editor/tools/middleware.test.ts
```

---

### Task 2: Implement add_blocks and delete_blocks tools
**Type:** default  
**Priority:** High  
**Estimated Effort:** 2 hours  
**Dependencies:** Task 1

**Files:**
- `lib/editor/tools/index.ts` (lines 126-206: replace createAddBlockTool & createDeleteBlockTool)

**Description:**
Replace singular tools with batch versions:
- `createAddBlocksTool`: accepts `additions` array (max 25)
- `createDeleteBlocksTool`: accepts `deletions` array (max 25)
- Both return `{results: [{ok, diffId?, error?}]}` format

**Acceptance Criteria:**
- `add_blocks` validates non-empty content per addition
- `add_blocks` handles `afterBlockId=null` as `'__start__'`
- `delete_blocks` calls `canDeleteBlocks()` for batch validation
- Both create PendingDiffs and call `onDiffCreated` callback
- Partial success: continue processing after individual failures
- Update `createEditorTools()` export to use new tools
- Test coverage ≥90%

**Test Command:**
```bash
npm test __tests__/editor/tools/batch-tools.test.ts
```

---

### Task 3: Write comprehensive tests for batch tools
**Type:** default  
**Priority:** High  
**Estimated Effort:** 2 hours  
**Dependencies:** Task 2

**Files:**
- `__tests__/editor/tools/batch-tools.test.ts` (add new test suites)

**Description:**
Add test suites mirroring existing `edit_blocks` pattern:

**add_blocks tests:**
- Batch addition with multiple afterBlockIds
- Empty content rejection
- MAX_BATCH_SIZE=25 limit
- null afterBlockId (insert at start)
- Non-existent afterBlockId error handling
- canAdd() guard check
- onDiffCreated callback verification
- Partial success scenario

**delete_blocks tests:**
- Batch deletion with multiple blockIds
- MAX_BATCH_SIZE=25 limit
- canDeleteBlocks() guard check
- Non-existent blocks error handling
- Effective content overlay with pending diffs
- onDiffCreated callback verification
- Partial success scenario

**Acceptance Criteria:**
- Test coverage ≥90%
- All edge cases covered (empty arrays, oversized batches, guard failures)
- Callback verification for streaming

**Test Command:**
```bash
npm test __tests__/editor/tools/batch-tools.test.ts
```

---

### Task 4: Update System Prompts
**Type:** default  
**Priority:** Medium  
**Estimated Effort:** 30 minutes  
**Dependencies:** Task 2

**Files:**
- `lib/editor/agent.ts` (lines 10-34: SYSTEM_PROMPT, lines 36-56: MULTI_DOC_SYSTEM_PROMPT)

**Description:**
Update both prompts to replace singular tool names with batch versions and add efficiency guidance.

**Changes:**
Replace:
```
- add_block: Add a new block
- delete_block: Remove a block
```

With:
```
- add_blocks: Batch add blocks (max 25)
- delete_blocks: Batch delete blocks (max 25)
```

Add efficiency rule:
```
- Batch ALL add/delete operations in ONE call
```

**Acceptance Criteria:**
- Both SYSTEM_PROMPT and MULTI_DOC_SYSTEM_PROMPT updated
- Tool descriptions emphasize batch usage
- MAX_BATCH_SIZE=25 documented
- No test failures in `__tests__/editor/agent.test.ts`

**Test Command:**
```bash
npm test __tests__/editor/agent.test.ts
```

---

### Task 5: Integration testing and coverage validation
**Type:** default  
**Priority:** High  
**Estimated Effort:** 1 hour  
**Dependencies:** Tasks 1-4

**Files:**
- `__tests__/editor/tools.test.ts` (lines 182-304: update add_block/delete_block tests to batch versions)
- All editor test files

**Description:**
Update legacy tests and validate full test suite passes with ≥90% coverage.

**Acceptance Criteria:**
- Update `tools.test.ts` to test batch tools instead of singular
- All editor tests pass (353 existing test cases + new tests)
- Coverage ≥90% for:
  - `lib/editor/tools/index.ts`
  - `lib/editor/tools/middleware.ts`
  - `lib/editor/agent.ts`
- No regressions in agent behavior

**Test Command:**
```bash
npm test __tests__/editor/ -- --coverage
```

---

## Success Criteria
- ✅ All 5 tasks completed
- ✅ Test coverage ≥90% across all modified files
- ✅ 0 test failures in full editor test suite
- ✅ System Prompts updated to use batch tools
- ✅ Singular `add_block`/`delete_block` completely removed

## Rollout Plan
1. Merge to main branch
2. Monitor agent behavior in production (7 days)
3. Validate LLM correctly uses batch operations
4. Document performance improvements (LLM call reduction)
