import sharedConfig from '@carbonid1/eslint-config/nextjs'

const config = [...sharedConfig, { ignores: ['.next/**', 'next-env.d.ts'] }]

export default config
