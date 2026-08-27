export type ValueSource = "default" | "modeled" | "synced" | "planned";
export type CurrentValueSource = Exclude<ValueSource, "planned">;

export interface LayeredValue<T> {
  default: T;
  modeled?: T;
  synced?: T;
  planned?: T;
}

export interface ResolvedValue<T> {
  source: ValueSource;
  value: T;
}

export interface ResolvedCurrentValue<T> {
  source: CurrentValueSource;
  value: T;
}

/** Resolves the current value without allowing a future plan to replace it. */
export const resolveCurrentLayeredValue = <T>({
  default: defaultValue,
  modeled,
  synced,
}: LayeredValue<T>): ResolvedCurrentValue<T> => {
  if (synced !== undefined) return { source: "synced", value: synced };
  if (modeled !== undefined) return { source: "modeled", value: modeled };

  return { source: "default", value: defaultValue };
};

/** Resolves calculator state using default ≤ modeled ≤ synced ≤ planned. */
export const resolveLayeredValue = <T>({
  default: defaultValue,
  modeled,
  synced,
  planned,
}: LayeredValue<T>): ResolvedValue<T> => {
  if (planned !== undefined) return { source: "planned", value: planned };
  if (synced !== undefined) return { source: "synced", value: synced };
  if (modeled !== undefined) return { source: "modeled", value: modeled };

  return { source: "default", value: defaultValue };
};
