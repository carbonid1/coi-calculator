import { type SyncedSettlementState } from '../settlement-state';
import { testNativeWeather } from './recorded-game-data';

export const testWeather = testNativeWeather;

export const emptySettlement: SyncedSettlementState = {
  population: 0,
  settlements: [],
  unity: [],
};
