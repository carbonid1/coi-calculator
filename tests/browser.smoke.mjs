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
  const state = { mode: 'live', inventoryBonus: 0 }
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
    if (url.pathname === '/api/mods/CoiCalculatorExporter/snapshot') return json({
      ...fixture, products: undefined, exportedAtUtc: new Date().toISOString(),
      schemaVersion: state.mode === 'old-bridge' ? 45 : fixture.schemaVersion,
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
    await browser('focus', '[aria-label="294.5 MW demand / 314.6 MW generation capacity."]')
    await browser('wait', '[role="tooltip"]')
    assert.match(await text(), /294\.5 MW demand \/ 314\.6 MW generation capacity/)
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
    await click('Research')
    assert.match(await text(), /Housing Capacity/i)
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

  await t.test('serves conditional snapshots and refreshes inventory without starting the game', async () => {
    const response = await fetch(`${appUrl}/api/game-state`)

    assert.equal(response.status, 200)
    const etag = response.headers.get('etag')

    assert.ok(etag)
    assert.equal((await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })).status, 304)
    state.inventoryBonus = 123
    const changed = await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })

    assert.equal(changed.status, 200)
    assert.notEqual(changed.headers.get('etag'), etag)
    assert.equal((await changed.json()).products.inventory.Product_Salt.quantity, fixture.products.inventory.Product_Salt.quantity + 123)
    await browser('reload')
    await ready()
    await browser('find', 'role', 'button', 'click', '--name', 'Inspect Salt supply', '--exact')
    const inventory = await evaluate(`document.querySelector('[aria-label="Island inventory"]').innerText`)

    assert.ok(inventory.includes((fixture.products.inventory.Product_Salt.quantity + 123).toLocaleString('en-US', { maximumFractionDigits: 2 })))
    state.inventoryBonus = 0
  })

  await t.test('rejects missing native data, incompatible Bridges and mixed sessions, then recovers', async () => {
    for (const [mode, status] of [['old-bridge', 422], ['missing-farm-definition', 422], ['missing-rocket-definition', 422], ['missing-products', 502], ['different-session', 503], ['offline', 502]]) {
      state.mode = mode
      const response = await fetch(`${appUrl}/api/game-state`)

      assert.equal(response.status, status, mode)
      assert.ok((await response.json()).error)
    }
    await browser('reload')
    await browser('wait', '--fn', 'document.body.innerText.includes("Game sync: Last sync")', '--timeout', '45000')
    assert.doesNotMatch(await text(), /Game sync: Live/)
    assert.equal(await evaluate('document.querySelectorAll("[data-source=synced]").length'), 0)
    await click('Resource supply')
    assert.match(await text(), /Island inventory unavailable/)
    state.mode = 'live'
    await browser('reload')
    await ready()
    assert.match(await text(), /7,356 \/ 7,488/)
    assert.equal((await browser('errors')).errors.length, 0)
  })
})
