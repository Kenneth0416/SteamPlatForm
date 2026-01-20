# Remove Single-Block Tools - Development Plan

## Overview
Remove deprecated single-block tools (read_block, edit_block) from the editor agent system and update all references to use batch tools exclusively.

## Task Breakdown

### Task 1: Remove single-block tool definitions
- **ID**: task-1
- **type**: default
- **Description**: Delete createReadBlockTool and createEditBlockTool functions from lib/editor/tools/index.ts, and remove them from the createEditorTools return array. This eliminates the deprecated single-block tools from the system.
- **File Scope**: lib/editor/tools/index.ts
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/tools.test.ts --coverage --collectCoverageFrom=lib/editor/tools/index.ts
- **Test Focus**: Verify createEditorTools returns only batch tools (list_blocks, read_blocks, edit_blocks, add_block, delete_block), ensure no references to read_block or edit_block remain

### Task 2: Update middleware error messages
- **ID**: task-2
- **type**: quick-fix
- **Description**: Update error messages in ReadWriteGuard.canEdit and ReadWriteGuard.canEditBlocks methods to reference read_blocks instead of read_block. Change error message from "Must call read_block" to "Must call read_blocks".
- **File Scope**: lib/editor/tools/middleware.ts
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/middleware.test.ts --coverage --collectCoverageFrom=lib/editor/tools/middleware.ts
- **Test Focus**: Verify error messages correctly reference read_blocks, test canEdit and canEditBlocks return correct error messages when blocks haven't been read

### Task 3: Update agent system prompts
- **ID**: task-3
- **type**: quick-fix
- **Description**: Remove all references to read_block and edit_block from SYSTEM_PROMPT and MULTI_DOC_SYSTEM_PROMPT in lib/editor/agent.ts. Update workflow descriptions to only mention batch tools (read_blocks, edit_blocks).
- **File Scope**: lib/editor/agent.ts
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/agent.test.ts --coverage --collectCoverageFrom=lib/editor/agent.ts
- **Test Focus**: Verify system prompts contain no references to single-block tools, ensure prompts correctly describe batch-only workflow

### Task 4: Update stuck detection logic
- **ID**: task-4
- **type**: default
- **Description**: Update the readTools array in detectStuck function (lib/editor/agent/runtime.ts) to only include 'read_blocks', removing 'read_block'. Update the mutationTools array to only include 'edit_blocks', removing 'edit_block'.
- **File Scope**: lib/editor/agent/runtime.ts
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/agent-stuck.test.ts --coverage --collectCoverageFrom=lib/editor/agent/runtime.ts
- **Test Focus**: Verify stuck detection correctly identifies repeated read_blocks calls, ensure mutation detection only checks for edit_blocks (not edit_block), test no-progress detection with batch tools only

### Task 5: Refactor test files
- **ID**: task-5
- **type**: default
- **Description**: Remove all test cases related to single-block tools (read_block, edit_block) from test files. Update stuck detection tests to only test batch tool patterns. Ensure all tests pass with the new batch-only tool set.
- **File Scope**: __tests__/editor/tools.test.ts, __tests__/editor/agent-stuck.test.ts, __tests__/editor/tools/middleware.test.ts
- **Dependencies**: task-1, task-2, task-3, task-4
- **Test Command**: npm test --coverage --collectCoverageFrom=lib/editor/**/*.ts
- **Test Focus**: All tests pass with single-block tools removed, stuck detection tests cover batch tool patterns, middleware tests verify batch tool error messages, no test references to deprecated tools remain

## Acceptance Criteria
- [ ] createReadBlockTool and createEditBlockTool functions are completely removed
- [ ] All error messages reference read_blocks instead of read_block
- [ ] System prompts contain no references to single-block tools
- [ ] Stuck detection logic only checks for batch tools
- [ ] All test files updated to remove single-block tool tests
- [ ] All unit tests pass
- [ ] Code coverage ≥90%

## Technical Notes
- This is a cleanup task to enforce batch-only tool usage, improving agent efficiency
- The batch tools (read_blocks, edit_blocks) already exist and are fully functional
- No new functionality is being added, only removing deprecated alternatives
- Tests must be updated to reflect the new batch-only architecture
- Error messages should guide users toward batch tools for better performance
