# Chat Markdown Parser - Development Plan

## Overview
Add Markdown rendering support to chat messages for improved readability using existing react-markdown and remark-gfm dependencies.

## Task Breakdown

### Task 1: Create ChatMarkdown Component
- **ID**: MD-001
- **type**: default
- **Description**: Create a reusable ChatMarkdown component that renders Markdown content with Tailwind styling for headings, lists, code blocks, links, and emphasis. Use react-markdown with remark-gfm plugin. Exclude rehype-raw for security.
- **File Scope**: components/steam-agent/chat-markdown.tsx (new file)
- **Dependencies**: None
- **Test Command**: pnpm vitest run components/steam-agent/__tests__/chat-markdown.test.tsx --coverage --reporter=verbose
- **Test Focus**:
  - Renders headings (h1, h2, h3) with correct styling
  - Renders ordered and unordered lists with proper indentation
  - Renders inline code and code blocks with syntax highlighting
  - Renders links with security attributes (rel="noopener noreferrer")
  - Renders bold and italic text correctly
  - Sanitizes potentially unsafe content

### Task 2: Integrate ChatMarkdown into Chat Panel
- **ID**: MD-002
- **type**: ui
- **Description**: Replace plain text rendering in chat-panel.tsx with ChatMarkdown component for assistant messages. Preserve plain text rendering for isThinking and isStreaming states to maintain loading UX.
- **File Scope**: components/steam-agent/chat-panel.tsx
- **Dependencies**: depends on MD-001
- **Test Command**: pnpm vitest run components/steam-agent/__tests__/chat-panel.test.tsx --coverage --reporter=verbose
- **Test Focus**:
  - Assistant messages render with Markdown formatting
  - User messages render as plain text (no Markdown parsing)
  - Thinking/streaming states display plain text
  - Component maintains existing chat functionality
  - No visual regressions in chat layout

### Task 3: Add Component Unit Tests
- **ID**: MD-TEST-001
- **type**: default
- **Description**: Create comprehensive unit tests for ChatMarkdown component covering all Markdown elements, edge cases, and security scenarios.
- **File Scope**: components/steam-agent/__tests__/chat-markdown.test.tsx (new file)
- **Dependencies**: depends on MD-001
- **Test Command**: pnpm vitest run components/steam-agent/__tests__/chat-markdown.test.tsx --coverage --reporter=verbose
- **Test Focus**:
  - All Markdown syntax elements render correctly
  - Empty/null content handled gracefully
  - XSS prevention (script tags, dangerous HTML)
  - Link security attributes applied
  - Code block language detection
  - Nested list rendering
  - Mixed content (text + Markdown)

## Acceptance Criteria
- [ ] ChatMarkdown component renders all standard Markdown elements (headings, lists, code, links, emphasis)
- [ ] Chat messages display formatted Markdown content for assistant responses
- [ ] Plain text preserved for user messages and loading states
- [ ] Links include security attributes (rel="noopener noreferrer", target="_blank")
- [ ] No rehype-raw plugin used (security requirement)
- [ ] All unit tests pass
- [ ] Code coverage ≥90%
- [ ] No visual regressions in chat interface
- [ ] Existing chat functionality (streaming, thinking states) unaffected

## Technical Notes
- Reuse existing dependencies: react-markdown (v9.0.1), remark-gfm (v4.0.0) already in package.json
- Reference existing implementation: components/markdown-editor.tsx uses same libraries
- Tailwind styling: Use prose classes or custom component styles for consistency
- Security: Explicitly exclude rehype-raw to prevent XSS via HTML injection
- Performance: react-markdown is lightweight; no additional optimization needed for chat context
- TypeScript: Define props interface with content: string, className?: string
- Testing: Use @testing-library/react for component tests, vitest as test runner
