'use client'

import { Combobox } from '@base-ui/react/combobox'
import { Button, Input } from '@carbonid1/design-system'
import { ChevronDown } from 'lucide-react'

import { resources, type ResourceId } from '../db/resources'

const resourceName = (resourceId: ResourceId) => resources[resourceId].name

export const ResourcePicker = ({
  value,
  options,
  onChange,
}: {
  value: ResourceId
  options: readonly ResourceId[]
  onChange: (value: ResourceId) => void
}) => (
  <Combobox.Root
    items={options}
    value={value}
    itemToStringLabel={resourceName}
    autoHighlight
    onValueChange={nextValue => { if (nextValue !== null) onChange(nextValue) }}
  >
    <Combobox.InputGroup className="relative w-56 max-w-full">
      <Combobox.Input
        aria-label="Resource"
        placeholder="Search resources…"
        onFocus={event => event.currentTarget.select()}
        render={<Input className="pr-9" />}
      />
      <Combobox.Trigger
        aria-label="Show resources"
        render={<Button variant="ghost" size="icon" className="absolute inset-y-0 right-0" />}
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </Combobox.Trigger>
    </Combobox.InputGroup>
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-50">
        <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-popover outline-hidden">
          <Combobox.Empty className="px-3 text-sm text-muted-foreground not-empty:py-3">
            No resources found.
          </Combobox.Empty>
          <Combobox.List className="max-h-[min(15rem,var(--available-height))] overflow-y-auto p-1 empty:p-0">
            {(resourceId: ResourceId) => (
              <Combobox.Item
                key={resourceId}
                value={resourceId}
                className="flex min-h-9 cursor-default items-center rounded-lg px-2.5 py-2 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium"
              >
                {resourceName(resourceId)}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
)
