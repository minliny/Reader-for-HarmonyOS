# Bounded form/modal shared structures

## Immutable baseline and ownership

Host baseline `d6adb8833d530e19141dc3ff506dc055dc8feec7`; isolated branch `codex/p5-bounded-forms-20261003`. `bounded-form-baseline/AST_BASELINE.json` records the actual installed SDK ETS AST, immutable source hashes, declarations/decorators and 199 native node records for all five assigned files. Reproduce with `node tools/audit-bounded-form-families.mjs`; this is source evidence, not pixels.

| Family | Existing host/state owner and geometry | Shared structural migration |
|---|---|---|
| Source switch | Index original surface admission; Reader SourceSwitchPanel delegates to SourceSwitchWindow; 300 cap, height385 with safe-window clamp; translation remains Window | Real Frame column + Header icon/title/sort accessory/close + original body/footer slots. Seven states, callbacks, candidate identities and measured safe bounds stay original. |
| TTS manager/picker/voice | Original viewport overlay/content-cover; all selection generations, drafts, preview, busy, keyboard restore stay ReaderTtsConfigOverlay. Manager364/r22/halfborder/shadow48+18; picker dynamic260 cap/r14/shadow36+14 | Real Frame/Header shared with source family. Normal header/body/actions slots; compact manager keeps its original whole-form Scroll inside body with original header/footer. Frame height remains continuous owner input. Voice picker retains no header. |
| Bookshelf book sheet | Root exclusively retains bindSheet host and migrates four actions. Sheet270/high, TopStart absolute positions, only top corners24; header title AUTO, handle | This lane supplies finite shared Frame stack and Header handle/title variant. Root consumes and removes sheet's repeated frame/header, with its finite action-list component. |
| Local import | Original mounted Stack, measured result budget, importing→result crossfade, spinner/foreground/reduceMotion owner | Next commit: shared frame/header/actions while keeping continuous shell height and persistent phase layers. |
| Retained replace editor | Existing persistent control tree, morph progress, session and temporary revision, drafts and action admission | Next commit: shared finite temporary frame/header/actions without moving business owner or remounting canonical rule list. |

Current UI tuples are the migration baseline. No font-role numeric edit or new free style override is allowed. The existing DialogSurface remains its own admitted native/dialog family; no universal renderer, navigation/task owner or error bus is introduced.

## Finite public API

`ReaderBoundedSurface.specId` admits `source-switch-window`, `tts-config-manager`, `tts-config-picker`, `bookshelf-book-action`, `local-import-selection`, `local-import-progress`, `local-import-result-content`, `reader-replace-editor`. The latter four finite structures are supplied for the next owned consumer migration; their presence alone is not migration proof. `width:number|string` and `height:number` are existing owner geometry, not style overrides. `header/body/actions` are real BuilderParam slots invoked in one native frame. Consumers must pass lexical arrow closures (for example `body: (): void => { this.windowBody(); }`), preserving their original state owner; direct Builder method references are rejected by the real composed SDK probe. Styles resolve existing ReaderSurfaceSpecs; the finite picker adapter preserves14/36/14 geometry. Sheet ignores caller width/height and always resolves its100%/270 spec contract, so the caller must remove repeated frame styles.

`ReaderBoundedSurfaceHeader` uses the same finite ID, `title`, `enabled`, source-only `width` for its original divider extent, `accessory` for source sort, `onClose`. Close callbacks consult live enabled state. Sheet variant owns its exact handle/title nodes and no close callback. Header typography consumes original existing roles; sheet consumes its existing spec tuple.

Caller hosts retain mask, translation/position, native bindings, original safe geometry, dynamic height measurement, keyboard mode and route/generation guards. No close action cancels accepted durable work or guesses a late ACK.

## Code exit evidence for the first vertical slice

New SDK Frame/Header test executes actual compiled builders and installed SDK observable/property proxy classes: three existing frame tuples, all header close targets, title replacement, height replacement on the same native node, guarded retained click, and the sheet Stack/top-corner/AUTO-title/no-close contract. Immutable baseline AST and real source/TTS call-site checks demonstrate structural migration and deletion of private frame/header nodes.

Existing TTS config interaction test still executes real owner methods, draft/late-result and callback contracts. Popup surface assertions now follow real frame ownership instead of requiring stale private styles in the caller.

Still OPEN: full new composed consumer→Frame→Header/body/actions lifecycle/propagation checks; all same-spec local-import/replace/action consumers; integrated source/ArkTS checks; native focus/scheduling/keyboard behavior; target evidence, visual/user acceptance. Finite sheet API availability does not mean root's sheet consumer is already migrated. The first slice is not the completed P5 family exit.

## First composed-consumer correction and proof

The first `7a5bfd69` commit was an isolated candidate, not a completed consumer-to-Frame proof. Real composition exposed a concrete ArkUI binding defect: a direct method reference passed to BuilderParam is invoked with the child frame as `this`. Nested business methods then fail. All Source/TTS slots now use lexical closures, as the existing SettingsShell callers already require. Removing these closures from the real production source is a failing negative control in `test-bounded-source-tts-composition.mjs`.

The installed SDK `CommonAttribute.height(Length)` / `TextAttribute.lineHeight(number|string|Resource)` contract also does not establish that an explicit undefined call equals the old AUTO behavior. Shared modifiers now author only original attributes: TTS title never calls height/lineHeight/constraintSize/margin, source frame never calls empty constraintSize/undefined shadow/clip(false), and finite file-action layout sets weighted selection or measured result width separately. Native branch variants stay fixed per actual mounted family; arbitrary cross-family native node recycling is outside this interface.

A second real Source dependency gap was exposed: a primitive message passed to a nested Builder retained the first error text. Source error and failure text now use live state getters (with a live rollback-presence getter), retaining the original native tuple.

Actual SDK composed Source/TTS owners now execute the shared Frame/Header/body/action children, not test stubs. Gates cover live parent Props, same frame/header/action identities, safe-window divider extent, TTS busy dispatch/cancel guards, retained credentials/draft, replacement opening versus late accepted write, original keyboard-mode restoration, continuous height/body budget and compact whole-form Scroll. An isolated common-frame style mutation changes both actual Source and TTS callers; the finite picker radius remains unchanged. SDK observable classes/compiler output are real; subscriber delivery and native node sinks are instrumented. Native layout, scheduling, focus, keyboard behavior, pixels and target/user acceptance remain OPEN.

The common finite action regions are now real structure for TTS; importing/replacement consumers are in the next reviewable commit. There is no arbitrary style override or new task/state owner.
