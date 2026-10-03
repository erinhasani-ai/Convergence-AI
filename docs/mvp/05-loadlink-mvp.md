# LoadLink MVP — equipment-aware pooled routing (Priority 1, Person C)

Written for: the LoadLink owner and their Claude Code session. Read `00-README.md` first.

## What you're building (and only this)
One pure function in `modules/loadlink/planner.ts`:

```ts
export function planRoutes(input: PlanInput): RoutePlan
// input: { shipments: ShipmentRequest[]; readiness: ReleaseReadiness[]; carriers: CarrierResource[]; routePlanId; generatedAt; evidenceCollectionRevision }
```

It assigns pooled shipments from both source tags to two trucks, respecting **equipment** (a non-running car needs a `winch`), **capacity** (car slots on board at any moment), and **pickup-before-delivery**. Work it can't plan is reported **with a reason**. It never authorizes dispatch.

The demo moment: the SecondLook evidence makes `V-DEMO-001` need a winch. Only Truck B has one, so Truck A can't take it. Then "Truck B winch out of service" turns it into explicit unassigned work.

## Inputs (already exist)
- **Shipments.** The foundation builds them. `requiredEquipment` comes from `HANDLING` (winch if drivable is known false). Parts cargo has `cargo.cargoType === 'parts_package'` and needs `parcel_space`.
- **Readiness.** From the foundation's minimal provider `@platform/gates`, **not ReadyToMove**. `decision` is `ready` / `blocked` / `unknown`, and `dispatchAllowed` is always false.
- **Carriers.** `CR-DEMO-A` (3 slots, open only) and `CR-DEMO-B` (2 slots, open + winch). Both start at `L-DEMO-DEPOT`. When the "winch out of service" toggle is on, B arrives without `winch`.
- `distanceKm(from, to)` from `@fixtures/shared/seed` (fixture matrix, km).

## Rules (deterministic)
1. **Exclusions, in order:**
   - parts cargo → unassigned `cargo_type_unsupported` ("vehicle carriers only; parcel/LTL adapter later");
   - readiness `blocked` → unassigned `readiness_blocked` (include the blocking gate's basis).
   - Readiness `unknown` **is plannable**: it makes the plan provisional.
2. **Capable truck** = has every `requiredEquipment`. None → unassigned `no_capable_equipment`.
3. **Search.**
   - Try every assignment of plannable shipments to capable trucks, or leave them unassigned. ≤ 8 shipments × 2 trucks is small; brute force is fine.
   - For each truck's set, find the shortest stop sequence. Start at `homeBaseId`; the route ends at the last delivery (no return leg).
   - Each shipment's pickup must come before its delivery. Cars on board can never exceed `vehicleSlots`.
4. **Objective, in order:**
   1. fewest unassigned;
   2. **smallest longest-route km** (balance trucks so everything finishes the same day);
   3. smallest total km;
   4. tie-break: assignments compared by resource IDs listed in shipment-ID order, lexicographically smallest wins.
5. A plannable shipment with a capable truck but no feasible slot → `capacity`.
6. **Output.**
   - `status: 'provisional'` if any assigned shipment's readiness is `unknown`, otherwise `'eligible'`.
   - `dispatchAllowed: false` always.
   - `feasibility: { capacity:'pass', equipment:'pass', pickupBeforeDelivery:'pass', timeWindows:'not_checked' }`. Be honest: the MVP doesn't check time windows.
   - `readiness` echoes the input.
   - `meta`: same shape as the other modules, with `providerId: 'loadlink'` and `engine: { name: 'LOADLINK', version: '0.1.0' }`.
   - Route `distanceKm` = sum of legs.

## Expected results (your tests check these)
Inputs are the journey shipment `SH-S01-0001` (V-DEMO-001 r2, seller lot → Buyer 201, needs winch, readiness unknown) plus the seeded `SH-DEMO-002…006`.

| | Truck B (winch) | Truck A | Unassigned |
|---|---|---|---|
| Normal | `SH-S01-0001` + `SH-DEMO-002`: depot → lot → yard → buyer 401 → buyer 201 = **375 km** | `SH-DEMO-003` + `SH-DEMO-004`: depot → lot → yard → buyer 101 = **360 km** | `SH-DEMO-005` `readiness_blocked` (payment reversed); `SH-DEMO-006` `cargo_type_unsupported` |
| Winch out of service | `SH-DEMO-004` = 110 km | `SH-DEMO-003` = 290 km | `SH-S01-0001` and `SH-DEMO-002` `no_capable_equipment`, plus 005 and 006 as above |

Status: **`provisional`** in the normal case (SH-S01-0001's readiness is unknown). **`eligible`** in the outage case (only the ready shipments 003 and 004 are assigned). `dispatchAllowed` is false in both.

## Done when
- `npx vitest run tests/loadlink.test.ts` passes.
- Journey step 5 shows both trucks' stop lists, unassigned work with reasons, "Provisional — not dispatchable", and the outage toggle re-plans.

## Out of scope
Time windows, driver hours, maps, OR-Tools, live rates/carriers, parts freight, execution tracking, ReadyToMove.
