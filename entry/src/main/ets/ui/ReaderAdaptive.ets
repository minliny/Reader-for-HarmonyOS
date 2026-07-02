export class ReaderWidthClass {
  static readonly compact: string = 'compact';
  static readonly medium: string = 'medium';
  static readonly expanded: string = 'expanded';
  static readonly large: string = 'large';
}

export class ReaderHeightClass {
  static readonly compact: string = 'compactHeight';
  static readonly regular: string = 'regularHeight';
}

export class ReaderOrientation {
  static readonly portrait: string = 'portrait';
  static readonly landscape: string = 'landscape';
}

export class ReaderFoldPosture {
  static readonly none: string = 'none';
  static readonly folded: string = 'folded';
  static readonly expanded: string = 'expanded';
  static readonly unknown: string = 'unknown';
}

export class ReaderWindowMode {
  static readonly fullscreen: string = 'fullscreen';
  static readonly split: string = 'split';
  static readonly freeform: string = 'freeform';
  static readonly floating: string = 'floating';
  static readonly unknown: string = 'unknown';
}

export class ReaderMainTabMode {
  static readonly bottomTabs: string = 'bottomTabs';
  static readonly navRail: string = 'navRail';
}

export class ReaderPanelMode {
  static readonly bottomSheet: string = 'bottomSheet';
  static readonly sideDock: string = 'sideDock';
  static readonly splitPane: string = 'splitPane';
}

export class ReaderContentMode {
  static readonly single: string = 'single';
  static readonly wideSingle: string = 'wideSingle';
  static readonly dualCandidate: string = 'dualCandidate';
}

export class ReaderSafeAreaInsets {
  top: number = 0;
  right: number = 0;
  bottom: number = 0;
  left: number = 0;
}

export class ReaderAdaptiveState {
  widthVp: number = 390;
  heightVp: number = 844;
  widthClass: string = ReaderWidthClass.compact;
  heightClass: string = ReaderHeightClass.regular;
  orientation: string = ReaderOrientation.portrait;
  foldPosture: string = ReaderFoldPosture.unknown;
  windowMode: string = ReaderWindowMode.unknown;
  safeArea: ReaderSafeAreaInsets = new ReaderSafeAreaInsets();
  keyboardInsetBottom: number = 0;
  mainTabMode: string = ReaderMainTabMode.bottomTabs;
  readerPanelMode: string = ReaderPanelMode.bottomSheet;
  readerContentMode: string = ReaderContentMode.single;
  bookshelfColumns: number = 3;
}

export class ReaderAdaptive {
  static readonly compactMaxVp: number = 599;
  static readonly mediumMaxVp: number = 839;
  static readonly largeMinVp: number = 1440;
  static readonly compactHeightMaxVp: number = 499;

  static initialState(): ReaderAdaptiveState {
    return ReaderAdaptive.fromMetrics(390, 844);
  }

  static fromArea(area: Area, fallback: ReaderAdaptiveState): ReaderAdaptiveState {
    const widthVp = ReaderAdaptive.lengthToNumber(area.width, fallback.widthVp);
    const heightVp = ReaderAdaptive.lengthToNumber(area.height, fallback.heightVp);
    return ReaderAdaptive.fromMetrics(widthVp, heightVp, fallback);
  }

  static fromMetrics(
    widthVp: number,
    heightVp: number,
    previous: ReaderAdaptiveState | null = null
  ): ReaderAdaptiveState {
    const next = new ReaderAdaptiveState();
    next.widthVp = ReaderAdaptive.positive(widthVp, previous === null ? 390 : previous.widthVp);
    next.heightVp = ReaderAdaptive.positive(heightVp, previous === null ? 844 : previous.heightVp);
    next.widthClass = ReaderAdaptive.deriveWidthClass(next.widthVp);
    next.heightClass = next.heightVp <= ReaderAdaptive.compactHeightMaxVp ?
      ReaderHeightClass.compact :
      ReaderHeightClass.regular;
    next.orientation = next.widthVp >= next.heightVp ? ReaderOrientation.landscape : ReaderOrientation.portrait;
    next.foldPosture = previous === null ? ReaderFoldPosture.unknown : previous.foldPosture;
    next.windowMode = previous === null ? ReaderWindowMode.unknown : previous.windowMode;
    next.safeArea = previous === null ? new ReaderSafeAreaInsets() : previous.safeArea;
    next.keyboardInsetBottom = previous === null ? 0 : previous.keyboardInsetBottom;
    next.mainTabMode = ReaderAdaptive.deriveMainTabMode(next);
    next.readerPanelMode = ReaderAdaptive.deriveReaderPanelMode(next);
    next.readerContentMode = ReaderAdaptive.deriveReaderContentMode(next);
    next.bookshelfColumns = ReaderAdaptive.deriveBookshelfColumns(next);
    return next;
  }

  static equals(a: ReaderAdaptiveState, b: ReaderAdaptiveState): boolean {
    return a.widthVp === b.widthVp &&
      a.heightVp === b.heightVp &&
      a.widthClass === b.widthClass &&
      a.heightClass === b.heightClass &&
      a.orientation === b.orientation &&
      a.foldPosture === b.foldPosture &&
      a.windowMode === b.windowMode &&
      a.keyboardInsetBottom === b.keyboardInsetBottom &&
      a.mainTabMode === b.mainTabMode &&
      a.readerPanelMode === b.readerPanelMode &&
      a.readerContentMode === b.readerContentMode &&
      a.bookshelfColumns === b.bookshelfColumns;
  }

  static isNavRail(state: ReaderAdaptiveState): boolean {
    return state.mainTabMode === ReaderMainTabMode.navRail;
  }

  static readerBodyWidth(state: ReaderAdaptiveState): Length {
    if (state.readerContentMode === ReaderContentMode.dualCandidate) {
      return 760;
    }
    if (state.readerContentMode === ReaderContentMode.wideSingle) {
      return 640;
    }
    return '100%';
  }

  static readerPanelWidth(state: ReaderAdaptiveState): Length {
    if (state.readerPanelMode === ReaderPanelMode.splitPane) {
      return 388;
    }
    if (state.readerPanelMode === ReaderPanelMode.sideDock) {
      return 336;
    }
    return '100%';
  }

  static bookshelfGridTemplate(state: ReaderAdaptiveState): string {
    if (state.bookshelfColumns <= 2) {
      return '1fr 1fr';
    }
    if (state.bookshelfColumns === 3) {
      return '1fr 1fr 1fr';
    }
    if (state.bookshelfColumns === 4) {
      return '1fr 1fr 1fr 1fr';
    }
    return '1fr 1fr 1fr 1fr 1fr';
  }

  private static deriveWidthClass(widthVp: number): string {
    if (widthVp < 600) {
      return ReaderWidthClass.compact;
    }
    if (widthVp < 840) {
      return ReaderWidthClass.medium;
    }
    if (widthVp < ReaderAdaptive.largeMinVp) {
      return ReaderWidthClass.expanded;
    }
    return ReaderWidthClass.large;
  }

  private static deriveMainTabMode(state: ReaderAdaptiveState): string {
    if (state.widthClass === ReaderWidthClass.large) {
      return ReaderMainTabMode.navRail;
    }
    if (state.widthClass === ReaderWidthClass.expanded && state.orientation === ReaderOrientation.landscape) {
      return ReaderMainTabMode.navRail;
    }
    return ReaderMainTabMode.bottomTabs;
  }

  private static deriveReaderPanelMode(state: ReaderAdaptiveState): string {
    if (state.widthClass === ReaderWidthClass.large) {
      return ReaderPanelMode.splitPane;
    }
    if (state.widthClass === ReaderWidthClass.expanded) {
      return ReaderPanelMode.sideDock;
    }
    if (state.widthClass === ReaderWidthClass.medium && state.orientation === ReaderOrientation.landscape) {
      return ReaderPanelMode.sideDock;
    }
    return ReaderPanelMode.bottomSheet;
  }

  private static deriveReaderContentMode(state: ReaderAdaptiveState): string {
    if (state.widthClass === ReaderWidthClass.compact) {
      return ReaderContentMode.single;
    }
    if (state.widthClass === ReaderWidthClass.large && state.orientation === ReaderOrientation.landscape) {
      return ReaderContentMode.dualCandidate;
    }
    return ReaderContentMode.wideSingle;
  }

  private static deriveBookshelfColumns(state: ReaderAdaptiveState): number {
    if (state.widthVp < 360) {
      return 2;
    }
    if (state.widthClass === ReaderWidthClass.compact) {
      return 3;
    }
    if (state.widthClass === ReaderWidthClass.medium) {
      return 4;
    }
    return 5;
  }

  private static lengthToNumber(value: Length, fallback: number): number {
    if (typeof value === 'number') {
      return ReaderAdaptive.positive(value, fallback);
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return ReaderAdaptive.positive(parsed, fallback);
    }
    return fallback;
  }

  private static positive(value: number, fallback: number): number {
    if (value > 0) {
      return Math.round(value);
    }
    return fallback;
  }
}
