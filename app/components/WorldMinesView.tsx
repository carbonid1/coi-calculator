import { cn, Item, Switch, Tooltip } from '@carbonid1/design-system'
import { Check, ChevronRight, CircleAlert, CirclePause, Ship } from 'lucide-react'
import { type ReactNode } from 'react'

import { type ResourceId } from '../db/resources'
import { formatInGameDuration } from '../helpers/format-in-game-duration'
import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources'
import { getWorldCargoWorkers, getWorldMineWorkers, type WorldCargoResult, type WorldMineResult } from '../helpers/world-mines/calculate-world-mines'
import { getWorldMineLocalStock } from '../helpers/world-mines/world-mine-storage'
import { type SyncedStorage, type SyncedWorldMine, type SyncedWorldState } from '../world-state'
import { ResourceToken } from './ResourceToken'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const mineState = (mine: SyncedWorldMine) => {
  if (!mine.running) return 'Paused'
  if (mine.state === 'Working') return 'Running'
  if (mine.state === 'FullStorage') return 'Storage full'
  return mine.state.replaceAll(/([a-z])([A-Z])/g, '$1 $2')
}
const groupState = (mines: SyncedWorldMine[], routes: WorldCargoResult[], active: boolean, shipping: boolean) => {
  if (!active) return shipping ? 'Mine paused' : 'Paused'
  if (!mines.some(mine => mine.running && (mine.state === 'Working' || mine.state === 'FullStorage'))) return 'Mine blocked'
  if (!shipping) return routes.length > 0 ? 'Shipping paused' : 'No depot'
  if (routes.every(cargo => cargo.status === 'ShoreStorageFull')) return 'Storage full'
  if (routes.every(cargo => cargo.status === 'NotEnoughFuel')) return 'No ship fuel'
  if (routes.every(cargo => cargo.status === 'NotEnoughWorkers')) return 'No ship workers'
  return 'Running'
}
const stateTone = (state: string) => {
  if (state === 'Running') return 'text-success-foreground'
  if (state === 'Paused') return 'text-muted-foreground'
  return 'text-attention-foreground'
}
const columns = 'grid grid-cols-[minmax(0,1fr)_5rem_1rem] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.3fr)_6rem_6rem_7rem_6rem_8rem_1rem]'
const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
    <dt className="min-w-0 text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right font-mono text-xs tabular-nums">{children}</dd>
  </div>
)
const Level = ({ mine }: { mine: SyncedWorldMine }) => (
  <Tooltip label={`${mine.name} · level ${mine.level} / ${mine.maxLevel} · ${mine.productionStep} production shifts`}>
    <span tabIndex={0} className={cn('rounded text-xs tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
      mine.level === mine.maxLevel ? 'text-success-foreground' : 'text-muted-foreground')}>
      {mine.level}/{mine.maxLevel}
    </span>
  </Tooltip>
)
const shipStates: Record<string, string> = {
  Paused: 'Paused', NoShip: 'No ship', InTransit: 'In transit', TransferringCargo: 'Transferring cargo',
  NotEnoughToPickUp: 'Waiting for cargo', NothingToPickUp: 'Waiting for cargo', NotEnoughFuel: 'No fuel',
  NotEnoughWorkers: 'No workers', CannotLeave: 'Dock blocked', ShoreStorageFull: 'Shore storage full',
  NoCargoCapacity: 'No import modules', UnknownJourney: 'Journey not measured', UnknownFuel: 'Fuel not measured',
}

const ShippingDetails = ({ cargo, resourceId, storages }: { cargo: WorldCargoResult; resourceId: ResourceId; storages: SyncedStorage[] }) => {
  const connection = cargo.route.operation.connections?.find(item => item.direction === 'import' && resolveSyncedResourceId(item.product) === resourceId)
  const local = getWorldMineLocalStock([cargo], resourceId, storages)
  const limited = connection?.capacityPerCycle != null && (cargo.delivered[resourceId] ?? 0) > connection.capacityPerCycle + 0.001
  const workers = getWorldCargoWorkers(cargo.route)
  const shared = new Set(cargo.route.modules.flatMap(module => module.selectedProduct ? [module.selectedProduct.productId] : [])).size > 1
  const localText = local && `${format(local.quantity)} / ${format(local.capacity)}`
  const localStatus = local?.count === 0 ? 'No storage' : localText
  const saveFuel = cargo.route.ship?.saveFuel ? 'On' : 'Off'

  return (
    <section className="space-y-2 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">{cargo.route.depotCustomTitle || cargo.route.depotPrototypeName}{shared && <span className="text-xs text-muted-foreground"> · Shared shipping</span>}</h4>
        <span className="text-xs text-muted-foreground">{shipStates[cargo.status] ?? cargo.status}</span>
      </div>
      <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Shipping</h5>
          <dl>
            <Field label={cargo.fuelResourceId ? <span className="inline-flex items-center gap-1"><ResourceToken resourceId={cargo.fuelResourceId} named /> / month</span> : 'Ship fuel / month'}>
              {cargo.fuelPerCycle === null ? 'Not measured' : format(cargo.fuelPerCycle)}
            </Field>
            <Field label="Round trip">{cargo.route.ship?.journeyDurationSeconds ? formatInGameDuration(cargo.route.ship.journeyDurationSeconds / 60) : 'Not measured'}</Field>
            <Field label="Save fuel">{cargo.route.ship ? saveFuel : '—'}</Field>
            <Field label="Workers">{workers}</Field>
          </dl>
        </div>
        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Capacity</h5>
          <dl>
            <Field label="Max import / month">{cargo.cycleDuration === null ? 'Not measured' : format((cargo.pickupLoads[resourceId] ?? 0) / cargo.cycleDuration)}</Field>
            <Field label="Output line / month">{connection?.capacityPerCycle == null ? 'Not measured' : format(connection.capacityPerCycle)}</Field>
            <Field label={<Tooltip label="Storage connected along this depot’s product lines, including chained storage. Stops at production buildings, train stations and other depots." maxWidth={320}><span tabIndex={0}>Depot-connected stock</span></Tooltip>}>
              {localStatus ?? 'Not measured'}
            </Field>
            <Field label="On ship / at depot">{format(cargo.onboard[resourceId] ?? 0)} / {format(cargo.onshore[resourceId] ?? 0)}</Field>
          </dl>
        </div>
      </div>
      {limited && <p className="flex gap-1.5 text-xs text-attention-foreground"><CircleAlert className="size-4 shrink-0" aria-hidden="true" />Output line: {format(connection?.capacityPerCycle ?? 0)} capacity &lt; {format(cargo.delivered[resourceId] ?? 0)} planned / month.</p>}
    </section>
  )
}

interface Props {
  world: SyncedWorldState
  result: WorldMineResult
  storages: SyncedStorage[]
  fullThrottlePreferences: Readonly<Record<string, boolean>>
  onFullThrottleChange?: (productId: string, enabled: boolean) => void
}

export const WorldMinesView = ({ world, result, storages, fullThrottlePreferences, onFullThrottleChange }: Props) => {
  const groups = new Map<string, SyncedWorldMine[]>()

  for (const mine of world.mines) {
    if (!mine.repaired) continue
    const group = groups.get(mine.product.productId) ?? []

    group.push(mine)
    groups.set(mine.product.productId, group)
  }
  const rows = [...groups].flatMap(([productId, mines]) => {
    const mine = mines[0]

    if (!mine) return []
    const resourceId = resolveSyncedResourceId(mine.product)
    const routes = resourceId ? result.routes.filter(cargo => cargo.route.modules.some(module => module.direction === 'import' && module.selectedProduct?.productId === productId)) : []
    const active = mines.some(mine => mine.running)
    const shipping = routes.some(cargo => cargo.route.running && cargo.route.ship?.running)

    return [{ productId, mines, resourceId, routes, active, shipping, name: mine.product.name }]
  }).toSorted((a, b) => Number(b.active) - Number(a.active) || Number(b.shipping) - Number(a.shipping)
    || a.name.localeCompare(b.name))
  const running = world.mines.filter(mine => mine.repaired && mine.running).length

  return (
    <section className="space-y-3" aria-labelledby="world-mines-heading">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id="world-mines-heading" className="text-sm font-semibold">World mines · {world.mines.filter(mine => mine.repaired).length}</h3>
        <span className="text-xs text-muted-foreground">{running} running · {world.mines.filter(mine => mine.repaired && !mine.running).length} paused</span>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No built world mines.</p> : <div>
        <div className={cn(columns, 'hidden items-center px-3 pb-2 text-xs text-muted-foreground sm:grid')} aria-hidden="true">
          <span>Mine</span><span className="text-right">Production<br />/ month</span><span className="text-right">Delivery<br />/ month</span><span className="text-right">Deposit left</span><span className="text-right">Unity / month<br />Workers</span><span>State</span><span />
        </div>
        <div className="space-y-1">
          {rows.map(({ productId, mines, resourceId, routes, active, shipping, name }) => {
            const fullThrottle = fullThrottlePreferences[productId] !== false
            const lineLimited = routes.some(cargo => cargo.route.operation.connections?.some(connection => (
              connection.direction === 'import' && connection.product.productId === productId && connection.capacityPerCycle !== null
              && (resourceId ? cargo.delivered[resourceId] ?? 0 : 0) > connection.capacityPerCycle + 0.001
            )))
            const unity = mines.reduce((total, mine) => total + mine.unityPerCycle, 0)
            const dedicated = routes.filter(cargo => cargo.route.modules.every(module => !module.selectedProduct || module.selectedProduct.productId === productId))
            const workers = mines.reduce((total, mine) => total + getWorldMineWorkers(mine), 0) + dedicated.reduce((total, cargo) => total + getWorldCargoWorkers(cargo.route), 0)
            const sharedActive = routes.some(cargo => !dedicated.includes(cargo) && getWorldCargoWorkers(cargo.route) > 0)
            const finite = mines.filter(mine => mine.depositQuantity !== null)
            const deposit = finite.length > 0 ? `${format(finite.reduce((total, mine) => total + (mine.depositQuantity ?? 0), 0))}${finite.length < mines.length ? ' + ∞' : ''}` : '∞'
            const state = groupState(mines, routes, active, shipping)
            const PausedIcon = state === 'Paused' || state === 'Mine paused' ? CirclePause : Ship
            const Icon = state === 'Running' ? Check : PausedIcon

            return (
              <Item.Root as="details" key={productId} surface="raised" className="group/world-mine block p-0" data-world-product={productId} data-full-throttle={fullThrottle}>
                <Item.Root as="summary" interactive className={cn(columns, 'cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden', !active && !shipping && 'text-muted-foreground')}>
                  <span className="min-w-0">
                    {resourceId ? <ResourceToken resourceId={resourceId} named /> : name}
                    {mines.length > 1 && <span className="mt-1 block text-xs text-muted-foreground">{mines.length} mines</span>}
                  </span>
                  <span className="hidden text-right font-mono text-sm tabular-nums sm:block">{format(resourceId ? result.production[resourceId] ?? 0 : 0)}</span>
                  <span className="text-right font-mono text-sm tabular-nums">{resourceId ? format(result.supplies[resourceId] ?? 0) : '—'}<span className="block font-sans text-xs text-muted-foreground sm:hidden">/ month</span></span>
                  <span className="hidden text-right font-mono text-xs tabular-nums sm:block">{deposit}</span>
                  <span className="col-start-2 row-start-2 text-right text-xs tabular-nums sm:col-start-auto sm:row-start-auto">{format(unity)}<span className="block text-muted-foreground">{workers} workers{sharedActive && <span className="block">+ shared shipping</span>}</span></span>
                  <span className="col-start-1 row-start-2 flex flex-col text-xs sm:col-start-auto sm:row-start-auto">
                    <span className={cn('inline-flex items-center gap-1', stateTone(state))}><Icon className="size-4 shrink-0" aria-hidden="true" />{state}</span>
                    {lineLimited && <span className="text-attention-foreground">Line limit</span>}
                    <span className={fullThrottle ? 'text-muted-foreground' : 'text-highlight-foreground'}>{fullThrottle ? 'Full throttle' : 'Planned · Demand-balanced'}</span>
                  </span>
                  <ChevronRight className="col-start-3 row-start-1 size-4 text-muted-foreground group-open/world-mine:rotate-90 sm:col-start-7" aria-hidden="true" />
                </Item.Root>
                <div className="max-w-4xl space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <Tooltip label="Forecast continuous production and shipping at the current enabled capacity." maxWidth={320}>
                      <label className="inline-flex cursor-pointer items-center gap-2">Full throttle<Switch.Root aria-label="Full throttle" checked={fullThrottle} disabled={!onFullThrottleChange} onCheckedChange={enabled => onFullThrottleChange?.(productId, enabled)}><Switch.Thumb /></Switch.Root></label>
                    </Tooltip>
                    <span className="text-muted-foreground">{fullThrottle ? 'Synced' : 'Planned · Demand-balanced'}</span>
                  </div>
                  <div className="space-y-1">
                    {mines.map(mine => <div key={mine.entityId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 rounded-lg bg-surface-inset px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_8rem_9rem]">
                      <span>{mine.name}<span className="ml-2 text-muted-foreground">{mineState(mine)}</span></span>
                      <Level mine={mine} />
                      <span className="tabular-nums text-muted-foreground">{mine.depositQuantity === null ? '∞ deposit' : `${format(mine.depositQuantity)} left`}</span>
                      <span className="text-right tabular-nums text-muted-foreground">{format(mine.bufferQuantity)} / {format(mine.bufferCapacity)} offshore</span>
                    </div>)}
                  </div>
                  {resourceId && routes.map(cargo => <ShippingDetails key={cargo.route.depotEntityId} cargo={cargo} resourceId={resourceId} storages={storages} />)}
                  {routes.length === 0 && <p className="text-xs text-muted-foreground">No cargo depot configured for this resource.</p>}
                </div>
              </Item.Root>
            )
          })}
        </div>
      </div>}
    </section>
  )
}
