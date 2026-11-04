import { type Module, type Preset } from '../db/modules/modules'
import { buildModuleLines as build } from '../helpers/build-module-lines/build-module-lines'
import { type RecipeModifierMultipliers } from '../helpers/modifiers/recipe-output'
import { testOfficeFocusDefinitions, testPlanningDefinitions } from './recorded-game-data'

export const buildModuleLines = (
  module: Module,
  preset: Preset | null,
  modifiers: RecipeModifierMultipliers = {},
) =>
  build(module, preset, {
    officeFocusDefinitions: testOfficeFocusDefinitions,
    planningDefinitions: testPlanningDefinitions,
    ...modifiers,
  })
