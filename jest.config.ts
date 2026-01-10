import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    '/node_modules/(?!(marked|turndown|docx)/)',
  ],
  collectCoverageFrom: (() => {
    const argv = process.argv.join(' ')
    if (argv.match(/testPathPattern=.*vditor-editor/i)) {
      return ['components/vditor-editor.tsx']
    }
    if (argv.match(/testPathPattern=.*vditor/i)) {
      return ['lib/vditor-assets.ts']
    }
    if (argv.match(/testPathPattern=.*export/i)) {
      return ['lib/export/**/*.{ts,tsx}', 'app/api/export/**/*.{ts,tsx}']
    }
    if (argv.match(/testPathPattern=.*bottom-action-bar/i)) {
      return ['components/steam-agent/bottom-action-bar.tsx']
    }
    return ['components/wysiwyg-editor.tsx', 'components/markdown-editor.tsx']
  })(),
  coverageThreshold: (() => {
    const argv = process.argv.join(' ')
    if (argv.match(/testPathPattern=.*vditor-editor/i)) {
      return {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      }
    }
    if (argv.match(/testPathPattern=.*vditor/i)) {
      return {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      }
    }
    if (argv.match(/testPathPattern=.*bottom-action-bar/i)) {
      return {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      }
    }
    return {
      global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    }
  })(),
}

export default createJestConfig(config)
