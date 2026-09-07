import { Card } from '@carbonid1/design-system'

import { type ResourceId, resources } from '../db/resources'
import { typedEntries } from '../helpers/typed-entries/typed-entries'
import { type WorldMineResult } from '../helpers/world-mines/calculate-world-mines'
import { type SyncedWorldState } from '../world-state'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const states: Record<string, string> = {
  Working: 'Working', FullStorage: 'Storage full', Paused: 'Off', NotEnoughWorkers: 'Missing workers',
  MissingWorkers: 'Missing workers', NotEnoughUnity: 'Missing Unity', ResourceDepleted: 'Depleted',
  Broken: 'Needs maintenance', NoShip: 'No ship', NoModulesBuilt: 'No active cargo modules',
  CannotLeave: 'Departure blocked', NotEnoughFuel: 'Missing fuel', UnknownJourney: 'Waiting for first voyage',
  ShoreStorageFull: 'Cargo Depot storage full', NoCargoCapacity: 'No cargo available', UnknownFuel: 'Voyage fuel unavailable',
  NothingToPickUp: 'Waiting for cargo', NotEnoughToPickUp: 'Waiting for cargo',
  TransferringCargo: 'Transferring cargo', InTransit: 'In transit', None: 'Ready',
}

const Metrics = ({ values }: { values: [string, React.ReactNode][] }) => (
  <dl className="grid gap-2 sm:grid-cols-2">
    {values.map(([label, value]) => (
      <div key={label} className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</dd>
      </div>
    ))}
  </dl>
)

const burstMetrics = (cycles: number | null): [string, React.ReactNode][] => cycles === null ? [] : [
  ['Burst remaining', `${format(cycles)} cycles · ${format(cycles / 12)} in-game years`],
]

const quantities = (values: Partial<Record<ResourceId, number>>) => typedEntries(values)
  .filter(([, quantity]) => quantity > 0)
  .map(([id, quantity]) => `${format(quantity)} ${resources[id].name}`).join(' · ') || '0'

export const WorldMinesView = ({ world, result }: { world: SyncedWorldState; result: WorldMineResult }) => (
  <section className="space-y-3" aria-label="World mines and cargo">
    {result.issues.map(issue => <p key={issue} className="text-sm text-muted-foreground">{issue}</p>)}
    <div className="grid gap-3 lg:grid-cols-2">
      {world.mines.filter(mine => mine.repaired).map(mine => (
        <Card.Root key={mine.entityId}>
          <Card.Content className="gap-3 p-4">
            <Card.Header>
              <Card.Title>{mine.name}</Card.Title>
              <Card.Action><span className="text-xs text-foreground">Synced · {states[mine.state] ?? mine.state}</span></Card.Action>
            </Card.Header>
            <Metrics values={[
              ['Production level', `${mine.productionStep} / ${mine.level}`],
              ['Output / cycle', `${format(mine.outputPerCycle)} ${mine.product.name}`],
              ['Offshore stock', `${format(mine.bufferQuantity)} / ${format(mine.bufferCapacity)}`],
              ['Workers', `${mine.workers} / ${mine.workersNeeded}`],
              ['Unity / cycle', format(mine.unityPerCycle)],
              ['Deposit', mine.depositQuantity === null ? 'Unlimited' : format(mine.depositQuantity)],
            ]} />
          </Card.Content>
        </Card.Root>
      ))}
      {result.routes.map(cargo => (
        <Card.Root key={cargo.route.depotEntityId}>
          <Card.Content className="gap-3 p-4">
            <Card.Header>
              <Card.Title>{cargo.route.depotCustomTitle || cargo.route.depotPrototypeName}</Card.Title>
              <Card.Action><span className="text-xs text-foreground">{states[cargo.status] ?? cargo.status}</span></Card.Action>
            </Card.Header>
            <p className="text-xs text-muted-foreground">{cargo.route.modules.length} / {cargo.route.slotCount} modules · {cargo.route.ship?.prototypeName ?? 'No ship'}</p>
            <Metrics values={[
              ['Delivery / cycle', cargo.fuelPerCycle === null ? 'Unavailable' : quantities(cargo.delivered)],
              ['Sustained delivery / cycle', cargo.fuelPerCycle === null ? 'Unavailable' : quantities(cargo.sustained)],
              ['Fuel / cycle', cargo.fuelPerCycle === null ? 'Unavailable' : `${format(cargo.fuelPerCycle)} ${cargo.fuelResourceId ? resources[cargo.fuelResourceId].name : ''}`],
              ['Fuel / voyage', cargo.route.ship?.fuelPerTrip === null || !cargo.route.ship ? 'Unavailable' : `${format(cargo.route.ship.fuelPerTrip)} ${cargo.route.ship.fuelProduct.name}`],
              ['Unity for shipping / cycle', format(cargo.unityPerCycle)],
              ['Onboard cargo', quantities(cargo.onboard)],
              ['Cargo Depot stock', quantities(cargo.onshore)],
              ['Crew', cargo.route.ship?.workers ?? 0],
              ['Module workers', cargo.route.modules.reduce((sum, module) => sum + module.workers, 0)],
              ...burstMetrics(cargo.burstCyclesRemaining),
            ]} />
          </Card.Content>
        </Card.Root>
      ))}
    </div>
    {!world.mines.some(mine => mine.repaired) && result.routes.length === 0 && (
      <p className="text-sm text-muted-foreground">No repaired world mines or world-cargo depots.</p>
    )}
  </section>
)
