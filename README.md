# CoI Calculator

Factory planning for [Captain of Industry](https://www.captain-of-industry.com/),
connected through the game's local web server and **CoI Calculator Bridge**.

Use the Node.js and pnpm versions in [package.json](./package.json) and the game
version supported by the [Bridge manifest](./game-mod/CoiCalculatorExporter/manifest.json).

```sh
pnpm install
pnpm game-mod:install
pnpm dev
```

Restart the game after installing the Bridge, enable it when loading your factory,
then open [localhost:3000](http://localhost:3000). The Bridge starts the game server
on port 3073 and works while paused.

The calculator listens on this computer only. To reach it from another device, run `pnpm exec next dev --hostname 0.0.0.0`.

For another game-server port, set `COI_WEB_API_URL=http://127.0.0.1:3099` in
`.env.local` and restart the calculator.

Checks: `pnpm ts`, `pnpm lint`, `pnpm exec vitest run`, `pnpm build`. `pnpm lint:fix` fixes lint issues.

[Train Network Monitor](./game-mod/TrainNetworkMonitor/README.md) is maintained separately.
