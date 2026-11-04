import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))))
// Synthetic topology exercises bays, separate islands and inland water in the UI.
const islandMap = JSON.parse(readFileSync(new URL('./fixtures/island-map.json', import.meta.url), 'utf8'))
// Positions and area membership come from the capture. Outlines and footprints
// are synthetic replay geometry; native geometry needs the next Bridge launch.
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
const run = promisify(execFile)
const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const browserCli = fileURLToPath(new URL('../node_modules/agent-browser/bin/agent-browser.js', import.meta.url))
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

test('recorded factory: browser → Next API → replayed game API → worker → UI', { timeout: 240_000 }, async t => {
  const state = { mode: 'live', inventoryBonus: 0, pausedPumps: false, mapMode: 'live', layoutMode: 'live', addedBuilding: false, officeCostBonus: 0, planningCostBonus: 0 }
  const requests = new Set()
  const upstream = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')

    requests.add(url.pathname)
    const json = (value, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(value))
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
      schemaVersion: state.mode === 'old-bridge' ? fixture.schemaVersion - 1 : fixture.schemaVersion,
      planningDefinitions: state.mode === 'missing-planning-definitions' ? undefined : {
        ...fixture.planningDefinitions, research: fixture.planningDefinitions.research.map(research => ({
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
        : { ...fixture.groundwater, aquifers: state.pausedPumps ? [...fixture.groundwater.aquifers].reverse() : fixture.groundwater.aquifers },
      machines: state.pausedPumps ? [...fixture.machines].reverse().map(machine => machine.aquifer ? { ...machine, running: false } : machine) : fixture.machines,
      cropFarming: state.mode === 'missing-crop-definitions' ? undefined : fixture.cropFarming,
      spaceStationLevels: state.mode === 'missing-station-levels' ? undefined : fixture.spaceStationLevels,
      rocketIiDefinition: state.mode === 'missing-rocket-definition' ? undefined : fixture.rocketIiDefinition,
      chickenFarmDefinition: state.mode === 'missing-farm-definition' ? undefined : fixture.chickenFarmDefinition,
      sessionId: state.mode === 'different-session' ? '999' : fixture.sessionId,
    })
    if (url.pathname === '/api/v1/products') return state.mode === 'missing-products'
      ? json({}, 503) : json({ products: fixture.products.catalog, unknownIds: [] })
    if (url.pathname === '/api/v1/products/stats') return json({
      products: { ...fixture.products.inventory,
        Product_Salt: { ...fixture.products.inventory.Product_Salt, quantity: fixture.products.inventory.Product_Salt.quantity + state.inventoryBonus },
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

  const session = `coi-smoke-${process.pid}`
  const browser = async (...args) => {
    const { stdout } = await run(process.execPath, [browserCli, '--session', session, '--json', ...args], {
      cwd: root, timeout: 55_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    })
    const result = JSON.parse(stdout)

    assert.equal(result.success, true, stdout)
    return result.data
  }
  const evaluate = async expression => (await browser('eval', '--base64', Buffer.from(expression).toString('base64'))).result
  const text = () => evaluate('document.body.innerText')
  const click = name => browser('find', 'role', 'button', 'click', '--name', name, '--exact')
  const area = async name => {
    await browser('fill', '[aria-label="Factory area"]', name)
    await browser('find', 'role', 'option', 'click', '--name', name, '--exact')
  }
  const tabClearance = async edge => {
    await browser('focus', `nav[aria-label="Calculator sections"] button:${edge}-child`)
    return evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="Calculator sections"]')
      const button = document.activeElement
      const outer = nav.getBoundingClientRect()
      const inner = button.getBoundingClientRect()
      return { left: inner.left - outer.left, right: outer.right - inner.right,
        top: inner.top - outer.top, bottom: outer.bottom - inner.bottom }
    })()`)
  }
  const screenshot = async name => {
    if (process.env.COI_SMOKE_SCREENSHOTS) await browser('screenshot', `${process.env.COI_SMOKE_SCREENSHOTS}/${name}.png`)
  }
  const ready = () => browser('wait', '--fn', 'document.body.innerText.includes("Game sync: Live") && document.querySelector("nav") !== null', '--timeout', '45000')

  t.after(() => browser('close'))

  await t.test('loads the real calculation and navigates production, planning, inventory and diagnostics', async () => {
    await browser('open', appUrl)
    await browser('set', 'viewport', '1440', '1000')
    await ready()
    assert.match(await text(), /Factory Summary[\s\S]*Projected · flows \/ cycle[\s\S]*\+20\.1 MW[\s\S]*\+118\.71 TFLOPS[\s\S]*-1\.08 \/ cycle[\s\S]*7,356 \/ 7,488/)
    assert.match(await text(), /Unpause 2 Research Lab IV/)
    assert.match(await text(), /Build Space Station level 4/)
    const desktopTabs = await tabClearance('first')

    assert.ok(desktopTabs.left >= 3 && desktopTabs.top >= 3 && desktopTabs.bottom >= 3,
      `Desktop selection/focus ring is clipped: ${JSON.stringify(desktopTabs)}`)
    await screenshot('factory-overview')
    await browser('focus', '[aria-label="297 MW demand / 317.1 MW generation capacity."]')
    await browser('wait', '[role="tooltip"]')
    assert.match(await text(), /297 MW demand \/ 317\.1 MW generation capacity/)
    await browser('press', 'Escape')

    await browser('fill', '[aria-label="Factory area"]', 'no-such-area-qzx')
    await browser('wait', '--text', 'No areas found.')
    assert.equal(await evaluate('document.querySelector("h2").textContent'), 'Factory Total')
    await browser('fill', '[aria-label="Factory area"]', 'ste')
    assert.equal(await evaluate('document.querySelectorAll("[role=option]").length'), 1)
    assert.match(await text(), /Steel #1/)
    await screenshot('area-search')
    await browser('press', 'ArrowDown')
    await browser('press', 'Enter')
    assert.equal(await evaluate('document.querySelector("h2").textContent'), 'Steel #1')
    assert.equal(await evaluate('document.querySelector("[aria-label=\\"Module resource balance\\"] button").getAttribute("aria-expanded")'), 'false')
    assert.ok(await evaluate('document.querySelector("[data-source=synced]").getBoundingClientRect().top < 650'))
    await screenshot('steel-compact')
    await browser('find', 'role', 'button', 'click', '--name', 'Resource balance')
    assert.match(await text(), /Inputs \/ cycle[\s\S]*Seawater[\s\S]*Copper #1[\s\S]*88\.15[\s\S]*Outputs \/ cycle[\s\S]*Exhaust #1/)
    assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"Module inputs\\"] [data-resource-id=seaWater]").length'), 1)
    await screenshot('steel-balance')

    await browser('set', 'viewport', '375', '900')
    await browser('fill', '[aria-label="Factory area"]', 'nuc')
    await browser('press', 'Escape')
    assert.equal(await evaluate('document.querySelector("h2").textContent'), 'Steel #1')
    await browser('fill', '[aria-label="Factory area"]', 'def')
    await browser('press', 'ArrowDown')
    await browser('press', 'Enter')
    assert.equal(await evaluate('document.querySelector("h2").textContent'), 'Default')
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    assert.equal(await evaluate('document.querySelector("[aria-label=\\"Module resource balance\\"] button").getAttribute("aria-expanded")'), 'false')
    const mobileStart = await tabClearance('first')

    assert.ok(mobileStart.left >= 3 && mobileStart.top >= 3 && mobileStart.bottom >= 3,
      `Mobile first-tab focus ring is clipped: ${JSON.stringify(mobileStart)}`)
    await screenshot('mobile-default')
    const mobileEnd = await tabClearance('last')

    assert.ok(mobileEnd.right >= 3 && mobileEnd.top >= 3 && mobileEnd.bottom >= 3,
      `Mobile last-tab focus ring is clipped: ${JSON.stringify(mobileEnd)}`)
    await screenshot('mobile-tabs-scrolled')
    await browser('set', 'viewport', '1440', '1000')

    await area('Offices')
    assert.match(await text(), /2 MW[\s\S]*582 TFLOPS[\s\S]*3,004/)
    assert.match(await text(), /Computing boost 2/)
    assert.ok(await evaluate('document.querySelectorAll("[data-source=synced]").length > 0'))
    await area('Computing')
    assert.match(await text(), /Basic Rack[\s\S]*369 \/ 369[\s\S]*1476/)
    await area('Nuclear')
    assert.match(await text(), /\+163\.1 MW[\s\S]*24 TFLOPS[\s\S]*711/)
    await area('Population')
    assert.match(await text(), /7,488 population cap[\s\S]*Clinic I/)
    await click('Focus')
    assert.match(await text(), /Capacity\s+5,460[\s\S]*Allocated\s+5,450[\s\S]*Available\s+10/)
    await click('General Info')
    assert.match(await text(), /MAINTENANCE DEMAND[\s\S]*120 cycles · 10 in-game years/)
    await screenshot('maintenance-overview')
    await click('Research')
    assert.match(await text(), /Housing Capacity/i)
    const maintenanceCost = fixture.planningDefinitions.research.find(research => research.id === 'maintenanceOutput').costs[fixture.research.maintenanceOutput + 1]
    await browser('hover', '[aria-label^="Maintenance Output:"]')
    await browser('wait', '--text', maintenanceCost.toLocaleString('en-US'))
    await click('Mines')
    await browser('wait', '[data-island-outline]')
    await browser('wait', '--fn', '!document.querySelector("figure[aria-busy=true]")')
    assert.deepEqual(await evaluate(`(() => {
      const outline = document.querySelector('[data-island-outline]')
      return [[1800, -1000], [2000, -2350], [3500, -3900], [3850, -3500]]
        .map(([x, y]) => outline.isPointInFill(new DOMPoint(x, y)))
    })()`), [true, false, false, true], 'Coastline must preserve land, inland water and separate islands')
    assert.match(await text(), /Aquifers · 13 · 10 unused/)
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-factory-area]")].map(area => Number(area.dataset.factoryArea))'), [10])
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building]").length'), factoryLayout.buildings.filter(building => building.areas.includes(10)).length)
    assert.match(await text(), /Harvester \/ cycle · 1Y[\s\S]*5\.63 Water/)
    assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"Aquifer inventory\\"] tbody tr").length'), 13)
    const unusedPumps = await evaluate(`Array.from(document.querySelectorAll('[aria-label="Aquifer inventory"] tbody tr'))
      .find(row => row.innerText.includes('1041, 3242')).cells[1].innerText`)

    assert.equal(unusedPumps, '0/3')
    const plotted = await evaluate(`Object.fromEntries(Array.from(document.querySelectorAll('[data-aquifer-id]')).map(group => {
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
    assert.equal(await evaluate('document.querySelector("[aria-label=\\"North\\"]").innerText'), 'N')
    assert.doesNotMatch(await text(), /North up|source radius to scale/)
    assert.ok(await evaluate('Array.from(document.querySelectorAll("[aria-label=\\"Weather over the next 12 cycles\\"] .h-8 span")).every(bar => bar.getBoundingClientRect().width > 30)'))
    const mapPageY = await evaluate('window.scrollY')

    await click('Select aquifer 3132, 1583 on map')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await evaluate('window.scrollY'), mapPageY, 'Selecting a source must not move the page')
    assert.ok(await evaluate(`(() => {
      const region = document.querySelector('[aria-label="Aquifer inventory"]')
      const row = region.querySelector('[data-aquifer-row="3132:1583"]').getBoundingClientRect()
      const viewport = region.getBoundingClientRect()
      return row.top >= viewport.top + region.querySelector('thead').getBoundingClientRect().height && row.bottom <= viewport.bottom
    })()`), 'Map selection must reveal the corresponding inventory row')
    await click('Inspect aquifer 1041, 3242')
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-area], [data-factory-building], [data-factory-building-point]").length'), 0,
      'Unassigned sources must not show unrelated factory areas')
    assert.equal(await evaluate('document.querySelector("[aria-label=\\"Inspect aquifer 1041, 3242\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-id=\\"1041:3242\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"Aquifer details\\"]").length'), 0)
    assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"Water planning\\"] input").length'), 0)
    assert.ok(await evaluate(`(() => {
      const region = document.querySelector('[aria-label="Aquifer inventory"]')
      return region.querySelector('thead').getBoundingClientRect().top >= region.getBoundingClientRect().top
    })()`), 'Aquifer column headings must remain visible after scrolling to a source')
    await screenshot('water-unused-source')
    await click('Select aquifer 1858, 795 on map')
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-factory-area]")].map(area => Number(area.dataset.factoryArea))'), [14])
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building]").length'), factoryLayout.buildings.filter(building => building.areas.includes(14)).length)
    assert.deepEqual(await evaluate(`(() => {
      const shape = document.querySelector('[data-factory-shape="3"]')
      return [[0, 0], [9, 0], [0, -9]].map(([x, y]) => shape.isPointInFill(new DOMPoint(x, y)))
    })()`), [false, true, true], 'Building cut-outs must remain empty after north-up projection')
    const mappedBuilding = factoryLayout.buildings.find(building => building.areas.includes(14))

    assert.equal(await evaluate(`document.querySelector('[data-factory-building="${mappedBuilding.id}"]').getAttribute('transform')`),
      `translate(${mappedBuilding.x},${-mappedBuilding.y})`)
    assert.match(await evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Aquifer 7 · Population/)
    assert.doesNotMatch(await evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Forecast unavailable|First shortfall/)
    await screenshot('water-assigned-area')
    await browser('focus', '[data-aquifer-id="3247:647"]')
    await browser('press', 'Enter')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-row=\\"3247:647\\"]").getAttribute("aria-pressed")'), 'true')
    assert.match(await evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Aquifer 13[\s\S]*First shortfall · estimate[\s\S]*cycles · [\d,.]+ in-game years[\s\S]*Min reserve · 100Y[\s\S]*Shortfall · 1Y/)
    await browser('focus', '[aria-label="First shortfall estimate"]')
    await browser('press', 'Shift+Tab')
    await browser('press', 'Tab')
    await browser('wait', '[role="tooltip"]')
    assert.match(await text(), /Steady draw 210 \/ cycle · pump capacity 240 · sustainable output 210 Water \/ cycle\. Pipe delivery and tank buffers excluded/)
    await browser('press', 'Escape')
    assert.doesNotMatch(await text(), /Use factory plan|Source scenario/)
    await screenshot('water-desktop')
    assert.ok(requests.has('/api/mods/CoiCalculatorExporter/factory-layout'))
    await browser('set', 'viewport', '375', '900')
    await browser('focus', '[aria-label="First shortfall estimate"]')
    await browser('press', 'Shift+Tab')
    await browser('press', 'Tab')
    await browser('wait', '[role="tooltip"]')
    assert.ok(await evaluate(`(() => {
      const tooltip = document.querySelector('[role="tooltip"]').getBoundingClientRect()
      return tooltip.left >= 8 && tooltip.right <= window.innerWidth - 8
    })()`), 'Forecast tooltip must fit the mobile viewport')
    await browser('press', 'Escape')
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await screenshot('water-mobile-details')
    await browser('scroll', 'up', '2000')
    await screenshot('water-mobile')
    await browser('set', 'viewport', '1440', '1000')
    await click('Reserves')
    assert.match(await text(), /Reserve runway[\s\S]*cycles · [\d,.]+ in-game years/i)
    await click('Contracts')
    assert.match(await text(), /Hydrogen|Food pack/)
    await click('Factory Total')
    await browser('find', 'role', 'button', 'click', '--name', 'Inspect Salt supply', '--exact')
    assert.match(await text(), /Island inventory[\s\S]*Total quantity[\s\S]*Stored[\s\S]*Storage capacity/)
    assert.ok(await evaluate('Array.from(document.images).some(image => image.src.includes("/api/game-icons/") && image.complete && image.naturalWidth > 0)'))
    assert.ok(requests.has('/api/v1/products/history'))
    assert.ok(requests.has('/api/v1/products/stats'))
    assert.ok([...requests].some(path => path.startsWith('/api/v1/icons/')))
    await screenshot('resource-inspector')
    const inventory = await evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes(fixture.products.inventory.Product_Salt.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })))
    await click('Back to Factory Total')
    assert.match(await text(), /Factory Summary/)
    assert.equal((await browser('errors')).errors.length, 0)
  })

  await t.test('keeps aquifer numbers, rows, selection, focus and scroll stable through live pump changes', async () => {
    const response = await fetch(`${appUrl}/api/game-state`)

    assert.equal(response.status, 200)
    const etag = response.headers.get('etag')

    assert.ok(etag)
    assert.equal((await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })).status, 304)
    await click('Mines')
    await browser('focus', '[data-aquifer-id="3132:1583"]')
    await browser('press', 'Space')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    const viewState = () => evaluate(`({ page: window.scrollY,
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
    assert.equal((await changed.json()).products.inventory.Product_Salt.quantity, fixture.products.inventory.Product_Salt.quantity + 123)
    const newQuantity = fixture.products.inventory.Product_Salt.quantity + 123
    const receivedUpdate = `JSON.parse(localStorage.getItem('coi-game-state-last-valid-v1'))?.products.inventory.Product_Salt.quantity === ${newQuantity}`

    for (const attempt of [0, 1, 2, 3]) {
      try {
        await browser('wait', '--fn', receivedUpdate, '--timeout', '20000')
        break
      } catch (error) {
        if (attempt === 3) throw error
      }
    }
    await ready()
    assert.equal(await evaluate('document.querySelector("[data-aquifer-id=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-row=\\"3132:1583\\"]").getAttribute("aria-pressed")'), 'true')
    assert.equal(await evaluate('document.activeElement.dataset.aquiferId'), '3132:1583')
    assert.deepEqual(await viewState(), beforeRefresh)
    assert.equal(await evaluate('document.querySelector("[data-aquifer-row=\\"3247:647\\"]").closest("tr").cells[1].innerText'), '0/5')
    await screenshot('water-after-live-refresh')
    await click('Select aquifer 3247, 647 on map')
    for (const attempt of [0, 1, 2, 3]) {
      try {
        await browser('wait', `[data-factory-building="${addedBuilding.id}"]`, '--timeout', '20000')
        break
      } catch (error) {
        if (attempt === 3) throw error
      }
    }
    assert.equal(await evaluate(`document.querySelector('[data-factory-building="${addedBuilding.id}"]').dataset.constructed`), 'false')
    assert.equal(await evaluate('document.querySelector("[data-aquifer-id=\\"3247:647\\"] text").textContent'), '13')
    await screenshot('water-construction-refresh')
    await click('Factory Total')
    await browser('find', 'role', 'button', 'click', '--name', 'Inspect Salt supply', '--exact')
    const inventory = await evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes((fixture.products.inventory.Product_Salt.quantity + 123).toLocaleString('en-US', { maximumFractionDigits: 2 })))
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
    await browser('hover', '[aria-label^="Maintenance Output:"]')
    await browser('wait', '--text', (maintenanceCost + 7).toLocaleString('en-US'))
    await screenshot('native-research-cost-update')
    state.inventoryBonus = 0
    state.pausedPumps = false
    state.officeCostBonus = 0
    state.planningCostBonus = 0
  })

  await t.test('rejects missing native data, incompatible Bridges and mixed sessions, then recovers', async () => {
    for (const [mode, status] of [['old-bridge', 422], ['missing-weather', 422], ['missing-aquifers', 422], ['missing-farm-definition', 422], ['missing-rocket-definition', 422], ['missing-station-levels', 422], ['missing-crop-definitions', 422], ['missing-office-definitions', 422], ['missing-planning-definitions', 422], ['missing-products', 502], ['different-session', 503], ['offline', 502]]) {
      state.mode = mode
      const response = await fetch(`${appUrl}/api/game-state`)

      assert.equal(response.status, status, mode)
      assert.ok((await response.json()).error)
    }
    await browser('reload')
    await browser('wait', '--fn', 'document.body.innerText.includes("Game sync: Last sync")', '--timeout', '45000')
    assert.doesNotMatch(await text(), /Game sync: Live/)
    assert.equal(await evaluate('document.querySelectorAll("[data-source=synced]").length'), 0)
    await click('Mines')
    assert.match(await text(), /Current water data unavailable/)
    assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"Aquifer details\\"]").length'), 0)
    await click('Resource supply')
    assert.match(await text(), /Island inventory unavailable/)
    state.mode = 'live'
    await browser('reload')
    await ready()
    assert.match(await text(), /7,356 \/ 7,488/)
    assert.equal((await browser('errors')).errors.length, 0)
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
    await browser('reload')
    await ready()
    await click('Mines')
    await browser('wait', '--fn', '!document.querySelector("figure[aria-busy=true]")')
    await click('Select aquifer 1858, 795 on map')
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building-point]").length'), 1,
      'A partial native layout must retain the real centre of an omitted static entity')
    assert.deepEqual(await evaluate(`(() => {
      const point = document.querySelector('[data-factory-building-point="${centreOnlyBuilding.id}"]')
      return [Number(point.getAttribute('cx')), Number(point.getAttribute('cy'))]
    })()`), [centreOnlyBuilding.x, -centreOnlyBuilding.y])
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building]").length'),
      factoryLayout.buildings.filter(building => building.areas.includes(14)).length - 1)
    for (const [mode, status] of [['invalid', 502], ['other-session', 409], ['missing', 404]]) {
      state.layoutMode = mode
      assert.equal((await fetch(layoutRoute)).status, status)
    }
    await browser('reload')
    await ready()
    await click('Mines')
    await browser('wait', '--fn', '!document.querySelector("figure[aria-busy=true]")')
    assert.equal(await evaluate('document.querySelectorAll("[data-island-outline]").length'), 0)
    assert.equal(await evaluate('document.querySelectorAll("[data-aquifer-id]").length'), 13)
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-area], [data-factory-building]").length'), 0)
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building-point]").length'), factoryLayout.buildings.filter(building => building.areas.includes(10)).length)
    await click('Select aquifer 1858, 795 on map')
    assert.match(await evaluate('document.querySelector("[aria-label=\\"Aquifer details\\"]").innerText'), /Population/)
    assert.equal(await evaluate('document.querySelectorAll("[data-factory-building-point]").length'), factoryLayout.buildings.filter(building => building.areas.includes(14)).length)
    await screenshot('water-without-terrain')
    assert.equal((await browser('errors')).errors.length, 0)
  })
})
