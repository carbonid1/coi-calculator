export type ResearchMode = 'before-space' | 'with-space'

export const baseConfig = {
  recyclingEfficiencyPercent: 20,
  researchMode: 'with-space',
} satisfies {
  recyclingEfficiencyPercent: number
  researchMode: ResearchMode
};
