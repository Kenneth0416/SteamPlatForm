# WYSIWYG Editor Tests

## Setup

Install test dependencies:

```bash
pnpm install
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Test Files

- `__tests__/wysiwyg-editor.test.tsx` - Tests for the Vditor-backed WYSIWYG editor component

## Coverage

Tests are configured to maintain ≥90% coverage for:
- Branches
- Functions
- Lines
- Statements

## Test Structure

Tests use:
- Jest as the test runner
- React Testing Library for component testing
- @testing-library/user-event for user interactions
- @testing-library/jest-dom for DOM assertions

## Mocking

The tests mock:
- The Vditor React wrapper when validating the WysiwygEditor API surface
- The underlying `vditor` constructor to simulate input/blur callbacks and value syncing
