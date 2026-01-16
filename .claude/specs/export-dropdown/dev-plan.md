# Export Template Selection Dropdown - Development Plan

## Overview
Add split-button dropdown menus to PDF and Word export buttons for quick template selection without persisting the choice.

## Task Breakdown

### Task 1: UI Dropdown Implementation
- **ID**: task-1
- **type**: ui
- **Description**: Implement split-button dropdowns for PDF (standard/detailed/minimal) and Word (standard/detailed) export buttons using existing dropdown-menu component. Main button exports with default template from settings, chevron opens template menu for one-time override.
- **File Scope**: components/steam-agent/bottom-action-bar.tsx, components/ui/dropdown-menu.tsx
- **Dependencies**: None
- **Test Command**: pnpm test -- --testPathPattern=bottom-action-bar --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - Split-button renders correctly with main action and dropdown trigger
  - Dropdown opens/closes on chevron click
  - Template options display correctly (PDF: 3 options, Word: 2 options)
  - Main button uses default template from loadSettings()
  - Dropdown selection triggers export with selected template
  - Selection is not persisted (next export uses default again)
  - i18n strings render correctly for all template options

### Task 2: API Type Hardening
- **ID**: task-2
- **type**: quick-fix
- **Description**: Add strict TypeScript types for template parameters in export API functions (exportToPdf, exportToWord) to ensure type safety with PdfTemplate and WordTemplate enums.
- **File Scope**: lib/api.ts, types/settings.ts
- **Dependencies**: None
- **Test Command**: pnpm test -- --testPathPattern=api --coverage --coveragePathIgnorePatterns="node_modules"
- **Test Focus**:
  - Type checking prevents invalid template values
  - API functions accept valid PdfTemplate/WordTemplate enums
  - TypeScript compilation succeeds with strict mode
  - Runtime validation for template parameters

### Task 3: Comprehensive Test Coverage
- **ID**: task-3
- **type**: default
- **Description**: Add comprehensive unit and integration tests for dropdown selection behavior, template override logic, and edge cases to achieve ≥90% coverage.
- **File Scope**: __tests__/bottom-action-bar.test.tsx, __tests__/api.test.ts
- **Dependencies**: depends on task-1
- **Test Command**: pnpm test:coverage -- --coverageThreshold='{"global":{"branches":90,"functions":90,"lines":90,"statements":90}}'
- **Test Focus**:
  - User interaction flows (click main button, click dropdown, select option)
  - Default template loading from settings
  - Template override does not persist across exports
  - Multiple consecutive exports with different templates
  - Dropdown closes after selection
  - Keyboard navigation (arrow keys, enter, escape)
  - Accessibility attributes (aria-labels, roles)
  - Error handling for missing settings
  - Edge cases (rapid clicks, concurrent exports)

## Acceptance Criteria
- [ ] PDF export button has split-button with dropdown showing standard/detailed/minimal options
- [ ] Word export button has split-button with dropdown showing standard/detailed options
- [ ] Main button exports using default template from loadSettings()
- [ ] Dropdown selection overrides template for single export only
- [ ] Template selection is not persisted (next export uses default)
- [ ] All UI components use existing dropdown-menu component
- [ ] i18n strings display correctly for all template options
- [ ] All unit tests pass
- [ ] Code coverage ≥90% (branches, functions, lines, statements)
- [ ] TypeScript strict mode passes with no type errors
- [ ] Keyboard navigation and accessibility work correctly

## Technical Notes
- Use Radix UI DropdownMenu component (already available in components/ui/dropdown-menu.tsx)
- Split-button pattern: main button triggers default action, chevron button opens dropdown
- Template types already defined in types/settings.ts (PdfTemplate, WordTemplate)
- Default template retrieved via loadSettings() function
- Dropdown selection should be ephemeral (use local state, not persisted settings)
- Maintain existing export functionality for backward compatibility
- Follow existing i18n pattern using t.settings.template* keys
- Ensure WCAG 2.1 AA compliance for dropdown interactions
