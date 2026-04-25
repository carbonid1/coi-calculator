export const typedEntries = <K extends string, V>(o: Partial<Record<K, V>>) =>
  Object.entries(o).filter((entry): entry is [K, V] => entry[1] != null);
