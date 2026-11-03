"use client";

import { Autocomplete, Button, Tooltip } from "@carbonid1/design-system";
import { ArrowLeft, ArrowLeftRight, ChartPie, Factory, FlaskConical, Handshake, Info } from "lucide-react";

import { type Module } from "../db/modules/modules";
import { getModuleIcon } from "./module-icons";
import { getModuleTabGroups } from "./module-tab-order";

interface Props {
  modules: Module[];
  active: string;
  contractsId: string;
  factoryTotalId: string;
  resourceSupplyId: string;
  focusId: string;
  modifiersId: string;
  onChange: (id: string) => void;
  researchId: string;
  viewModuleIds: readonly string[];
  backId?: string;
  onBack?: () => void;
}

export const ModuleSwitcher = ({
  modules, active, contractsId, factoryTotalId, resourceSupplyId, focusId,
  modifiersId, onChange, researchId, viewModuleIds, backId, onBack,
}: Props) => {
  const { presetModules, syncedModules, viewModules } = getModuleTabGroups(modules, new Set(viewModuleIds));
  const views = [
    { id: factoryTotalId, name: "Factory Total", icon: Factory },
    { id: resourceSupplyId, name: "Resource supply", icon: ArrowLeftRight },
    { id: modifiersId, name: "General Info", icon: Info },
    { id: focusId, name: "Focus", icon: ChartPie },
    { id: researchId, name: "Research", icon: FlaskConical },
    ...viewModules.map(module => ({ ...module, icon: getModuleIcon(module) })),
    { id: contractsId, name: "Contracts", icon: Handshake },
  ];
  const areaOptions = [...syncedModules, ...presetModules];
  const area = areaOptions.find(module => module.id === active);
  const title = area?.name ?? views.find(view => view.id === active)?.name;
  const backLabel = modules.find(module => module.id === backId)?.name
    ?? views.find(view => view.id === backId)?.name;

  return (
    <div className="space-y-3">
      <nav className="-mx-1 overflow-x-auto p-1" aria-label="Calculator sections">
        <div className="flex min-w-max gap-1" role="group" aria-label="Overview tools">
          {views.map(({ id, name, icon: Icon }) => (
            <Button key={id} type="button" variant="ghost" size="small"
              selected={active === id} aria-current={active === id ? "page" : undefined}
              onClick={() => onChange(id)}>
              <Icon aria-hidden="true" className="size-4" />
              {name}
            </Button>
          ))}
        </div>
      </nav>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {onBack && backLabel && (
            <Tooltip label={`Back to ${backLabel}`}>
              <Button variant="ghost" size="small" aria-label={`Back to ${backLabel}`} onClick={onBack}>
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
            </Tooltip>
          )}
          <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {areaOptions.length > 0 && (
          <Autocomplete.Root items={areaOptions} value={area ?? null}
            itemToStringLabel={selectedModule => selectedModule.name}
            isItemEqualToValue={(left, right) => left.id === right.id}
            onValueChange={nextValue => { if (nextValue !== null) onChange(nextValue.id) }}>
            <Autocomplete.InputGroup className="w-44 shrink-0 sm:w-56">
              <Autocomplete.Input aria-label="Factory area" placeholder="Search areas…"
                onFocus={event => event.currentTarget.select()} />
              <Autocomplete.Trigger aria-label="Show factory areas" />
            </Autocomplete.InputGroup>
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.Empty>No areas found.</Autocomplete.Empty>
                  <Autocomplete.List>
                    {(selectedModule: Module) => {
                      const Icon = getModuleIcon(selectedModule);

                      return <Autocomplete.Item key={selectedModule.id} value={selectedModule} aria-label={selectedModule.name}>
                        <span className="flex items-center gap-2">
                          <Icon aria-hidden="true" className="size-4 shrink-0" />
                          {selectedModule.name}
                          {selectedModule.includedInFactoryTotals === false && !selectedModule.liveArea && (
                            <span className="text-xs text-muted-foreground">Plan only</span>
                          )}
                        </span>
                      </Autocomplete.Item>;
                    }}
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        )}
      </div>
    </div>
  );
};
