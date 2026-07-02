export class ReaderMotionId {
  static readonly tabItemPress: string = 'tab.item.press';
  static readonly tabItemSelect: string = 'tab.item.select';
  static readonly tabItemSwitch: string = 'tab.item.switch';
  static readonly appTabSwitch: string = 'app.tab.switch';
  static readonly appRoutePush: string = 'app.route.push';
  static readonly appRoutePop: string = 'app.route.pop';
  static readonly appRouteReplace: string = 'app.route.replace';
  static readonly readerEntryCoverToImmersive: string = 'reader.entry.coverToImmersive';
  static readonly readerEntryActionToImmersive: string = 'reader.entry.actionToImmersive';
  static readonly readerControlShow: string = 'reader.control.show';
  static readonly readerControlHide: string = 'reader.control.hide';
  static readonly readerControlHandlePress: string = 'reader.control.handle.press';
  static readonly readerModuleSwitch: string = 'reader.module.switch';
  static readonly readerQuickPromote: string = 'reader.quick.promote';
  static readonly readerPanelExpand: string = 'reader.panel.expand';
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
  durationOverlay: number = 200;
  durationInterruptSettle: number = 80;
  readerEntryY: number = 12;
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
      snapshot.durationOverlay = 0;
      snapshot.durationInterruptSettle = 0;
      snapshot.readerEntryY = 0;
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

  static durationRoute(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationRoute;
  }

  static durationInterruptSettle(reducedMotion: boolean): number {
    return ReaderMotion.snapshot(reducedMotion).durationInterruptSettle;
  }
}
