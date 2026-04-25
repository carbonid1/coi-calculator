import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.coi-calculator.localhost'],
  transpilePackages: ['@carbonid1/design-system'],
}

export default nextConfig
