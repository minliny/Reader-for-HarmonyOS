# HarmonyOS + Core Legado Non-UI Parity Evidence

Status: `LOCAL_CODE_OWNED_MEASURED_COMPLETE`

This report records the HarmonyOS-side non-UI parity batch for the gaps called out
against Legado. UI/page behavior is intentionally excluded. The batch adds local,
clean-room, executable service closures plus a Core-compatible evidence bundle
without copying, translating, or adapting Legado GPL implementation code.

## Added Evidence

| Area | Evidence | File |
| --- | --- | --- |
| Source chain | Search -> detail -> TOC -> content fixture runtime with failure classification and redacted evidence | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Data layer | 21 Legado-like non-UI entity names, DAO contract names, v43->v75 migration steps, source/search/progress/bookmark/cache/rule-sub records | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Local books | TXT, EPUB, PDF, MOBI/AZW3, UMD, HTML, and unknown format detection boundary | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| WebDAV/backup | Connection, upload/download, conflict resolution, restore policy, opaque backup envelope, raw-body redaction | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Download/cache | Queue scheduling, completion, retry classification, cache hit, raw content redaction | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| TTS/HTTP TTS | Segment queue/progress plus credential redaction boundary | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Content processing | Replacement, dictionary normalization boundary, and ad text cleanup | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Debug transport | Local HTTP/WebSocket source-debug event contract with raw payload redaction | `entry/src/main/ets/services/LegadoNonUIParityServices.ets` |
| Evidence bundle | `harmonyos_legado_non_ui_parity_001` rows, artifact export, no fake device execution, Core root gate boundary | `entry/src/main/ets/coreAdapter/HarmonyOSNonUIParityEvidenceRunner.ets` |
| Validation | Non-UI parity validator added to aggregate `TestInfra` | `entry/src/main/ets/__tests__/NonUIParityEvidenceValidator.ets` |

## Gate Interpretation

| Gate | Outcome |
| --- | --- |
| Local code-owned non-UI gaps | `closed` |
| Unsafe raw value export | `false` |
| Clean-room maintained | `true` |
| External GPL code copied | `false` |
| Legado source copied | `false` |
| Device executor used | `false` |
| External network used | `false` |
| Can enter Core external evidence intake | `true` |
| Can mutate Reader-Core `production_release` | `false` |
| Reader-Core root artifacts mutated | `false` |

## Remaining Non-Fakeable Work

The following are not claimed as measured pass by this local batch:

- HarmonyOS device/simulator execution that sets `deviceExecutorUsed=true`.
- Platform runtime CI stability from a real ArkWeb/native HTTP/cookie/session runner.
- Authorized real corpus benchmark and redacted source-backed diff artifacts.
- Product governance approval.
- Manual Reader-Core root gate application that changes `production_release`.

Those rows are exported as `READY_NOT_EXECUTED` or `EXTERNAL_REQUIRED`, not as
local `MEASURED_PASS`.
