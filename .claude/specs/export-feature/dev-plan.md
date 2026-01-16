# Export Feature - Development Plan

## Overview
Implement PDF and Word document export functionality for generated STEAM lesson content with template support and image inclusion options.

## Task Breakdown

### Task 1: Export Model and Parser
- **ID**: task-1
- **type**: default
- **Description**: Define ExportLesson TypeScript model and implement Markdown-to-structured-data parser to normalize lesson content for export generators
- **File Scope**: `lib/export/types.ts`, `lib/export/parser.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test -- --testPathPattern=export-parser --coverage --coverageDirectory=coverage/export-parser`
- **Test Focus**:
  - Parse Markdown headings, lists, code blocks, and images
  - Handle malformed Markdown gracefully
  - Extract metadata (title, grade, subject, duration)
  - Validate ExportLesson structure

### Task 2: PDF Generator
- **ID**: task-2
- **type**: default
- **Description**: Implement PDF generation using @react-pdf/renderer with template support, create API route handler for server-side rendering, and apply user settings (template, images)
- **File Scope**: `lib/export/pdf/generator.tsx`, `lib/export/pdf/styles.ts`, `app/api/export/pdf/route.ts`
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test -- --testPathPattern=export-pdf --coverage --coverageDirectory=coverage/export-pdf`
- **Test Focus**:
  - Generate valid PDF buffer from ExportLesson
  - Apply template styles correctly
  - Include/exclude images based on settings
  - Handle empty or minimal content
  - Verify API route returns correct Content-Type and headers

### Task 3: Word Generator
- **ID**: task-3
- **type**: default
- **Description**: Implement DOCX generation using docx library with template support, create API route handler for server-side generation, and apply user settings (template, images)
- **File Scope**: `lib/export/word/generator.ts`, `app/api/export/word/route.ts`
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test -- --testPathPattern=export-word --coverage --coverageDirectory=coverage/export-word`
- **Test Focus**:
  - Generate valid DOCX buffer from ExportLesson
  - Apply template formatting correctly
  - Include/exclude images based on settings
  - Handle lists, headings, and paragraphs
  - Verify API route returns correct Content-Type and headers

### Task 4: Client Download UI
- **ID**: task-4
- **type**: ui
- **Description**: Wire export buttons in BottomActionBar to call export APIs, handle loading states, trigger browser downloads, and display error messages
- **File Scope**: `components/steam-agent/bottom-action-bar.tsx`, `lib/api.ts`
- **Dependencies**: depends on task-2, task-3
- **Test Command**: `pnpm test -- --testPathPattern=bottom-action-bar --coverage --coverageDirectory=coverage/bottom-action-bar`
- **Test Focus**:
  - Button click triggers API call with correct payload
  - Loading state displays during export
  - Browser download initiates on success
  - Error toast displays on failure
  - Disabled state when no lesson content

### Task 5: Integration Tests
- **ID**: task-5
- **type**: default
- **Description**: Create comprehensive integration tests covering parser, PDF generator, Word generator, and end-to-end export workflows
- **File Scope**: `__tests__/export-parser.test.ts`, `__tests__/export-pdf.test.ts`, `__tests__/export-word.test.ts`, `__tests__/export-integration.test.ts`
- **Dependencies**: depends on task-1, task-2, task-3, task-4
- **Test Command**: `pnpm test -- --testPathPattern=export --coverage --coverageDirectory=coverage/export --coverageReporters=text,lcov`
- **Test Focus**:
  - Full export workflow from Markdown to downloadable file
  - Template switching affects output correctly
  - Image inclusion toggle works
  - Error handling for invalid input
  - Performance with large lesson content

## Acceptance Criteria
- [ ] Users can export lessons to PDF format with template selection
- [ ] Users can export lessons to Word format with template selection
- [ ] Image inclusion can be toggled via settings
- [ ] Export buttons show loading state during generation
- [ ] Downloaded files have correct filenames (lesson-title.pdf, lesson-title.docx)
- [ ] All unit tests pass
- [ ] Code coverage ≥90%
- [ ] Export works for lessons with Chinese and English content
- [ ] Error messages display when export fails

## Technical Notes
- Use Node runtime for export API routes (required for @react-pdf/renderer and docx)
- Markdown parser should handle both English and Chinese characters
- PDF/Word generators must sanitize filenames for download headers
- Consider streaming large files instead of buffering entirely in memory
- Template styles should be configurable via settings (future enhancement)
- Image URLs in Markdown must be absolute or properly resolved
