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

### Execution gate checklist (enforcement gates — Section 9 of the protocol)

10. Before running any test, virtual-machine cycle, or device cycle, verify the execution gate is structurally sound: `npm run enforce:implementation-ready-gate` must pass. This is the `pretest` hook — it runs automatically before `npm test`, but an agent must also run it manually before any non-`npm test` workflow.

11. `candidate-backport` is a STOP condition, not a renderable state. A page family whose `harmony.status` is `candidate-backport` (or whose generated admission entry says `candidate-backport`) has NOT completed Reader-UI source-side conversion and has NOT been consumed by HarmonyOS. It must NOT enter a virtual-machine or device test cycle. The renderer execution gate (RouteRenderer / ViewStateRenderer / OverlayHost / StateHost) will fail it closed — do not attempt to bypass the gate by editing the renderer.

12. The generated visual-admission artifact (`VisualAdmission.ets`) must carry `sourceBound` AND `implementationReady` for every entry. The old single `admitted` status is retired. If the artifact contains `'admitted'`, the generator is stale — regenerate it from Reader-UI before proceeding.

13. `test:arkts-emulator` is an emulator behavior test, NOT a device delivery test and NOT a frontend visual delivery test. A `465/465` emulator pass only proves the ArkTS Hypium suite passed on `127.0.0.1:5555`. It does NOT prove Figma parity, Reader-UI source-side completion, HarmonyOS consumption, or real-device behavior. Do not report it as device or frontend completion evidence.

14. When a visual or behavioral issue is found in native output, the correct response is to trace the consumption chain back to Reader-UI / Figma, NOT to patch the native renderer. "See a phenomenon, fix native" violates the single-source principle and is the exact error that caused the 2026-07-27 virtual-machine timing violation. Classify the issue first (FIGMA_SOURCE_MISSING / FIGMA_SOURCE_CONTRADICTORY / NATIVE_CONSTRAINT_DEFECT / BEHAVIOR_OR_MOTION_GAP) before touching any file.

15. The correct execution chain for a page family is: Figma frozen → Reader-UI source-side conversion → Reader-UI marks `implementation-ready` → HarmonyOS consumes the regenerated artifact → compile + static check → virtual machine → real device → Reader-UI freezes as deliverable. No step may be skipped or reordered. The virtual machine comes AFTER HarmonyOS consumption, not before.

### Three-layer anti-bypass constraints (protocol Section 9.6–9.9)

The 2026-07-27 audit found that the execution gate (items 10–15) could be bypassed by hand-editing `harmony.status` to `implementation-ready` in the Reader-UI registry without completing source-side conversion. A second 2026-07-27 audit found four deeper defects: inverted write order (artifact always stale), upstream/consumer artifact divergence, broken recordId→handoff mapping, and weak prerequisites. The following three layers close those bypasses. All three are machine-enforced, not documentary.

16. **Layer 1 — Atomic promotion transaction across FOUR files.** `harmony.status` must NEVER be hand-edited to `implementation-ready` in `FIGMA_VISUAL_ADMISSION_REGISTRY.json`. The ONLY authorized path is `Reader-UI/tools/design/promote-family.mjs <recordId>`, which: (a) verifies `local.status === 'implementation-ready'`; (b) resolves the handoff directory via an explicit `RECORD_ID_TO_HANDOFF` map (no string-prefix guessing — `reader.*`→`reader-runtime`, `search.*`→`search-results`, `webdav.*`→`webdav-config`, `settings.*`→`settings-general`); (c) verifies `LOCAL_READY_FOR_FIGMA.json` readiness; (d) verifies `record.figma.revision` matches the OFFICIAL `F0_FIGMA_CURRENT_REVISION_EVIDENCE.json` currentRevision (not another registry record); (e) verifies each `harmony.targets` entry's file exists AND the `#symbol` suffix is word-boundary findable in it; (f) snapshots all four files (registry + upstream artifact + consumer copy + ledger), writes the registry FIRST via temp+rename so the generator reads the new state, regenerates the upstream artifact, syncs the consumer copy, verifies upstream == consumer (byte-identical SHA-256), appends the ledger entry, and does a final read-back. Any failure rolls back ALL prior writes.

17. **Layer 2 — All execution entries must pass preflight, including Gate G2.** The `enforce:implementation-ready-gate.mjs` now includes Gate G (artifact ↔ registry sync via `generator --check`), Gate G2 (upstream `Reader-UI/generated/arkts/VisualAdmission.ets` SHA-256 == HarmonyOS consumer `entry/.../contract/reader_ui/VisualAdmission.ets` SHA-256), Gate H (`local.status === harmony.status` for every implementation-ready record), and Gate I (promotion ledger). It runs as `pretest`, `prebuild`, `pretest:arkts-emulator`, `pretest:device`, `pretest:raw` hooks AND as an internal preflight inside `run_ohos_device_tests.mjs`, `test.mjs`, and `collect_device_evidence.mjs`. Direct `node scripts/*.mjs` invocation triggers the internal preflight. Direct `hvigorw`/`hdc` invocation cannot be gated from inside the repo — use `npm run build` or `npm run test:raw` instead. Layer 3 is the only backstop for direct tool invocation.

18. **Layer 3 — Independent CI/merge gate.** `.github/workflows/reader-contract-gate.yml` runs from a clean checkout on every PR and push to `main`/`master`. It verifies: `promote-family.mjs --check` (ledger + upstream==consumer sync), `generate-visual-admission-contract.mjs --check` (registry→artifact sync), upstream vs consumer byte-identical SHA-256 comparison, `local.status` consistency, `enforce:implementation-ready-gate`, and `test_contracts.mjs`. **Until the gate files are committed AND branch protection requires `Reader contract gate` as a required status check, Layer 3 is NOT an active defense.** The files have been `git add`-ed; they must be committed and the required check must be configured in repository settings. An agent editing the workflow file in a PR does not change the workflow that runs on that PR — GitHub uses the base branch's definition — but ONLY after branch protection is configured.

19. **Stop condition for hand-edited state.** If the gate fails because `harmony.status` was hand-edited (Gate H or Gate I), or because upstream/consumer artifacts diverged (Gate G2), the fix is NOT to edit the gate, the ledger, the renderer, or to manually copy the artifact. The fix is to run `promote-family.mjs <recordId>` in Reader-UI for each affected record — but ONLY after verifying that `local.status` is truly `implementation-ready` (source-side conversion is actually complete). If `local.status` is still `candidate-backport` or `not-currently-crosswalked`, the record is NOT ready for promotion; the source-side work must be done first.
