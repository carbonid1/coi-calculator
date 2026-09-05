import { type WeatherConfig } from "../db/weather";
import { type SyncedSettlementState } from "../settlement-state";

export const testWeather: WeatherConfig = {
  gameSeed: "ywaruuxpx8oo",
  difficulty: "Standard",
  weatherRngInitialState: {
    state0: "0x7277e8ad6570007d",
    state1: "0xeb4586d79675008d",
    warmupSteps: 100,
  },
};

export const emptySettlement: SyncedSettlementState = {
  population: 0,
  settlements: [],
  unity: [],
};
