import base from '@carbonid1/prettier-config'

const config = {
  ...base,
  plugins: [...base.plugins, 'prettier-plugin-tailwindcss'],
}

export default config
