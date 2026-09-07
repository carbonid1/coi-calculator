import type { NextConfig } from 'next'

import { getCalculationVersion } from './scripts/calculation-version'

const nextConfig: NextConfig = {
  env: { CALCULATION_CACHE_VERSION: getCalculationVersion() },
}

export default nextConfig
