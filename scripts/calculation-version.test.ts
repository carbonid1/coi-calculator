import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

import { getCalculationVersion } from './calculation-version'

it('invalidates saved results for code/data changes but not edits to tests', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coi-calculation-version-'))

  try {
    mkdirSync(path.join(root, 'app'))
    writeFileSync(path.join(root, 'package.json'), '{}')
    writeFileSync(path.join(root, 'app', 'solver.ts'), 'original')
    const original = getCalculationVersion(root)

    expect(getCalculationVersion(root)).toBe(original)
    writeFileSync(path.join(root, 'app', 'solver.test.ts'), 'test')
    expect(getCalculationVersion(root)).toBe(original)
    writeFileSync(path.join(root, 'app', 'solver.ts'), 'changed')
    expect(getCalculationVersion(root)).not.toBe(original)
  } finally {
    rmSync(root, { recursive: true })
  }
})
