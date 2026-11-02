# CoI Calculator

Production chain calculator for [Captain of Industry](https://www.captain-of-industry.com/).

Pick a module, plug in building counts, see net resource flows and where to place sinks.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** via `@carbonid1/design-system/themes/dashboard`
- **Configs** from [`@carbonid1/packages`](https://github.com/carbonid1/packages): `tsconfig`, `eslint-config`, `prettier-config`

Factory data comes from the game's local web server through
[CoI Calculator Bridge](./game-mod/CoiCalculatorExporter/README.md).
Calculation rules and planning defaults live under `app/db`.

## Develop

Prerequisites: Node.js 24 and pnpm 11.20.0.

```sh
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

To connect a factory, install the bridge with `pnpm game-mod:install`, restart
Captain of Industry, and enable **CoI Calculator Bridge** when loading a game.
The bridge starts the game server on port 3073 and works while paused.
The calculator requires the Update 4.3 bridge; previous export files are no longer read.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm ts` | Type-check |
| `pnpm lint` | Lint + auto-fix |

## Modules

See [`docs/FBR-FUEL-LOOP.md`](./docs/FBR-FUEL-LOOP.md) for the canonical fuel-loop module reference.
