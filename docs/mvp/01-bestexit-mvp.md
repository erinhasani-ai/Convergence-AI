# BestExit MVP — net-proceeds comparison (Priority 1, Person A)

Written for: the BestExit owner and their Claude Code session. Read `00-README.md` first (5 rules, how to run).

## What you're building (and only this)
One pure function in `modules/bestexit/valuation.ts`:

```ts
export function evaluateValuation(input: ValuationInput): ValuationResult
// input: { vehicle: VehicleSnapshot; evidenceCollectionRevision; previous: ValuationResult | null; valuationId; generatedAt }
```

It compares four **simulated** sale channels for one vehicle revision. It itemizes who pays each cost, computes the **seller's net** range, and recommends the eligible channel with the best mid net. The demo point is that **a channel with a lower gross price can have a better net.** The UI table is already built by the foundation.

## Inputs you use (already exist — import, don't copy)
- `@fixtures/shared/seed`: `CHANNELS` (labels, fees in cents, `transportPayer`, `daysToCash`), `COMPARABLES` (15 synthetic sales), `COMPANY.minimumAcceptableNetMinor` (1,200,000 = $12,000 seller floor, confidential), `distanceKm(from, to)`, `SCENARIO_ID`.
- `@platform/money`: `usd`, `sum`, `transportQuote(distanceKm, equipment)` → `{ price, basis }` (402.00 lot→yard; 577.00 with winch).
- `@platform/handling`: `requiredEquipment(vehicle)` → `{ equipment, basis }` (adds `winch` when drivable is known false).
- The vehicle's location is `vehicle.locationId` (`L-DEMO-SELLER-LOT`). Yard channels move it to `L-DEMO-YARD-N`.

## Rules (deterministic — no AI here)
1. **Drivable state** = `vehicle.handling.drivable` (known true / known false). If it's unknown, every channel's gross is unknown.
2. **Gross range** per channel = (min, median, max) of `COMPARABLES` with that `channel` and the same `drivable` value. Fewer than 3 matches → `gross: { state: 'unknown', reason: 'insufficient_evidence' }`.
3. **Eligibility** (`titleBrand`, `drivable` from the vehicle):

   | Channel | Rule |
   |---|---|
   | `acv_wholesale_auction` | eligible if title known clean (or rebuilt); unknown if title unknown |
   | `copart_wholesale_auction` | eligible if title known |
   | `copart_salvage_auction` | eligible if title salvage, or drivable known **false**; **ineligible** if title clean and drivable known true; else unknown |
   | `international_export` | always `unknown` + `reviewRequired: true` (no title-document evidence) |

4. **Seller lines** (`payer: 'seller'`):
   - `seller_fee` from `CHANNELS[c].sellerFeeMinor`.
   - If `transportPayer === 'seller'`, a `transport` line = `transportQuote(distanceKm(lot, yard), requiredEquipment(vehicle).equipment)`. Put the quote's `basis` string in the line.
5. **Buyer lines** (`payer: 'buyer'`):
   - `buyer_fee`.
   - For `transportPayer === 'buyer'`, a `transport` line with `amount: unknown('not_supplied')`. The buyer's location isn't known yet.
   - **Never subtract buyer lines from seller net.**
6. **Seller net** = gross − sum(seller lines), per bound (low/mid/high). If gross is unknown or any seller line is unknown → `sellerNet: null`. **Never treat unknown as 0.**
7. **Recommendation**:
   - Choose among `eligible` channels with a non-null net, highest **mid** net; ties go to the earlier channel in the table above.
   - `rationale` must say it in words, e.g. "Higher net despite $550.00 lower gross: no seller-paid transport, lower seller fee."
   - No candidate → `status: 'insufficient_evidence'`, `recommendation: null`.
8. **`meetsSellerFloor`** = known(recommended mid net ≥ 1,200,000), else unknown.
9. **`changeFromPrevious`** (when `previous` is given and its vehicle revision differs). Include each code that applies:
   - `INPUT_REVISED` (which handling fields changed);
   - `COMPARABLES_CHANGED` (runner → nonrunner set);
   - `COST_CHANGED` (a seller transport line changed);
   - `ELIGIBILITY_CHANGED` (any channel's eligibility changed).
10. **Warnings**: if `keysPresent` is not known, add `{ code: 'FACT_UNKNOWN', message: 'Keys present is unknown; no key cost assumed.' }`.
11. **`meta`**: `contractVersion: CONTRACT_VERSION`, `dataMode: 'synthetic'`, `runtimeMode: 'demo'`, `scenarioId: SCENARIO_ID`, `providerId: 'bestexit'`, `generatedAt`, `inputRefs: [{ entityType: 'VehicleSnapshot', id, revision }]`, `evidenceCollectionRevision`, `engine: { name: 'BESTEXIT', version: '0.1.0' }`.

## Expected results (your tests check these to the cent)

| Channel | r1 (runs) eligibility | r1 seller net low / mid / high | r2 (no-start, confirmed) eligibility | r2 seller net low / mid / high |
|---|---|---|---|---|
| ACV-style wholesale | eligible | 13,250 / **13,850** / 14,350 | eligible | 10,350 / **10,950** / 11,450 |
| Copart-style wholesale | eligible | 13,088 / **13,738** / 14,288 (transport 402 + fee 610) | eligible | 10,213 / **10,863** / 11,413 (transport 577 + fee 610) |
| Copart-style salvage | **ineligible** | null (no runner comps) | eligible | 8,573 / **9,073** / 9,573 (transport 577 + fee 450) |
| Export | unknown + review | null | unknown + review | null |

- r1: recommend ACV-style. Its gross mid of 14,200 is lower than 14,750, but its net is higher. `meetsSellerFloor` known **true**.
- r2: still ACV-style. `meetsSellerFloor` known **false**. `changeFromPrevious` has all four codes.

## Done when
- `npx vitest run tests/bestexit.test.ts` passes.
- On the journey page, step 1 shows the table, and step 3 ("Recompute") shows the r2 numbers with the "why it changed" list.

## Out of scope
Ranking-policy versions, comparables import, VIPER/ACV MAX offers, buyer-demand inputs, FX, history UI.
