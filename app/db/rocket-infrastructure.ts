export const rocketInfrastructureItems = [
  {
    id: 'rocketAssemblyDepot',
    recipeId: 'rocket-ii-assembly',
  },
  {
    id: 'rocketLaunchPad',
    recipeId: 'rocket-ii-launch-amortized',
  },
] as const

export type RocketInfrastructureId = (typeof rocketInfrastructureItems)[number]['id']
export type RocketInfrastructureConfig = Record<RocketInfrastructureId, number>

export const emptyRocketInfrastructureConfig: RocketInfrastructureConfig = {
  rocketAssemblyDepot: 0,
  rocketLaunchPad: 0,
}

export const normalizeRocketInfrastructureConfig = (
  config: RocketInfrastructureConfig,
): RocketInfrastructureConfig => ({
  rocketAssemblyDepot: Math.max(0, Math.trunc(config.rocketAssemblyDepot)),
  rocketLaunchPad: Math.max(0, Math.trunc(config.rocketLaunchPad)),
})
