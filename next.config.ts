import type { NextConfig } from 'next'

import { getCalculationVersion } from './scripts/calculation-version'

const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.COI_SMOKE_DIST_DIR || '.next',
  env: { CALCULATION_CACHE_VERSION: getCalculationVersion() },
}

export default nextConfig
