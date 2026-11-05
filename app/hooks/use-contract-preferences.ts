import { getContractPreferencesStorageKey } from '../helpers/contracts/contract-preferences'
import { useOperatingPreferences } from './use-operating-preferences'

export const useContractPreferences = (saveId: string | null | undefined) => (
  useOperatingPreferences(getContractPreferencesStorageKey(saveId))
)
