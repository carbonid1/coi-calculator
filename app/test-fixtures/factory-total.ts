import { type Module } from '../db/modules/modules'
import {
  calculateFactoryTotal as calculate,
  type FactoryTotalOptions,
} from '../helpers/factory-total/factory-total'
import { testPlanningDefinitions } from './recorded-game-data'

export const calculateFactoryTotal = (modules: Module[], options: FactoryTotalOptions) =>
  calculate(modules, {
    ...options,
    outputModifiers: { planningDefinitions: testPlanningDefinitions, ...options.outputModifiers },
  })
