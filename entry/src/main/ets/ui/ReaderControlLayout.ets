import { ReaderAdaptive, ReaderAdaptiveState, ReaderOrientation, ReaderPanelMode } from './ReaderAdaptive';
import { ReaderTypography } from './ReaderTypography';

export class ReaderControlLayout {
  static isBottomSheetMode(adaptive: ReaderAdaptiveState): boolean {
    return adaptive.readerPanelMode === ReaderPanelMode.bottomSheet;
  }

  static isCompactLandscape(adaptive: ReaderAdaptiveState): boolean {
    return adaptive.orientation === ReaderOrientation.landscape && adaptive.heightVp < 520;
  }

  static sheetHeight(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return 330;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 230 : 252;
  }

  static sheetBottom(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return 18;
    }
    return ReaderControlLayout.moduleNavBottom(adaptive) + ReaderControlLayout.moduleNavHeight(adaptive) - 1;
  }

  static sheetBodyTop(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 18 : 28;
  }

  static sheetBodyBottom(
    adaptive: ReaderAdaptiveState,
    isSourceSwitchFlowLayout: boolean,
    isQuickPresentation: boolean
  ): number {
    if (isSourceSwitchFlowLayout) {
      return 48;
    }
    if (!isQuickPresentation) {
      return 110;
    }
    if (ReaderControlLayout.isBottomSheetMode(adaptive) && adaptive.orientation === ReaderOrientation.portrait) {
      return 104;
    }
    return 12;
  }

  static railWidth(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 30 : 38;
  }

  static railGap(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 8 : 14;
  }

  static railReserve(adaptive: ReaderAdaptiveState): number {
    return 12 + ReaderControlLayout.railWidth(adaptive) + ReaderControlLayout.railGap(adaptive);
  }

  static railHeight(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean, isQuickPresentation: boolean): number {
    return Math.max(
      96,
      ReaderControlLayout.sheetHeight(adaptive) -
        ReaderControlLayout.sheetBodyTop(adaptive) -
        ReaderControlLayout.sheetBodyBottom(adaptive, isSourceSwitchFlowLayout, isQuickPresentation)
    );
  }

  static railTrackHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 58 : 92;
  }

  static panelWidthNumber(adaptive: ReaderAdaptiveState): number {
    if (adaptive.readerPanelMode === ReaderPanelMode.splitPane) {
      return 388;
    }
    if (adaptive.readerPanelMode === ReaderPanelMode.sideDock) {
      return 336;
    }
    return Math.max(0, adaptive.widthVp - 24);
  }

  static fullHostTopInset(): number {
    return 88;
  }

  static fullHostBottomInset(): number {
    return 18;
  }

  static fullHostHorizontalInset(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isBottomSheetMode(adaptive) ? 12 : 0;
  }

  static fullPanelPaddingTop(): number {
    return 18;
  }

  static fullPanelPaddingX(): number {
    return 12;
  }

  static fullPanelPaddingBottom(): number {
    return 12;
  }

  static fullPanelRadius(): number {
    return 24;
  }

  static fullPanelHeaderHeight(): number {
    return 30;
  }

  static fullPanelHeaderGap(): number {
    return 10;
  }

  static fullPanelActionHeight(): number {
    return 26;
  }

  static fullPanelContentTopGap(): number {
    return 8;
  }

  static fullPanelContentRadius(): number {
    return 12;
  }

  static fullPanelContentPadding(): number {
    return 10;
  }

  static fullGrabberVisualTop(): number {
    return 9;
  }

  static fullGrabberHitHeight(): number {
    return 24;
  }

  static grabberWidth(): number {
    return 42;
  }

  static grabberHeight(): number {
    return 4;
  }

  static moreLayerZIndex(): number {
    return 30;
  }

  static moreBackdropZIndex(): number {
    return 0;
  }

  static moreMenuZIndex(): number {
    return 1;
  }

  static moreMenuTop(): number {
    return 74;
  }

  static moreMenuRight(): number {
    return 12;
  }

  static moreMenuWidth(): number {
    return 214;
  }

  static moreMenuPadding(): number {
    return 8;
  }

  static moreMenuGap(): number {
    return 4;
  }

  static moreMenuRadius(): number {
    return 14;
  }

  static moreMenuItemHeight(): number {
    return 46;
  }

  static moreMenuItemPaddingX(): number {
    return 10;
  }

  static moreMenuItemTextGap(): number {
    return 2;
  }

  static sessionHostWidth(): number {
    return 110;
  }

  static sessionHostHeight(): number {
    return 26;
  }

  static sessionHostBottom(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.sheetBottom(adaptive) + ReaderControlLayout.sheetHeight(adaptive) + 8;
  }

  static sessionHostRight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isBottomSheetMode(adaptive) ? 24 : ReaderControlLayout.dockRight(adaptive) + 2;
  }

  static sessionHostLeft(adaptive: ReaderAdaptiveState): number {
    return Math.max(0, adaptive.widthVp - ReaderControlLayout.sessionHostRight(adaptive) - ReaderControlLayout.sessionHostWidth());
  }

  static sessionHostTop(adaptive: ReaderAdaptiveState): number {
    return Math.max(0, adaptive.heightVp - ReaderControlLayout.sessionHostBottom(adaptive) - ReaderControlLayout.sessionHostHeight());
  }

  static sessionCapsuleWidth(kind: string): number {
    return kind === 'autoPage' ? 96 : 94;
  }

  static sessionCapsuleHeight(): number {
    return 24;
  }

  static sessionCapsuleGap(): number {
    return 4;
  }

  static sessionCapsulePaddingX(): number {
    return 5;
  }

  static sessionCountdownWidth(): number {
    return 18;
  }

  static sessionCountdownHeight(): number {
    return 16;
  }

  static sessionVoiceSize(): number {
    return 16;
  }

  static sessionControlSize(): number {
    return 16;
  }

  static sessionControlIconSize(): number {
    return 8;
  }

  static sessionVoiceIconSize(): number {
    return 11;
  }

  static utilitySummaryHeight(): number {
    return 58;
  }

  static utilityActionRowHeight(): number {
    return 58;
  }

  static utilityBlockGap(): number {
    return 8;
  }

  static utilitySectionGap(): number {
    return 10;
  }

  static utilityHeaderBlankHeight(): number {
    return 10;
  }

  static utilityHeaderBlankGap(): number {
    return 8;
  }

  static fullChoiceRowHeight(): number {
    return 30;
  }

  static fullChoiceRowGap(): number {
    return 10;
  }

  static fullChoiceRowTopGap(): number {
    return 8;
  }

  static fullThemeSwatchRowHeight(): number {
    return 34;
  }

  static fullTtsPlaybackRowHeight(): number {
    return 62;
  }

  static fullTtsPlaybackRowGap(): number {
    return 8;
  }

  static fullDirectorySegmentRowHeight(): number {
    return 30;
  }

  static fullDirectorySegmentRowGap(): number {
    return 8;
  }

  static readerDropdownOverlayPaddingRight(): number {
    return 7;
  }

  static sourceSwitchHeaderPaddingY(): number {
    return 7;
  }

  static sourceSwitchHeaderPaddingX(): number {
    return 9;
  }

  static sourceSwitchRowPaddingX(): number {
    return 9;
  }

  static sourceSwitchRowPaddingY(): number {
    return 7;
  }

  static sourceSwitchRowTrailingGap(): number {
    return 6;
  }

  static sourceSwitchRowLeadingGap(): number {
    return 9;
  }

  static sourceSwitchRowCloseIconSize(): number {
    return 20;
  }

  static sourceSwitchRowSortIconSize(): number {
    return 20;
  }

  static sourceSwitchRowSourceTextFontSize(): number {
    return 11;
  }

  static sourceSwitchRowSpeedTextFontSize(): number {
    return 11;
  }

  static sourceSwitchRowChapterTextFontSize(): number {
    return 11;
  }

  static chapterListRowHeight(): number {
    return 34;
  }

  static chapterListRowGap(): number {
    return 8;
  }

  static fullTocRowHeight(): number {
    return 34;
  }

  static fullStepRowHeight(): number {
    return 34;
  }

  static fullToggleRowHeight(): number {
    return 34;
  }

  static utilitySummaryRowHeight(): number {
    return 34;
  }

  static fullSettingBlockHeaderHeight(): number {
    return 24;
  }

  static fullSettingBlockHeaderGap(): number {
    return 8;
  }

  static compactTocSegmentRowHeight(): number {
    return 30;
  }

  static compactTocSegmentRowPadding(): number {
    return 3;
  }

  static moduleRowHeight(): number {
    return 28;
  }

  static moduleRowGap(): number {
    return 8;
  }

  static fullStepButtonHeight(): number {
    return 28;
  }

  static fullStepButtonWidth(): number {
    return 30;
  }

  static fullStepValueWidth(): number {
    return 42;
  }

  static moreMenuNonRouteIconSize(): number {
    return 24;
  }

  static moreMenuNonRouteIconRadius(): number {
    return 8;
  }

  static moreMenuNonRouteTextSize(): number {
    return 11;
  }

  static fullPanelCloseButtonWidth(): number {
    return 64;
  }

  static fullPanelCloseButtonHeight(): number {
    return 24;
  }

  static fullPanelCloseIconSize(): number {
    return 24;
  }

  static fullPanelHeaderFontSize(): number {
    return 14;
  }

  static fullPanelActionFontSize(): number {
    return 10;
  }

  static fullPanelActionRadius(): number {
    return 8;
  }

  static fullPanelActionPaddingX(): number {
    return 10;
  }

  static chapterStepSize(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 28;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 30 : 34;
  }

  static chapterControlMinHeight(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 30;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 34 : 52;
  }

  static controlMainGap(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 4;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 4 : 6;
  }

  static controlMainLeftInset(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 10 : 12;
  }

  static controlMainRightInset(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.controlMainLeftInset(adaptive) +
      ReaderControlLayout.railWidth(adaptive) +
      ReaderControlLayout.railGap(adaptive);
  }

  static controlMainAvailableHeight(
    adaptive: ReaderAdaptiveState,
    isSourceSwitchFlowLayout: boolean,
    isQuickPresentation: boolean
  ): number {
    return Math.max(
      0,
      ReaderControlLayout.sheetHeight(adaptive) -
        ReaderControlLayout.sheetBodyTop(adaptive) -
        ReaderControlLayout.sheetBodyBottom(adaptive, isSourceSwitchFlowLayout, isQuickPresentation)
    );
  }

  static actionPanelMinHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 58 : 70;
  }

  static chapterPanelMinHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 86 : 96;
  }

  static actionPanelHeight(
    adaptive: ReaderAdaptiveState,
    isSourceSwitchFlowLayout: boolean,
    isQuickPresentation: boolean
  ): number {
    const rowSpace = Math.max(
      0,
      ReaderControlLayout.controlMainAvailableHeight(adaptive, isSourceSwitchFlowLayout, isQuickPresentation) -
        ReaderControlLayout.controlMainGap(adaptive, isSourceSwitchFlowLayout)
    );
    const minSpace = ReaderControlLayout.actionPanelMinHeight(adaptive) + ReaderControlLayout.chapterPanelMinHeight(adaptive);
    if (rowSpace <= minSpace) {
      return ReaderControlLayout.actionPanelMinHeight(adaptive);
    }
    return Math.round((ReaderControlLayout.actionPanelMinHeight(adaptive) + (rowSpace - minSpace) * 0.41) * 10) / 10;
  }

  static chapterPanelHeight(
    adaptive: ReaderAdaptiveState,
    isSourceSwitchFlowLayout: boolean,
    isQuickPresentation: boolean
  ): number {
    const rowSpace = Math.max(
      0,
      ReaderControlLayout.controlMainAvailableHeight(adaptive, isSourceSwitchFlowLayout, isQuickPresentation) -
        ReaderControlLayout.controlMainGap(adaptive, isSourceSwitchFlowLayout)
    );
    return Math.max(
      ReaderControlLayout.chapterPanelMinHeight(adaptive),
      Math.round((rowSpace - ReaderControlLayout.actionPanelHeight(adaptive, isSourceSwitchFlowLayout, isQuickPresentation)) * 10) / 10
    );
  }

  static actionPanelGap(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 4;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 5 : 8;
  }

  static actionPanelPaddingX(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 4;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 5 : 8;
  }

  static actionPanelPaddingY(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 4;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 5 : 9;
  }

  static actionButtonFontSize(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 9;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 10 : ReaderTypography.actionLabelFontSize;
  }

  static actionButtonIconSize(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 18 : 24;
  }

  static actionButtonGap(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 2 : 6;
  }

  static chapterPanelGap(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 3 : 6;
  }

  static chapterPanelPaddingX(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 6 : 10;
  }

  static chapterPanelPaddingY(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 5 : 9;
  }

  static chapterTitleFontSize(isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 11;
    }
    return ReaderTypography.chapterTitleFontSize;
  }

  static modulePanelInnerHeight(
    adaptive: ReaderAdaptiveState,
    isSourceSwitchFlowLayout: boolean,
    isQuickPresentation: boolean
  ): number {
    return Math.max(40, ReaderControlLayout.railHeight(adaptive, isSourceSwitchFlowLayout, isQuickPresentation) - 24);
  }

  static readerDropdownCount(owner: string, key: string): number {
    if (owner === 'tts' && key === 'speed') {
      return 4;
    }
    if (owner === 'tts' && (key === 'voice' || key === 'scope' || key === 'timer')) {
      return 3;
    }
    if (owner === 'settings' && (key === 'tapMode' || key === 'pageAnimation')) {
      return 3;
    }
    return 0;
  }

  static readerDropdownFullHeight(owner: string, key: string): number {
    const count = ReaderControlLayout.readerDropdownCount(owner, key);
    if (count <= 0) {
      return 0;
    }
    return 10 + count * 27 + Math.max(0, count - 1) * 2;
  }

  static normalizedReaderDropdownHeight(owner: string, key: string, availableSpace: number): number {
    const count = ReaderControlLayout.readerDropdownCount(owner, key);
    if (count <= 0) {
      return 0;
    }
    const fullHeight = ReaderControlLayout.readerDropdownFullHeight(owner, key);
    const available = Math.max(40, Math.floor(availableSpace));
    const availableForRows = Math.max(27, available - 10);
    const visibleRows = Math.max(1, Math.min(count, Math.floor((availableForRows + 2) / 29)));
    const height = 10 + visibleRows * 27 + Math.max(0, visibleRows - 1) * 2;
    return Math.floor(Math.min(fullHeight, height, available));
  }

  static readerDropdownRowTop(owner: string, key: string): number {
    if (owner === 'tts') {
      if (key === 'speed') {
        return 56;
      }
      if (key === 'voice') {
        return 88;
      }
      if (key === 'scope') {
        return 120;
      }
      if (key === 'timer') {
        return 152;
      }
    }
    if (owner === 'settings') {
      if (key === 'tapMode') {
        return 34;
      }
      if (key === 'pageAnimation') {
        return 102;
      }
    }
    return 0;
  }

  static readerDropdownRowHeight(owner: string): number {
    return owner === 'settings' ? 34 : 32;
  }

  static readerDropdownDownOffset(owner: string): number {
    return owner === 'settings' ? 31 : 29;
  }

  static readerDropdownDropUp(owner: string, key: string, panelHeight: number): boolean {
    const fullHeight = ReaderControlLayout.readerDropdownFullHeight(owner, key);
    if (fullHeight <= 0) {
      return false;
    }
    const rowTop = ReaderControlLayout.readerDropdownRowTop(owner, key);
    const rowBottom = rowTop + ReaderControlLayout.readerDropdownRowHeight(owner);
    const dropdownBottom = rowTop + ReaderControlLayout.readerDropdownDownOffset(owner) + fullHeight;
    const isBottomOverflow = dropdownBottom > panelHeight - 6;
    if (!isBottomOverflow) {
      return false;
    }
    const spaceBelow = panelHeight - rowBottom;
    const spaceAbove = rowTop;
    return spaceAbove > spaceBelow;
  }

  static readerDropdownVisibleHeight(owner: string, key: string, panelHeight: number): number {
    const fullHeight = ReaderControlLayout.readerDropdownFullHeight(owner, key);
    if (fullHeight <= 0) {
      return 0;
    }
    const rowTop = ReaderControlLayout.readerDropdownRowTop(owner, key);
    const rowBottom = rowTop + ReaderControlLayout.readerDropdownRowHeight(owner);
    const dropdownBottom = rowTop + ReaderControlLayout.readerDropdownDownOffset(owner) + fullHeight;
    const isBottomOverflow = dropdownBottom > panelHeight - 6;
    if (!isBottomOverflow) {
      return fullHeight;
    }
    if (ReaderControlLayout.readerDropdownDropUp(owner, key, panelHeight)) {
      return ReaderControlLayout.normalizedReaderDropdownHeight(owner, key, rowTop - 6);
    }
    return ReaderControlLayout.normalizedReaderDropdownHeight(owner, key, panelHeight - rowBottom - 6);
  }

  static readerDropdownY(owner: string, key: string, panelHeight: number): number {
    const visibleHeight = ReaderControlLayout.readerDropdownVisibleHeight(owner, key, panelHeight);
    if (visibleHeight <= 0) {
      return 0;
    }
    const rowTop = ReaderControlLayout.readerDropdownRowTop(owner, key);
    if (ReaderControlLayout.readerDropdownDropUp(owner, key, panelHeight)) {
      return Math.max(0, rowTop + 3 - visibleHeight);
    }
    return rowTop + ReaderControlLayout.readerDropdownDownOffset(owner);
  }

  static moduleNavHeight(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return 78;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 54 : 79;
  }

  static moduleNavGap(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 3 : 4;
  }

  static moduleNavPadding(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 5 : 8;
  }

  static moduleNavIconShellSize(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 28 : 42;
  }

  static moduleNavIconSize(): number {
    return 24;
  }

  static moduleNavLabelFontSize(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 9 : ReaderTypography.moduleNavLabelFontSize;
  }

  static moduleNavLabelGap(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 2 : 4;
  }

  static moduleNavBottom(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return 32;
    }
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 16 : 32;
  }

  static dockRight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 16 : 24;
  }

  static topBarTop(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 12 : 18;
  }

  static topBarHorizontalInset(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isCompactLandscape(adaptive)) {
      return 14;
    }
    return ReaderControlLayout.isBottomSheetMode(adaptive) ? 14 : 28;
  }

  static topBarMinHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 48 : 54;
  }

  static topBarBackWidth(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 40 : 44;
  }

  static topBarSourceWidth(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 58 : 62;
  }

  static topBarMoreWidth(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 32 : 34;
  }

  static topBarGap(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 6 : 8;
  }

  static topBarPaddingX(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 10 : 12;
  }

  static topBarButtonHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 36 : 42;
  }

  static topBarTitleFontSize(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isCompactLandscape(adaptive)) {
      return 13;
    }
    // demo large-font 变体：18px（01-shell-layout.css 969）
    if (adaptive.fontScale >= 1.3) {
      return 18;
    }
    return ReaderTypography.topBarTitleFontSize;
  }

  static topBarSubtitleFontSize(adaptive: ReaderAdaptiveState): number {
    if (ReaderControlLayout.isCompactLandscape(adaptive)) {
      return 10;
    }
    // demo large-font 变体：14px（01-shell-layout.css 973）
    if (adaptive.fontScale >= 1.3) {
      return 14;
    }
    return ReaderTypography.topBarSubtitleFontSize;
  }

  static topBarButtonFontSize(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 11 : ReaderTypography.topBarButtonFontSize;
  }

  static sourceSwitchUsesFlowLayout(adaptive: ReaderAdaptiveState, isSourceSwitchOpen: boolean): boolean {
    return isSourceSwitchOpen && ReaderAdaptive.sourceSwitchUsesFlowLayout(adaptive);
  }

  static sourceSwitchFlowPadding(): number {
    return 12;
  }

  static sourceSwitchFlowGap(): number {
    return 12;
  }

  static sourceSwitchFlowAvailableWidth(adaptive: ReaderAdaptiveState): number {
    return Math.max(0, adaptive.widthVp - ReaderControlLayout.sourceSwitchFlowPadding() * 2);
  }

  static sourceSwitchFlowAvailableHeight(adaptive: ReaderAdaptiveState): number {
    // demo 06-responsive.css: min(960px, 100vh - 68px) — 顶部 68px 为状态栏 + topbar 预留。
    // ArkUI 在 FlowShell 内 ControlTopBar 已独立绝对定位，reader slot 不需要再让出 topbar 高度，
    // 但需对齐 demo 几何，故减去 68px 顶部 inset（含状态栏 18 + topbar 54 - 余量 4 = 68）。
    return Math.min(960, Math.max(0, adaptive.heightVp - 68));
  }

  static sourceSwitchResultWidth(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (!isSourceSwitchFlowLayout) {
      return 0;
    }
    const available = ReaderControlLayout.sourceSwitchFlowAvailableWidth(adaptive);
    return Math.min(200, Math.max(160, available - ReaderControlLayout.sourceSwitchFlowGap() * 2 - 300 - 300));
  }

  static sourceSwitchWindowTop(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? 12 : 92;
  }

  static sourceSwitchWindowBottom(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return 12;
    }
    return ReaderControlLayout.isBottomSheetMode(adaptive) ? 360 : 18;
  }

  static sourceSwitchWindowWidth(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      const available = ReaderControlLayout.sourceSwitchFlowAvailableWidth(adaptive);
      return Math.min(
        300,
        Math.max(
          260,
          available -
            ReaderControlLayout.sourceSwitchFlowGap() * 2 -
            300 -
            ReaderControlLayout.sourceSwitchResultWidth(adaptive, isSourceSwitchFlowLayout)
        )
      );
    }
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return Math.max(0, adaptive.widthVp - 24);
    }
    return Math.min(320, Math.max(0, adaptive.widthVp - 48));
  }

  static sourceSwitchReaderWidth(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (!isSourceSwitchFlowLayout) {
      return adaptive.widthVp;
    }
    return Math.max(
      300,
      ReaderControlLayout.sourceSwitchFlowAvailableWidth(adaptive) -
        ReaderControlLayout.sourceSwitchFlowGap() * 2 -
        ReaderControlLayout.sourceSwitchWindowWidth(adaptive, isSourceSwitchFlowLayout) -
        ReaderControlLayout.sourceSwitchResultWidth(adaptive, isSourceSwitchFlowLayout)
    );
  }

  static sourceSwitchWindowX(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return ReaderControlLayout.sourceSwitchFlowPadding() +
        ReaderControlLayout.sourceSwitchReaderWidth(adaptive, isSourceSwitchFlowLayout) +
        ReaderControlLayout.sourceSwitchFlowGap();
    }
    if (ReaderControlLayout.isBottomSheetMode(adaptive)) {
      return 12;
    }
    return Math.max(24, adaptive.widthVp - 24 - ReaderControlLayout.sourceSwitchWindowWidth(adaptive, isSourceSwitchFlowLayout));
  }

  static sourceSwitchWindowHeight(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    if (isSourceSwitchFlowLayout) {
      return ReaderControlLayout.sourceSwitchFlowAvailableHeight(adaptive);
    }
    return Math.max(
      180,
      adaptive.heightVp -
        ReaderControlLayout.sourceSwitchWindowTop(isSourceSwitchFlowLayout) -
        ReaderControlLayout.sourceSwitchWindowBottom(adaptive, isSourceSwitchFlowLayout)
    );
  }

  static sourceSwitchResultX(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return ReaderControlLayout.sourceSwitchWindowX(adaptive, isSourceSwitchFlowLayout) +
      ReaderControlLayout.sourceSwitchWindowWidth(adaptive, isSourceSwitchFlowLayout) +
      ReaderControlLayout.sourceSwitchFlowGap();
  }

  static sourceSwitchReaderX(): number {
    return ReaderControlLayout.sourceSwitchFlowPadding();
  }

  static sourceSwitchReaderY(isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? ReaderControlLayout.sourceSwitchFlowPadding() : 0;
  }

  static sourceSwitchReaderHeight(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return isSourceSwitchFlowLayout ? ReaderControlLayout.sourceSwitchFlowAvailableHeight(adaptive) : adaptive.heightVp;
  }

  static sourceSwitchReaderSheetWidth(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return Math.min(340, Math.max(0, ReaderControlLayout.sourceSwitchReaderWidth(adaptive, isSourceSwitchFlowLayout) - 24));
  }

  static sourceSwitchReaderSheetHeight(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 196 : 230;
  }

  static sourceSwitchReaderSheetX(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return Math.max(
      0,
      ReaderControlLayout.sourceSwitchReaderWidth(adaptive, isSourceSwitchFlowLayout) -
        12 -
        ReaderControlLayout.sourceSwitchReaderSheetWidth(adaptive, isSourceSwitchFlowLayout)
    );
  }

  static sourceSwitchReaderSheetY(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return Math.max(
      0,
      ReaderControlLayout.sourceSwitchReaderHeight(adaptive, isSourceSwitchFlowLayout) -
        18 -
        ReaderControlLayout.sourceSwitchReaderSheetHeight(adaptive)
    );
  }

  static sourceSwitchReaderNavWidth(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return Math.min(320, Math.max(0, ReaderControlLayout.sourceSwitchReaderWidth(adaptive, isSourceSwitchFlowLayout) - 48));
  }

  static sourceSwitchReaderNavX(adaptive: ReaderAdaptiveState, isSourceSwitchFlowLayout: boolean): number {
    return Math.max(
      0,
      ReaderControlLayout.sourceSwitchReaderWidth(adaptive, isSourceSwitchFlowLayout) -
        24 -
        ReaderControlLayout.sourceSwitchReaderNavWidth(adaptive, isSourceSwitchFlowLayout)
    );
  }

  static sourceSwitchReaderNavY(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 74 : 112;
  }

  static sourceSwitchReaderTextTop(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 136 : 206;
  }

  static sourceSwitchReaderTextBottom(adaptive: ReaderAdaptiveState): number {
    return ReaderControlLayout.isCompactLandscape(adaptive) ? 48 : 260;
  }
}
