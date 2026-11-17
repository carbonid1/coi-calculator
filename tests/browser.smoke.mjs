import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))))
// Synthetic topology exercises bays, separate islands and inland water in the UI.
const islandMap = JSON.parse(readFileSync(new URL('./fixtures/island-map.json', import.meta.url), 'utf8'))
// Positions and area membership come from the capture. Outlines and footprints
// are synthetic replay geometry; native geometry is verified separately.
const factoryLayout = {
  schemaVersion: 1, gameId: fixture.gameId, sessionId: fixture.sessionId,
  areas: fixture.logisticsZones.map(zone => {
    const members = fixture.areaEntities.filter(entity => entity.zones.some(area => area.id === zone.id))
    const minX = Math.min(...members.map(entity => entity.tile.x)) - 24
    const minY = Math.min(...members.map(entity => entity.tile.y)) - 24
    const maxX = Math.max(...members.map(entity => entity.tile.x)) + 24
    const maxY = Math.max(...members.map(entity => entity.tile.y)) + 24

    return { id: zone.id, outline: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] }
  }),
  shapes: [
    [[-16, -16, 16, 16]],
    [[-12, -6, 12, 6]],
    [[-6, -12, 6, 12]],
    [[-12, -12, 12, -6], [-12, 6, 12, 12], [-12, -6, -6, 6], [6, -6, 12, 6]],
  ],
  buildings: fixture.areaEntities.map((entity, index) => ({
    id: entity.entityId, prototypeId: entity.prototypeId, ...entity.tile,
    shape: entity.prototypeId.includes('Greenhouse') ? 0 : 1 + index % 3,
    constructed: entity.constructed, areas: entity.zones.map(zone => zone.id),
  })),
}
const addedBuilding = { id: 2_000_000_001, prototypeId: 'Greenhouse', x: 3100, y: 700, shape: 0, constructed: false, areas: [10] }
const centreOnlyBuilding = factoryLayout.buildings.find(building => building.areas.includes(14))
const waterPumps = fixture.machines.filter(machine => machine.aquifer?.id === '3247:647')
// Synthetic plumbing verifies connected reserves without assuming recorded pipe topology.
const waterNetwork = {
  pumpIds: waterPumps.map(pump => pump.entityId), activePumpIds: waterPumps.filter(pump => pump.running).map(pump => pump.entityId),
  aquiferIds: ['3247:647'], consumerIds: [fixture.cropFarms.find(farm => farm.zones.some(zone => zone.id === 10)).entityId],
  hasOtherSources: false, buffers: [{ entityId: 2_000_000_002, kind: 'tank', quantity: 60, capacity: 60 }],
}
const run = promisify(execFile)
const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9z8AAAAASUVORK5CYII=', 'base64')

// Reconstruct only the completed-window total from the capture. Individual
// monthly samples were not recorded; the unfinished month is deliberately huge.
const sampleMonths = Math.max(...Object.values(fixture.history.hydrogenFuel.byUse).map(use => use.sampleMonths))
const totalFuel = Math.round(fixture.history.hydrogenFuel.total.averagePerCycle * sampleMonths)
const history = {
  date: '24575-12-23', start: '24565-12-1', resolution: 'month', unknownIds: [],
  products: { Product_Hydrogen: { consumedAsFuel: [
    ...Array.from({ length: 120 }, (_, index) => index < 120 - sampleMonths ? 0
      : Math.floor(totalFuel / sampleMonths) + Number(index - (120 - sampleMonths) < totalFuel % sampleMonths)),
    999_999,
  ] } },
}

const listen = async server => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}

test('recorded factory: browser → Next API → replayed game API → worker → UI', { timeout: 300_000 }, async t => {
  const state = { mode: 'live', powerMeter: false, inventoryBonus: 0, pausedPumps: false, mapMode: 'live', layoutMode: 'live', addedBuilding: false, officeCostBonus: 0, planningCostBonus: 0, limitedConnections: false, worldMining: false }
  const requests = new Set()
  const snapshotRequests = { count: 0 }
  const upstream = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')

    requests.add(url.pathname)
    if (url.pathname === '/api/mods/CoiCalculatorExporter/snapshot') snapshotRequests.count++
    const json = (value, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      const body = JSON.stringify(value)

      if (url.pathname === '/api/mods/CoiCalculatorExporter/snapshot' && state.syncDelayMs) {
        setTimeout(() => response.end(body), state.syncDelayMs)
      } else response.end(body)
    }

    if (request.method !== 'GET') return json({ error: 'Replay is read-only' }, 405)
    if (state.mode === 'offline') return json({}, 503)
    if (url.pathname === '/api/v1/game-info') return json({ gameId: fixture.gameId, sessionId: fixture.sessionId,
      date: history.date, isPaused: true, speed: 1, tick: 0 })
    if (url.pathname === '/api/mods/CoiCalculatorExporter/island-map') {
      if (state.mapMode === 'missing') return json({}, 404)
      return json({ ...islandMap, gameId: fixture.gameId,
        sessionId: state.mapMode === 'other-session' ? 'other' : fixture.sessionId,
        landRows: state.mapMode === 'invalid' ? [[1, 0], ...islandMap.landRows.slice(1)] : islandMap.landRows })
    }
    if (url.pathname === '/api/mods/CoiCalculatorExporter/factory-layout') {
      if (state.layoutMode === 'missing') return json({}, 404)
      const buildings = state.layoutMode === 'partial'
        ? factoryLayout.buildings.filter(building => building.id !== centreOnlyBuilding.id) : factoryLayout.buildings

      return json({ ...factoryLayout,
        sessionId: state.layoutMode === 'other-session' ? 'other' : fixture.sessionId,
        shapes: state.layoutMode === 'invalid' ? [[[1, 1, 0, 0]]] : factoryLayout.shapes,
        buildings: state.addedBuilding ? [...buildings, addedBuilding] : buildings })
    }
    if (url.pathname === '/api/mods/CoiCalculatorExporter/snapshot') return json({
      ...fixture, products: undefined, exportedAtUtc: new Date().toISOString(),
      // Synthetic native meter readings exercise measured demand and reserve
      // comparisons independently of nameplate capacity or recipe utilization.
      electricity: state.powerMeter ? { demandMw: 150, surplusDemandMw: 0, consumedMw: 150, generationMw: 150,
        generationCapacityMw: 213, maximumGenerationCapacityMw: 345,
        byType: [{ prototypeId: 'FlatConveyorT3', name: 'Flat conveyor III', demandMw: 2,
          consumedMw: 2, maximumDemandMw: 4, entities: 100, transport: true }] } : undefined,
      saveId: state.saveId ?? fixture.saveId,
      spaceStation: state.stationCrewDisabled === undefined ? fixture.spaceStation
        : { ...fixture.spaceStation, currentLevel: 4, crewDisabled: state.stationCrewDisabled },
      productionEntities: fixture.productionEntities.map(entity => state.researchRunning !== undefined && entity.prototypeId.startsWith('ResearchLab')
        ? { ...entity, running: state.researchRunning && entity.entityId !== 317965 } : entity),
      areaEntities: fixture.areaEntities.map(entity => state.researchRunning !== undefined && entity.prototypeId.startsWith('ResearchLab')
        ? { ...entity, running: state.researchRunning && entity.entityId !== 317965 } : entity),
      world: state.worldMining ? { ...fixture.world,
        mines: fixture.world.mines.map(mine => mine.product.productId === 'Product_Sulfur'
          ? { ...mine, running: true, state: 'Working', outputPerCycle: 432, capacityPerCycle: 432, workers: 96, unityPerCycle: 1.6 } : mine),
        routes: fixture.world.routes.map(route => {
          if (!route.modules.every(module => module.selectedProduct?.productId === 'Product_Sulfur')) return route
          const local = fixture.storages.filter(storage => storage.product.productId === 'Product_Sulfur').slice(0, 2)

          return { ...route, running: true, modules: route.modules.map(module => ({ ...module, running: true, workers: 5 })),
            ship: { ...route.ship, running: true, workers: 36 }, operation: { ...route.operation,
              connections: [{ product: route.modules[0].selectedProduct, direction: 'import', capacityPerCycle: 450, storageEntityIds: local.map(storage => storage.entityId) }],
              modules: route.operation.modules.map(module => ({ ...module, state: 'Idle', operational: true, shoreQuantity: 0, shoreFreeCapacity: module.shoreCapacity, onboardQuantity: 0 })),
              ship: { ...route.operation.ship, state: 'NotEnoughToPickUp', availableCargo: [{ product: route.modules[0].selectedProduct, quantity: 0, capacity: 19000 }] },
            } }
        }),
      } : fixture.world,
      contracts: state.limitedConnections ? { ...fixture.contracts, routes: fixture.contracts.routes.map(route => {
        const contract = fixture.contracts.established.find(contract => contract.gameId === route.contractGameId)

        if (contract.importedProduct.productId !== 'Product_TitaniumOre') return route
        return { ...route, operation: { ...route.operation, connections: [
          { product: contract.exportedProduct, direction: 'export', capacityPerCycle: 0.01 },
          { product: contract.importedProduct, direction: 'import', capacityPerCycle: 10 },
        ] } }
      }) } : fixture.contracts,
      schemaVersion: state.mode === 'old-bridge' ? fixture.schemaVersion - 1 : fixture.schemaVersion,
      planningDefinitions: state.mode === 'missing-planning-definitions' ? undefined : {
        ...fixture.planningDefinitions, factory: state.mode === 'missing-factory-definitions' ? undefined : fixture.planningDefinitions.factory,
        research: fixture.planningDefinitions.research.map(research => ({
          ...research, costs: research.costs.map((cost, level) => cost + (level > 0 ? state.planningCostBonus : 0)),
        })),
      },
      officeFocusDefinitions: state.mode === 'missing-office-definitions' ? undefined : {
        ...fixture.officeFocusDefinitions, focuses: fixture.officeFocusDefinitions.focuses.map(focus => ({
          ...focus, pointCosts: focus.pointCosts.map((cost, step) => cost + (step > 0 ? state.officeCostBonus : 0)),
        })),
      },
      weather: state.mode === 'missing-weather' ? undefined : fixture.weather,
      groundwater: state.mode === 'missing-aquifers' ? { ...fixture.groundwater, aquifers: undefined }
        : { ...fixture.groundwater, aquifers: state.pausedPumps ? [...fixture.groundwater.aquifers].reverse() : fixture.groundwater.aquifers,
          networks: [{ ...waterNetwork, activePumpIds: state.pausedPumps ? [] : waterNetwork.activePumpIds }] },
      machines: state.pausedPumps ? [...fixture.machines].reverse().map(machine => machine.aquifer ? { ...machine, running: false } : machine) : fixture.machines,
      cropFarming: state.mode === 'missing-crop-definitions' ? undefined : { ...fixture.cropFarming, tiers: state.mode === 'missing-farm-tiers' ? undefined : fixture.cropFarming.tiers },
      spaceStationLevels: state.mode === 'missing-station-levels' ? undefined : fixture.spaceStationLevels,
      rocketIiDefinition: state.mode === 'missing-rocket-definition' ? undefined : fixture.rocketIiDefinition,
      chickenFarmDefinition: state.mode === 'missing-farm-definition' ? undefined : fixture.chickenFarmDefinition,
      sessionId: state.mode === 'different-session' ? '999' : fixture.sessionId,
    })
    if (url.pathname === '/api/v1/products') return state.mode === 'missing-products'
      ? json({}, 503) : json({ products: fixture.products.catalog, unknownIds: [] })
    if (url.pathname === '/api/v1/products/stats') return json({
      products: { ...fixture.products.inventory,
        Product_Gold: { ...fixture.products.inventory.Product_Gold, quantity: fixture.products.inventory.Product_Gold.quantity + state.inventoryBonus },
      }, unknownIds: [],
    })
    if (url.pathname === '/api/v1/products/history') return json(history)
    if (url.pathname.startsWith('/api/v1/icons/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/v1/icons/'.length))

      if (!fixture.products.catalog.some(product => product.id === id)) return json({}, 404)
      response.writeHead(200, { 'Content-Type': 'image/png' })
      return response.end(png)
    }
    return json({}, 404)
  })
  const upstreamPort = await listen(upstream)

  t.after(() => new Promise(resolve => { upstream.closeAllConnections(); upstream.close(resolve) }))

  const env = { ...process.env, COI_WEB_API_URL: `http://127.0.0.1:${upstreamPort}`,
    COI_SMOKE_DIST_DIR: '.next/smoke', NEXT_TELEMETRY_DISABLED: '1' }
  // Use pnpm's normal launcher so PostCSS sees the same dependency resolution
  // as `pnpm build`, including pnpm's hoisted dependency path on Windows.
  const buildCommand = process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/c', 'pnpm exec next build']]
    : ['pnpm', ['exec', 'next', 'build']]

  await run(buildCommand[0], buildCommand[1], { cwd: root, env, timeout: 120_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })
  const reservation = createServer()
  const port = await listen(reservation)

  await new Promise(resolve => reservation.close(resolve))
  const appUrl = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  const logs = []

  server.stdout.on('data', chunk => logs.push(String(chunk)))
  server.stderr.on('data', chunk => logs.push(String(chunk)))
  t.after(async () => {
    if (server.exitCode === null) {
      server.kill()
      await once(server, 'exit')
    }
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Next server did not start\n${logs.join('')}`)), 15_000)

    server.stdout.on('data', () => {
      if (logs.join('').includes('Ready')) { clearTimeout(timer); resolve() }
    })
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Next exited: ${code}\n${logs.join('')}`)) })
  })

  const browser = await chromium.launch()

  t.after(() => browser.close())
  const page = await browser.newPage()
  // Uncaught exceptions and console errors. Chrome also logs every non-2xx
  // response; the error-mode scenarios assert those through the UI instead.
  const errors = []

  page.setDefaultTimeout(25_000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text())
  })
  const waitForText = expected => page.waitForFunction(value => document.body.innerText.includes(value), expected)
  const text = () => page.evaluate('document.body.innerText')
  const click = name => page.getByRole('button', { name, exact: true }).click()
  const expandChecklist = async () => {
    const closedModules = await page.evaluate('Array.from(document.querySelectorAll("[data-checklist-module]:not([open])")).map(node => node.dataset.checklistModule)')

    for (const id of closedModules) {
      await page.locator(`[data-checklist-module=${JSON.stringify(id)}] > summary`).click()
    }
  }
  // A closed combobox keeps filtering by its old query until its list unmounts;
  // typing before then reopens that stale list.
  const listUnmounted = id => page.waitForFunction(listId => document.getElementById(listId) === null, id)
  const search = async (label, query) => {
    const input = `[aria-label=${JSON.stringify(label)}]`

    await page.locator(input).fill(query)
    return page.locator(`${input}[aria-controls]`).getAttribute('aria-controls')
  }
  const pick = async (label, name) => {
    const list = await search(label, name)

    await page.getByRole('option', { name, exact: true }).click()
    await listUnmounted(list)
  }
  const tooltip = async () => {
    await page.locator('[role="tooltip"]').first().waitFor()
    // The previously focused control's tooltip may still be fading out.
    await page.waitForFunction(`(() => {
      const tooltips = document.querySelectorAll('[role="tooltip"]')
      return tooltips.length === 1 && tooltips[0].hasAttribute('data-open') && tooltips[0].getAnimations().length === 0
    })()`)
  }
  const preset = async name => {
    await page.locator('[aria-label="Factory preset"]').click()
    await page.getByRole('option', { name, exact: true }).click()
  }
  const area = name => pick('Factory area', name)
  const tabClearance = async edge => {
    await page.locator(`nav[aria-label="Calculator sections"] button:${edge}-child`).focus()
    return page.evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="Calculator sections"]')
      const button = document.activeElement
      const outer = nav.getBoundingClientRect()
      const inner = button.getBoundingClientRect()
      return { left: inner.left - outer.left, right: outer.right - inner.right,
        top: inner.top - outer.top, bottom: outer.bottom - inner.bottom }
    })()`)
  }
  const screenshot = async name => {
    if (!process.env.COI_SMOKE_SCREENSHOTS) return
    mkdirSync(process.env.COI_SMOKE_SCREENSHOTS, { recursive: true })
    await page.screenshot({ path: join(process.env.COI_SMOKE_SCREENSHOTS, `${name}.png`) })
  }
  const ready = () => page.waitForFunction('document.querySelector("[data-game-sync=available]") !== null && document.querySelector("[data-plan-calculation=ready]") !== null && document.querySelector("nav") !== null', null, { timeout: 45_000 })

  await t.test('keeps the synced baseline and previews the iron ore and research shutdown plan', async () => {
    await page.goto(appUrl)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await ready()
    const selected = () => page.evaluate(`document.querySelector('[aria-label="Factory preset"]').textContent`)

    assert.equal(await selected(), 'Baseline')
    await page.locator('[aria-label="Factory preset"]').click()
    await page.getByRole('option').first().waitFor()
    assert.deepEqual(await page.evaluate('Array.from(document.querySelectorAll("[role=option]")).map(node => node.innerText)'), ['Baseline', 'Appliances & Iron Ore'])
    await page.keyboard.press('Escape')
    const summary = () => page.evaluate('Array.from(document.querySelectorAll("[data-summary-metric]")).map(node => node.innerText)')
    const baselineSummary = await summary()

    await preset('Appliances & Iron Ore')
    await ready()
    assert.equal(await selected(), 'Appliances & Iron Ore')
    assert.notDeepEqual(await summary(), baselineSummary)
    await expandChecklist()
    assert.match(await text(), /Build 1 Incineration plant/)
    assert.match(await text(), /Build 3 Thermal desalinators/)
    await page.reload()
    await ready()
    assert.equal(await selected(), 'Appliances & Iron Ore')
    await preset('Baseline')
    await ready()
    await expandChecklist()
    assert.doesNotMatch(await text(), /Unpause 2 Research Lab IV|Build Space Station level 4/)
    assert.doesNotMatch(await text(), /Build 1 Fast breeder reactor|Set 3× enrichment FBR|Unpause 1 Household Goods Module/)
    const key = `coi-factory-preset-v1:${encodeURIComponent(fixture.saveId)}`

    await page.evaluate(`localStorage.setItem(${JSON.stringify(key)}, JSON.stringify({presetId: 'third-fbr', changes: {priorities: {14: {water: 'local-first'}}}}))`)
    await page.reload()
    await ready()
    assert.equal(await selected(), 'Baseline')
    await expandChecklist()
    assert.doesNotMatch(await text(), /Build 1 Fast breeder reactor|Set 3× enrichment FBR/)
    state.stationCrewDisabled = false
    state.researchRunning = true
    await click('Sync now')
    await page.locator('[aria-label="Sync now"]:not([disabled])').first().waitFor()
    await ready()
    await preset('Appliances & Iron Ore')
    await ready()
    await expandChecklist()
    assert.match(await text(), /Pause 2 Research Lab IV/)
    assert.match(await text(), /Shut down Space Station/)
    assert.doesNotMatch(await text(), /Build Space Station level 4/)
    await screenshot('research-shutdown-plan')
    await page.setViewportSize({ width: 375, height: 900 })
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await page.locator('[aria-label="Factory preset"]').click()
    await page.getByRole('option').first().waitFor()
    assert.equal(await page.evaluate('document.querySelectorAll("[role=option]").length'), 2)
    await screenshot('baseline-mobile')
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await click('Contracts')
    const iron = 'details[data-contract-id="Contract_Product_IronOre_For_Product_VehicleParts2"]'

    await page.locator(iron).first().waitFor()
    assert.match(await page.evaluate(`document.querySelector('${iron}').innerText`), /Planned/)
    assert.match(await text(), /Establish the Vehicle Parts II → Iron Ore contract/)
    await preset('Baseline')
    await ready()
    state.stationCrewDisabled = undefined
    state.researchRunning = undefined
    await click('Sync now')
    await page.locator('[aria-label="Sync now"]:not([disabled])').first().waitFor()
    await ready()
  })

  await t.test('renders baseline resource requirements and preserves them after reload', async () => {
    await page.goto(appUrl)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await ready()
    await preset('Baseline')
    await ready()
    await click('Requirements')
    const requirements = () => page.evaluate(`document.querySelector('[aria-label="Resource requirements"]').innerText`)
    const scienceRequirements = await requirements()

    assert.match(scienceRequirements, /Consumed per in-game month[\s\S]*Freshwater[\s\S]*Iron ore[\s\S]*Copper ore[\s\S]*Groundwater[\s\S]*World-mine deliveries[\s\S]*Farm rain/i)
    const oreValues = await page.evaluate(`['ironOre', 'copperOre'].map(id => Number(document.querySelector('[data-requirement-value="' + id + '"]').textContent.replaceAll(',', '')))`)

    assert.ok(oreValues.every(quantity => Number.isFinite(quantity) && quantity > 0))
    await page.waitForFunction(`Array.from(document.querySelectorAll('[aria-label="Resource consumption"] img')).length === 3 && Array.from(document.querySelectorAll('[aria-label="Resource consumption"] img')).every(icon => icon.complete && icon.naturalWidth > 0)`)
    assert.doesNotMatch(scienceRequirements, /Unused supply|Experiment|Reference|Reset|Research levels/)
    assert.equal(await page.evaluate(`document.querySelectorAll('[aria-label="Resource requirements"] input, [aria-label="Resource requirements"] [role=slider]').length`), 0)
    assert.equal(await page.evaluate(`document.querySelectorAll('[aria-label="Factory area"]').length`), 0)
    await screenshot('resource-requirements')
    await page.locator('[aria-label="Freshwater sources"]').focus()
    await page.keyboard.press('Tab')
    await page.waitForFunction('document.querySelector("[role=tooltip]") !== null')
    assert.match(await text(), /Groundwater \+ world-mine deliveries[\s\S]*Farm rain reduces irrigation/)
    await page.keyboard.press('Escape')
    await page.reload()
    await ready()
    await click('Requirements')
    assert.equal(await requirements(), scienceRequirements)
    await page.setViewportSize({ width: 375, height: 900 })
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await screenshot('resource-requirements-mobile')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await click('Factory Total')
  })

  await t.test('loads the real calculation and navigates production, planning, inventory and diagnostics', async () => {
    await page.goto(appUrl)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await ready()
    await preset('Baseline')
    await ready()
    await expandChecklist()
    assert.match(await text(), /Factory Summary[\s\S]*Projected · flows \/ cycle[\s\S]*Modeled demand[\s\S]*122\.4 MW[\s\S]*\+356\.71 TFLOPS[\s\S]*\+0\.27 \/ cycle[\s\S]*6,954 \/ 7,488/)
    assert.doesNotMatch(await text(), /(?:Pause|Unpause|Build) \d+ Cracking Units?/)
    assert.doesNotMatch(await text(), /Unpause 2 Research Lab IV|Build Space Station level 4/)
    const storedRock = await page.evaluate(`document.querySelector('[aria-label="From storage"] li:has([aria-label="Inspect Rock supply"])').innerText`)

    assert.match(storedRock, /Rock[\s\S]*stored · [\d,.]+ in-game years remaining[\s\S]*48\.94/)
    assert.doesNotMatch(storedRock, /\bcycles\b/)
    assert.equal(await page.evaluate(`Array.from(document.querySelectorAll('section')).find(section => section.querySelector('h4')?.textContent === 'Deficit / cycle').querySelector('[aria-label="Inspect Rock supply"]') === null`), true)
    const desktopTabs = await tabClearance('first')

    assert.ok(desktopTabs.left >= 3 && desktopTabs.top >= 3 && desktopTabs.bottom >= 3,
      `Desktop selection/focus ring is clipped: ${JSON.stringify(desktopTabs)}`)
    await screenshot('factory-overview')
    await page.locator('[data-summary-metric="Electricity"] [tabindex]').focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await tooltip()
    assert.match(await page.evaluate('document.querySelector("[role=tooltip]").innerText'), /Measured power demand is unavailable/)
    await page.keyboard.press('Escape')

    await click('Resource supply')
    for (const [resource, quantity] of [['Core fuel', '12'], ['Core fuel (spent)', '12'], ['Recyclables', '58.48']]) {
      await pick('Resource', resource)
      const balance = new RegExp(`Supply\\s+${quantity.replace('.', '\\.')}\\s+Demand\\s+${quantity.replace('.', '\\.')}\\s+Remaining\\s+0`)

      assert.match(await text(), balance)
    }
    await click('Factory Total')

    await page.locator('[aria-label="Factory area"]').fill('no-such-area-qzx')
    await waitForText('No areas found.')
    assert.equal(await page.evaluate('document.querySelector("h2").textContent'), 'Factory Total')
    await page.locator('[aria-label="Factory area"]').fill('ste')
    assert.equal(await page.evaluate(`document.getElementById(document.querySelector('[aria-label="Factory area"]').getAttribute('aria-controls')).querySelectorAll('[role=option]').length`), 1)
    assert.match(await text(), /Steel #1/)
    await screenshot('area-search')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate('document.querySelector("h2").textContent'), 'Steel #1')
    assert.equal(await page.evaluate('document.querySelector("[aria-label=\\"Module resource balance\\"] button").getAttribute("aria-expanded")'), 'false')
    assert.ok(await page.evaluate('document.querySelector("[data-source=synced]").getBoundingClientRect().top < 650'))
    await screenshot('steel-compact')
    await page.getByRole('button', { name: 'Resource balance' }).click()
    assert.match(await text(), /Inputs \/ cycle[\s\S]*Seawater[\s\S]*Copper #1[\s\S]*37\.84[\s\S]*Outputs \/ cycle[\s\S]*Exhaust #1/)
    assert.equal(await page.evaluate('document.querySelectorAll("[aria-label=\\"Module inputs\\"] [data-resource-id=seaWater]").length'), 1)
    await screenshot('steel-balance')

    await page.setViewportSize({ width: 375, height: 900 })
    const list = await search('Factory area', 'nuc')

    await page.keyboard.press('Escape')
    await listUnmounted(list)
    assert.equal(await page.evaluate('document.querySelector("h2").textContent'), 'Steel #1')
    await page.locator('[aria-label="Factory area"]').fill('def')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate('document.querySelector("h2").textContent'), 'Default')
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    assert.equal(await page.evaluate('document.querySelector("[aria-label=\\"Module resource balance\\"] button").getAttribute("aria-expanded")'), 'false')
    const mobileStart = await tabClearance('first')

    assert.ok(mobileStart.left >= 3 && mobileStart.top >= 3 && mobileStart.bottom >= 3,
      `Mobile first-tab focus ring is clipped: ${JSON.stringify(mobileStart)}`)
    await screenshot('mobile-default')
    const mobileEnd = await tabClearance('last')

    assert.ok(mobileEnd.right >= 3 && mobileEnd.top >= 3 && mobileEnd.bottom >= 3,
      `Mobile last-tab focus ring is clipped: ${JSON.stringify(mobileEnd)}`)
    await screenshot('mobile-tabs-scrolled')
    await page.setViewportSize({ width: 1440, height: 1000 })

    await area('Offices')
    assert.match(await text(), /2 MW[\s\S]*582 TFLOPS[\s\S]*3,004/)
    assert.match(await text(), /Computing boost 2/)
    assert.ok(await page.evaluate('document.querySelectorAll("[data-source=synced]").length > 0'))
    await area('Computing')
    assert.match(await text(), /Basic Rack[\s\S]*369 \/ 369[\s\S]*1476/)
    await area('Nuclear')
    assert.match(await text(), /Electricity\s+Demand\s+13\.8 MW[\s\S]*24 TFLOPS[\s\S]*711/)
    await area('Population')
    assert.match(await text(), /7,488 population cap[\s\S]*Clinic I/)
    await click('Focus')
    assert.match(await text(), /Capacity\s+5,460[\s\S]*Allocated\s+5,450[\s\S]*Available\s+10/)
    await click('General Info')
    assert.match(await text(), /MAINTENANCE DEMAND \/ MONTH[\s\S]*Synced/)
    assert.doesNotMatch(await text(), /\bcycles\b/)
    await screenshot('maintenance-overview')
    await click('Research')
    assert.match(await text(), /Housing Capacity/i)
    const maintenanceCost = fixture.planningDefinitions.research.find(research => research.id === 'maintenanceOutput').costs[fixture.research.maintenanceOutput + 1]

    await page.locator('[aria-label^="Maintenance Output:"]').hover()
    await waitForText(maintenanceCost.toLocaleString('en-US'))
    await click('Mines')
    await page.locator('[data-island-outline]').first().waitFor()
    await page.waitForFunction('!document.querySelector("figure[aria-busy=true]")')
    assert.deepEqual(await page.evaluate(`(() => {
      const outline = document.querySelector('[data-island-outline]')
      return [[1800, -1000], [2000, -2350], [3500, -3900], [3850, -3500]]
        .map(([x, y]) => outline.isPointInFill(new DOMPoint(x, y)))
    })()`), [true, false, false, true], 'Coastline must preserve land, inland water and separate islands')
    assert.match(await text(), /Aquifers · 13 · 10 unused/)
    assert.deepEqual(await page.evaluate('[...document.querySelectorAll("[data-factory-area]")].map(area => Number(area.dataset.factoryArea))'), [10])
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building]").length'), factoryLayout.buildings.filter(building => building.areas.includes(10)).length)
    assert.match(await text(), /Harvester \/ cycle · 1Y[\s\S]*5\.63 Water/)
    assert.equal(await page.evaluate('document.querySelectorAll("[aria-label=\\"Aquifer inventory\\"] tbody tr").length'), 13)
    const unusedPumps = await page.evaluate(`Array.from(document.querySelectorAll('[aria-label="Aquifer inventory"] tbody tr'))
      .find(row => row.innerText.includes('1041, 3242')).cells[1].innerText`)

    assert.equal(unusedPumps, '0/3')
    const plotted = await page.evaluate(`Object.fromEntries(Array.from(document.querySelectorAll('[data-aquifer-id]')).map(group => {
      const point = group.querySelector('circle').getBoundingClientRect()
      return [group.dataset.aquiferId, { x: point.x + point.width / 2, y: point.y + point.height / 2 }]
    }))`)
    const aquifers = fixture.groundwater.aquifers
    const north = aquifers.reduce((a, b) => a.position.y > b.position.y ? a : b)
    const south = aquifers.reduce((a, b) => a.position.y < b.position.y ? a : b)
    const east = aquifers.reduce((a, b) => a.position.x > b.position.x ? a : b)
    const west = aquifers.reduce((a, b) => a.position.x < b.position.x ? a : b)

    assert.ok(plotted[north.id].y < plotted[south.id].y, 'Positive game Y must point north/up')
    assert.ok(plotted[east.id].x > plotted[west.id].x, 'Positive game X must point east/right')
    assert.equal(await page.evaluate('document.querySelector("[aria-label=\\"North\\"]").innerText'), 'N')
    assert.doesNotMatch(await text(), /North up|source radius to scale/)
    assert.ok(await page.evaluate('Array.from(document.querySelectorAll("[aria-label=\\"Weather over the next in-game year\\"] .h-8 span")).every(bar => bar.getBoundingClientRect().width > 30)'))
    assert.doesNotMatch(await page.evaluate('document.querySelector("[aria-label=\\"Water planning\\"]").innerText'), /\bcycles\b/)
    // Keep the map target visible without starting at the page's bottom, where
    // selecting an unused source removes the previous source's detail panel.
    await page.evaluate(`(() => {
      const target = document.querySelector('[aria-label="Select aquifer 3132, 1583 on map"]').getBoundingClientRect()
      window.scrollTo({ top: Math.max(0, target.bottom + window.scrollY - window.innerHeight + 100), behavior: 'instant' })
    })()`)
    const mapPageY = await page.evaluate('window.scrollY')

    await click('Select aquifer 3132, 1583 on map')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await page.evaluate('window.scrollY'), mapPageY, 'Selecting a source must not move the page')
    assert.ok(await page.evaluate(`(() => {
      const region = document.querySelector('[aria-label="Aquifer inventory"]')
      const row = region.querySelector('[data-aquifer-row="3132:1583"]').getBoundingClientRect()
      const viewport = region.getBoundingClientRect()
      return row.top >= viewport.top + region.querySelector('thead').getBoundingClientRect().height && row.bottom <= viewport.bottom
    })()`), 'Map selection must reveal the corresponding inventory row')
    await click('Inspect aquifer 1041, 3242')
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-area], [data-factory-building], [data-factory-building-point]").length'), 0,
      'Unassigned sources must not show unrelated factory areas')
    assert.equal(await page.evaluate('document.querySelector("[aria-label=\\"Inspect aquifer 1041, 3242\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-id=\\"1041:3242\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await page.evaluate('document.querySelectorAll("[aria-label=\\"Aquifer details\\"]").length'), 0)
    assert.equal(await page.evaluate('document.querySelectorAll("[aria-label=\\"Water planning\\"] input").length'), 0)
    assert.ok(await page.evaluate(`(() => {
      const region = document.querySelector('[aria-label="Aquifer inventory"]')
      return region.querySelector('thead').getBoundingClientRect().top >= region.getBoundingClientRect().top
    })()`), 'Aquifer column headings must remain visible after scrolling to a source')
    await screenshot('water-unused-source')
    await click('Select aquifer 1858, 795 on map')
    assert.deepEqual(await page.evaluate('[...document.querySelectorAll("[data-factory-area]")].map(area => Number(area.dataset.factoryArea))'), [14])
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building]").length'), factoryLayout.buildings.filter(building => building.areas.includes(14)).length)
    assert.deepEqual(await page.evaluate(`(() => {
      const shape = document.querySelector('[data-factory-shape="3"]')
      return [[0, 0], [9, 0], [0, -9]].map(([x, y]) => shape.isPointInFill(new DOMPoint(x, y)))
    })()`), [false, true, true], 'Building cut-outs must remain empty after north-up projection')
    const mappedBuilding = factoryLayout.buildings.find(building => building.areas.includes(14))

    assert.equal(await page.evaluate(`document.querySelector('[data-factory-building="${mappedBuilding.id}"]').getAttribute('transform')`),
      `translate(${mappedBuilding.x},${-mappedBuilding.y})`)
    assert.match(await page.evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Aquifer 7 · Population/)
    assert.doesNotMatch(await page.evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Forecast unavailable|First shortfall/)
    await screenshot('water-assigned-area')
    await page.locator('[data-aquifer-id="3247:647"]').focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-row=\\"3247:647\\"]").getAttribute("aria-pressed")'), 'true')
    assert.match(await page.evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Aquifer 13[\s\S]*First shortfall · estimate[\s\S]*None · 100Y[\s\S]*Min reserve · 100Y[\s\S]*Shortfall · 1Y[\s\S]*0 Water/)
    await page.locator('[aria-label="First shortfall estimate"]').focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await tooltip()
    assert.match(await text(), /Steady draw 210 \/ cycle · pump capacity 240 · sustainable output 210 Water \/ cycle\. 60 Water in connected tanks and pipes\. Pipe throughput excluded/)
    await page.keyboard.press('Escape')
    assert.doesNotMatch(await text(), /Use factory plan|Source scenario/)
    await screenshot('water-desktop')
    assert.ok(requests.has('/api/mods/CoiCalculatorExporter/factory-layout'))
    await page.setViewportSize({ width: 375, height: 900 })
    await page.locator('[aria-label="First shortfall estimate"]').focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await tooltip()
    assert.ok(await page.evaluate(`(() => {
      const tooltip = document.querySelector('[role="tooltip"]').getBoundingClientRect()
      return tooltip.left >= 8 && tooltip.right <= window.innerWidth - 8
    })()`), 'Forecast tooltip must fit the mobile viewport')
    await page.keyboard.press('Escape')
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await screenshot('water-mobile-details')
    await page.mouse.wheel(0, -2000)
    await screenshot('water-mobile')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await click('Reserves')
    assert.match(await text(), /Reserve runway[\s\S]*[\d,.]+ in-game years/i)
    assert.doesNotMatch(await text(), /\bcycles\b/)
    await click('Contracts')
    assert.match(await text(), /Hydrogen|Food pack/)
    const contractRows = 'details[data-contract-id]'

    assert.doesNotMatch(await text(), /Available contracts/)
    assert.equal(await page.evaluate('document.querySelector("[aria-labelledby=available-contracts-heading]")'), null)
    assert.equal(await page.evaluate(`document.querySelectorAll('${contractRows}[open]').length`), 0)
    assert.equal(await page.evaluate(`document.querySelectorAll('${contractRows}').length`), fixture.contracts.established.length)
    assert.match(await text(), /\d+ running/)
    await page.waitForFunction(`Array.from(document.querySelectorAll('${contractRows} > summary')).every(row => {
      const icons = Array.from(row.querySelectorAll('img'))
      return icons.length === 2 && icons.every(icon => icon.complete && icon.naturalWidth > 0)
    })`)
    await screenshot('contracts-overview')
    await page.locator(`${contractRows} > summary`).first().focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(`document.querySelector('${contractRows}').open`), true)
    assert.match(await page.evaluate(`document.querySelector('${contractRows}').innerText`), /Shipping[\s\S]*Capacity[\s\S]*Max import \/ month/)
    assert.doesNotMatch(await page.evaluate(`document.querySelector('${contractRows}').innerText`), /CargoDepotT|Cargo Ship|1×|Route workers/)
    await page.locator(`${contractRows} > summary`).first().hover()
    assert.ok(await page.evaluate(`(() => {
      const row = document.querySelector('${contractRows}')
      return row.children[1].firstElementChild.getBoundingClientRect().top - row.firstElementChild.getBoundingClientRect().bottom >= 12
    })()`), 'Expanded content keeps its inset when the header is hovered or focused')
    await screenshot('contracts-details')
    await page.keyboard.press('Enter')
    await page.setViewportSize({ width: 375, height: 900 })
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await screenshot('contracts-mobile')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await click('Factory Total')
    await page.getByRole('button', { name: 'Inspect Gold supply', exact: true }).click()
    assert.match(await text(), /Island inventory[\s\S]*Total quantity[\s\S]*Stored[\s\S]*Storage capacity/)
    assert.ok(await page.evaluate('Array.from(document.images).some(image => image.src.includes("/api/game-icons/") && image.complete && image.naturalWidth > 0)'))
    assert.ok(requests.has('/api/v1/products/history'))
    assert.ok(requests.has('/api/v1/products/stats'))
    assert.ok([...requests].some(path => path.startsWith('/api/v1/icons/')))
    await screenshot('resource-inspector')
    const inventory = await page.evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes(fixture.products.inventory.Product_Gold.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })))
    await click('Back to Factory Total')
    assert.match(await text(), /Factory Summary/)
    await click('Inspect Rock supply')
    assert.equal(await page.evaluate(`document.querySelector('[aria-label="Rock supply diagnosis"]') !== null`), true)
    assert.match(await page.evaluate(`document.querySelector('[aria-label="Supply sources"]').innerText`), /Reserves[\s\S]*48\.94/)
    await click('Back to Factory Total')
    assert.deepEqual(errors, [])
  })

  await t.test('syncs current inventory by keyboard without reloading and disables sync during the request', async () => {
    await click('Factory Total')
    await page.locator('[aria-label="Sync now"]').focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate('document.activeElement.getAttribute("aria-label")'), 'Sync now')
    await waitForText('Automatic sync every minute')
    state.inventoryBonus = 17
    state.syncDelayMs = 2500
    await page.keyboard.press('Enter')
    await page.locator('[aria-label="Sync now"][disabled][aria-busy="true"]').first().waitFor()
    assert.match(await page.evaluate('document.querySelector("[data-game-sync=syncing]").innerText'), /^Syncing game…/)
    assert.equal(await page.evaluate('document.querySelector("[data-plan-calculation]").innerText'), '')
    await page.locator('[aria-label="Sync now"]:not([disabled])').first().waitFor()
    state.syncDelayMs = 0
    await ready()
    await click('Inspect Gold supply')
    const inventory = await page.evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes((fixture.products.inventory.Product_Gold.quantity + 17).toLocaleString('en-US', { maximumFractionDigits: 2 })))
    await click('Back to Factory Total')
    await screenshot('manual-sync')
    // An unchanged response (304) must also settle the button and remain synced.
    await click('Sync now')
    await page.locator('[aria-label="Sync now"]:not([disabled])').first().waitFor()
    await ready()
    state.inventoryBonus = 0
  })

  await t.test('keeps aquifer numbers, rows, selection, focus and scroll stable through live pump changes', async () => {
    const response = await fetch(`${appUrl}/api/game-state`)

    assert.equal(response.status, 200)
    const etag = response.headers.get('etag')

    assert.ok(etag)
    assert.equal((await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })).status, 304)
    await click('Mines')
    await page.locator('[data-aquifer-id="3132:1583"]').focus()
    await page.keyboard.press('Space')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    const viewState = () => page.evaluate(`({ page: window.scrollY,
      table: document.querySelector('[aria-label="Aquifer inventory"]').scrollTop,
      rows: [...document.querySelectorAll('[data-aquifer-row]')].map(button => [button.dataset.aquiferRow, button.innerText]),
      markers: [...document.querySelectorAll('[data-aquifer-id]')].map(marker => [marker.dataset.aquiferId, marker.querySelector('text').textContent]) })`)
    const beforeRefresh = await viewState()

    state.inventoryBonus = 123
    state.pausedPumps = true
    state.addedBuilding = true
    state.officeCostBonus = 7
    state.planningCostBonus = 7
    const changed = await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })

    assert.equal(changed.status, 200)
    assert.notEqual(changed.headers.get('etag'), etag)
    assert.equal((await changed.json()).products.inventory.Product_Gold.quantity, fixture.products.inventory.Product_Gold.quantity + 123)
    const newQuantity = fixture.products.inventory.Product_Gold.quantity + 123
    const receivedUpdate = `JSON.parse(localStorage.getItem('coi-game-state-last-valid-v1'))?.products.inventory.Product_Gold.quantity === ${newQuantity}`

    // Same poll as the automatic one; a scripted click leaves keyboard focus on the map.
    await page.evaluate('document.querySelector("[aria-label=\\"Sync now\\"]").click()')
    for (const attempt of [0, 1, 2, 3]) {
      try {
        await page.waitForFunction(receivedUpdate, null, { timeout: 20_000 })
        break
      } catch (error) {
        if (attempt === 3) throw error
      }
    }
    await ready()
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-id=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await page.evaluate('document.activeElement.dataset.aquiferId'), '3132:1583')
    assert.deepEqual(await viewState(), beforeRefresh)
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-row=\\"3247:647\\"]").closest("tr").cells[1].innerText'), '0/5')
    await screenshot('water-after-live-refresh')
    await click('Select aquifer 3247, 647 on map')
    for (const attempt of [0, 1, 2, 3]) {
      try {
        await page.locator(`[data-factory-building="${addedBuilding.id}"]`).first().waitFor({ timeout: 20_000 })
        break
      } catch (error) {
        if (attempt === 3) throw error
      }
    }
    assert.equal(await page.evaluate(`document.querySelector('[data-factory-building="${addedBuilding.id}"]').dataset.constructed`), 'false')
    assert.equal(await page.evaluate('document.querySelector("[data-aquifer-id=\\"3247:647\\"] text").textContent'), '13')
    await screenshot('water-construction-refresh')
    await click('Factory Total')
    await page.getByRole('button', { name: 'Inspect Gold supply', exact: true }).click()
    const inventory = await page.evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes((fixture.products.inventory.Product_Gold.quantity + 123).toLocaleString('en-US', { maximumFractionDigits: 2 })))
    await click('Back to Factory Total')
    await click('Focus')
    const updatedFocusCost = fixture.officeFocusDefinitions.focuses.reduce((total, focus) => {
      const step = fixture.focus[focus.id].targetStep

      return total + focus.pointCosts[step] + (step > 0 ? 7 : 0)
    }, 0)

    assert.match(await text(), new RegExp(`Allocated\\s+${updatedFocusCost.toLocaleString('en-US')}`),
      'Focus costs must update from the refreshed native tables')
    await screenshot('focus-native-cost-update')
    await click('Research')
    const maintenanceCost = fixture.planningDefinitions.research.find(research => research.id === 'maintenanceOutput').costs[fixture.research.maintenanceOutput + 1]

    await page.locator('[aria-label^="Maintenance Output:"]').hover()
    await waitForText((maintenanceCost + 7).toLocaleString('en-US'))
    await screenshot('native-research-cost-update')
    state.inventoryBonus = 0
    state.pausedPumps = false
    state.officeCostBonus = 0
    state.planningCostBonus = 0
  })

  await t.test('rejects missing native data, incompatible Bridges and mixed sessions, then recovers', async () => {
    for (const [mode, status] of [['old-bridge', 422], ['missing-weather', 422], ['missing-aquifers', 422], ['missing-farm-definition', 422], ['missing-rocket-definition', 422], ['missing-station-levels', 422], ['missing-crop-definitions', 422], ['missing-office-definitions', 422], ['missing-planning-definitions', 422], ['missing-factory-definitions', 422], ['missing-farm-tiers', 422], ['missing-products', 502], ['different-session', 503], ['offline', 502]]) {
      state.mode = mode
      const response = await fetch(`${appUrl}/api/game-state`)

      assert.equal(response.status, status, mode)
      const { error } = await response.json()

      assert.ok(error, mode)
      if (mode === 'old-bridge') assert.equal(error, 'Update CoI Calculator Bridge for this version of the calculator.')
      else if (status === 422) assert.equal(error, 'The calculator could not read this factory.', mode)
    }
    await page.reload()
    await page.locator('[data-game-sync="error"]').first().waitFor({ timeout: 45_000 })
    assert.match(await page.evaluate('document.querySelector("[data-game-sync]").innerText'), /^Last sync · /)
    assert.equal(await page.evaluate('document.querySelectorAll("[data-source=synced]").length'), 0)
    await click('Mines')
    assert.match(await text(), /Current water data unavailable/)
    assert.equal(await page.evaluate('document.querySelectorAll("[aria-label=\\"Aquifer details\\"]").length'), 0)
    await click('Resource supply')
    assert.match(await text(), /Island inventory unavailable/)
    state.mode = 'live'
    await click('Sync now')
    await page.locator('[aria-label="Sync now"]:not([disabled])').first().waitFor()
    await ready()
    await click('Factory Total')
    assert.match(await text(), /6,954 \/ 7,488/)
    assert.deepEqual(errors, [])
  })

  await t.test('validates optional map layers, rejects other sessions and supports compatible Bridges without them', async () => {
    const route = `${appUrl}/api/island-map?${new URLSearchParams({ gameId: fixture.gameId, sessionId: fixture.sessionId })}`
    const response = await fetch(route)

    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).landRows, islandMap.landRows)
    assert.equal((await fetch(route, { headers: { 'If-None-Match': response.headers.get('etag') } })).status, 304)
    for (const [mode, status] of [['invalid', 502], ['other-session', 409], ['missing', 404]]) {
      state.mapMode = mode
      assert.equal((await fetch(route)).status, status)
    }
    const layoutRoute = `${appUrl}/api/factory-layout?${new URLSearchParams({ gameId: fixture.gameId, sessionId: fixture.sessionId })}`
    const layoutResponse = await fetch(layoutRoute)

    assert.equal(layoutResponse.status, 200)
    assert.equal((await layoutResponse.json()).buildings.length, factoryLayout.buildings.length + 1)
    assert.equal((await fetch(layoutRoute, { headers: { 'If-None-Match': layoutResponse.headers.get('etag') } })).status, 304)
    state.addedBuilding = false
    assert.equal((await fetch(layoutRoute, { headers: { 'If-None-Match': layoutResponse.headers.get('etag') } })).status, 200)
    state.layoutMode = 'partial'
    await page.reload()
    await ready()
    await click('Mines')
    await page.waitForFunction('!document.querySelector("figure[aria-busy=true]")')
    await click('Select aquifer 1858, 795 on map')
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building-point]").length'), 1,
      'A partial native layout must retain the real centre of an omitted static entity')
    assert.deepEqual(await page.evaluate(`(() => {
      const point = document.querySelector('[data-factory-building-point="${centreOnlyBuilding.id}"]')
      return [Number(point.getAttribute('cx')), Number(point.getAttribute('cy'))]
    })()`), [centreOnlyBuilding.x, -centreOnlyBuilding.y])
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building]").length'),
      factoryLayout.buildings.filter(building => building.areas.includes(14)).length - 1)
    for (const [mode, status] of [['invalid', 502], ['other-session', 409], ['missing', 404]]) {
      state.layoutMode = mode
      assert.equal((await fetch(layoutRoute)).status, status)
    }
    await page.reload()
    await ready()
    await click('Mines')
    await page.waitForFunction('!document.querySelector("figure[aria-busy=true]")')
    assert.equal(await page.evaluate('document.querySelectorAll("[data-island-outline]").length'), 0)
    assert.equal(await page.evaluate('document.querySelectorAll("[data-aquifer-id]").length'), 13)
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-area], [data-factory-building]").length'), 0)
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building-point]").length'), factoryLayout.buildings.filter(building => building.areas.includes(10)).length)
    await click('Select aquifer 1858, 795 on map')
    assert.match(await page.evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Population/)
    assert.equal(await page.evaluate('document.querySelectorAll("[data-factory-building-point]").length'), factoryLayout.buildings.filter(building => building.areas.includes(14)).length)
    await screenshot('water-without-terrain')
    assert.deepEqual(errors, [])
  })

  await t.test('persists full-throttle shipping and recalculates its resource pressure', async () => {
    await click('Contracts')
    const nativeContract = fixture.contracts.established.find(contract => contract.importedProduct.productId === 'Product_TitaniumOre')
    const row = `details[data-contract-id="${nativeContract.gameId}"]`
    const toggle = `${row} [role=switch]`

    await page.locator(`${row} > summary`).click()
    await page.locator(toggle).click()
    await page.waitForFunction(`document.querySelector('${row}').dataset.fullThrottle === 'true'`, null, { timeout: 45_000 })
    const rates = await page.evaluate(`(() => {
      const row = document.querySelector('${row}')
      const imported = row.querySelector('summary').children[2].querySelector('.font-mono').textContent
      const capacity = Array.from(row.querySelectorAll('dl > div')).find(field => field.querySelector('dt').textContent === 'Max import / month').querySelector('dd').textContent
      return [imported, capacity].map(value => Number(value.replaceAll(',', '')))
    })()`)

    assert.ok(rates[0] > 0 && Math.abs(rates[0] - rates[1]) < 0.001, 'Full throttle imports at measured route capacity')
    assert.equal(await page.evaluate(`document.querySelector('[aria-label="Factory preset"]').textContent`), 'Baseline · modified')
    await screenshot('contracts-full-throttle')
    state.limitedConnections = true
    await page.reload()
    await ready()
    await click('Contracts')
    await page.waitForFunction(`document.querySelector('${row}').dataset.fullThrottle === 'true'`, null, { timeout: 45_000 })
    await page.waitForFunction(`document.querySelector('${row}').innerText.includes('Line limit')`, null, { timeout: 45_000 })
    await page.locator(`${row} > summary`).click()
    assert.equal(await page.evaluate(`document.querySelector('${toggle}').getAttribute('aria-checked')`), 'true')
    const connectionDetails = await page.evaluate(`document.querySelector('${row}').innerText`)

    assert.match(connectionDetails, /input line:[\s\S]*capacity[\s\S]*planned/)
    assert.match(connectionDetails, /output line:[\s\S]*capacity[\s\S]*planned/)
    assert.match(connectionDetails, /Round trip[\s\S]*Save fuel[\s\S]*On/)
    await screenshot('contracts-connection-warning')
    await page.locator(toggle).click()
    await page.waitForFunction(`document.querySelector('${row}').dataset.fullThrottle === 'false'`, null, { timeout: 45_000 })
    state.limitedConnections = false
    assert.deepEqual(errors, [])
  })

  await t.test('shows built world mines, local stock and saved demand-balanced shipping', async () => {
    state.worldMining = true
    await page.reload()
    await ready()
    await click('Mines')
    const row = '[data-world-product="Product_Sulfur"]'
    const delivery = `${row} > summary > span:nth-child(3)`

    await page.waitForFunction(`document.querySelector('${delivery}')?.firstChild.textContent === '432'`, null, { timeout: 45_000 })
    assert.equal(await page.evaluate('document.querySelector("[data-world-product]").dataset.worldProduct'), 'Product_Sulfur')
    assert.equal(await page.evaluate('document.querySelectorAll("[data-world-product]").length'), new Set(fixture.world.mines.filter(mine => mine.repaired).map(mine => mine.product.productId)).size)
    assert.match(await page.evaluate(`document.querySelector('${row} > summary').innerText`), /172 workers/)
    assert.doesNotMatch(await page.evaluate(`document.querySelector('${row} > summary').innerText`), /8\/8/)
    assert.match(await page.evaluate('document.querySelector("[data-world-product=Product_CrudeOil] > summary").innerText'), /3,287,900/)
    await page.locator(`${row} > summary`).focus()
    await page.keyboard.press('Enter')
    assert.ok(await page.evaluate(`Array.from(document.querySelectorAll('${row} .text-success-foreground')).some(element => element.textContent === '8/8')`))
    const local = fixture.storages.filter(storage => storage.product.productId === 'Product_Sulfur').slice(0, 2)
    const quantity = local.reduce((sum, storage) => sum + storage.quantity, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

    assert.match(await page.evaluate(`document.querySelector('${row}').innerText`), new RegExp(`Depot-connected stock[\\s\\S]*${quantity}`))
    await screenshot('world-mines-full-throttle')
    await page.locator(`${row} [role=switch]`).click()
    await page.waitForFunction(`Number(document.querySelector('${delivery}').firstChild.textContent.replaceAll(',', '')) < 431`, null, { timeout: 45_000 })
    assert.match(await page.evaluate(`document.querySelector('${row}').innerText`), /Planned · Demand-balanced/)
    await page.reload()
    await ready()
    await click('Mines')
    await page.waitForFunction(`document.querySelector('${row}')?.dataset.fullThrottle === 'false'`, null, { timeout: 45_000 })
    await page.locator(`${row} > summary`).click()
    assert.equal(await page.evaluate(`document.querySelector('${row} [role=switch]').getAttribute('aria-checked')`), 'false')
    await page.setViewportSize({ width: 375, height: 900 })
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > window.innerWidth'), false)
    await screenshot('world-mines-mobile')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await preset('Baseline')
    await ready()
    await page.waitForFunction(`document.querySelector('${row}')?.dataset.fullThrottle === 'true'`, null, { timeout: 45_000 })
    assert.equal(await page.evaluate(`document.querySelector('[aria-label="Factory preset"]').textContent`), 'Baseline')
    await click('Contracts')
    const titanium = fixture.contracts.established.find(contract => contract.importedProduct.productId === 'Product_TitaniumOre')
    const contract = `details[data-contract-id="${titanium.gameId}"]`

    await page.locator(`${contract} > summary`).click()
    await page.locator(`${contract} [role=switch]`).click()
    await page.waitForFunction(`document.querySelector('${contract}').dataset.fullThrottle === 'true'`, null, { timeout: 45_000 })
    await click('Mines')
    assert.equal(await page.evaluate(`document.querySelector('${row}').dataset.fullThrottle`), 'true', 'Editing a different setting must not resurrect a discarded draft')
    await preset('Baseline')
    await ready()
    await click('Contracts')
    assert.equal(await page.evaluate(`document.querySelector('${contract}').dataset.fullThrottle`), 'false')
    state.worldMining = false
    assert.deepEqual(errors, [])
  })
})
