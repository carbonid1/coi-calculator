"use client";

import { Button } from "@carbonid1/design-system";
import {
  CircleHelp,
  Factory,
  Handshake,
  Info,
  MapPinned,
  type LucideIcon,
} from "lucide-react";

import { type Module } from "../db/modules/modules";
import { moduleIcons } from "./module-icons";

interface Props {
  modules: Module[];
  active: string;
  contractsId: string;
  factoryTotalId: string;
  modifiersId: string;
  onChange: (id: string) => void;
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

export const ModuleSwitcher: React.FC<Props> = ({ modules, active, contractsId, factoryTotalId, modifiersId, onChange }) => (
  <div
    className="flex flex-wrap gap-1 border-b border-border pb-2"
    role="group"
    aria-label="Calculator modules"
  >
    <SwitchButton
      active={active === factoryTotalId}
      icon={Factory}
      onClick={() => onChange(factoryTotalId)}
    >
      Factory Total
    </SwitchButton>
    {modules.map((mod) => {
      const Icon = mod.liveArea ? MapPinned : (moduleIcons[mod.id] ?? CircleHelp);
      const inclusionLabel = mod.includedInFactoryTotals === false
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
    })}
    <SwitchButton
      active={active === modifiersId}
      icon={Info}
      onClick={() => onChange(modifiersId)}
    >
      General Info
    </SwitchButton>
    <SwitchButton
      active={active === contractsId}
      icon={Handshake}
      onClick={() => onChange(contractsId)}
    >
      Contracts
    </SwitchButton>
  </div>
);
