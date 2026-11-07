export const createLatestRevisionCache = <Value>() => {
  const cache: { cached: { revision: string; value: Value } | null } = {
    cached: null,
  }

  return (revision: string, calculate: () => Value): Value => {
    if (cache.cached?.revision === revision) return cache.cached.value

    const value = calculate()

    cache.cached = { revision, value }

    return value
  }
}
