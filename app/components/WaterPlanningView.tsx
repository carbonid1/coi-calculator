import { Button, Card, TableScrollRegion, Tooltip } from '@carbonid1/design-system';
import { CloudRain, Droplets, Sun } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { type GameStateSnapshot } from '../game-state';
import { type PassiveResult, type ResourceFlow } from '../helpers/calculate/calculate';
import { GROUNDWATER_PUMP_OUTPUT_PER_CYCLE } from '../helpers/groundwater/calculate-groundwater-production';
import { buildWaterSourceInventory, getRainwaterHarvesterPotential, simulateWaterSource, summarizeWeather } from '../helpers/water-planning/water-planning';
import { MapFrame } from './MapFrame';
import { useProductState } from './ResourceProducts';

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

type WaterSource = ReturnType<typeof buildWaterSourceInventory>[number];

const SourceDetails = ({ source, number, snapshot }: { source: WaterSource; number: number; snapshot: GameStateSnapshot }) => {
  const forecast = useMemo(() => source.projectedWithdrawalPerCycle > 0
    ? simulateWaterSource(source.source, snapshot.groundwater, snapshot.weather, source.projectedPumps, source.projectedWithdrawalPerCycle)
    : null,
    [source.source, snapshot.groundwater, snapshot.weather, source.projectedPumps, source.projectedWithdrawalPerCycle]);

  return (
    <div className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface" aria-label="Aquifer details">
      <h3 className="text-sm font-semibold">Aquifer {number}
        {source.areas.length > 0 && <span className="font-normal text-muted-foreground"> · {source.areas.join(' · ')}</span>}
      </h3>
      {forecast && (
        <dl className="grid gap-3 text-sm sm:grid-cols-3" aria-live="polite">
          <div><dt className="text-xs text-muted-foreground"><Tooltip maxWidth={320} label={`Steady draw ${format(source.projectedWithdrawalPerCycle)} / cycle · pump capacity ${format(source.projectedPumps * GROUNDWATER_PUMP_OUTPUT_PER_CYCLE)} · sustainable output ${format(source.sustainableOutputPerCycle)} Water / cycle. Pipe delivery and tank buffers excluded.`}>
            <span tabIndex={0} aria-label="First shortfall estimate">First shortfall · estimate</span>
          </Tooltip></dt>
            <dd className="font-mono">{forecast.firstShortfallCycle === null ? 'None · 100Y'
              : `${format(forecast.firstShortfallCycle)} cycles · ${format(forecast.firstShortfallCycle / 12)} in-game years`}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Min reserve · 100Y</dt>
            <dd className="font-mono">{format(forecast.minimumReserve)} Water</dd></div>
          <div><dt className="text-xs text-muted-foreground">Shortfall · 1Y</dt>
            <dd className="font-mono">{format(forecast.firstYearShortfallQuantity)} Water</dd></div>
        </dl>
      )}
      {!forecast && <p className="text-sm text-muted-foreground">Forecast unavailable · weather override</p>}
    </div>
  );
};

interface Props {
  snapshot: GameStateSnapshot;
  sourceResults: readonly PassiveResult[];
  waterFlow?: ResourceFlow;
  rainwaterYieldMultiplier: number;
}

export const WaterPlanningView = (props: Props) => {
  const { current } = useProductState();
  const [selection, setSelection] = useState<{ gameId: string; id: string } | null>(null);

  if (!current) return <Card.Root aria-label="Water planning"><Card.Content>
    <p className="text-sm text-muted-foreground">Current water data unavailable.</p>
  </Card.Content></Card.Root>;
  return <CurrentWaterPlanningView {...props}
    selectedId={selection?.gameId === props.snapshot.gameId ? selection.id : null}
    onSelect={id => setSelection({ gameId: props.snapshot.gameId, id })} />;
};

const CurrentWaterPlanningView = ({ snapshot, sourceResults, waterFlow, rainwaterYieldMultiplier, selectedId, onSelect }: Props & {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const climate = useMemo(() => summarizeWeather(snapshot.weather), [snapshot.weather]);
  const sources = useMemo(() => buildWaterSourceInventory(snapshot, sourceResults), [snapshot, sourceResults]);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const selected = sources.find(row => row.source.id === selectedId) ?? sources[0];
  const rainwater = getRainwaterHarvesterPotential(climate, rainwaterYieldMultiplier);
  const nextRain = (() => {
    if (snapshot.weather.hasOverride) return 'Weather override';
    if (climate.nextRainCycles === 0) return 'Raining';
    return climate.nextRainCycles === null ? 'None in 100Y' : `${format(climate.nextRainCycles)} cycles`;
  })();
  const unused = sources.filter(row => row.builtPumps === 0);
  const date = snapshot.weather.startDate;
  const bounds = {
    minX: Math.min(...sources.map(({ source }) => source.position.x - source.radius)) - 140,
    minY: Math.min(...sources.map(({ source }) => source.position.y - source.radius)) - 80,
    maxX: Math.max(...sources.map(({ source }) => source.position.x + source.radius)) + 140,
    maxY: Math.max(...sources.map(({ source }) => source.position.y + source.radius)) + 160,
  };
  const hitRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 16;
  const selectFromMap = (id: string) => {
    onSelect(id);
    const region = inventoryRef.current?.querySelector<HTMLDivElement>('[aria-label="Aquifer inventory"]');
    const button = region && [...region.querySelectorAll<HTMLButtonElement>('[data-aquifer-row]')]
      .find(element => element.dataset.aquiferRow === id);

    if (!region || !button) return;
    const viewport = region.getBoundingClientRect();
    const row = button.closest('tr')?.getBoundingClientRect();
    const headerHeight = region.querySelector('thead')?.getBoundingClientRect().height ?? 0;

    if (!row) return;

    // Scroll only the inventory, keeping the map and keyboard focus in place.
    if (row.top < viewport.top + headerHeight) region.scrollTop += row.top - viewport.top - headerHeight;
    else if (row.bottom > viewport.bottom) region.scrollTop += row.bottom - viewport.bottom;
  };

  return (
    <Card.Root aria-label="Water planning">
      <Card.Header className="px-4 pt-4">
        <Card.Title><Droplets className="mr-2 inline h-4 w-4" />Water</Card.Title>
        <Card.Description><Tooltip label={`${snapshot.weather.difficulty} · Seed ${snapshot.weather.gameSeed}`}>
          <span tabIndex={0}>Year {date.year} · {date.month}/{date.day}</span>
        </Tooltip></Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Supply / demand per cycle</dt>
            <dd className="font-mono">{format(waterFlow?.produced ?? 0)} / {format(waterFlow?.consumed ?? 0)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Next rain</dt>
            <dd className="font-mono">{nextRain}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Harvester / cycle · 1Y</dt>
            <dd className="font-mono"><Tooltip maxWidth={320} label="Next in-game year, per Rainwater harvester, including Rainwater Yield research. Before storage overflow and delivery limits.">
              <span tabIndex={0}>{format(rainwater.nextYearPerCycle)} Water</span>
            </Tooltip></dd></div>
          <div><dt className="text-xs text-muted-foreground">Longest dry spell · 100Y</dt>
            <dd className="font-mono">{format(climate.longestDryCycles)} cycles</dd></div>
        </dl>
        <div aria-label="Weather over the next 12 cycles" className="space-y-1">
          <div className="text-xs text-muted-foreground">Next 12 cycles</div>
          <div className="grid grid-cols-12 gap-1">
            {climate.cycles.map((cycle, index) => (
              <Tooltip key={index} label={`Cycle ${index + 1}: rain ${format(cycle.rainIntensityPercent)}%, sunlight ${format(cycle.sunIntensityPercent)}%`}>
                <div tabIndex={0} className="w-full space-y-1 rounded bg-surface-inset p-1 inset-shadow-surface">
                  <div className="flex h-8 items-end"><span className="block w-full rounded-sm bg-primary" style={{ height: `${cycle.rainIntensityPercent}%` }} /></div>
                  <div className="flex h-4 items-end"><span className="block w-full rounded-sm bg-foreground/40" style={{ height: `${cycle.sunIntensityPercent}%` }} /></div>
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <Tooltip label="Average rain intensity over the next 100 in-game years.">
              <span tabIndex={0} className="flex items-center gap-1"><CloudRain className="h-3 w-3" aria-label="Rain" />{format(climate.averageRainIntensityPercent)}% · 100Y</span>
            </Tooltip>
            <Tooltip label="Average sunlight over the next in-game year.">
              <span tabIndex={0} className="flex items-center gap-1"><Sun className="h-3 w-3" aria-label="Sunlight" />{format(climate.nextYearAverageSunIntensityPercent)}% · 1Y</span>
            </Tooltip>
          </div>
          {snapshot.weather.hasOverride && <p className="text-xs text-muted-foreground">Forecast excludes weather override.</p>}
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <h3 className="font-semibold text-foreground">Aquifers · {sources.length} · {unused.length} unused</h3>
          <Tooltip maxWidth={320} label="Aquifers without built pumps. Physical source ceiling with enough pumps; excluded from factory supply until assigned and connected.">
            <span tabIndex={0}>Untapped {format(unused.reduce((sum, row) => sum + row.sustainableCeilingPerCycle, 0))} / cycle</span>
          </Tooltip>
        </div>
        {sources.length > 0 ? <>
          <div ref={inventoryRef} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <MapFrame label="Aquifer positions" bounds={bounds} interactive>
              {project => sources.map((row, index) => {
                const point = project(row.source.position);

                return <Button key={row.source.id} render={<g />} nativeButton={false}
                  data-aquifer-id={row.source.id} selected={row.source.id === selected?.source.id}
                  aria-pressed={row.source.id === selected?.source.id}
                  aria-label={`Select aquifer ${row.source.position.x}, ${row.source.position.y} on map`}
                  onClick={() => selectFromMap(row.source.id)}
                  className={`cursor-pointer ${row.source.id === selected?.source.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  <circle cx={point.x} cy={point.y} r={hitRadius} fill="transparent" />
                  <circle cx={point.x} cy={point.y} r={hitRadius} fill="none" stroke="currentColor" strokeWidth={2}
                    vectorEffect="non-scaling-stroke" className="pointer-events-none opacity-0 group-focus-visible/button:opacity-100" />
                  <circle cx={point.x} cy={point.y} r={row.source.radius} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={4} />
                  <text x={point.x} y={point.y - row.source.radius - 100} textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize={150}>{index + 1}</text>
                </Button>;
              })}
            </MapFrame>
            <TableScrollRegion label="Aquifer inventory" className="max-h-80 min-w-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card" rows={sources} rowKey={row => row.source.id} columns={[
                { accessorKey: 'source', header: 'Position', render: row => <Button variant="ghost" size="small" selected={row.source.id === selected?.source.id}
                  aria-pressed={row.source.id === selected?.source.id} aria-label={`Inspect aquifer ${row.source.position.x}, ${row.source.position.y}`}
                  data-aquifer-row={row.source.id}
                  onClick={() => onSelect(row.source.id)} className="font-mono text-xs">
                  {sources.indexOf(row) + 1} · {row.source.position.x}, {row.source.position.y}
                </Button> },
                { accessorKey: 'activePumps', header: <Tooltip maxWidth={320} label="Active pumps / pumps needed to reach the aquifer's sustainable ceiling."><span tabIndex={0}>Pumps</span></Tooltip>, align: 'end', render: row => <Tooltip label={`${row.activePumps} active · ${row.builtPumps} built · ${row.pumpsForCeiling} for sustainable ceiling`}>
                  <span tabIndex={0} className="font-mono">{row.activePumps}/{row.pumpsForCeiling}</span>
                </Tooltip> },
                { accessorKey: 'source', header: 'Reserve', align: 'end', render: row => <span className="whitespace-nowrap font-mono">{format(row.source.quantity)} / {format(row.source.capacity)}</span> },
                { accessorKey: 'sustainableCeilingPerCycle', header: <Tooltip maxWidth={320} label="Long-run physical source ceiling with enough pumps. Includes low-reserve difficulty assistance."><span tabIndex={0}>Ceiling / cycle</span></Tooltip>, align: 'end', render: row => <span className="font-mono">{format(row.sustainableCeilingPerCycle)}</span> },
                { accessorKey: 'projectedWithdrawalPerCycle', header: <Tooltip maxWidth={320} label="Projected groundwater withdrawal, apportioned across each area's aquifers. Delivery follows existing calculator area assignments."><span tabIndex={0}>Draw / cycle</span></Tooltip>, align: 'end', render: row => <span className="font-mono">{format(row.projectedWithdrawalPerCycle)}</span> },
              ]} />
          </div>
          {selected && selected.projectedWithdrawalPerCycle > 0 && <SourceDetails source={selected} number={sources.indexOf(selected) + 1} snapshot={snapshot} />}
        </> : <p className="text-sm text-muted-foreground">No groundwater sources on this map.</p>}
      </Card.Content>
    </Card.Root>
  );
};
