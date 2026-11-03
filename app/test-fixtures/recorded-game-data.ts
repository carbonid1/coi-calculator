import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { isChickenFarmDefinition } from '../chicken-farm-state'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../tests/fixtures/factory.json.gz', import.meta.url))).toString())
const definition: unknown = capture.chickenFarmDefinition

if (!isChickenFarmDefinition(definition)) throw new Error('Recorded chicken farm definition is invalid')

export const testChickenFarmDefinition = definition
