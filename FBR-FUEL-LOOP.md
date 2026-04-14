# FBR Fuel Loop

## FBR modes (per 60s at 1x reactor speed)

| Mode | Water | CF | BF | Steam | CFS | BFE |
|---|---|---|---|---|---|---|
| 0x | 96 | 2 | 0 | 96 | 2 | 0 |
| 1x | 96 | 4 | 4 | 96 | 4 | 4 |
| 3x | 24 | 4 | 12 | 24 | 4 | 12 |

Breeder always 3x. Energy FBRs always 0x. All values scale linearly with reactor speed.

## Phasing strategy

Run fewest FBRs possible while DU lasts, then scale up.

### Phase 1: Burn DU — 1+1 (75 MW, zero UO)

Spare BFE splits between DU recipe and EU20 enrichment. BF loop closes without any yellowcake.

| Step | BFE | Consumes | Produces |
|---|---|---|---|
| Reprocessing | — | 6 CFS | 4.5 CF |
| Enrichment (Core Fuel) | 6 | — | 4.5 BF, 1.5 CF |
| Enrichment (EU20) | 3.6 | — | 2.7 BF, 0.45 EU20 |
| DU → BF | 2.4 | 12 DU, 4.8 salt | 4.8 BF |

**External inputs:** 12 DU/60s (from stockpile)
**Outputs:** 0.45 EU20/60s (stockpile for space stations)
**70k DU lasts:** ~97 hours → accumulates ~2,600 EU20

### Phase 2: Burn DU — 1+2 (135 MW, zero UO)

Same DU rate, less EU20 produced, more power.

| Step | BFE | Consumes | Produces |
|---|---|---|---|
| Reprocessing | — | 8 CFS | 6 CF |
| Enrichment (Core Fuel) | 8 | — | 6 BF, 2 CF |
| Enrichment (EU20) | 1.6 | — | 1.2 BF, 0.2 EU20 |
| DU → BF | 2.4 | 12 DU, 4.8 salt | 4.8 BF |

**External inputs:** 12 DU/60s (from stockpile)
**Outputs:** 0.2 EU20/60s

### Phase 3: DU exhausted — 1+4 (255 MW, 54 UO)

No spare BFE. All 12 BFE to enrichment. BF gap filled by yellowcake.

| Step | BFE | Consumes | Produces |
|---|---|---|---|
| Reprocessing | — | 12 CFS | 9 CF |
| Enrichment (Core Fuel) | 12 | — | 9 BF, 3 CF |
| YC → BF | — | 9 YC, 3 salt | 3 BF |

**External inputs:** 9 YC/60s (= 54 UO via crusher → settling tank)

## Comparison (1x speed)

| Config | Power | UO/60s | DU/60s | EU20/60s | Phase |
|---|---|---|---|---|---|
| 1+1 | 75 MW | 0 | 12 | +0.45 | Burn DU, stockpile EU20 |
| 1+2 | 135 MW | 0 | 12 | +0.2 | Burn DU, more power |
| 1+3 | 195 MW | 9 | 10 | 0 | DU + some YC |
| 1+4 | 255 MW | 54 | 0 | 0 | YC only, no DU needed |

DU burn rate is 12/60s at N≤2, drops to 10 at N=3, zero at N=4.

## Free resources (burn stockpiles first)

While spent fuel/MOX stockpiles last, they replace YC for the BF gap — zero UO cost. Priority:
1. Spent Fuel (0.5 SF/60s → 0.5 BF)
2. Spent MOX (0.5 SM/60s → 0.5 BF)
3. Then DU as described above

## Key recipes

- **Reprocessing**: 16 CFS + 2 acid + 2 MG + 1 steel → 12 CF + 2 FP
- **Enrichment (Core Fuel)**: 8 BFE → 6 BF + 2 CF
- **Enrichment (EU20)**: 16 BFE → 12 BF + 2 EU20
- **DU → BF**: 2 BFE + 10 DU + 4 salt → 4 BF
- **YC → BF**: 12 YC + 4 salt → 4 BF
- **NRP Spent Fuel**: 2 SF + 2 acid + 2 MG + 2 salt → 2 BF + 2 FP
- **NRP Spent MOX**: 2 SM + 2 acid + 2 MG + 2 salt → 2 BF + 2 FP
- **Crusher**: 72 UO → 72 UOP
- **Settling Tank**: 36 UOP + 12 acid → 6 YC + 36 toxic slurry
