export type ResearchMode = 'before-space' | 'with-space'

export const baseConfig = {
  researchMode: 'with-space',
} satisfies {
  researchMode: ResearchMode
};
