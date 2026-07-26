# Reader for HarmonyOS — AGENTS.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS/Stage Model) native host app in the Reader Contract-first Native UI Architecture. It consumes Reader UI Contract route/state/event/motion/token/view-state artifacts, talks to Reader-Core-Native through the NAPI/Core bridge (`entry/src/main/ets/bridge/CoreRuntime.ets` + `entry/libs/arm64-v8a/libreader_core_napi.so`), and implements HarmonyOS platform capability through 15 Host Adapter seams (`entry/src/main/ets/host/adapters/`). The P0 UI static link matrix is 120/120. Historical 2026-07-08 device evidence verified CoreSelfCheck + ReadingChain + ReadingChainUi on device `af2137d`, but it is not fresh proof for the current Reader UI release identity; current rollout remains 7 Pilot / 28 Shadow / 0 Authoritative and requires a new attached hdc target for device closure.

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS` |
| Business Core | `../Reader-Core-Native` |
| UI Contract | `../Reader-UI/contracts` |
| Planning docs | `docs/PLANNING/` |
| Loop command | `.claude/commands/harmonyos-loop.md` |

## Architecture Baseline

- Reader-Core-Native is the business source of truth.
- Reader UI Contract is the route/state/event/motion/token/view-state source.
- This repo owns ArkUI rendering, ArkTS reducer/store, NAPI bridge, Host Adapter, and device proof.
- Old Swift `Reader-Core` may be used only as migration reference or fixture/history evidence.

## Rules

1. Reader-Core-Native and Reader UI may only be changed when the current user request explicitly asks for cross-repo changes.
2. Do not copy, translate, or adapt external GPL/iOS/Android implementation code.
3. Do not assume Core capabilities — read actual Reader-Core-Native files and protocol before using them.
4. Core-missing features must be marked accurately until measured evidence exists.
5. WebDAV, JS Runtime, WebView, TXT/EPUB parser, real HTTP/book-source access, and host smoke implementations are allowed when they are clean-room, evidence-bound, redacted, and validated.
6. UI state must flow through ArkTS reducer/store and `ViewState`; durable state must not be hidden inside ArkUI page components.
7. ENV_BLOCKED is valid only for true environment blockers; do not use stale local planning constraints as blockers.
8. Do not fake build, device, simulator, network, credential, cookie, or release-gate success. If device execution is not run, export device-ready evidence separately from device-executed evidence.

## Mandatory Figma-to-native protocol

Before changing any visible ArkUI surface, route, visual token, renderer, state, motion, or frontend behavior, read and obey:

`../Reader-UI/docs/design/FIGMA_TO_NATIVE_AGENT_EXECUTION_PROTOCOL.md`

This is a hard gate. In particular:

1. Figma is the sole visual source and Reader-UI is the single visual-admission/contract authority. HarmonyOS must consume its generated artifacts, never Figma directly at runtime.
2. Do not create or revive a HarmonyOS-side `Figma*` root, policy, geometry manifest, alias-token layer, detached frame, screenshot, local approximation, generic fallback page, or self-created replacement UI.
3. A missing/contradictory Figma node, unbound state, retired route, or missing Tablet master is a stop condition. Keep the surface fail-closed and report the exact source gap.
4. A Figma prototype does not authorize a new UiEvent, state owner, Core action, Host capability, or business flow. Preserve reducer/effect/Core ownership.
5. Follow the protocol's single-writer Figma rule, Design Delta requirements, generated-contract route, affected viewport verification, and evidence/handoff format before claiming completion.

## Development Loop

Use `/harmonyos-loop` for automated single-task execution. See `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` for the task queue and `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md` for cron/automation setup.

## Concurrency & Commit Discipline

Multi-agent concurrency on a shared working tree is a confirmed root cause of the 2026-07-22~25 parallel-layer regression. The following rules are mandatory and override any per-task instruction that would violate them.

### Single-writer rule

1. One page family OR one repo may have at most one writer at a time. Other agents are read-only, produce plans, or perform independent verification.
2. Before modifying any file, an agent must confirm no other agent is writing to the same page family. If a `WORKTREE_FROZEN.md` marker exists at the repo root, all modifications are blocked until the marker is removed.
3. Stash operations must be single-responsibility: visual-admission, behavior, and device-evidence changes go in separate stashes. Mixed-content stashes are prohibited because cherry-picking from them re-introduces parallel-layer pollution.

### Isolation commit rule

4. A change set that mixes "parallel-layer removal", "admission consumption", "behavior changes", and "media assets" must NOT be committed as one blob. Isolate the structural/gate changes into an independent, verifiable commit first.
5. After staging the isolation commit, stash the remaining changes (`git stash push --keep-index --include-untracked`), run the full gate (`npm run check:reader-ui-consumer && npm test`), and only commit if the gate is green with the stashed changes absent.

### Coverage quality baseline

6. `scripts/sync_reader_ui_screen_graph.mjs` enforces a `COVERAGE_QUALITY_BASELINE` (faithful instance floor + partial instance ceiling). A green screen-graph gate must never imply quality held — it only proves structural completeness. Only an explicitly approved Design Delta may update the baseline numbers.
7. If `faithfulInstanceCount` drops below the floor or `partialInstanceCount` exceeds the ceiling, the gate fails. This prevents silent faithful→partial regression that the old completeness-only gate allowed.

### Stop conditions

8. Encountering a design gap, missing Tablet master, missing business owner, or unbound state is a STOP condition — do not paint a local replacement, add a self-created button/flow, or revive a retired route. Report the exact source gap and wait.
9. If a previously-removed parallel layer (`Figma*Root.ets`, `FigmaVisual*Policy.ets`, `FigmaExactRouteRenderer.ets`, `ReaderControlIcon.ets`) reappears in the working tree, treat it as pollution and remove it before any other work proceeds.
