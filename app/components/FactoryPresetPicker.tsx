'use client'

import { Select } from '@carbonid1/design-system'

import { factoryPresets, getFactoryPreset, type FactoryPresetId } from '../db/factory-presets'

interface Props {
  selected: FactoryPresetId
  modified: boolean
  disabled?: boolean
  onChange: (id: FactoryPresetId) => void
}

const items = factoryPresets.map(preset => ({ value: preset.id, label: preset.name }))

export const FactoryPresetPicker = ({ selected, modified, disabled, onChange }: Props) => (
  <Select aria-label="Factory preset" value={modified ? '' : selected} options={items}
    disabled={disabled} className="w-40 text-xs sm:w-52" menuAlign="end"
    placeholder={selected === 'current' ? 'Modified setup' : `${getFactoryPreset(selected).name} · modified`}
    onChange={id => onChange(getFactoryPreset(id).id)} />
)
