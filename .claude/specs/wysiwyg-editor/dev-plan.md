# WYSIWYG Markdown Editor - Development Plan

## Overview
Implement a rich text WYSIWYG editor using TipTap to replace the plain textarea in edit mode, while maintaining markdown storage format and ReactMarkdown preview.

## Technical Approach

### Core Technology
- **Editor Library**: TipTap with StarterKit extensions
- **Dependencies**: @tiptap/react, @tiptap/starter-kit, @tiptap/extension-task-list, @tiptap/extension-task-item, @tiptap/extension-underline
- **UI Components**: Radix Toggle for toolbar buttons
- **Data Format**: Markdown string (TipTap handles markdown ↔ HTML conversion)

### Architecture
- Replace textarea with TipTap editor in edit mode
- Keep ReactMarkdown for preview mode
- Floating toolbar with formatting controls (bold, italic, underline, headings, lists, tasks)
- Bidirectional markdown conversion handled by TipTap

## Task Breakdown

### Task 1: Install Dependencies & Setup TipTap
- **ID**: TASK-001
- **Type**: quick-fix
- **Description**: Install TipTap packages and create base configuration file with StarterKit and extensions
- **File Scope**: package.json, lib/tiptap-config.ts (new)
- **Dependencies**: None
- **Test Command**: `pnpm install && pnpm build`
- **Test Focus**: Verify packages install without conflicts and build succeeds

### Task 2: Create WYSIWYG Toolbar Component
- **ID**: TASK-002
- **Type**: default
- **Description**: Build floating toolbar with formatting buttons (bold, italic, underline, headings, lists, task lists) using Radix Toggle components
- **File Scope**: components/wysiwyg-toolbar.tsx (new), lib/translations.ts
- **Dependencies**: TASK-001
- **Test Command**: `pnpm dev`
- **Test Focus**: Toolbar renders correctly, buttons toggle active states, i18n labels display properly

### Task 3: Create WYSIWYG Editor Component
- **ID**: TASK-003
- **Type**: default
- **Description**: Implement TipTap editor component with markdown conversion, toolbar integration, and controlled value prop
- **File Scope**: components/wysiwyg-editor.tsx (new)
- **Dependencies**: TASK-001, TASK-002
- **Test Command**: `pnpm test components/wysiwyg-editor.test.tsx --coverage`
- **Test Focus**: Editor initializes with markdown content, converts markdown to HTML, updates on user input, emits markdown on change

### Task 4: Integrate WYSIWYG into MarkdownEditor
- **ID**: TASK-004
- **Type**: default
- **Description**: Replace textarea with WYSIWYG editor in edit mode, maintain preview mode with ReactMarkdown, preserve existing state management
- **File Scope**: components/markdown-editor.tsx
- **Dependencies**: TASK-003
- **Test Command**: `pnpm test components/markdown-editor.test.tsx --coverage`
- **Test Focus**: Edit/preview mode switching works, markdown state syncs correctly, existing functionality preserved

### Task 5: Unit & Integration Tests
- **ID**: TASK-005
- **Type**: default
- **Description**: Write comprehensive tests for WYSIWYG editor and toolbar components covering formatting actions, markdown conversion, and edge cases
- **File Scope**: __tests__/wysiwyg-editor.test.tsx (new), __tests__/wysiwyg-toolbar.test.tsx (new)
- **Dependencies**: TASK-004
- **Test Command**: `pnpm test --coverage --coveragePathPattern="(wysiwyg|markdown-editor)" --coverageReporters=text`
- **Test Focus**: All formatting buttons work, markdown round-trip conversion accurate, toolbar state reflects editor state, error handling for invalid markdown

## Acceptance Criteria
- [ ] TipTap editor replaces textarea in edit mode
- [ ] Floating toolbar with bold, italic, underline, headings (H1-H3), bullet list, ordered list, task list
- [ ] Markdown content correctly converts to/from TipTap HTML
- [ ] Preview mode continues using ReactMarkdown
- [ ] Toolbar buttons show active state based on cursor position
- [ ] Supports EN/ZH i18n for toolbar labels
- [ ] All unit tests pass
- [ ] Code coverage ≥90% for new components

## Technical Notes
- TipTap's markdown extension handles bidirectional conversion automatically
- Store content as markdown string in database (no schema changes needed)
- Toolbar should be positioned above editor with sticky/floating behavior
- Maintain existing MarkdownEditor props interface for backward compatibility
- Use Tailwind CSS for styling consistency with existing UI
- Leverage existing Radix UI Toggle components from ui/ directory
