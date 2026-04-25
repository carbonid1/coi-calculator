# CoI Calculator

Production chain calculator for [Captain of Industry](https://www.captain-of-industry.com/).

Pick a module, plug in building counts, see net resource flows and where to place sinks.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** via [`@carbonid1/tailwind-config/dashboard`](https://www.npmjs.com/package/@carbonid1/tailwind-config)
- **Configs** from [`@carbonid1/packages`](https://github.com/carbonid1/packages): `tsconfig`, `eslint-config`, `prettier-config`

State lives in `localStorage` — no backend, no login.

## Develop

Prerequisites: [portless](https://github.com/vercel-labs/portless).

```sh
pnpm install
pnpm dev
```

Open [coi-calculator.localhost](https://coi-calculator.localhost).

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm ts` | Type-check |
| `pnpm lint` | Lint + auto-fix |

## Modules

See [`docs/FBR-FUEL-LOOP.md`](./docs/FBR-FUEL-LOOP.md) for the canonical fuel-loop module reference.
