import { type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { calculateOfficePlan, focusCatalog, plannedOfficePlan } from '../db/offices'
import { normalizeFocusStates, resolveFocusAllocations } from '../focus-state'
import { testBuildingDefinitions } from '../test-fixtures/building-requirements'

vi.mock('@carbonid1/design-system', () => {
  const Part = (props: ComponentProps<'div'>) => <div {...props} />

  return {
    Card: { Root: Part, Content: Part, Header: Part, Title: Part, Description: Part, Action: Part },
    cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  }
})

import { FocusView } from './FocusView'

const plan = {
  ...plannedOfficePlan,
  focusSteps: { ...plannedOfficePlan.focusSteps, maintenanceProduction: 5, recyclingEfficiency: 2, contractsProfitability: 15 },
}

it('keeps missing allocations unknown without per-card state labels', () => {
  const html = renderToStaticMarkup(<FocusView
    calculation={calculateOfficePlan(plannedOfficePlan, 8, undefined, testBuildingDefinitions)}
    allocations={resolveFocusAllocations(undefined, {})}
  />)

  expect(html).not.toContain('data-source=')
  expect(html).not.toContain('Not synced')
  expect(html).toContain('Trucks Capacity')
  expect(html).toContain('— / 40')
  expect(html).toContain('— / 15')
  expect(html).not.toContain('Current effect')
  expect(html).not.toContain('Synced')
})

it('uses the synced treatment for confirmed allocations, including Off, and shows reduced active levels', () => {
  const synced = normalizeFocusStates(Object.fromEntries(focusCatalog.map(focus => [focus.id, {
    targetStep: plan.focusSteps[focus.id], activeStep: 0,
  }])))!
  const html = renderToStaticMarkup(<FocusView
    calculation={calculateOfficePlan(plan, 8, undefined, testBuildingDefinitions)}
    allocations={resolveFocusAllocations(synced, {})}
  />)

  expect(html.match(/data-source="synced"/g)).toHaveLength(focusCatalog.length)
  expect(html.match(/>Effect</g)).toHaveLength(focusCatalog.length)
  expect(html).toContain('Active 0 / 15')
  expect(html).not.toContain('Synced')
  expect(html).not.toContain('border-dashed')
  expect(html).not.toContain('Planned')
})

it('uses borders and backgrounds for future plans without additional state labels', () => {
  const synced = normalizeFocusStates(Object.fromEntries(focusCatalog.map(focus => {
    const step = focus.id === 'contractsProfitability' ? 7 : plan.focusSteps[focus.id]

    return [focus.id, { targetStep: step, activeStep: step }]
  })))!
  const html = renderToStaticMarkup(<FocusView
    calculation={calculateOfficePlan(plan, 8, undefined, testBuildingDefinitions)}
    allocations={resolveFocusAllocations(synced, { contractsProfitability: 15 })}
  />)

  expect(html.match(/data-source="synced"/g)).toHaveLength(11)
  expect(html.match(/data-source="planned"/g)).toHaveLength(1)
  expect(html).toContain('15 / 15')
  expect(html).toContain('border-dashed')
  expect(html).not.toContain('Synced')
  expect(html).not.toContain('Planned')
  expect(html).not.toContain('Not synced')
})
