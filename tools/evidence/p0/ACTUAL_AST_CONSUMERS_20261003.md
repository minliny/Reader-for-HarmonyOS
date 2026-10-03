# P0 actual AST / owner-consumer registration

Snapshot Host `641924106bfe`, product profile `l0`; SDK ETS AST parses every source file. The tool re-reads every source hash and checks HEAD before/after, so this is an immutable source snapshot rather than a live claim after later commits. Full machine data is in `tools/evidence/p0/actual-ast-consumers-20261003.json` and the workspace evidence copy `P0_ACTUAL_AST_CONSUMERS.json`. It includes every file hash, actual native/custom element, method, input expression, modifier, component field/decorator, parent consumer, product admission and source reachability.

## Scope and counts

- 362 ETS/TS files; 118 contain actual UI nodes.
- 122 struct components and 2412 actual native/custom call sites. The count includes ordinary CallExpression custom components without trailing attributes; a native-only ETS walk missed193 of them.
- Struct reachability: {'main_l0_conditional_source_reachable': 95, 'product_disabled_interface_preserved': 7, 'not_reached_by_registered_static_roots': 14, 'debug_probe_only': 5, 'native_startup_recovery': 1}. Native element reachability is separately registered in the machine file.
- Framework/lifecycle/Watch/callback references are conservatively connected; literal product-policy branches are evaluated using the actual ReaderProductScope implementation. 'Source reachable' means potentially admitted by code, not device scheduling, a completed workflow, or user acceptance.
- ReaderStartupRecovery is a native startup-recovery root. Renderer/control verification roots require the real debug cold-start allowlist. The RSS/Discover/Sync implementations stay product-disabled under l0. Fourteen legacy control structs are not reached by these registered roots; preserve their interfaces rather than opening or deleting them by assumption.

## What the old100 gate proves

`test-architecture-consumer-baseline.mjs` has 100 baseline rows plus4 shared-owner rows. It budgets fontSize/background/overlay increments. fontSize is now actual AST, but backgrounds/overlays remain lexical, and the test does not check every actual element, its owner, reachability, or migration closure. It also cannot discover a control with no font calls. PASS therefore means no forbidden budget increase; it does not mean100 consumers migrated or the entire UI shares surfaces.

The actual-node registry adds 18 UI files absent from that budget and 13 UI files absent from the original evidence registry. These include legitimate wrappers/native adapters and verification pages, not automatic defects. Their exact classifications and owner interfaces are in the machine data.

## Native defaults: retain actual upstream rendering

Seventy Text/Span-input/button candidates have no own font arguments:30 blank paint actors, one unlabelled native event host, four1vp accessibility actors, one shared Dialog native action host, and34 native defaults (13 current main-flow controls,20 diagnostic controls, one product-disabled Sync loading Text). Six additional body spans inherit their parent's actual body tuple and are separately checked.

The13 main controls use three finite contracts in `tools/fixtures/design/native-default-control-contracts.json`: nativeLabelButton, nativeShelfGroupInput, nativeDirectoryLevelInput. Their actual rendering implementation is upstream ArkUI Button/TextInput; all five font attributes remain omitted, so system/inheritance/AUTO responsibilities stay with the framework. The SDK declarations are `openharmony/ets/component/button.d.ts` and `text_input.d.ts`. No Reader font value or empty modifier is fabricated, and this registration is explicitly RETAINED_PLATFORM_DEFAULT_CONTRACT, not wrapper-migration completion. Business owners, current input/action consumers, geometry and applicability are registered individually.

|ID|Actual native element/consumer|Host and variant|Business owner|
|---|---|---|---|
|NATIVE-DEFAULT-01|features/bookshelf/BookDirectoryPage.ets:83 / Button(this.rulesExpanded ? '收起层级规则' : '本书目录层级规则')|BookDirectoryPage.build / nativeLabelButton|BookDirectoryPage rulesExpanded local display state|
|NATIVE-DEFAULT-02|features/bookshelf/BookshelfManagementPage.ets:169 / TextInput({ text: this.snapshot.groupNameDraft, placeholder: '分组名' })|BookshelfManagementPage.groupEditorCard / nativeShelfGroupInput|BookshelfOrchestrator snapshot group draft; callbacks to Index/owner|
|NATIVE-DEFAULT-03|features/bookshelf/BookshelfManagementPage.ets:171 / TextInput({ text: this.snapshot.groupOrderDraft, placeholder: '顺序整数' })|BookshelfManagementPage.groupEditorCard / nativeShelfGroupInput|BookshelfOrchestrator snapshot group draft; callbacks to Index/owner|
|NATIVE-DEFAULT-04|features/bookshelf/BookshelfManagementPage.ets:255 / TextInput({ text: this.snapshot.assignmentGroupDraft, placeholder: '分组名；留空清除' })|BookshelfManagementPage.assignmentCard / nativeShelfGroupInput|BookshelfOrchestrator snapshot group draft; callbacks to Index/owner|
|NATIVE-DEFAULT-05|features/reading/LocalReadingExperience.ets:13583 / Button('重试')|ReadingExperience.readingFailureContent / nativeLabelButton|ReadingExperience source-switch failure/session guard|
|NATIVE-DEFAULT-06|features/reading/LocalReadingExperience.ets:13588 / Button('阅读设置')|ReadingExperience.readingFailureContent / nativeLabelButton|ReadingExperience source-switch failure/session guard|
|NATIVE-DEFAULT-07|features/reading/LocalReadingExperience.ets:13591 / Button('继续当前书源')|ReadingExperience.readingFailureContent / nativeLabelButton|ReadingExperience source-switch failure/session guard|
|NATIVE-DEFAULT-08|features/reading/LocalReadingExperience.ets:13595 / Button('切换书源')|ReadingExperience.readingFailureContent / nativeLabelButton|ReadingExperience source-switch failure/session guard|
|NATIVE-DEFAULT-09|features/reading/ReaderDirectoryRules.ets:108 / TextInput({ text: rule.level })|ReaderDirectoryRules.build / nativeDirectoryLevelInput|ReaderDirectoryRules local rules draft and run() admission|
|NATIVE-DEFAULT-10|features/reading/ReaderDirectoryRules.ets:114 / Button('删除')|ReaderDirectoryRules.build / nativeLabelButton|ReaderDirectoryRules local draft/preview/run owner|
|NATIVE-DEFAULT-11|features/reading/ReaderDirectoryRules.ets:121 / Button('添加规则')|ReaderDirectoryRules.build / nativeLabelButton|ReaderDirectoryRules local draft/preview/run owner|
|NATIVE-DEFAULT-12|features/reading/ReaderDirectoryRules.ets:124 / Button('预览')|ReaderDirectoryRules.build / nativeLabelButton|ReaderDirectoryRules local draft/preview/run owner|
|NATIVE-DEFAULT-13|features/reading/ReaderDirectoryRules.ets:125 / Button('应用')|ReaderDirectoryRules.build / nativeLabelButton|ReaderDirectoryRules local draft/preview/run owner|

The AST gate `test-native-default-control-contracts.mjs` reads the real13 controls and verifies omitted typography, original input geometry, real callback presence, bounded consumer identity and no added empty attributeModifier. It separately recognises only blank/no-label, exact accessibility actors, real shared Dialog host and inherited body spans. A new unregistered visible default element cannot hide behind zero font-call counts. Callback presence is an interface proof; epoch/ACK/recovery correctness remains with the relevant owner tests.

Future basic-control migration groups are driven by repeated Reader structure/state/policy: three shelf group fields share a contract; DirectoryRules has its own editable level/preview/apply state; four reader failure actions share their owner but remain actual native Button implementations. A wrapper is warranted if those Reader policies repeat and can use one real implementation while preserving current defaults. Introducing a wrapper solely to say 'shared' or giving these defaults hard-coded font values is not an architectural improvement.

## Real public component consumers

Counts below are actual call sites and distinct source-file consumers. They prove implementation reuse in source; selected variants, callback lifecycle and target pixels still have their own acceptance tiers.

|Public component|Actual calls|Distinct consumer files|
|---|---:|---:|
|AppTopBar|3|3|
|JsonImportDialog|1|1|
|PageBackBar|13|13|
|ReaderActionMenuSurface|2|2|
|ReaderCard|6|2|
|ReaderChoiceRow|5|2|
|ReaderDialogSurface|3|3|
|ReaderIconButton|3|2|
|ReaderRecoveryAction|8|7|
|ReaderRecoveryNotice|4|4|
|ReaderSearchField|7|7|
|ReaderSectionHeading|1|1|
|ReaderSegmentedControl|1|1|
|ReaderSelect|4|4|
|ReaderSelectPanel|3|3|
|ReaderToggle|6|5|
|StatusBadge|3|3|

## Missing old registrations

|Actual UI file not in100 budget|Components / source status|
|---|---|
|app/ArkWebExecutionHost.ets|ArkWebExecutionHost: main_l0_conditional_source_reachable|
|features/bookshelf/BookshelfShell.ets|BookshelfShell: main_l0_conditional_source_reachable|
|features/common/ReaderIconButton.ets|ReaderIconButton: main_l0_conditional_source_reachable|
|features/reading/BookTurnTextureBuilder.ets|adapter / non-struct owner|
|features/reading/ReaderBookmarkList.ets|ReaderBookmarkList: main_l0_conditional_source_reachable|
|features/reading/ReaderContinuousReadingStage.ets|ReaderContinuousReadingStage: main_l0_conditional_source_reachable|
|features/reading/ReaderDirectoryList.ets|ReaderDirectoryList: main_l0_conditional_source_reachable|
|features/reading/ReaderNativeParagraphView.ets|ReaderNativeParagraphView: main_l0_conditional_source_reachable|
|features/reading/ReaderPageTurnStage.ets|ReaderPageTurnSurface: main_l0_conditional_source_reachable; ReaderPageTurnStage: main_l0_conditional_source_reachable|
|features/reading/SourceSwitchPanel.ets|SourceSwitchPanel: main_l0_conditional_source_reachable|
|features/search/SearchSpinner.ets|SearchSpinner: main_l0_conditional_source_reachable|
|features/settings/CategorySection.ets|CategorySection: main_l0_conditional_source_reachable|
|pages/Index.ets|Index: main_l0_conditional_source_reachable|
|pages/ReaderControlMotionVerification.ets|ReaderControlMotionVerification: debug_probe_only|
|pages/ReaderParagraphDiagnostic.ets|ReaderParagraphDiagnostic: debug_probe_only|
|pages/ReaderRendererPilot.ets|ReaderRendererPilot: debug_probe_only|
|pages/ReaderStartupRecovery.ets|ReaderStartupRecovery: native_startup_recovery|
|pages/ReaderTextNodeDiagnostic.ets|ReaderTextNodeDiagnostic: debug_probe_only|

## Hidden/compatibility interface set

|Struct not reached by registered static roots|Reason/action|
|---|---|
|features/reading/ReaderAppearanceFullPanel.ets / ReaderAppearanceFullPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderAppearanceModulePanel.ets / ReaderAppearanceModulePanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderAppearanceMotionStage.ets / ReaderAppearanceMotionStage|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderAppearanceSharedActors.ets / ReaderAppearanceSharedActors|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderAutoPageFullPanel.ets / ReaderAutoPageFullPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderAutoPagePanel.ets / ReaderAutoPagePanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderDirectoryModulePanel.ets / ReaderDirectoryModulePanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderQuickSearchPanel.ets / ReaderQuickSearchPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderReplaceQuickPanel.ets / ReaderReplaceQuickPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderSearchFullPanel.ets / ReaderSearchFullPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderSettingsFullPanel.ets / ReaderSettingsFullPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderSettingsModulePanel.ets / ReaderSettingsModulePanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderTtsFullPanel.ets / ReaderTtsFullPanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|
|features/reading/ReaderTtsModulePanel.ets / ReaderTtsModulePanel|Compatibility or alternate harness interface; no new shipping entrance. Keep compatible until an explicit owner/consumer decision verifies removal.|

## Validation boundaries

Read-only full AST parser/inventory PASS; each source hash and HEAD stayed stable. Native-default13-consumer contract gate, five-property reading gate (983 public/calibrated +16 narrowly required runtime arguments, zero arbitrary chrome arguments), true role-import checks, private-override gate and test-tier checks PASS on the implementation branch. Runtime native body/measurement/physical previews remain justified by their actual contracts; persistent controls are not exempted as a family. No HAP, device, visual or user-acceptance result is inferred from this registration. The existing full462-test integration report has separate remaining failures and is not replaced by a registry PASS.
