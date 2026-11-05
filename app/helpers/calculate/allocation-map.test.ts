import { expect, it, vi } from 'vitest';

import { AllocationMap } from './allocation-map';

it('rolls back repeated probes and older branches without changing checkpoint values or key order', () => {
  const state = new AllocationMap<string>();

  state.set('first', 0).set('second', 2);
  const original = new Map(state);

  state.set('third', 3);
  const branch = new Map(state);

  state.restore(original);
  for (const quantity of [1, 0.5, 0]) {
    state.set('first', quantity).set('trial', quantity);
    state.restore(original);
    expect([...state]).toEqual([...original]);
  }
  state.delete('first');
  state.set('first', 9);
  state.restore(original);
  expect([...state]).toEqual([...original]);
  state.restore(branch);
  expect([...state]).toEqual([['first', 0], ['second', 2], ['third', 3]]);
  state.clear();
  state.restore(branch);
  expect([...state]).toEqual([...branch]);
  expect([...original]).toEqual([['first', 0], ['second', 2]]);

  // Flow values are mutable, unlike utilization counters. A restore must
  // copy from the checkpoint rather than lend its objects to the next probe.
  const flows = new AllocationMap<string, { consumed: number; sources: Map<string, number> }>();
  const checkpoint = new Map([
    ['water', { consumed: 3, sources: new Map([['iron', 4]]) }],
    ['steam', { consumed: 7, sources: new Map<string, number>() }],
  ]);
  const copy = vi.fn((saved: { consumed: number; sources: Map<string, number> }) => ({ consumed: saved.consumed, sources: new Map(saved.sources) }));
  const restore = () => flows.restore(checkpoint, copy);

  restore();
  expect(copy).toHaveBeenCalledTimes(2);
  for (const quantity of [5, 10]) {
    const flow = flows.get('water');

    if (!flow) throw new Error('Missing restored flow');
    flows.markChanged('water');
    flow.consumed = quantity;
    flow.sources.set('iron', quantity);
    copy.mockClear();
    restore();
    expect(copy).toHaveBeenCalledTimes(1);
    expect([...flows]).toEqual([...checkpoint]);
    expect(checkpoint.get('water')?.consumed).toBe(3);
    expect(checkpoint.get('water')?.sources.get('iron')).toBe(4);
  }
});
