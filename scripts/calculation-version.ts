import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Invalidate persisted models/results whenever their code or game data changes. */
export const getCalculationVersion = (root = process.cwd()): string => {
  const hash = createHash('sha256')
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filename = path.join(directory, entry.name)

      if (entry.isDirectory() && entry.name !== 'test-fixtures') visit(filename)
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        hash.update(path.relative(root, filename).replaceAll('\\', '/'))
        hash.update(readFileSync(filename))
      }
    }
  }

  visit(path.join(root, 'app'))
  hash.update(readFileSync(path.join(root, 'package.json')))
  return hash.digest('base64url')
}
