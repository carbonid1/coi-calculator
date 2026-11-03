import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { isChickenFarmDefinition } from '../chicken-farm-state'
import { isRocketIiDefinition } from '../rocket-state'
import { isSpaceStationLevels } from '../space-station-state'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../tests/fixtures/factory.json.gz', import.meta.url))).toString())
const definition: unknown = capture.chickenFarmDefinition

if (!isChickenFarmDefinition(definition)) throw new Error('Recorded chicken farm definition is invalid')

export const testChickenFarmDefinition = definition

const rocket: unknown = capture.rocketIiDefinition

if (!isRocketIiDefinition(rocket)) throw new Error('Recorded Rocket II definition is invalid')

export const testRocketIiDefinition = rocket

const stationLevels: unknown = capture.spaceStationLevels

if (!isSpaceStationLevels(stationLevels)) throw new Error('Recorded Space Station tiers are invalid')

export const testSpaceStationLevels = stationLevels
