# Return-route presentation repair — 2026-10-04

The current native Source→Settings→Source route exposed a silent navigation refusal. `nextNavigationGeneration()` retired the old Settings identity; `returnToSettings()` changed the route without binding a replacement, so the newly mounted Settings callbacks captured an empty identity. The former Settings tests bound manually and replaced navigation with counters.

`returnToSettings()` now uses the existing Settings binding, cache reconciliation and guarded `open(identity)` flow. The current section remains intact; the same runtime owner retains accepted preferences and lost-ACK truth. No new persistence implementation or intent replay was added.

The return-route audit found the same omission in the currently gated RSS main feed. Mere reattachment would still leave a previous feed read loading: its completion updated the host but its retired UI binding rejected delivery. `returnToRss()` now calls the existing `loadRss(currentNavigation)` read flow, which reattaches the original host synchronously and serializes original-receipt inspection/list reads. It does not apply a mutation, generate a mutation identity, clear the original journal, or open the shipping L0 gate.

## Code verification

- `test-settings-return-navigation-chain.mjs`: eight groups through actual production Index methods, Settings/Source hosts, Preferences/cache gateways and SDK emitted CategoryRow. Covers real round trip, section retention, synchronous binding before an in-flight read, runtime/mount retirement, old physical callbacks, missing-bind negative control, and before/after lost flush ACK with unchanged write dispatch and original accepted/saved revisions.
- `test-rss-return-presentation-sdk.mjs`: eight groups through actual Index retirement/return, RSS Gateway/Orchestrator, Atomic/Core receipt and SDK emitted native action. Covers the old-load/new-return loading defect, three return routes, original unknown/confirmed-pending-cleanup facts, current admission, old physical/runtime/mount rejection and shipping L0 no-op.
- Both regressions first failed on the original private Host `0e0e6c66`, Index SHA256 `24e5b18bb22892a281aa997b37e91ee0ae647656963ba76f43a4ec8f40b490cf`. The original failure logs and fixtures remain in the external execution evidence; new green outputs are separate.

These are code and controlled SDK proofs. Full ArkTS/HAP and a preserve-data current-artifact native Source return/reentry verification are separate exits. Hidden RSS receives interface compatibility proof without exposing its entry. Visual/user acceptance remains deferred; numeric performance budgets are not admitted by these tests.
