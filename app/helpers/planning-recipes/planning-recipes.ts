import { getHousingTypes } from '../../db/housing'
import { type Recipe } from '../../db/recipes'
import { calculateSettlementPopulationFlows } from '../../db/settlement'
import { type PlanningDefinitions } from '../../planning-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

export const withPlanningDefinition = (
  recipe: Recipe,
  definitions?: PlanningDefinitions,
): Recipe => {
  const configuration = recipe.planningConfiguration

  if (!configuration) return recipe
  if (!definitions) throw new Error('Planning definitions unavailable for ' + recipe.id)
  const base = { ...recipe, planningConfiguration: undefined }

  if (configuration === 'housingII' || configuration === 'housingIII') {
    const housing = getHousingTypes(definitions)[configuration]
    const flows = calculateSettlementPopulationFlows(
      definitions,
      housing.populationCapacity,
      housing,
    )

    return {
      ...base,
      inputs: flows.inputs,
      outputs: flows.outputs,
      buildingData: { ...recipe.buildingData, workers: 0, electricityKw: flows.electricityKw },
    }
  }
  const ingredient = (product: { productId: string; quantity: number }) => {
    const resourceId = resolveSyncedResourceId({
      productId: product.productId,
      name: product.productId,
    })

    if (!resourceId) throw new Error('Computing product unavailable for ' + product.productId)
    return { resourceId, quantity: product.quantity }
  }

  if (configuration === 'basicRack') {
    const data = definitions.computing

    return {
      ...base,
      inputs: [ingredient({ productId: data.coolantInProductId, quantity: data.coolantInPerRack })],
      outputs: [
        ingredient({ productId: data.coolantOutProductId, quantity: data.coolantOutPerRack }),
        { resourceId: 'computing', quantity: data.computingPerRack },
      ],
    }
  }
  if (configuration === 'waterChiller')
    return {
      ...base,
      inputs: definitions.computing.chillerInputs.map(ingredient),
      outputs: definitions.computing.chillerOutputs.map(ingredient),
    }
  if (configuration === 'statue') {
    const resourceId = resolveSyncedResourceId({
      productId: definitions.statue.fuelProductId,
      name: definitions.statue.fuelProductId,
    })

    if (!resourceId) throw new Error('Statue fuel unavailable')
    return { ...base, inputs: [{ resourceId, quantity: definitions.statue.fuelPerCycle }] }
  }
  const prototypeId = recipe.id === 'solar-panel-mono' ? 'SolarPanelMono' : 'SolarPanel'
  const solar = definitions.solar.find(s => s.prototypeId === prototypeId)

  if (!solar) throw new Error('Solar definition unavailable for ' + prototypeId)
  return {
    ...base,
    outputs: [
      {
        resourceId: 'electricity',
        quantity: solar.productionKw / 1000,
        outputModifierId: 'solarPower',
      },
    ],
  }
}
