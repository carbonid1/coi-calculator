import { describe, expect, it } from 'vitest'
import {
  runtimeRecipeBehaviors,
  runtimeRecipePriorities,
} from './runtime-recipe-behaviors'

describe('runtime recipe behaviors', () => {
  it('balances multi-output recipes by their primary product', () => {
    expect(runtimeRecipeBehaviors['ChemicalPlant2:BauxiteDigestion']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['hydratedAlumina'],
    })
    expect(runtimeRecipeBehaviors['AirSeparator:AirSeparation']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['oxygen', 'nitrogen'],
    })
    expect(runtimeRecipeBehaviors['HydrogenReformer:HydrogenProductionFromSteamSp']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['hydrogen', 'oxygen'],
    })
    expect(runtimeRecipeBehaviors['ArcFurnace2:IlmeniteSmeltingArc2']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['titaniumSlag'],
    })
    expect(runtimeRecipeBehaviors['ArcFurnace2:GlassSmeltingArcWithBroken']).toMatchObject({
      balanceBy: 'input',
      balanceInputIds: ['brokenGlass'],
    })
    expect(runtimeRecipeBehaviors['FoodProcessor:MeatProcessing']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['meat'],
    })
    expect(runtimeRecipeBehaviors['CharcoalMaker:CharcoalBurning']).toMatchObject({
      balanceBy: 'output',
      balanceOutputIds: ['coal'],
    })
  })

  it('uses only surplus eggs before falling back to meat for Food Packs', () => {
    expect(runtimeRecipeBehaviors['BakingUnit:CakeProduction']).toEqual({
      balanceBy: 'output',
      balanceOutputIds: ['cake'],
      demandPriority: -2,
    })
    expect(runtimeRecipeBehaviors['AssemblyRoboticT2:FoodPackEggsAssembly']).toEqual({
      balanceBy: 'output',
      balanceInputIds: ['eggs'],
      balanceOutputIds: ['foodPack'],
      demandPriority: -1,
    })
    expect(runtimeRecipeBehaviors['AssemblyRoboticT2:FoodPackMeatAssembly']).toEqual({
      balanceBy: 'output',
      balanceInputIds: [],
      balanceOutputIds: ['foodPack'],
    })
  })

  it('keeps waste and surplus routes input-driven', () => {
    const surplusDigestion = Object.entries(runtimeRecipeBehaviors).filter(([id]) => (
      id.startsWith('AnaerobicDigester:') && id.endsWith('Digestion')
      && id !== 'AnaerobicDigester:SludgeDigestion'
    ))

    expect(surplusDigestion).toHaveLength(10)
    expect(surplusDigestion.every(([, behavior]) => (
      behavior.allocation === 'surplus'
      && behavior.balanceBy === 'input'
      && behavior.balanceInputIds?.length === 1
    ))).toBe(true)
    expect(runtimeRecipeBehaviors['ExhaustScrubber:ExhaustFilteringLime']).toMatchObject({
      balanceBy: 'input',
      balanceInputIds: ['exhaust'],
      group: 'waste',
    })
    expect(runtimeRecipeBehaviors['ChemicalPlant2:EthanolCookingOilReforming']).toMatchObject({
      balanceOutputIds: [],
      consumeSurplusInputIds: ['cookingOil'],
    })
    expect(runtimeRecipeBehaviors['ChemicalPlant2:GraphiteProductionCo2']).toMatchObject({
      allocation: 'fallback',
      balanceBy: 'input',
      balanceInputIds: ['carbonDioxide'],
    })
    expect(runtimeRecipeBehaviors['FoodProcessor:MeatProcessingTrimmings']).toMatchObject({
      allocation: 'fallback',
      balanceBy: 'input',
      balanceInputIds: ['chickenCarcass'],
    })
    expect(runtimeRecipeBehaviors['IndustrialMixerT2:AnimalFeedCompost']).toMatchObject({
      allocation: 'surplus',
      balanceBy: 'input',
      balanceInputIds: ['animalFeed'],
    })
    expect(runtimeRecipeBehaviors['WaterTreatmentPlant:ToxicSlurryTreatment']).toEqual({
      allocation: 'surplus',
      balanceBy: 'input',
      balanceInputIds: ['toxicSlurry'],
    })
  })

  it('treats every smoke-stack recipe as disposal capacity', () => {
    const smallStack = Object.entries(runtimeRecipeBehaviors).filter(([id]) => (
      id.startsWith('SmokeStack:')
    ))
    const largeStack = Object.entries(runtimeRecipeBehaviors).filter(([id]) => (
      id.startsWith('SmokeStackLarge:')
    ))

    expect(smallStack).toHaveLength(8)
    expect(smallStack.every(([, behavior]) => (
      behavior.group === 'sink' && behavior.sinkScope === 'module'
    ))).toBe(true)
    expect(largeStack).toHaveLength(8)
    expect(largeStack.every(([, behavior]) => behavior.group === 'sink')).toBe(true)
  })

  it('uses organic Fertilizer I before the lower-yield fallback recipe', () => {
    expect(runtimeRecipePriorities).toMatchObject({
      'ChemicalPlant2:FertilizerProductionFromOrganic': 0,
      'ChemicalPlant2:FertilizerProduction': 1,
    })
  })
})
