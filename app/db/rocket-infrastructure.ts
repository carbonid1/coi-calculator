export const rocketInfrastructureItems = [
  {
    id: 'rocketAssemblyDepot',
    recipeId: 'rocket-ii-assembly',
    name: 'Rocket Assembly Depot',
    building: 'Rocket Assembly Depot',
    workers: 160,
  },
  {
    id: 'rocketLaunchPad',
    recipeId: 'rocket-ii-launch-amortized',
    name: 'Rocket Launch Pad',
    building: 'Rocket Launch Pad',
    workers: 30,
  },
] as const

export type RocketInfrastructureId = (typeof rocketInfrastructureItems)[number]['id']
export type RocketInfrastructureConfig = Record<RocketInfrastructureId, number>

export const emptyRocketInfrastructureConfig: RocketInfrastructureConfig = {
  rocketAssemblyDepot: 0,
  rocketLaunchPad: 0,
}

/** Planned orbital logistics capacity; neither building is present in the current save. */
export const plannedRocketInfrastructureConfig: RocketInfrastructureConfig = {
  rocketAssemblyDepot: 1,
  rocketLaunchPad: 1,
}

export const normalizeRocketInfrastructureConfig = (
  config: RocketInfrastructureConfig,
): RocketInfrastructureConfig => ({
  rocketAssemblyDepot: Math.max(0, Math.trunc(config.rocketAssemblyDepot)),
  rocketLaunchPad: Math.max(0, Math.trunc(config.rocketLaunchPad)),
})
