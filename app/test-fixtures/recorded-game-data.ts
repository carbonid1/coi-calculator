import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { isChickenFarmDefinition } from '../chicken-farm-state'
import { isCropFarmingDefinitions } from '../crop-farming-state'
import { getContractCatalog } from '../db/contracts'
import { isWeatherConfig } from '../db/weather'
import { normalizeGameStateSnapshot } from '../game-state'
import { isOfficeFocusDefinitions } from '../office-focus-state'
import { isPlanningDefinitions } from '../planning-state'
import { isRocketIiDefinition } from '../rocket-state'
import { isSpaceStationLevels } from '../space-station-state'

const capture = JSON.parse(
  gunzipSync(
    readFileSync(new URL('../../tests/fixtures/factory.json.gz', import.meta.url)),
  ).toString(),
)
const definition: unknown = capture.chickenFarmDefinition

if (!isChickenFarmDefinition(definition))
  throw new Error('Recorded chicken farm definition is invalid')

export const testChickenFarmDefinition = definition

const rocket: unknown = capture.rocketIiDefinition

if (!isRocketIiDefinition(rocket)) throw new Error('Recorded Rocket II definition is invalid')

export const testRocketIiDefinition = rocket

const stationLevels: unknown = capture.spaceStationLevels

if (!isSpaceStationLevels(stationLevels))
  throw new Error('Recorded Space Station tiers are invalid')

export const testSpaceStationLevels = stationLevels

const cropFarming: unknown = capture.cropFarming

if (!isCropFarmingDefinitions(cropFarming))
  throw new Error('Recorded crop and fertilizer definitions are invalid')

export const testCropFarming = cropFarming

const weather: unknown = capture.weather

if (!isWeatherConfig(weather)) throw new Error('Recorded native weather is invalid')

export const testNativeWeather = weather

const offices: unknown = capture.officeFocusDefinitions

if (!isOfficeFocusDefinitions(offices))
  throw new Error('Recorded Office and Focus definitions are invalid')

export const testOfficeFocusDefinitions = offices

const planning: unknown = capture.planningDefinitions

if (!isPlanningDefinitions(planning)) throw new Error('Recorded planning definitions are invalid')
export const testPlanningDefinitions = planning

export const testContracts = getContractCatalog(planning.factory.contracts)

const snapshot = normalizeGameStateSnapshot(capture)

if (!snapshot) throw new Error('Recorded factory snapshot is incompatible')
export const testGroundwater = snapshot.groundwater
