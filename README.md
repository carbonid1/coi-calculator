# CoI Calculator

Production chain calculator for [Captain of Industry](https://www.captain-of-industry.com/).

Pick a module, plug in building counts, see net resource flows and where to place sinks.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** via `@carbonid1/design-system/themes/dashboard`
- **Configs** from [`@carbonid1/packages`](https://github.com/carbonid1/packages): `tsconfig`, `eslint-config`, `prettier-config`

Factory configuration lives in the version-controlled domain files under `app/db` — no backend or login.

## Develop

Prerequisites: Node.js 24 and pnpm 11.20.0.

```sh
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm ts` | Type-check |
| `pnpm lint` | Lint + auto-fix |

## Modules

See [`docs/FBR-FUEL-LOOP.md`](./docs/FBR-FUEL-LOOP.md) for the canonical fuel-loop module reference.
