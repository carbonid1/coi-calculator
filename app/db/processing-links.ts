import { type ProcessingLink } from '../helpers/processing-links/processing-links'

/** Configured connections within a specific factory save. */
export const getConfiguredProcessingLinks = (saveId: string | null | undefined): ProcessingLink[] => {
  if (saveId !== 'Last-Stop Waters') return []

  const furnace = { moduleId: 'general', buildingId: 'OxygenFurnace', recipeId: 'SteelSmelting' }

  return [
    {
      id: 'default-ilmenite-to-oxygen-furnace',
      source: { moduleId: 'general', buildingId: 'ArcFurnace2', recipeId: 'IlmeniteSmeltingArc2' },
      target: furnace,
      resourceId: 'moltenIron',
    },
    {
      id: 'default-oxygen-furnace-to-cooled-caster',
      source: furnace,
      target: { moduleId: 'general', buildingId: 'CasterCooled', recipeId: 'SteelCastingCooled' },
      resourceId: 'moltenSteel',
    },
  ]
}
