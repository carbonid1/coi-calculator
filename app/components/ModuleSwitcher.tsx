"use client";

import { cn } from "@carbonid1/design-system";

import { type Module } from "../db/modules/modules";

interface Props {
  modules: Module[];
  active: string;
  factoryTotalId: string;
  onChange: (id: string) => void;
}

const tabClass = (isActive: boolean) =>
  cn("border-b-2 px-4 py-2 text-sm font-medium transition-colors", {
    "border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100": isActive,
    "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300":
      !isActive,
  });

export const ModuleSwitcher: React.FC<Props> = ({ modules, active, factoryTotalId, onChange }) => (
  <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
    {modules.map((mod) => (
      <button key={mod.id} onClick={() => onChange(mod.id)} className={tabClass(active === mod.id)}>
        {mod.name}
      </button>
    ))}
    <button onClick={() => onChange(factoryTotalId)} className={tabClass(active === factoryTotalId)}>
      Factory Total
    </button>
  </div>
);
