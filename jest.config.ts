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
    '/node_modules/(?!(marked|turndown|docx|unified|remark-parse|remark-stringify|bail|devlop|is-plain-obj|trough|vfile|vfile-message|unist-util-stringify-position|mdast-util-from-markdown|mdast-util-to-markdown|micromark|decode-named-character-reference|character-entities|mdast-util-to-string|mdast-util-phrasing|longest-streak|zwitch)/)',
  ],
  collectCoverageFrom: (() => {
    const argv = process.argv.join(' ')
    if (argv.match(/testPathPattern=.*lesson-preview/i)) {
      return ['components/steam-agent/lesson-preview.tsx']
    }
    if (argv.match(/testPathPattern=.*page/i)) {
      return ['app/page.tsx']
    }
    if (argv.match(/testPathPattern=.*vditor-editor/i)) {
      return ['components/vditor-editor.tsx']
    }
    if (argv.match(/testPathPattern=.*vditor/i)) {
      return ['lib/vditor-assets.ts']
    }
    if (argv.match(/autoSaveQueue/i)) {
      return ['lib/autoSaveQueue.ts', 'hooks/useAutoSave.ts']
    }
    if (argv.match(/export-pdf-generator/i)) {
      return ['lib/export/pdf/**/*.{ts,tsx}']
    }
    if (argv.match(/testPathPattern=.*export/i)) {
      return ['lib/export/**/*.{ts,tsx}', 'app/api/export/**/*.{ts,tsx}']
    }
    if (argv.match(/testPathPattern=.*bottom-action-bar/i)) {
      return ['components/steam-agent/bottom-action-bar.tsx']
    }
    if (argv.match(/redundant-redirects/i)) {
      return ['components/layout/header.tsx']
    }
    if (argv.match(/editorStore/i)) {
      return ['stores/editorStore.ts']
    }
    if (argv.match(/layout-guard/i)) {
      return ['app/layout.tsx', 'app/auth/layout.tsx']
    }
    if (argv.match(/auth-protection/i)) {
      return [
        'app/api/lesson/route.ts',
        'app/api/lessons/**/*.{ts,tsx}',
        'app/api/chat/route.ts',
        'app/api/admin/**/*.{ts,tsx}',
        'app/api/editor/**/*.{ts,tsx}',
        'app/api/apply-change/route.ts',
      ]
    }
    if (argv.match(/proxy-config/i)) {
      return ['app/proxy.ts']
    }
    if (argv.match(/testPathPattern=(\"|')?editor(\1)?/i)) {
      return ['lib/editor/api.ts', 'stores/editorStore.ts']
    }
    return ['components/wysiwyg-editor.tsx', 'components/markdown-editor.tsx']
  })(),
  coverageThreshold: (() => {
    const argv = process.argv.join(' ')
    if (argv.match(/testPathPattern=.*lesson-preview/i)) {
      return {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      }
    }
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
