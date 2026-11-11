import sharedConfig from '@carbonid1/eslint-config/nextjs'

const config = [...sharedConfig, { ignores: ['.next/**', '.claude/**', 'out/**', 'Builds/**', 'next-env.d.ts'] }]

export default config
