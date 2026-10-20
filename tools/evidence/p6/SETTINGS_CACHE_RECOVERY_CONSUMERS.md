# Settings accepted save and shared cache-clear consumers

This slice keeps the current normal UI and existing compact recovery typography, colors, radius and 36vp hit area. It does not redefine four settings flags or introduce a global overlay/state owner.

- SettingsPage renders “刷新设置” only as the original read-only reconciliation; “重试保存当前设置” invokes `SettingsHost.retryAccepted` with the exact original projection generation. Small recovery actors are keyed by the physical page identity, action family and immutable generation, so retained V1 native callbacks cannot borrow a newer tuple.
- Index captures Runtime, mount, navigation and the original SettingsHost for dispatch. Old page callbacks cannot dynamically acquire a new settings owner. The cache consumers separately expose “核对清理结果” (pure exact-ID query) and “继续原操作” (only the original owner's explicit capability).
- Both settings entry routes read the fixed cache intent. An ACK lost after durable Core execution is confirmed only through the exact receipt query. A null receipt permits the owner's explicit original-ID continuation, never a fresh clear.
- A cold global `cache/global-text` intent discovered by a book's Offline owner remains the original scope. A finite `blockingClear` capacity DTO says to return to Settings; it gives no wrong-book reconciliation or continuation action. Book download/clear dispatch stays blocked; existing directory/body data remains usable. Clearing the original intent changes the capacity flag, not the foreign receipt's unknown confirmation.
- Directory/Offline factory and same-Runtime read-after-active join from the preceding slice remain intact.

## Evidence

`test-settings-cache-index-sdk.mjs`: five actual installed-SDK/AtomicFile/cold-Core-SQLite/Index→decorated Page→shared native action groups, including before/after ACK, old navigation, retained V1 actor, Runtime unavailable, and cold global intent viewed from book scope.

`test-source-settings-receipt-consumers.mjs`: original Source/Settings actual Gateway→Index→SDK cases preserved; explicit accepted-save and immutable retained physical actor added. The fixture now replays existing SDK observers rather than repeatedly creating fresh children and reading the obsolete first child's payload.

`test-reading-directory-index-sdk.mjs`: all twelve preceding real receipt/owner/consumer and negative-control groups pass after the finite cross-scope addition. `test-general-settings-write-confirmation.mjs`: thirteen actual owner/Gateway cases pass. Current producer/consumer/style registration passes with all 100 business style budgets unchanged.

Native scheduling, full ArkTS/HAP, device behavior, visual refinement and user acceptance remain separate exits. Additional recovery text only appears in fault states and is recorded for later visual refinement.
