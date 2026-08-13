"use client";

import { Button } from "@carbonid1/design-system";

import { type Module } from "../db/modules/modules";

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
  onClick: () => void;
}

const SwitchButton: React.FC<SwitchButtonProps> = ({ active, children, onClick }) => (
  <Button variant="ghost" selected={active} aria-pressed={active} onClick={onClick}>
    {children}
  </Button>
);

export const ModuleSwitcher: React.FC<Props> = ({ modules, active, contractsId, factoryTotalId, modifiersId, onChange }) => (
  <div className="flex flex-wrap gap-1 border-b border-border pb-2">
    <SwitchButton active={active === factoryTotalId} onClick={() => onChange(factoryTotalId)}>
      Factory Total
    </SwitchButton>
    {modules.map((mod) => (
      <SwitchButton key={mod.id} active={active === mod.id} onClick={() => onChange(mod.id)}>
        {mod.name}
      </SwitchButton>
    ))}
    <SwitchButton active={active === modifiersId} onClick={() => onChange(modifiersId)}>
      Unity &amp; Policies
    </SwitchButton>
    <SwitchButton active={active === contractsId} onClick={() => onChange(contractsId)}>
      Contracts
    </SwitchButton>
  </div>
);
