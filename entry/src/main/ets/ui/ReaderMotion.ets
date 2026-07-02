export class ReaderMotionId {
  static readonly tabItemPress: string = 'tab.item.press';
  static readonly tabItemSelect: string = 'tab.item.select';
  static readonly tabItemSwitch: string = 'tab.item.switch';
  static readonly appTabSwitch: string = 'app.tab.switch';
  static readonly appRoutePush: string = 'app.route.push';
  static readonly appRoutePop: string = 'app.route.pop';
  static readonly appRouteReplace: string = 'app.route.replace';
  static readonly bookshelfViewSwitch: string = 'bookshelf.view.switch';
  static readonly readerEntryCoverToImmersive: string = 'reader.entry.coverToImmersive';
  static readonly readerEntryActionToImmersive: string = 'reader.entry.actionToImmersive';
  static readonly readerControlShow: string = 'reader.control.show';
  static readonly readerControlHide: string = 'reader.control.hide';
  static readonly readerControlHandlePress: string = 'reader.control.handle.press';
  static readonly readerModuleSwitch: string = 'reader.module.switch';
  static readonly readerQuickPromote: string = 'reader.quick.promote';
  static readonly readerPanelExpand: string = 'reader.panel.expand';
  static readonly readerPageTurnNext: string = 'reader.page.turn.next';
  static readonly readerPageTurnPrev: string = 'reader.page.turn.prev';
  static readonly readerChapterJump: string = 'reader.chapter.jump';
  static readonly readerBrightnessUpdate: string = 'reader.brightness.update';
  static readonly readerBrightnessAutoToggle: string = 'reader.brightness.auto.toggle';
  static readonly readerSessionAutoPageStart: string = 'reader.session.autoPage.start';
  static readonly readerSessionTtsStart: string = 'reader.session.tts.start';
  static readonly readerSessionCapsuleEnter: string = 'reader.session.capsule.enter';
  static readonly readerSessionCapsuleUpdate: string = 'reader.session.capsule.update';
  static readonly readerSessionCapsuleSwitch: string = 'reader.session.capsule.switch';
  static readonly readerSessionCapsuleExit: string = 'reader.session.capsule.exit';
  static readonly readerSessionControlSpaceEnter: string = 'reader.session.controlSpace.enter';
  static readonly readerSessionControlSpaceUpdate: string = 'reader.session.controlSpace.update';
  static readonly readerSessionControlSpaceExit: string = 'reader.session.controlSpace.exit';
  static readonly motionInterruptCancel: string = 'motion.interrupt.cancel';
  static readonly motionInterruptRedirect: string = 'motion.interrupt.redirect';
  static readonly motionInterruptCompleteThenReplace: string = 'motion.interrupt.completeThenReplace';
  static readonly dropdownMenuExpand: string = 'dropdown.menu.expand';
  static readonly dropdownMenuCollapse: string = 'dropdown.menu.collapse';
  static readonly dropdownOptionPress: string = 'dropdown.option.press';
  static readonly dropdownOptionSelect: string = 'dropdown.option.select';
}

export class ReaderMotionSnapshot {
  reducedMotion: boolean = false;
  durationInstant: number = 0;
  durationTabPress: number = 80;
  durationTabSelect: number = 120;
  durationTabSwitch: number = 160;
  durationRoute: number = 160;
  durationReaderEntry: number = 240;
  durationReaderControl: number = 160;
  durationReaderSession: number = 160;
  durationRunningSpace: number = 160;
  durationCapsuleEnter: number = 180;
  durationCapsuleControl: number = 90;
  durationCapsuleTick: number = 120;
  durationPageTurn: number = 220;
  durationPanel: number = 220;
  durationOverlay: number = 200;
  durationInterruptSettle: number = 80;
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
      snapshot.durationTabPress = 0;
      snapshot.durationTabSelect = 0;
      snapshot.durationTabSwitch = 0;
      snapshot.durationRoute = 0;
      snapshot.durationReaderEntry = 0;
      snapshot.durationReaderControl = 0;
      snapshot.durationReaderSession = 0;
      snapshot.durationRunningSpace = 0;
      snapshot.durationCapsuleEnter = 0;
      snapshot.durationCapsuleControl = 0;
      snapshot.durationCapsuleTick = 0;
      snapshot.durationPageTurn = 0;
      snapshot.durationPanel = 0;
      snapshot.durationOverlay = 0;
      snapshot.durationInterruptSettle = 0;
      snapshot.readerEntryY = 0;
      snapshot.runningSpaceY = 0;
      snapshot.capsuleY = 0;
      snapshot.runningSpaceDockScale = 1;
      snapshot.capsuleControlPressScale = 1;
      snapshot.coverPressScale = 1;
    }
    return snapshot;
  }

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
}
