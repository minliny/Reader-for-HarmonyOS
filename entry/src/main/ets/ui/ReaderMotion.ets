// Reader for HarmonyOS - L1 Motion Token
// Phase 1.4: Motion 类型从契约导入,所有 MotionId 值严格对应 contract/Motion.ets 的 83 个 enum。
// Phase 1.5: Duration 数值从 ReaderMotionDurationToken(Contract Token 注册表)消费。
// 任何新增 MotionId 必须先在 Reader UI/contracts/motion.schema.json 添加后重新生成。
import { MotionId as ContractMotionId, MotionEasing } from '../contract';
import { ReaderMotionDurationToken } from './ReaderToken';

// ─── Phase 1.4: 契约 MotionId 常量 ───
// 所有值严格对应 contract/Motion.ets 的 83 个 MotionId enum。
// Reducer 和组件应使用这些常量,不允许自定义 MotionId 字符串。
export class ReaderMotionId {
  // App / Route
  static readonly appFirstOpenEnter: string = 'app.firstOpen.enter';
  static readonly appRoutePushForward: string = 'app.route.push.forward';
  static readonly appRoutePopBackward: string = 'app.route.pop.backward';
  static readonly appRouteReplace: string = 'app.route.replace';
  // Bookshelf
  static readonly bookshelfViewSwitch: string = 'bookshelf.view.switch';
  // Button / Card / Chip
  static readonly buttonActivate: string = 'button.activate';
  static readonly cardPress: string = 'card.press';
  static readonly cardSelect: string = 'card.select';
  static readonly cardRoute: string = 'card.route';
  static readonly chipItemSelect: string = 'chip.item.select';
  // Destructive / Filter / Input
  static readonly destructiveConfirmCommit: string = 'destructive.confirm.commit';
  static readonly dropdownMenuCollapse: string = 'dropdown.menu.collapse';
  static readonly dropdownMenuExpand: string = 'dropdown.menu.expand';
  static readonly dropdownOptionSelect: string = 'dropdown.option.select';
  static readonly dropdownTriggerPress: string = 'dropdown.trigger.press';
  static readonly feedbackToastEnter: string = 'feedback.toast.enter';
  static readonly feedbackToastUpdate: string = 'feedback.toast.update';
  static readonly feedbackToastExit: string = 'feedback.toast.exit';
  static readonly filterApplyCommit: string = 'filter.apply.commit';
  static readonly filterItemToggle: string = 'filter.item.toggle';
  static readonly inputBlur: string = 'input.blur';
  static readonly inputClear: string = 'input.clear';
  static readonly inputFocus: string = 'input.focus';
  static readonly inputFocusBlur: string = 'input.focus-blur';
  static readonly inputSubmit: string = 'input.submit';
  static readonly listRowSelect: string = 'listRow.select';
  // Motion Interrupt (三态)
  static readonly motionInterruptCancel: string = 'motion.interrupt.cancel';
  static readonly motionInterruptCompleteThenReplace: string = 'motion.interrupt.completeThenReplace';
  static readonly motionInterruptRedirect: string = 'motion.interrupt.redirect';
  // Overlay
  static readonly overlayDialogEnter: string = 'overlay.dialog.enter';
  static readonly overlayDialogEnterExit: string = 'overlay.dialog.enter-exit';
  static readonly overlayDialogExit: string = 'overlay.dialog.exit';
  static readonly overlayKeyboardEnterExit: string = 'overlay.keyboard.enter-exit';
  static readonly overlaySheetEnter: string = 'overlay.sheet.enter';
  static readonly overlaySheetEnterExit: string = 'overlay.sheet.enter-exit';
  static readonly overlaySheetExit: string = 'overlay.sheet.exit';
  // Reader
  static readonly readerChapterJump: string = 'reader.chapter.jump';
  static readonly readerControlDockDrag: string = 'reader.control.dock.drag';
  static readonly readerControlDockLongPress: string = 'reader.control.dock.longPress';
  static readonly readerControlDockRebound: string = 'reader.control.dock.rebound';
  static readonly readerControlDockRelease: string = 'reader.control.dock.release';
  static readonly readerControlHandlePress: string = 'reader.control.handle.press';
  static readonly readerControlHandleRelease: string = 'reader.control.handle.release';
  static readonly readerControlHide: string = 'reader.control.hide';
  static readonly readerEntryActionToImmersive: string = 'reader.entry.actionToImmersive';
  static readonly readerEntryCoverToImmersive: string = 'reader.entry.coverToImmersive';
  static readonly readerModuleSwitch: string = 'reader.module.switch';
  static readonly readerPageTurnNextPrev: string = 'reader.page.turn.next-prev';
  static readonly readerQuickPromote: string = 'reader.quick.promote';
  static readonly readerSessionAutoPageStart: string = 'reader.session.autoPage.start';
  static readonly readerSessionCapsuleEnter: string = 'reader.session.capsule.enter';
  static readonly readerSessionCapsuleUpdate: string = 'reader.session.capsule.update';
  static readonly readerSessionCapsuleExit: string = 'reader.session.capsule.exit';
  static readonly readerSessionCapsuleSwitch: string = 'reader.session.capsule.switch';
  static readonly readerSessionCapsuleControlPressToggle: string = 'reader.session.capsule.control.press-toggle';
  static readonly readerSessionCapsuleCountdownTick: string = 'reader.session.capsule.countdownTick';
  static readonly readerSessionCapsuleVoiceIconActive: string = 'reader.session.capsule.voiceIcon.active';
  static readonly readerSessionControlSpaceEnter: string = 'reader.session.controlSpace.enter';
  static readonly readerSessionControlSpaceUpdate: string = 'reader.session.controlSpace.update';
  static readonly readerSessionControlSpaceExit: string = 'reader.session.controlSpace.exit';
  static readonly readerSessionTtsStart: string = 'reader.session.tts.start';
  static readonly readerSourceSwitchOpenClose: string = 'reader.sourceSwitch.open-close';
  // Search / Segment / Selection / Slider / State / Stepper / Tab / Toggle / Tooling / Viewport
  static readonly searchStateReplace: string = 'search.state.replace';
  static readonly segmentItemSwitch: string = 'segment.item.switch';
  static readonly selectionGroupToggle: string = 'selection.group.toggle';
  static readonly selectionItemToggle: string = 'selection.item.toggle';
  static readonly selectionOptionToggle: string = 'selection.option.toggle';
  static readonly selectionRangeShow: string = 'selection.range.show';
  static readonly selectionToolbarAction: string = 'selection.toolbar.action';
  static readonly selectionToolbarExit: string = 'selection.toolbar.exit';
  static readonly sliderDragStart: string = 'slider.drag.start';
  static readonly sliderDragUpdate: string = 'slider.drag.update';
  static readonly sliderDragRelease: string = 'slider.drag.release';
  static readonly stateContentReplace: string = 'state.content.replace';
  static readonly stateLoadingInline: string = 'state.loading.inline';
  static readonly stepperPress: string = 'stepper.press';
  static readonly stepperValueChange: string = 'stepper.value.change';
  static readonly tabItemSelect: string = 'tab.item.select';
  static readonly tabSwitch: string = 'tab.switch';
  static readonly toggleSwitch: string = 'toggle.switch';
  static readonly toolingModeSwitch: string = 'tooling.mode.switch';
  static readonly viewportOrientationPrepare: string = 'viewport.orientation.prepare';
  static readonly viewportOrientationReshape: string = 'viewport.orientation.reshape';
  static readonly viewportOrientationSettle: string = 'viewport.orientation.settle';

  // ─── 向后兼容别名(Phase 3 删除) ───
  // 这些别名映射旧 Reducer 代码使用的 MotionId 到契约值。
  // 旧值不在契约 enum 里,必须用契约值替代。
  /** @deprecated 用 appRoutePushForward */
  static readonly appRoutePush: string = ReaderMotionId.appRoutePushForward;
  /** @deprecated 用 appRoutePopBackward */
  static readonly appRoutePop: string = ReaderMotionId.appRoutePopBackward;
  /** @deprecated 用 readerControlHide(契约没有 show,hide 即控制层显隐) */
  static readonly readerControlShow: string = ReaderMotionId.readerControlHide;
  /** @deprecated 用 readerPageTurnNextPrev(契约合并 next/prev 为 next-prev) */
  static readonly readerPageTurnNext: string = ReaderMotionId.readerPageTurnNextPrev;
  /** @deprecated 用 readerPageTurnNextPrev */
  static readonly readerPageTurnPrev: string = ReaderMotionId.readerPageTurnNextPrev;
  /** @deprecated 契约无此 ID,用 buttonActivate 替代 */
  static readonly tabItemPress: string = ReaderMotionId.buttonActivate;
  /** @deprecated 契约无此 ID,用 tabSwitch 替代 */
  static readonly appTabSwitch: string = ReaderMotionId.tabSwitch;
  /** @deprecated 契约无此 ID,用 readerModuleSwitch 替代 */
  static readonly readerPanelExpand: string = ReaderMotionId.readerModuleSwitch;
  /** @deprecated 契约无此 ID,用 stateContentReplace 替代 */
  static readonly readerBrightnessUpdate: string = ReaderMotionId.stateContentReplace;
  /** @deprecated 契约无此 ID,用 toggleSwitch 替代 */
  static readonly readerBrightnessAutoToggle: string = ReaderMotionId.toggleSwitch;
  /** @deprecated 契约无 dropdownOptionPress,用 dropdownTriggerPress 替代 */
  static readonly dropdownOptionPress: string = ReaderMotionId.dropdownTriggerPress;
}

// ─── Motion 快照(从 token.fixtures.json motion-duration 映射)───
export class ReaderMotionSnapshot {
  reducedMotion: boolean = false;
  // Duration(从 ReaderMotionDurationToken 消费 Contract Token)
  durationFirstOpen: number = ReaderMotionDurationToken.firstOpen;
  durationTabPress: number = ReaderMotionDurationToken.tabPress;
  durationTabSelect: number = ReaderMotionDurationToken.tabSelect;
  durationTabSwitch: number = ReaderMotionDurationToken.tabSwitch;
  durationButtonPress: number = ReaderMotionDurationToken.buttonPress;
  durationButtonActivate: number = ReaderMotionDurationToken.buttonActivate;
  durationToggleSwitch: number = ReaderMotionDurationToken.toggleSwitch;
  durationChipSelect: number = ReaderMotionDurationToken.chipSelect;
  durationFilterCommit: number = ReaderMotionDurationToken.filterCommit;
  durationNumericCommit: number = ReaderMotionDurationToken.numericCommit;
  durationInputFocus: number = ReaderMotionDurationToken.inputFocus;
  durationSearchState: number = ReaderMotionDurationToken.searchState;
  durationFeedbackToast: number = ReaderMotionDurationToken.feedbackToast;
  durationStateReplace: number = ReaderMotionDurationToken.stateReplace;
  durationSelectionToolbar: number = ReaderMotionDurationToken.selectionToolbar;
  durationDropdownPress: number = ReaderMotionDurationToken.dropdownPress;
  durationDropdownExpand: number = ReaderMotionDurationToken.dropdownExpand;
  durationDropdownCollapse: number = ReaderMotionDurationToken.dropdownCollapse;
  durationDropdownSelect: number = ReaderMotionDurationToken.dropdownSelect;
  durationReaderInstant: number = ReaderMotionDurationToken.readerInstant;
  durationReaderMicro: number = ReaderMotionDurationToken.readerMicro;
  durationReaderFast: number = ReaderMotionDurationToken.readerFast;
  durationReaderBase: number = ReaderMotionDurationToken.readerBase;
  durationHandleLongPress: number = ReaderMotionDurationToken.handleLongPress;
  durationHandleSnap: number = ReaderMotionDurationToken.handleSnap;
  durationPanel: number = ReaderMotionDurationToken.panel;
  durationPageTurn: number = ReaderMotionDurationToken.pageTurn;
  durationReaderEntry: number = ReaderMotionDurationToken.readerEntry;
  durationSessionReturn: number = ReaderMotionDurationToken.sessionReturn;
  durationRunningSpace: number = ReaderMotionDurationToken.runningSpace;
  durationCapsuleEnter: number = ReaderMotionDurationToken.capsuleEnter;
  durationCapsuleControl: number = ReaderMotionDurationToken.capsuleControl;
  durationCapsuleTick: number = ReaderMotionDurationToken.capsuleTick;
  durationVoicePulse: number = ReaderMotionDurationToken.voicePulse;
  durationOverlay: number = ReaderMotionDurationToken.overlay;
  durationLoadingSpin: number = ReaderMotionDurationToken.loadingSpin;
  durationInterruptSettle: number = ReaderMotionDurationToken.interruptSettle;
  durationViewportReshape: number = ReaderMotionDurationToken.viewportReshape;
  durationOrientationFreeze: number = ReaderMotionDurationToken.orientationFreeze;
  durationOrientationSettle: number = ReaderMotionDurationToken.orientationSettle;

  // ─── 向后兼容字段(Phase 3 删除)───
  /** @deprecated 用 durationRoute 对应 appRoutePushForward */
  durationRoute: number = 160;
  /** @deprecated 用 durationReaderControl 对应 readerControlHide */
  durationReaderControl: number = 160;
  /** @deprecated 用 durationReaderSession 对应 readerSessionTtsStart */
  durationReaderSession: number = 200;
  // Distance/Scale(契约未定义,本地保留)
  readerEntryY: number = 12;
  runningSpaceY: number = 8;
  capsuleY: number = 6;
  runningSpaceDockScale: number = 1;
  capsuleControlPressScale: number = 0.96;
  coverPressScale: number = 0.98;
}

export class ReaderMotion {
  static snapshot(reducedMotion: boolean): ReaderMotionSnapshot {
    const snapshot = new ReaderMotionSnapshot();
    snapshot.reducedMotion = reducedMotion;
    if (reducedMotion) {
      // 所有 duration 置 0(interrupt settle 保留 80ms per token)
      snapshot.durationFirstOpen = 0;
      snapshot.durationTabPress = 0;
      snapshot.durationTabSelect = 0;
      snapshot.durationTabSwitch = 0;
      snapshot.durationButtonPress = 0;
      snapshot.durationButtonActivate = 0;
      snapshot.durationToggleSwitch = 0;
      snapshot.durationChipSelect = 0;
      snapshot.durationFilterCommit = 0;
      snapshot.durationNumericCommit = 0;
      snapshot.durationInputFocus = 0;
      snapshot.durationSearchState = 0;
      snapshot.durationFeedbackToast = 0;
      snapshot.durationStateReplace = 0;
      snapshot.durationSelectionToolbar = 0;
      snapshot.durationDropdownPress = 0;
      snapshot.durationDropdownExpand = 0;
      snapshot.durationDropdownCollapse = 0;
      snapshot.durationDropdownSelect = 0;
      snapshot.durationReaderMicro = 0;
      snapshot.durationReaderFast = 0;
      snapshot.durationReaderBase = 0;
      snapshot.durationHandleLongPress = 0;
      snapshot.durationHandleSnap = 0;
      snapshot.durationPanel = 0;
      snapshot.durationPageTurn = 0;
      snapshot.durationReaderEntry = 0;
      snapshot.durationSessionReturn = 0;
      snapshot.durationRunningSpace = 0;
      snapshot.durationCapsuleEnter = 0;
      snapshot.durationCapsuleControl = 0;
      snapshot.durationCapsuleTick = 0;
      snapshot.durationVoicePulse = 0;
      snapshot.durationOverlay = 0;
      snapshot.durationLoadingSpin = 0;
      snapshot.durationViewportReshape = 0;
      snapshot.durationOrientationFreeze = 0;
      snapshot.durationOrientationSettle = 0;
      // 兼容字段
      snapshot.durationRoute = 0;
      snapshot.durationReaderControl = 0;
      snapshot.durationReaderSession = 0;
      // Distance/Scale 置 0/1
      snapshot.readerEntryY = 0;
      snapshot.runningSpaceY = 0;
      snapshot.capsuleY = 0;
      snapshot.runningSpaceDockScale = 1;
      snapshot.capsuleControlPressScale = 1;
      snapshot.coverPressScale = 1;
    }
    return snapshot;
  }

  // ─── 向后兼容方法(Phase 3 删除)───
  static durationTabPress(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationTabPress;
  }
  static durationTabSelect(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationTabSelect;
  }
  static durationTabSwitch(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationTabSwitch;
  }
  static durationReaderEntry(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationReaderEntry;
  }
  static durationReaderControl(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationReaderControl;
  }
  static durationOverlay(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationOverlay;
  }
  static durationReaderSession(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationReaderSession;
  }
  static durationRunningSpace(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationRunningSpace;
  }
  static durationCapsuleControl(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationCapsuleControl;
  }
  static durationPageTurn(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationPageTurn;
  }
  static durationPanel(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationPanel;
  }
  static durationRoute(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationRoute;
  }
  static durationInterruptSettle(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationInterruptSettle;
  }
  static durationLoadingSpin(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationLoadingSpin;
  }
}
