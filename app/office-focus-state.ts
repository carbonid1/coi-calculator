import { focusCatalog, officeCatalog, type FocusEffectId } from './db/office-catalog';

export interface OfficeDefinition {
  prototypeId: string;
  suppliesProductId: string;
  suppliesPerCycle: number;
  boosts: { focusBonusPercent: number; computingTflops: number }[];
}

export interface NativeFocusDefinition {
  id: FocusEffectId;
  pointCosts: number[];
  effects: { propertyId: string; percentPerStep: number }[];
}

export interface OfficeFocusDefinitions {
  pointsMultiplierPercent: number;
  offices: OfficeDefinition[];
  focuses: NativeFocusDefinition[];
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const name = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isFocusId = (value: unknown): value is FocusEffectId => focusCatalog.some(focus => focus.id === value);

const isOfficeDefinition = (office: unknown): office is OfficeDefinition => record(office) && name(office.prototypeId) && name(office.suppliesProductId)
  && amount(office.suppliesPerCycle) && Array.isArray(office.boosts) && office.boosts.length === 3
  && office.boosts.every(boost => record(boost) && amount(boost.focusBonusPercent) && amount(boost.computingTflops));

const isFocusDefinition = (focus: unknown): focus is NativeFocusDefinition => record(focus) && isFocusId(focus.id) && Array.isArray(focus.pointCosts)
  && focus.pointCosts.length >= 2 && focus.pointCosts.length <= 10001 && focus.pointCosts[0] === 0
  && focus.pointCosts.every((cost, index, costs) => amount(cost) && Number.isSafeInteger(cost) && (index === 0 || cost >= costs[index - 1]))
  && Array.isArray(focus.effects) && focus.effects.length > 0 && focus.effects.length <= 100
  && focus.effects.every(effect => record(effect) && name(effect.propertyId) && typeof effect.percentPerStep === 'number' && Number.isFinite(effect.percentPerStep))
  && new Set(focus.effects.map(effect => effect.propertyId)).size === focus.effects.length;

export const isOfficeFocusDefinitions = (value: unknown): value is OfficeFocusDefinitions => {
  if (!record(value) || !amount(value.pointsMultiplierPercent) || !Array.isArray(value.offices)
    || !Array.isArray(value.focuses) || value.offices.length !== officeCatalog.length || value.focuses.length !== focusCatalog.length) return false;
  const { offices, focuses } = value;

  if (!offices.every(isOfficeDefinition) || !focuses.every(isFocusDefinition)) return false;
  if (!officeCatalog.every(office => offices.filter(definition => definition.prototypeId === office.prototypeId).length === 1)) return false;
  return focusCatalog.every(focus => focuses.filter(definition => definition.id === focus.id
      && definition.effects.some(effect => effect.propertyId === focus.propertyId)).length === 1);
};

export const getFocusDefinitions = (definitions: OfficeFocusDefinitions) => focusCatalog.map(focus => {
  const native = definitions.focuses.find(definition => definition.id === focus.id);
  const effect = native?.effects.find(effect => effect.propertyId === focus.propertyId);

  if (!native || !effect) throw new Error(`Focus definition unavailable for ${focus.id}`);
  return { ...focus, maxStep: native.pointCosts.length - 1, pointCosts: native.pointCosts, percentPerStep: effect.percentPerStep };
});

export const getOfficeDefinition = (definitions: OfficeFocusDefinitions, prototypeId: string) => {
  const office = definitions.offices.find(office => office.prototypeId === prototypeId);

  if (!office) throw new Error(`Office definition unavailable for ${prototypeId}`);
  return office;
};
