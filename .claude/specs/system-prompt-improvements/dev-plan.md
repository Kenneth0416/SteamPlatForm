# Development Plan: System Prompt Improvements

## Overview
Implement 6 priority improvements to Editor Agent System Prompts based on code review recommendations (`.claude/reviews/system-prompt-review.md`). Changes are text-only modifications to prompt strings with no runtime behavior changes.

**Expected Impact**:
- 15-20% reduction in failed requests
- 10-15% improvement in batching efficiency
- 5-10% reduction in average token usage
- ~30% reduction in stuck loops

**Risk Level**: LOW (text-only changes, no API modifications)

---

## Tasks

### Task 1: High Priority - Tool Description Alignment + Error Recovery
**Type**: quick-fix
**Priority**: High
**Estimated Effort**: 15 minutes
**Dependencies**: None

**Files**:
- `lib/editor/agent.ts:30-35` - SYSTEM_PROMPT Available tools section
- `lib/editor/agent.ts:55-58` - MULTI_DOC_SYSTEM_PROMPT Available tools section
- `lib/editor/agent.ts:28` - Insert ERROR HANDLING after RULES

**Description**:
Add "PREFERRED" markers and "ONE call" emphasis to tool descriptions in both prompts to align with actual tool descriptions in `lib/editor/tools/index.ts`. Also add comprehensive ERROR HANDLING section.

**Changes**:
```diff
# SYSTEM_PROMPT (lines 30-35)
Available tools:
-- list_blocks: See document structure with previews (call first)
-- read_blocks: Batch read blocks (max 25)
-- edit_blocks: Batch edit blocks (max 25)
-- add_blocks: Batch add blocks (max 25)
-- delete_blocks: Batch delete blocks (max 25)
++ list_blocks: See document structure with previews (call first)
++ read_blocks: PREFERRED - Batch read blocks in ONE call (max 25)
++ edit_blocks: PREFERRED - Batch edit blocks in ONE call (max 25) - requires read_blocks first
++ add_blocks: PREFERRED - Batch add blocks in ONE call (max 25) - no prior read needed
++ delete_blocks: PREFERRED - Batch delete blocks in ONE call (max 25) - requires read_blocks first

# Insert after RULES section (line 28)
++ ERROR HANDLING:
++ - If tool fails, READ the error message carefully
++ - "Block not found" → call list_blocks to refresh document state
++ - "not read yet" → call read_blocks before retrying
++ - "already deleted" → skip that block and continue
++ - Never retry the same operation 3+ times (prevents infinite loops)

# MULTI_DOC_SYSTEM_PROMPT (lines 55-58)
Available tools:
-- list_documents: See all open documents
-- switch_document: Switch active document
-- list_blocks, read_blocks, edit_blocks, add_blocks (max 25), delete_blocks (max 25)
++ list_documents: See all open documents
++ switch_document: Switch active document
++ list_blocks: See document structure with previews (call first)
++ read_blocks: PREFERRED - Batch read blocks in ONE call (max 25)
++ edit_blocks: PREFERRED - Batch edit blocks in ONE call (max 25) - requires read_blocks first
++ add_blocks: PREFERRED - Batch add blocks in ONE call (max 25) - no prior read needed
++ delete_blocks: PREFERRED - Batch delete blocks in ONE call (max 25) - requires read_blocks first
```

**Acceptance Criteria**:
- All 5 tools in SYSTEM_PROMPT have "PREFERRED" marker
- All 5 tools specify "ONE call" or "in ONE call"
- Tools requiring prior read (edit_blocks, delete_blocks) explicitly state "requires read_blocks first"
- Tools not requiring prior read (add_blocks) explicitly state "no prior read needed"
- ERROR HANDLING section added with 5 clear recovery strategies
- MULTI_DOC_SYSTEM_PROMPT tools match SYSTEM_PROMPT format
- Test coverage ≥90%

**Test Command**:
```bash
npm test -- __tests__/editor/agent.test.ts
```

---

### Task 2: High Priority - Multi-Document Guard Reset Warning
**Type**: quick-fix
**Priority**: High
**Estimated Effort**: 10 minutes
**Dependencies**: None

**Files**:
- `lib/editor/agent.ts:39-43` - MULTI_DOC_SYSTEM_PROMPT workflow section

**Description**:
Add explicit CRITICAL warning about guard reset after switch_document to prevent permission errors.

**Changes**:
```diff
MULTI-DOCUMENT WORKFLOW:
1. list_documents - see all open documents (call first if user mentions multiple docs)
2. switch_document(docId) - switch to target document
3. list_blocks → read_blocks → edit_blocks (operate on current document)
++ ⚠️ CRITICAL: switch_document RESETS read guards - call list_blocks again after switching
++ 4. list_blocks → read_blocks → edit_blocks/add_blocks/delete_blocks (operate on active document)
```

**Acceptance Criteria**:
- Guard reset warning uses "⚠️ CRITICAL:" prefix for visibility
- Warning explicitly states what gets reset ("read guards")
- Warning specifies required action ("call list_blocks again after switching")
- Step 3 updated to include add_blocks/delete_blocks
- All multi-document tests pass
- Test coverage ≥90%

**Test Command**:
```bash
npm test -- __tests__/editor/agent.test.ts --testNamePattern="multi"
```

---

### Task 3: Medium Priority - Complete Workflow Description
**Type**: default
**Priority**: Medium
**Estimated Effort**: 20 minutes
**Dependencies**: None

**Files**:
- `lib/editor/agent.ts:18-22` - WORKFLOW section

**Description**:
Update workflow to include add_blocks/delete_blocks and clarify decision criteria for when to skip read_blocks.

**Changes**:
```diff
WORKFLOW (follow strictly):
1. list_blocks - get document structure (REQUIRED first step)
2. read_blocks - read ALL relevant blocks in ONE call (skip if list_blocks preview is enough)
++    - SKIP only for read-only queries about document structure
++    - ALWAYS read before editing/deleting for full context
3. edit_blocks - make ALL edits in ONE call
++ 3. Execute operations in ONE batch:
++    - Use edit_blocks for modifications
++    - Use add_blocks for insertions (max 25)
++    - Use delete_blocks for removals (max 25)
4. Respond with summary
```

**Acceptance Criteria**:
- Workflow step 2 explicitly clarifies when to skip read_blocks
- Decision criteria are binary: "read-only queries" vs "editing/deleting"
- Workflow step 3 replaced with "Execute operations in ONE batch"
- All three operation types listed: edit_blocks, add_blocks, delete_blocks
- Batch sizes specified for add/delete operations
- No test failures
- Test coverage ≥90%

**Test Command**:
```bash
npm test -- __tests__/editor/agent.test.ts
```

---

### Task 4: Medium Priority - Large Document Optimization Guidance
**Type**: default
**Priority**: Medium
**Estimated Effort**: 15 minutes
**Dependencies**: None

**Files**:
- `lib/editor/agent.ts:12-16` - EFFICIENCY RULES section

**Description**:
Add efficiency rules for documents with >50 blocks to handle edge case of large documents without breaking token limits.

**Changes**:
```diff
EFFICIENCY RULES (CRITICAL):
1. MINIMIZE tool calls - plan ALL operations upfront, execute in ONE batch
2. After list_blocks, you should know exactly which blocks to read/edit - do it in ONE call
3. Maximum 3 tool calls per request: list_blocks → read_blocks → edit_blocks
4. Batch ALL add/delete operations in ONE call
++ 5. For large documents (>50 blocks):
++    - Read only blocks you plan to edit (not entire document)
++    - Use withContext=false to reduce tokens
++    - Split into multiple batches if absolutely necessary (but prefer one)
++ 6. MAX 30 iterations - plan carefully to avoid loops
++ 7. If stuck after 3 attempts, ask user for clarification instead of repeating
```

**Acceptance Criteria**:
- Rule 5 explicitly defines "large documents" threshold (>50 blocks)
- Three optimization strategies clearly listed
- Preference for single batch stated ("but prefer one")
- Rule 6 reminds about iteration limit (30)
- Rule 7 provides stuck handling strategy
- Existing rules 1-4 unchanged
- No test failures
- Test coverage ≥90%

**Test Command**:
```bash
npm test -- __tests__/editor/agent.test.ts
```

---

### Task 5: Integration Test Coverage for Error Recovery
**Type**: default
**Priority**: Medium
**Estimated Effort**: 2 hours
**Dependencies**: Task 1 (must be complete first)

**Files**:
- `__tests__/editor/agent.test.ts` - Add new test suite

**Description**:
Add comprehensive test cases for error recovery scenarios introduced in Task 1.

**Test Cases**:

**Test 1: Block Not Found Recovery**
```typescript
describe('Error Recovery', () => {
  it('should recover from block not found by calling list_blocks', async () => {
    // Setup: Document with 3 blocks
    // Step 1: User requests edit of non-existent block_999
    // Expected: Error "Block not found"
    // Step 2: Agent calls list_blocks to refresh
    // Step 3: Agent retries with correct block ID
    // Expected: Success
  })
})
```

**Test 2: Guard Reset After Document Switch**
```typescript
it('should enforce guard reset after switch_document', async () => {
  // Setup: 2 documents with blocks
  // Step 1: Read block in doc_A (marks as read)
  // Step 2: Switch to doc_B
  // Step 3: Try to edit block in doc_B without reading
  // Expected: Error "not read yet"
  // Step 4: Call list_blocks in doc_B
  // Step 5: Read block in doc_B
  // Step 6: Edit block in doc_B
  // Expected: Success
})
```

**Test 3: Stuck Loop Detection**
```typescript
it('should detect stuck loops after 3 failed attempts', async () => {
  // Setup: Document with read guard
  // Step 1-3: Try to edit same block 3 times without reading
  // Expected: detectStuck() returns {isStuck: true, reason: "..."}
  // Step 4: Agent should ask user for clarification instead of retrying
  // Expected: Warning message in response
})
```

**Acceptance Criteria**:
- All 3 new test cases pass
- Edge case coverage: block not found, guard reset, stuck loops
- Error messages match ERROR HANDLING section instructions
- Test coverage ≥90% for `lib/editor/agent.ts`
- No regressions in existing tests

**Test Command**:
```bash
npm test -- __tests__/editor/agent.test.ts --testNamePattern="error recovery"
npm test -- __tests__/editor/agent.test.ts -- --coverage
```

---

## Success Criteria
- ✅ All 5 tasks completed
- ✅ Test coverage ≥90% for `lib/editor/agent.ts`
- ✅ 0 test failures in full editor test suite
- ✅ All 6 review recommendations implemented
- ✅ System prompts align with tool descriptions
- ✅ ERROR HANDLING section added
- ✅ Multi-document guard reset warning added
- ✅ Workflow includes add_blocks/delete_blocks
- ✅ Large document optimization rules added

---

## Parallelization Strategy

**Wave 1** (can run in parallel):
- Task 1: Tool Description Alignment + Error Recovery (15 min)
- Task 2: Multi-Document Guard Reset Warning (10 min)
- Task 3: Complete Workflow Description (20 min)
- Task 4: Large Document Optimization Guidance (15 min)

**Wave 2** (depends on Task 1):
- Task 5: Integration Test Coverage (2 hours)

**Total Estimated Effort**: ~3 hours

---

## Rollout Plan

1. **Immediate Deployment** (Tasks 1-4):
   - Merge to main branch
   - Deploy to production
   - Monitor metrics for 48 hours

2. **Metrics to Track**:
   - Average tool calls per request (target: <4)
   - Error rate (target: <5%)
   - Stuck detection frequency (target: <1%)
   - Token usage per operation (target: -5% to -10%)

3. **Validation** (Task 5):
   - Add test coverage after production validation
   - Ensure error recovery scenarios work as expected

4. **Documentation Update**:
   - Update README.md if behavior changes significantly
   - Add ERROR HANDLING section to architecture documentation
