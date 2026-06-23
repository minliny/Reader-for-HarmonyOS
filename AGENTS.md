# Reader for HarmonyOS — AGENTS.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS/Stage Model) port of the Reader ebook application. It consumes Reader-Core contracts through clean-room ArkTS DTOs, adapters, evidence runners, and optional bridge/runtime seams. The project has an ArkTS/HAP scaffold and local `hvigorw assembleHap` validation.

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader for HarmonyOS` |
| Upstream Core | `/Users/minliny/Documents/Reader-Core` |
| Planning docs | `docs/PLANNING/` |
| Loop command | `.Codex/commands/harmonyos-loop.md` |

## Reader-Core Baseline

- **HEAD**: `5b199ff` (Phase 2 active: P2.J1 done, P2.I1 done)
- **Language**: Swift 5.9, iOS 15+/macOS 13+
- **73 frozen symbols** across 6 modules
- **Services ready**: DefaultSearchService, DefaultTOCService, DefaultContentService
- **Core is Swift** — cannot be directly linked from ArkTS

## Rules

1. Reader-Core may only be changed when the current user request explicitly asks for Core changes.
2. Do not copy, translate, or adapt external GPL/iOS/Android implementation code.
3. Do not assume Core capabilities — read actual Core files before using them.
4. Core-missing features must be marked accurately until measured evidence exists.
5. WebDAV, JS Runtime, WebView, TXT/EPUB parser, real HTTP/book-source access, and host smoke implementations are allowed when they are clean-room, evidence-bound, redacted, and validated.
6. Bridge strategy defaults to Strategy A (DTO regeneration) unless user specifies otherwise.
7. ENV_BLOCKED is valid only for true environment blockers; do not use stale local planning constraints as blockers.
8. Do not fake build, device, simulator, network, credential, cookie, or release-gate success. If device execution is not run, export device-ready evidence separately from device-executed evidence.

## Development Loop

Use `/harmonyos-loop` for automated single-task execution. See `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` for the task queue and `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md` for cron/automation setup.
