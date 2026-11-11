export type ContractFullThrottlePreferences = Readonly<Record<string, boolean>>

export const parseContractPreferences = (text: string | null): ContractFullThrottlePreferences => {
  try {
    const value: unknown = JSON.parse(text ?? '{}')

    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, enabled]) => typeof enabled === 'boolean'))
  } catch {
    return {}
  }
}
