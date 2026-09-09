import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

import { resourceIcons } from './resource-icons'
import { resources } from './resources'

it('ships a readable PNG for every mapped resource and explicitly accounts for fallbacks', () => {
  expect(Object.keys(resourceIcons).sort()).toEqual(Object.keys(resources).sort())
  const directory = path.resolve('public/resource-icons')
  const mapped = Object.entries(resourceIcons).filter(([, icon]) => icon !== null)

  expect(readdirSync(directory).sort()).toEqual(mapped.map(([id]) => `${id}.png`).sort())
  for (const [id] of mapped) {
    const bytes = readFileSync(path.join(directory, `${id}.png`))

    expect(bytes.subarray(0, 8).toString('hex'), id).toBe('89504e470d0a1a0a')
    expect(bytes.readUInt32BE(16), `${id} width`).toBeGreaterThanOrEqual(28)
    expect(bytes.readUInt32BE(20), `${id} height`).toBeGreaterThanOrEqual(28)
  }
})
