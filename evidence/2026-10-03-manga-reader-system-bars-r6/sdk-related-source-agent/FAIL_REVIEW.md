# R6 first related manga gate failures

All 44 existing `tools/test-manga-*.mjs` ran against frozen source Surface `f84e5289f30711f31b9c7df2999fdba30dc6af4d175d6100c0e0bfb801ee3448`, Shell `edd9b4ade1b4f2ebe7953816742460b38263b1ae804b345f7f4dd4ebd906d560`. 31 exit0, 13 nonzero. Exact source/test/output SHA and original outputs are retained in run-index.json and adjacent logs. No source, tool, R5 evidence, HAP or device changes were made by this runner.

| Nonzero gates | Observed failure | Source-side preliminary classification |
|---|---|---|
| cancelled-banner, strip, tile-window | `refreshLoginRequiredForControls is not a function` | Ordinary production method probe omitted the new real transitive helper. Product full SDK component transform passes; fixture must execute the helper and supply its inputs, not weaken the assertion. |
| motion-progress, navigation, offline-network-probe, ui-state | SyntaxError from `@Watch` left in generated ordinary Probe class | Existing method-probe panelFields removes only the first decorator `@State`. New second Watch decorator is not ordinary JS. Preserve actual production member body, remove all ArkUI decorators only in this nonreactive method probe; retain dedicated actual SDK Watch test. |
| directory-font-readiness-sdk, sheet-motion-sdk, sheet-selection-sdk | SDK `10905301` Watch callback absent from selected members | Standalone SDK member selections include watched panel/control fields without the actual `onWindowChromeChanged` method. Whole component SDK parsing/transform passes. Extend selected real helpers/fields and supply genuine native boundary inputs. |
| error-recovery | Legacy regex `@State\s+private openingRetry` rejected actual State+Watch declaration | Prior exact annotation layout assertion needs to allow the new actual Watch while retaining State proof. It is not a retry behavior failure; preceding real retry/recovery checks passed. |
| surface-sdk | first matching same-label Text size 11 rather than panel header 15 | Newly shared presented predicate shows controls when a retained panel exists. `更多` can match the footer label before the wide panel header. Bind the actual header actor/context rather than loosening geometry. This classification requires the fixture owner to verify its repaired selector. |
| session | expected restore `[[6,0,0]]`, actual `[]` | This fixture extracts publish+requestedLast+displayChapterTitle. publish calls real notifyPublishedRows, which now calls the missing refresh helper; publish catch can retain the resulting error and skip restore. Owner must rerun the complete production helper closure to confirm the cause and unchanged recovery behavior. |

Immediate failures were sent to root and the test owner. The logs are original failed evidence and must not be overwritten by a later passing rerun. Suggested reruns belong in a separate dated directory.

`window-publication`, `viewport-restore-sdk`, and `ui-assembly-sdk` passed. SDK native scheduling/property/geometry instrumentation does not prove target system-bar pixels, native compositor motion, or reader anchor stability during physical bar reveal.
