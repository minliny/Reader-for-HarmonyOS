# HarmonyOS Device Runtime Smoke Report

Date: 2026-06-23

## Scope

- Capability slice: emulator install, foreground launch, screenshot, and layout smoke for the local service-bound app shell.
- Device target: `127.0.0.1:5555`.
- Device model: `emulator`.
- API version: `22`.
- Clean-room status: no external GPL implementation copied, translated, or adapted.

## Commands

```bash
./hvigorw assembleHap
hdc list targets
hdc install -r entry/build/default/outputs/default/entry-default-unsigned.hap
hdc shell aa start -a EntryAbility -b com.reader.harmonyos -m entry
hdc shell pidof com.reader.harmonyos
hdc shell hidumper -s AbilityManagerService -a '-a'
hdc shell snapshot_display -f /data/local/tmp/reader_harmonyos_home.jpeg
hdc shell uitest dumpLayout -p /data/local/tmp/reader_search_layout.json -b com.reader.harmonyos
```

## Evidence

| Check | Result | Observed Evidence |
| --- | --- | --- |
| Device target | PASS | `hdc list targets` returned `127.0.0.1:5555` |
| HAP install | PASS | `install bundle successfully` for `entry-default-unsigned.hap` |
| Ability start | PASS | `start ability successfully` |
| Foreground process | PASS | `pidof com.reader.harmonyos` returned `6018`; hidumper showed `EntryAbility` state `FOREGROUND` |
| Bookshelf layout | PASS | Layout contained `书架`, `藏书`, `在读`, `未读`, `三体` |
| Search layout | PASS | Layout contained `搜索`, `三体`, `FIXTURE`, `三体全集`, `三体II`, `刘慈欣` |
| Screenshot capture | PASS | `snapshot_display` wrote 1280x2832 JPEG screenshots for bookshelf and search views |

## Failure Reason Bound

Before this smoke, HarmonyOS UI capability was only build-verified and headless/local-service verified. The remaining evidence gap was whether the HAP could install, launch, and render the local service-bound bookshelf/search pages on an actual HarmonyOS runtime target.

## Expected Change

- App-shell capability moves from local-only evidence to emulator smoke evidence.
- Bookshelf/search UI claims remain limited to local service and fixture fallback rendering.
- Full device runtime parity is not claimed for ArkWeb, JS eval, native HTTP, cookie mirror, session login, secure storage, or live external source execution.

## Regression Result

- `./hvigorw assembleHap`: PASS.
- `hdc install -r entry/build/default/outputs/default/entry-default-unsigned.hap`: PASS.
- `hdc shell aa start -a EntryAbility -b com.reader.harmonyos -m entry`: PASS.
- Layout smoke for bookshelf/search: PASS.
