import { globalIgnores } from 'eslint/config'
import sharedConfig from '@carbonid1/eslint-config/nextjs'

const config = [...sharedConfig, globalIgnores(['.next/**', 'next-env.d.ts'])]

export default config
