"use client";

import { Button } from "@carbonid1/design-system";
import {
  CircleHelp,
  Factory,
  Handshake,
  Landmark,
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
      const Icon = moduleIcons[mod.id] ?? CircleHelp;

      return (
        <SwitchButton
          key={mod.id}
          active={active === mod.id}
          icon={Icon}
          onClick={() => onChange(mod.id)}
        >
          <span
            aria-label={mod.includedInFactoryTotals === false
              ? `${mod.name}, excluded from Factory Total`
              : undefined}
            className={mod.includedInFactoryTotals === false
              ? "text-muted-foreground line-through"
              : undefined}
          >
            {mod.name}
          </span>
        </SwitchButton>
      );
    })}
    <SwitchButton
      active={active === modifiersId}
      icon={Landmark}
      onClick={() => onChange(modifiersId)}
    >
      Unity &amp; Policies
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
