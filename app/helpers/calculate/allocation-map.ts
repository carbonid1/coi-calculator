/** Solver state with cheap repeated rollback to the same checkpoint. */
export class AllocationMap<Key, Value extends number | object = number> extends Map<Key, Value> {
  private checkpoint?: ReadonlyMap<Key, Value>;
  private readonly changed = new Set<Key>();
  private orderChanged = false;

  constructor() {
    super();
  }

  markChanged(key: Key): void {
    this.changed.add(key);
  }

  override set(key: Key, value: Value): this {
    this.changed.add(key);
    return super.set(key, value);
  }

  override delete(key: Key): boolean {
    this.orderChanged ||= this.has(key);
    return super.delete(key);
  }

  override clear(): void {
    this.orderChanged ||= this.size > 0;
    super.clear();
  }

  /** Mutable values need a copier so the next probe cannot alter its checkpoint. */
  restore(
    checkpoint: ReadonlyMap<Key, Value>,
    restoreValue: (saved: Value, current?: Value) => Value = value => value,
  ): void {
    if (this.checkpoint !== checkpoint || this.orderChanged) {
      super.clear();
      for (const [key, value] of checkpoint) super.set(key, restoreValue(value));
    } else {
      for (const key of this.changed) {
        const value = checkpoint.get(key);

        if (value === undefined) super.delete(key);
        else super.set(key, restoreValue(value, this.get(key)));
      }
    }
    this.checkpoint = checkpoint;
    this.changed.clear();
    this.orderChanged = false;
  }
}
