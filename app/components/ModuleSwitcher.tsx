"use client";

import { Button } from "@carbonid1/design-system";
import {
  ChartPie,
  Factory,
  Handshake,
  Info,
  type LucideIcon,
} from "lucide-react";

import { type Module } from "../db/modules/modules";
import { getModuleIcon } from "./module-icons";
import { getModuleTabGroups } from "./module-tab-order";

interface Props {
  modules: Module[];
  active: string;
  contractsId: string;
  factoryTotalId: string;
  focusId: string;
  modifiersId: string;
  onChange: (id: string) => void;
  viewModuleIds: readonly string[];
}

interface SwitchButtonProps {
  active: boolean;
  children: React.ReactNode;
  icon: LucideIcon;
  onClick: () => void;
}

const SwitchButton: React.FC<SwitchButtonProps> = ({ active, children, icon: Icon, onClick }) => (
  <Button type="button" variant="ghost" selected={active} aria-pressed={active} onClick={onClick}>
    <Icon aria-hidden="true" className="size-4" />
    {children}
  </Button>
);

const ModuleTabGroup = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex items-start gap-2" role="group" aria-label={label}>
    <span className="w-16 shrink-0 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
);

export const ModuleSwitcher: React.FC<Props> = ({
  modules,
  active,
  contractsId,
  factoryTotalId,
  focusId,
  modifiersId,
  onChange,
  viewModuleIds,
}) => {
  const { presetModules, syncedModules, viewModules } = getModuleTabGroups(
    modules,
    new Set(viewModuleIds),
  );
  const renderModuleButton = (mod: Module) => {
      const Icon = getModuleIcon(mod);
      const inclusionLabel = mod.includedInFactoryTotals === false && !mod.liveArea
        ? `${mod.name}, planning-only and excluded from current Factory Total`
        : undefined;

      return (
        <SwitchButton
          key={mod.id}
          active={active === mod.id}
          icon={Icon}
          onClick={() => onChange(mod.id)}
        >
          <span
            aria-label={inclusionLabel}
          >
            {mod.name}
          </span>
        </SwitchButton>
      );
  };

  return (
    <nav className="space-y-1.5 border-b border-border pb-2" aria-label="Calculator sections">
      <ModuleTabGroup label="Views">
        <SwitchButton
          active={active === factoryTotalId}
          icon={Factory}
          onClick={() => onChange(factoryTotalId)}
        >
          Factory Total
        </SwitchButton>
        <SwitchButton
          active={active === modifiersId}
          icon={Info}
          onClick={() => onChange(modifiersId)}
        >
          General Info
        </SwitchButton>
        <SwitchButton
          active={active === focusId}
          icon={ChartPie}
          onClick={() => onChange(focusId)}
        >
          Focus
        </SwitchButton>
        {viewModules.map(renderModuleButton)}
        <SwitchButton
          active={active === contractsId}
          icon={Handshake}
          onClick={() => onChange(contractsId)}
        >
          Contracts
        </SwitchButton>
      </ModuleTabGroup>
      {presetModules.length > 0 && (
        <ModuleTabGroup label="Presets">
          {presetModules.map(renderModuleButton)}
        </ModuleTabGroup>
      )}
      {syncedModules.length > 0 && (
        <ModuleTabGroup label="Synced">
          {syncedModules.map(renderModuleButton)}
        </ModuleTabGroup>
      )}
    </nav>
  );
};
