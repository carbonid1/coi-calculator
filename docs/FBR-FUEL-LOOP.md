# FBR Fuel Loop

The calculator models one YC-fed, no-breed configuration.

## Configuration

- 1 FBR at power level I
- 60 MW power output
- 3 yellowcake per production cycle, equivalent to 18 uranium ore upstream
- No EU20 production

## Fuel balance per production cycle

| Step | Consumes | Produces |
| --- | --- | --- |
| FBR | 4 CF, 4 BF | 4 CFS, 4 BFE |
| Reprocessing at 0.25 capacity | 4 CFS | 3 CF, 0.5 FP |
| Enrichment at 0.5 capacity | 4 BFE | 3 BF, 1 CF |
| YC → BF at 0.5 capacity | 3 YC, 1 salt | 1 BF |

The core-fuel and blanket-fuel loops balance. The yellowcake chemical plant is load-balanced against the missing blanket fuel, so it consumes 3 of its maximum 6 yellowcake per production cycle. The fuel cycle's only net output is 0.5 fission product per production cycle.

## External inputs per production cycle

- 3 yellowcake
- 1 salt
- 0.5 acid
- 0.5 molten glass
- 0.25 steel

The General module balances Yellowcake production against factory demand. With this FBR configuration, it produces and supplies 3 Yellowcake per production cycle with no planned surplus.

## Key recipes

- **Reprocessing**: 16 CFS + 2 acid + 2 molten glass + 1 steel → 12 CF + 2 FP
- **Enrichment**: 8 BFE → 6 BF + 2 CF
- **YC → BF**: 6 YC + 2 salt → 2 BF per production cycle
- **Crusher (Large)**: 72 uranium ore → 72 uranium ore powder
- **Settling tank**: 36 uranium ore powder + 12 acid → 6 YC + 36 toxic slurry
