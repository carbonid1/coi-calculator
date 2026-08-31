export const createLatestRevisionCache = <Value>() => {
  let cached: { revision: string; value: Value } | null = null

  return (revision: string, calculate: () => Value): Value => {
    if (cached?.revision === revision) return cached.value

    const value = calculate()

    cached = { revision, value }

    return value
  }
}
