import type { Config } from 'jest'
import { createRequire } from 'node:module'

// Bare `import from 'next/jest'` type-checks but fails under Jest’s ESM config load unless
// the import includes `.js`. `require('next/jest')` matches Node’s legacy resolution for `jest.js`.
const require = createRequire(import.meta.url)
const nextJest = require('next/jest') as typeof import('next/jest').default

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)