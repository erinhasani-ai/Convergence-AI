# VehicleOS P1 MVP — start here

**Goal:** a working, honest demo of the three Priority-1 features on one shared foundation, in the time left.
The full design is `docs/architecture/vehicleos-architecture-plan.md`. This MVP keeps its core ideas and cuts the rest.

| Feature | Owner | Your file | Your spec | Your tests |
|---|---|---|---|---|
| BestExit (net proceeds) | Person A | `modules/bestexit/valuation.ts` | [01-bestexit-mvp.md](01-bestexit-mvp.md) | `tests/bestexit.test.ts` |
| SecondLook (evidence + next check, the AI step) | Person B | `modules/secondlook/passport.ts` (+ new files in `modules/secondlook/`) | [02-secondlook-mvp.md](02-secondlook-mvp.md) | `tests/secondlook.test.ts` |
| LoadLink (equipment-aware routing) | Person C | `modules/loadlink/planner.ts` | [05-loadlink-mvp.md](05-loadlink-mvp.md) | `tests/loadlink.test.ts` |
| Foundation, API, UI, pitch glue | Claude (main session) + Person D | everything else | — | `tests/foundation.test.ts` |

## Rules that keep four people from colliding
1. **Edit only your `modules/<slug>/` folder.** The function signature in your file is frozen. Don't change `packages/`, `fixtures/`, `app/`, or the tests.
2. **Need a contract change?** Tell the foundation owner. Don't edit `packages/contracts` yourself.
3. **Pure functions only.** Your code gets its inputs as arguments and returns a result. No storage, no HTTP, no reading other modules.
4. **Unknown stays unknown.** Never turn a missing fact into `false`, `0`, or "ineligible". Keys on `V-DEMO-001` are unknown everywhere. That's on purpose.
5. **Labels are not optional.** Everything is simulated. Nothing is dispatchable. A replayed model output is labeled as such.

## Run it
```bash
npm install --legacy-peer-deps   # once (plain npm install hits an npm peer-resolution bug)
npm test                         # all tests; yours fail until you implement, then must pass
npx vitest run tests/<slug>.test.ts   # just yours
npm run dev                      # http://localhost:3000 — the journey page calls your module
```
For the live AI call, put `ANTHROPIC_API_KEY=...` **or** `GEMINI_API_KEY=...` in `.env.local` (server-side only, never commit it). Without either, SecondLook uses a labeled authored replay.

## How your code is reached
`app/api/v1/<slug>/[...path]/route.ts` (foundation) loads the current scenario state, calls your function with pinned inputs, stores the result, and returns it to the page. If your function throws `CapabilityUnavailable` (the stub does), the page shows an honest "not available yet" state, so the demo never breaks on an unfinished module.

## Shared vocabulary (from `@contracts`)
- `Knowable<T>`: `{state:'known', value, sourceIds}` | `{state:'unknown', reason, sourceIds}` | `{state:'not_applicable', basis}`.
- `Money`: `{ amountMinor: integer cents, currency: 'USD' }`. Use `usd()`, `sum()`, `formatUsd()` from `@platform/money`.
- `ArtifactMeta`: every result says `dataMode: 'synthetic'`, `runtimeMode: 'demo'`, `scenarioId`, `providerId`, `generatedAt`, `inputRefs`, `evidenceCollectionRevision`, `engine`, `warnings`.
- Scenario constants: `SCENARIO_ID`, `AS_OF` from `@fixtures/shared/seed`.

## Explicitly out of scope for the MVP
Provider registry, event outbox, database, auth/personas, RightBuyer/PartsBridge/ReadyToMove (shown as "Planned" cards), time windows, maps, FX, Playwright.
