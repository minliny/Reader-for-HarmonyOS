# Unified action-sheet registration, 2026-10-14

Worktree: `codex/unified-reader-popups`, starting at `493e631560088f342daef6a8f2535b2cfeec2907`.

## Observed validation issues

- Architecture registration initially failed with `unregistered actual UI file: features/common/ReaderActionSheetContent.ets`. The new physical producer must be registered by exact source/interface/spec/consumer edges; a common directory or stylesheet count does not confer an exemption.
- The independent worktree had no sibling `Reader-UI` checkout. A symlink under `.worktrees/Reader-UI` references the existing paired workspace for read-only visual-witness validation. No paired source or frozen historical fixture is modified.
- The earlier bookshelf leaf physically owned four local actions. Its successor delegates native rendering to the registered content producer and retains captured presentation identity, current-owner checks and once-only dispatch.
- Replacing manga More and download actions retires exact typography carriers. Historical manga and directory witnesses remain byte-immutable; a closed successor lists the two affected full paths and exact retired occurrences. Loading, error, retry, directory, settings and reading text carriers remain retained.

## Registration boundary

`ReaderActionSheetContent` owns only two finite variants, `grouped` and `quick`. It accepts business actions, an app/reading day/night scheme, and an action callback. Font families, weights, geometry, colors and the three quick slots belong to the finite spec. Arbitrary caller appearance or typography parameters remain rejected.

The original 100 business budgets remain witnessed as 93 unchanged rows plus seven explicit historical transfers. This change adds one exact producer contract; it does not raise or rewrite those historical budgets. Static/SDK verification is separate from native layout and user acceptance.

## Current local verification

All commands below completed with exit code 0 under Node.js 26.0.0 and the installed DevEco ETS SDK. A final exact-shape comparison confirms the finalized `ReaderActionSheetContent`, `ReaderSurfaceSpecs`, and download panel still match their registered source snapshots, including grouped background cards, quick icon slots, live action lookup and unmounted action rejection.

| Check | Result and evidence boundary |
| --- | --- |
| `node tools/test-architecture-shared-producers.mjs` | PASS: 17 exact finite producers; arbitrary caller style inputs, unknown variants, literal fonts, missing successor witnesses and inflated producer counts reject. |
| `node tools/test-architecture-consumer-baseline.mjs` | PASS: 93 unchanged business budgets, 17 bounded shared owners, 33 retained policies; all 139 actual UI files registered. |
| `node tools/test-private-typography-budget.mjs` | PASS: real finite resolver inputs admitted; retired bookshelf text getter, private helper/import, literal and mixed expressions reject. |
| `node tools/test-bounded-typography-carriers.mjs` | PASS: exact action successor plus previous directory/source/import witnesses and negative controls. |
| `node tools/test-conventional-typography-coverage.mjs` | PASS: 103 files, 485 real carriers, 1,238 public-role/spec arguments, 72 finite producer arguments and 291 retained approved arguments; no unregistered private typography. |
| `node tools/test-conventional-typography.mjs` | PASS: 28 files; 173 retained consumer contracts plus 125 approved carriers replacing 75 historical sites; dynamic variants and AUTO omissions preserved. |
| `node tools/test-conventional-typography-sdk.mjs` | PASS: 262 real SDK consumer contracts across three states, 11 role-propagation consumers and 251 bounded variants. |
| `node tools/test-conventional-typography-registry.mjs` | PASS: 248 consumers and 93 semantic roles retain the original public baseline and finite variants. |
| `node tools/test-native-default-control-contracts.mjs` | PASS: exact finite native/default/delegated hosts retain their authored AUTO and glyph contracts. |

These are code and local SDK facts. HAP generation, installation, native visual acceptance and user acceptance remain separate and unclaimed.

## Final geometry adaptation

The final heading uses a minimum height so system font scaling can grow its line box. The native bookshelf body owns a bounded Scroll; the SDK checker rejected a direct ForEach child, so the owner wraps it in one Column. Exact source shapes were refreshed after that correction. Architecture producer registration and budget gates were rerun after the wrapper correction; the typography bindings and tuples are unchanged.

Final production fingerprints for this registration evidence:

- `entry/src/main/ets/features/common/ReaderActionSheetContent.ets`: `c359d43b4b336d7525445e2a50b969e4a571b73570d4d2aa28aaf57cc3d38cda`
- `entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets`: `aa8fea63bf2dec158b369567af23a6742920758a3fce4b793443d698099eb893`
- `entry/src/main/ets/features/common/ReaderSheetActionList.ets`: `687447b7f7416acb71d0740a31ed6ca707a01f08b4c20a38e0a094845d86cc2a`
- `entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets`: `c8985954c9eb95fb1c47baf1d7384de8fc78214e41aeb7ed23385decb9f8a92a`
