import { defineConfig } from 'vitest/config'

// Collect tests from the three tracked folders only, so agent worktrees and
// scratch output never run as a second copy of the suite.
export default defineConfig({
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '.next/**', '.claude/**', 'out/**', 'Builds/**'],
  },
})
