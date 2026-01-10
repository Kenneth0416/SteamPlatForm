# Vditor Integration - Development Plan

## Overview
Replace TipTap-based markdown editor with Vditor in WYSIWYG mode, simplified toolbar, keeping export functionality.

## Task Breakdown

### Task 1: Add Vditor Dependency and Global Assets
- **ID**: task-1
- **type**: default
- **Description**: Install vditor npm package (pnpm add vditor), import vditor/dist/index.css in app/globals.css, add theme overrides for shadcn/Tailwind compatibility to ensure Vditor styling integrates with existing design system
- **File Scope**: package.json, app/globals.css
- **Dependencies**: None
- **Test Command**: pnpm test -- --testPathPattern="vditor" --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - Verify vditor package is installed in package.json dependencies
  - Verify CSS import exists in globals.css
  - Verify no CSS conflicts with existing Tailwind/shadcn styles

### Task 2: Build Vditor React Wrapper Component
- **ID**: task-2
- **type**: ui
- **Description**: Create a React wrapper component for Vditor that enforces WYSIWYG mode (mode: 'wysiwyg'), implements simplified toolbar (bold/italic/strike, headings, links, lists, quote, code, table, undo/redo), handles value syncing via input/blur callbacks with debouncing, integrates with existing theme system, and uses dynamic import with ssr: false for client-side only rendering
- **File Scope**: components/vditor-editor.tsx (new file)
- **Dependencies**: depends on task-1
- **Test Command**: pnpm test -- --testPathPattern="vditor-editor" --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - Component renders without errors in client-side environment
  - WYSIWYG mode is enforced (no mode toggle visible)
  - Value syncing works correctly (onChange callback fires on input/blur)
  - Toolbar contains only specified simplified buttons
  - Theme integration matches existing shadcn/Tailwind styling
  - Dynamic import prevents SSR errors

### Task 3: Integrate Vditor into Editor Components
- **ID**: task-3
- **type**: ui
- **Description**: Replace TipTap/ReactMarkdown usage in components/wysiwyg-editor.tsx with new Vditor wrapper, update components/markdown-editor.tsx to use Vditor wrapper instead of WysiwygEditor, preserve expand/edit controls and CollapsibleSection functionality, ensure mermaid code blocks (```mermaid) are preserved in markdown output for export pipeline compatibility
- **File Scope**: components/wysiwyg-editor.tsx (replace implementation), components/markdown-editor.tsx (update imports and usage)
- **Dependencies**: depends on task-2
- **Test Command**: pnpm test -- --testPathPattern="markdown-editor|wysiwyg-editor" --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - Editor renders with Vditor wrapper in both components
  - Edit/expand controls (Minimize2, Eye, Edit3 buttons) still function correctly
  - Mermaid blocks are preserved in markdown format (```mermaid...```)
  - Export functionality still works (markdown output is compatible)
  - CollapsibleSection rendering works in preview mode
  - Value prop changes trigger editor updates

### Task 4: Cleanup and Test Updates
- **ID**: task-4
- **type**: default
- **Description**: Remove TipTap artifacts (components/wysiwyg-toolbar.tsx, lib/tiptap-config.ts), remove TipTap dependencies from package.json (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-*, @tiptap/pm, marked, turndown), update test files (__tests__/wysiwyg-editor.test.tsx, __tests__/wysiwyg-toolbar.test.tsx, __tests__/bottom-action-bar.test.tsx) to reflect new Vditor behavior, verify all export tests pass (__tests__/export-*.test.ts)
- **File Scope**: components/wysiwyg-toolbar.tsx (delete), lib/tiptap-config.ts (delete), package.json (remove dependencies), __tests__/wysiwyg-editor.test.tsx (update), __tests__/wysiwyg-toolbar.test.tsx (delete or update), __tests__/bottom-action-bar.test.tsx (update), __tests__/export-*.test.ts (verify)
- **Dependencies**: depends on task-3
- **Test Command**: pnpm test --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - All tests pass without TipTap references
  - No TipTap imports remain in codebase
  - Export tests pass (PDF, Word, download functionality)
  - Mermaid export tests pass
  - Code coverage ≥90% across all modified components
  - No broken imports or missing dependencies

## Acceptance Criteria
- [ ] Vditor renders in WYSIWYG mode with no mode toggle visible
- [ ] Simplified toolbar with only common functions (bold/italic/strike, headings, links, lists, quote, code, table, undo/redo)
- [ ] Value syncing works correctly for export functionality (markdown format preserved)
- [ ] UI matches existing shadcn/Tailwind styling (no visual regressions)
- [ ] All existing export tests pass (PDF, Word, download, mermaid)
- [ ] No TipTap dependencies or code remain in project
- [ ] Code coverage ≥90%

## Technical Notes
- Vditor requires client-side only rendering: use `dynamic(() => import('./vditor-editor'), { ssr: false })` in parent components
- Configure Vditor with `mode: 'wysiwyg'` and hide mode toggle buttons via toolbar config
- Use `input` callback for live syncing, apply debouncing (300ms) to prevent excessive onChange calls
- Import `vditor/dist/index.css` in app/globals.css before custom styles
- Keep markdown format compatible with existing export pipeline (preserve mermaid blocks, GFM syntax)
- Vditor toolbar config: `toolbar: ['bold', 'italic', 'strike', '|', 'heading', 'link', '|', 'list', 'ordered-list', 'quote', 'code', 'table', '|', 'undo', 'redo']`
- Test framework: Jest with @testing-library/react for component tests
- Ensure Vditor theme variables align with CSS custom properties in globals.css (--background, --foreground, --border, etc.)
