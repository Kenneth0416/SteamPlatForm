# Optimize Apply Change LLM Speed - Development Plan

## Overview
Reduce LLM token usage by 54% through prompt simplification while maintaining edit accuracy.

## Task Breakdown

### Task 1: Replace Prompts with Simplified Versions
- **ID**: task-1
- **type**: quick-fix
- **Description**: Replace EDIT_PROMPT_EN and EDIT_PROMPT_EN_ZH constants with optimized versions (230→106 tokens EN, 363→166 tokens ZH)
- **File Scope**: lib/langchain/apply-change-agent.ts
- **Dependencies**: None
- **Test Command**: node scripts/test-apply-change-prompt.mjs
- **Test Focus**: Verify JSON output structure, test replace/delete/insert_after/insert_before actions, confirm exact substring matching

### Task 2: Make EditResult.summary Optional
- **ID**: task-2
- **type**: quick-fix
- **Description**: Update EditResult interface to make summary field optional since simplified prompts no longer generate summaries
- **File Scope**: lib/langchain/apply-change-agent.ts
- **Dependencies**: depends on task-1
- **Test Command**: node scripts/test-apply-change-prompt.mjs
- **Test Focus**: Verify type safety with optional summary, test backward compatibility with existing code

### Task 3: Add Regression Test for Prompt Structure
- **ID**: task-3
- **type**: default
- **Description**: Create comprehensive test script to validate prompt optimization maintains edit accuracy across various scenarios
- **File Scope**: scripts/test-apply-change-prompt.mjs
- **Dependencies**: depends on task-1
- **Test Command**: node scripts/test-apply-change-prompt.mjs
- **Test Focus**: Test EN/ZH prompts, validate all action types (replace/delete/insert_after/insert_before), verify exact substring matching, measure token reduction, test edge cases (special characters, multiline text)

## Acceptance Criteria
- [ ] EN prompt reduced from ~230 to ~106 tokens (-54%)
- [ ] ZH prompt reduced from ~363 to ~166 tokens (-54%)
- [ ] All edit actions (replace/delete/insert_after/insert_before) work correctly
- [ ] EditResult.summary field is optional
- [ ] Test script validates prompt structure and accuracy
- [ ] No breaking changes to existing functionality
- [ ] Code coverage ≥90%

## Technical Notes
- Optimized prompts use "档A - 稳定方案" (stable solution) approach
- Prompts maintain exact substring matching requirement for reliability
- Summary generation removed to reduce token overhead
- JSON-only output format enforced (no markdown wrapping)
- Backward compatibility maintained for existing callers
