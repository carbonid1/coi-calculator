"use client";

import { type Preset } from "../db/modules/modules";

interface Props {
  presets: Preset[];
  active: string;
  onChange: (id: string) => void;
}

export const PresetSwitcher: React.FC<Props> = ({ presets, active, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {presets.map((preset) => (
      <button
        key={preset.id}
        onClick={() => onChange(preset.id)}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          active === preset.id
            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        {preset.name}
      </button>
    ))}
  </div>
);
