# Reader for HarmonyOS — AGENTS.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS/Stage Model) native host app in the Reader Contract-first Native UI Architecture. It consumes Reader UI Contract route/state/event/motion/token/view-state artifacts, talks to Reader-Core-Native through the NAPI/Core bridge (`entry/src/main/ets/bridge/CoreRuntime.ets` + `entry/libs/arm64-v8a/libreader_core_napi.so`), and implements HarmonyOS platform capability through 15 Host Adapter seams (`entry/src/main/ets/host/adapters/`). P0 UI link matrix 120/120 green; 2026-07-08 device evidence collected (CoreSelfCheck + ReadingChain + ReadingChainUi verified on real device `af2137d`).

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader-for-HarmonyOS` |
| Business Core | `/Users/minliny/Documents/Reader-Core-Native` |
| UI Contract | `/Users/minliny/Documents/Reader UI/contracts` |
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

## Development Loop

Use `/harmonyos-loop` for automated single-task execution. See `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` for the task queue and `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md` for cron/automation setup.
