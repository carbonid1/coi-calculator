'use client'

import { Autocomplete } from '@carbonid1/design-system'

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
  <Autocomplete.Root
    items={options}
    value={value}
    itemToStringLabel={resourceName}
    onValueChange={nextValue => { if (nextValue !== null) onChange(nextValue) }}
  >
    <Autocomplete.InputGroup className="w-56 max-w-full">
      <Autocomplete.Input
        aria-label="Resource"
        placeholder="Search resources…"
        onFocus={event => event.currentTarget.select()}
      />
      <Autocomplete.Trigger aria-label="Show resources" />
    </Autocomplete.InputGroup>
    <Autocomplete.Portal>
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <Autocomplete.Empty>No resources found.</Autocomplete.Empty>
          <Autocomplete.List>
            {(resourceId: ResourceId) => (
              <Autocomplete.Item key={resourceId} value={resourceId}>
                {resourceName(resourceId)}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
)
