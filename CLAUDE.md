# Reader for HarmonyOS — CLAUDE.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS/Stage Model) port of the Reader ebook application. It consumes Reader-Core (Swift 5.9) for cross-platform models, protocols, and service contracts. This project is currently in the **planning phase** — no HarmonyOS project scaffold exists yet.

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader for HarmonyOS` |
| Upstream Core | `/Users/minliny/Documents/Reader-Core` |
| Planning docs | `docs/PLANNING/` |
| Loop command | `.claude/commands/harmonyos-loop.md` |

## Reader-Core Baseline

- **HEAD**: `5b199ff` (Phase 2 active: P2.J1 done, P2.I1 done)
- **Language**: Swift 5.9, iOS 15+/macOS 13+
- **73 frozen symbols** across 6 modules
- **Services ready**: DefaultSearchService, DefaultTOCService, DefaultContentService
- **Core is Swift** — cannot be directly linked from ArkTS

## Rules

1. **Do NOT modify Reader-Core** under any circumstances
2. **Do NOT copy iOS code** as HarmonyOS implementation
3. **Do NOT assume Core capabilities** — read actual Core files before using them
4. **Mark all Core-missing features** as CONTRACT_ONLY or MOCK_ONLY
5. **Do NOT implement**: WebDAV, JS Runtime, WebView, TXT/EPUB parser, real book source access
6. **Bridge strategy** defaults to Strategy A (DTO regeneration) unless user specifies otherwise
7. **ENV_BLOCKED** is a valid state — do not fake build success when ohpm/hvigor missing

## Development Loop

Use `/harmonyos-loop` for automated single-task execution. See `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` for the task queue and `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md` for cron/automation setup.
