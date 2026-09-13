import {
  ReaderWindowMetricsSnapshot,
  createDefaultReaderWindowMetrics,
  readerContentSafeHorizontal,
  readerContentSafeTop,
  readerInteractiveSafeBottom,
  readerInteractiveSafeRight,
  readerVisualSafeBottom,
  readerVisualSafeLeft,
  readerVisualSafeRight,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics.ts';

export type ReaderWidthClass = 'compact' | 'expanded';

export const READER_PHONE_REFERENCE_WIDTH = 390;
export const READER_PHONE_REFERENCE_HEIGHT = 844;
export const READER_TABLET_REFERENCE_WIDTH = 760;
export const READER_TABLET_REFERENCE_HEIGHT = 960;
export const READER_EXPANDED_MIN_WIDTH = 600;

export const READER_TITLE_LINE_HEIGHT_FP = 28.75;
export const READER_TITLE_TO_BODY_SPACE_VP = 18;

export const READER_FULL_PANEL_MAX_WIDTH_PHONE = 364;
export const READER_FULL_PANEL_MAX_WIDTH_TABLET = 720;
export const READER_FULL_PANEL_HEIGHT_PHONE = 736;
export const READER_FULL_PANEL_HEIGHT_TABLET = 852;
export const READER_FULL_PANEL_TOP = 88;
export const READER_FULL_PANEL_BOTTOM_GAP = 20;
export const READER_FULL_PANEL_INNER_INSET_X = 13;
export type ReaderContentInsetProfile = {
  compact: number;
  expanded: number;
};
export const DEFAULT_READER_CONTENT_INSET_PROFILE: ReaderContentInsetProfile = {
  compact: 24,
  expanded: 44.44,
};
/** Optical clearance below a live status/cutout edge for the 54vp control top bar. */
export const READER_CONTROL_SAFE_TOP_GAP = 10;

class ReaderDesignProfile {
  referenceWidth: number;
  referenceHeight: number;
  contentTop: number;
  contentBottom: number;
  contentHorizontal: number;
  topBarTop: number;
  topBarSideGap: number;
  topBarMaxWidth: number;
  dockBottomGap: number;
  dockLeftGap: number;
  dockRightGap: number;
  dockMaxWidth: number;
  fullPanelLeftGap: number;
  fullPanelRightGap: number;
  fullPanelMaxWidth: number;

  constructor(expanded: boolean) {
    if (expanded) {
      this.referenceWidth = READER_TABLET_REFERENCE_WIDTH;
      this.referenceHeight = READER_TABLET_REFERENCE_HEIGHT;
      this.contentTop = 92.44;
      this.contentBottom = 56.44;
      this.contentHorizontal = 44.44;
      this.topBarTop = 19;
      this.topBarSideGap = 29;
      this.topBarMaxWidth = 702;
      this.dockBottomGap = 33;
      this.dockLeftGap = 0;
      this.dockRightGap = 25;
      this.dockMaxWidth = 340;
      this.fullPanelLeftGap = 26;
      this.fullPanelRightGap = 14;
      this.fullPanelMaxWidth = READER_FULL_PANEL_MAX_WIDTH_TABLET;
      return;
    }
    this.referenceWidth = READER_PHONE_REFERENCE_WIDTH;
    this.referenceHeight = READER_PHONE_REFERENCE_HEIGHT;
    this.contentTop = 72;
    this.contentBottom = 47.99;
    this.contentHorizontal = 32;
    this.topBarTop = 19;
    this.topBarSideGap = 15;
    this.topBarMaxWidth = 360;
    this.dockBottomGap = 19;
    this.dockLeftGap = 13;
    this.dockRightGap = 13;
    this.dockMaxWidth = READER_FULL_PANEL_MAX_WIDTH_PHONE;
    this.fullPanelLeftGap = 13;
    this.fullPanelRightGap = 13;
    this.fullPanelMaxWidth = READER_FULL_PANEL_MAX_WIDTH_PHONE;
  }
}

export class ReaderReadingLayoutSnapshot {
  widthClass: ReaderWidthClass;
  viewportWidth: number;
  viewportHeight: number;
  contentTop: number;
  contentRight: number;
  contentBottom: number;
  contentLeft: number;
  titleLineHeightFp: number;
  titleToBodySpacingVp: number;
  titleTrackHeightVp: number;
  systemFontScale: number;
  pageChromeVisualSafeTop: number;
  pageChromeTopRegionHeight: number;
  pageChromeVisualSafeRight: number;
  pageChromeVisualSafeBottom: number;
  pageChromeVisualSafeLeft: number;
  pageChromeInteractiveSafeRight: number;
  pageChromeInteractiveSafeBottom: number;

  constructor(
    widthClass: ReaderWidthClass,
    viewportWidth: number,
    viewportHeight: number,
    contentTop: number,
    contentRight: number,
    contentBottom: number,
    contentLeft: number,
    systemFontScale: number,
    pageChromeVisualSafeTop: number = 0,
    pageChromeVisualSafeRight: number = 0,
    pageChromeVisualSafeBottom: number = 0,
    pageChromeVisualSafeLeft: number = 0,
    pageChromeInteractiveSafeRight: number = 0,
    pageChromeInteractiveSafeBottom: number = 0,
    pageChromeTopRegionHeight: number = 0,
  ) {
    this.widthClass = widthClass;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.contentTop = contentTop;
    this.contentRight = contentRight;
    this.contentBottom = contentBottom;
    this.contentLeft = contentLeft;
    this.titleLineHeightFp = READER_TITLE_LINE_HEIGHT_FP;
    this.titleToBodySpacingVp = READER_TITLE_TO_BODY_SPACE_VP;
    this.systemFontScale = systemFontScale;
    this.titleTrackHeightVp = this.titleLineHeightFp * systemFontScale + this.titleToBodySpacingVp;
    this.pageChromeVisualSafeTop = pageChromeVisualSafeTop;
    this.pageChromeTopRegionHeight = pageChromeTopRegionHeight;
    this.pageChromeVisualSafeRight = pageChromeVisualSafeRight;
    this.pageChromeVisualSafeBottom = pageChromeVisualSafeBottom;
    this.pageChromeVisualSafeLeft = pageChromeVisualSafeLeft;
    this.pageChromeInteractiveSafeRight = pageChromeInteractiveSafeRight;
    this.pageChromeInteractiveSafeBottom = pageChromeInteractiveSafeBottom;
  }

  bodyWidth(): number {
    return Math.max(1, this.viewportWidth - this.contentLeft - this.contentRight);
  }

  bodyHeight(showChapterTitle: boolean): number {
    return this.bodyHeightAfterTitle(showChapterTitle ?
      this.titleLineHeightFp * this.systemFontScale : 0);
  }

  /**
   * The chapter heading is laid out before body pagination. Callers that own
   * the real ArkUI title measurement pass its wrapped height here; only the
   * remaining page track is available to body lines.
   */
  bodyHeightAfterTitle(titleHeightVp: number): number {
    const measuredTitleHeight = Number.isFinite(titleHeightVp) ? Math.max(0, titleHeightVp) : 0;
    const titleTrack = measuredTitleHeight > 0 ? measuredTitleHeight + this.titleToBodySpacingVp : 0;
    return Math.max(1, this.viewportHeight - this.contentTop - this.contentBottom - titleTrack);
  }
}

export class ReaderControlLayoutSnapshot {
  widthClass: ReaderWidthClass;
  viewportWidth: number;
  viewportHeight: number;
  topBarTop: number;
  topBarWidth: number;
  dockBottomGap: number;
  dockRightGap: number;
  dockWidth: number;
  fullPanelTop: number;
  fullPanelRightGap: number;
  fullPanelWidth: number;
  fullPanelHeight: number;

  constructor(
    widthClass: ReaderWidthClass,
    viewportWidth: number,
    viewportHeight: number,
    topBarTop: number,
    topBarWidth: number,
    dockBottomGap: number,
    dockRightGap: number,
    dockWidth: number,
    fullPanelTop: number,
    fullPanelRightGap: number,
    fullPanelWidth: number,
    fullPanelHeight: number,
  ) {
    this.widthClass = widthClass;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.topBarTop = topBarTop;
    this.topBarWidth = topBarWidth;
    this.dockBottomGap = dockBottomGap;
    this.dockRightGap = dockRightGap;
    this.dockWidth = dockWidth;
    this.fullPanelTop = fullPanelTop;
    this.fullPanelRightGap = fullPanelRightGap;
    this.fullPanelWidth = fullPanelWidth;
    this.fullPanelHeight = fullPanelHeight;
  }

  isExpanded(): boolean {
    return this.widthClass === 'expanded';
  }
}

export function readerWidthClass(
  viewportWidth: number,
  expandedHint: boolean,
): ReaderWidthClass {
  if (viewportWidth > 0) {
    return viewportWidth >= READER_EXPANDED_MIN_WIDTH ? 'expanded' : 'compact';
  }
  return expandedHint ? 'expanded' : 'compact';
}

export function resolveReaderReadingLayout(
  viewportWidth: number,
  viewportHeight: number,
  expandedHint: boolean,
  metrics: ReaderWindowMetricsSnapshot,
  extendIntoCutout: boolean = false,
  insetProfile?: ReaderContentInsetProfile,
): ReaderReadingLayoutSnapshot {
  const widthClass = readerWidthClass(viewportWidth, expandedHint);
  const profile = new ReaderDesignProfile(widthClass === 'expanded');
  const width = viewportWidth > 0 ? viewportWidth : profile.referenceWidth;
  const height = viewportHeight > 0 ? viewportHeight : profile.referenceHeight;
  const cutoutSafeTop = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.top);
  const cutoutSafeBottom = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.bottom);
  const systemHorizontal = Math.max(
    Number.isFinite(metrics.systemInsets.left) ? Math.max(0, metrics.systemInsets.left) : 0,
    Number.isFinite(metrics.systemInsets.right) ? Math.max(0, metrics.systemInsets.right) : 0,
  );
  const safeHorizontal = Math.max(systemHorizontal, readerContentSafeHorizontal(metrics));
  // Reading text is a centred optical track. A one-sided cutout or system
  // inset therefore expands both authored margins by the same amount instead
  // of shifting the body and making the two screen-edge gaps visibly uneven.
  const autoHorizontal = widthClass === 'expanded' ? 44.44 : Math.max(16, Math.min(28, 24 * width / 390));
  const requestedHorizontal = insetProfile === undefined ? autoHorizontal :
    widthClass === 'expanded' ? insetProfile.expanded : insetProfile.compact;
  const configuredHorizontal = Number.isFinite(requestedHorizontal) ? Math.max(0, requestedHorizontal) : autoHorizontal;
  const contentHorizontal = Math.max(configuredHorizontal, safeHorizontal,
    widthClass === 'expanded' && insetProfile === undefined ? Math.max(0, (width - 720) / 2) : 0);
  // Reserve the information lane exactly once. With system chrome visible,
  // it starts below the retained status region; when extended it owns that region.
  const informationBottom = (extendIntoCutout ? 0 : metrics.statusBarHeight) + metrics.statusBarHeight;
  const contentTop = Math.max(metrics.systemInsets.top, cutoutSafeTop,
    informationBottom > 0 ? informationBottom + 8 : 0);
  const contentBottom = Math.max(
    metrics.systemInsets.bottom,
    cutoutSafeBottom,
    metrics.gestureInsets.bottom,
    metrics.navigationInsets.bottom,
  );
  const systemFontScale = metrics.systemFontScale > 0 ? metrics.systemFontScale : 1;
  return new ReaderReadingLayoutSnapshot(
    widthClass,
    width,
    height,
    Math.max(profile.contentTop, contentTop),
    contentHorizontal,
    Math.max(profile.contentBottom, contentBottom),
    contentHorizontal,
    systemFontScale,
    extendIntoCutout ? 0 : metrics.statusBarHeight,
    readerVisualSafeRight(metrics),
    readerVisualSafeBottom(metrics),
    readerVisualSafeLeft(metrics),
    readerInteractiveSafeRight(metrics, true),
    readerInteractiveSafeBottom(metrics, true),
    metrics.statusBarHeight,
  );
}

export function createDefaultReaderReadingLayout(): ReaderReadingLayoutSnapshot {
  return resolveReaderReadingLayout(0, 0, false, createDefaultReaderWindowMetrics());
}

export function resolveReaderControlLayout(
  viewportWidth: number,
  viewportHeight: number,
  expandedHint: boolean,
  metrics: ReaderWindowMetricsSnapshot,
): ReaderControlLayoutSnapshot {
  const widthClass = readerWidthClass(viewportWidth, expandedHint);
  const profile = new ReaderDesignProfile(widthClass === 'expanded');
  const width = viewportWidth > 0 ? viewportWidth : profile.referenceWidth;
  const height = viewportHeight > 0 ? viewportHeight : profile.referenceHeight;
  const safeHorizontal = readerContentSafeHorizontal(metrics);
  const safeTop = readerContentSafeTop(metrics);
  // A resized content viewport has already paid part/all of the IME inset.
  // Subtract only the keyboard area that still intersects this viewport.
  const consumedKeyboard = Math.max(0, metrics.windowRect.height - height);
  const keyboardOcclusion = Math.max(0, metrics.keyboardInsets.bottom - consumedKeyboard);
  const safeBottom = Math.max(readerInteractiveSafeBottom(metrics, false), keyboardOcclusion);
  const topBarSideGap = Math.max(profile.topBarSideGap, safeHorizontal);
  const topBarWidth = Math.min(profile.topBarMaxWidth, Math.max(0, width - topBarSideGap * 2));
  const dockLeftGap = Math.max(profile.dockLeftGap, safeHorizontal);
  const dockRightGap = Math.max(profile.dockRightGap, safeHorizontal);
  const dockWidth = Math.min(profile.dockMaxWidth, Math.max(0, width - dockLeftGap - dockRightGap));
  const fullPanelLeftGap = Math.max(profile.fullPanelLeftGap, safeHorizontal);
  const fullPanelRightGap = Math.max(profile.fullPanelRightGap, safeHorizontal);
  const fullPanelWidth = Math.min(
    profile.fullPanelMaxWidth,
    Math.max(0, width - fullPanelLeftGap - fullPanelRightGap),
  );
  const topBarTop = Math.max(profile.topBarTop, safeTop + READER_CONTROL_SAFE_TOP_GAP);
  // Reserve the complete top-bar box plus a breathing gap before the full
  // sheet. Previously the sheet's fixed 88vp anchor could overlap the 54vp
  // top bar whenever a visible status/cutout inset was present.
  const fullPanelTop = Math.max(READER_FULL_PANEL_TOP, topBarTop + 54 + 8);
  const fullPanelBottom = Math.max(READER_FULL_PANEL_BOTTOM_GAP, safeBottom);
  // This is the live height budget, not one panel's design height. Each full
  // panel clamps its own Figma height to this shared budget and scrolls its
  // internal content when the window is shorter.
  const fullPanelHeight = Math.max(0, height - fullPanelTop - fullPanelBottom);
  return new ReaderControlLayoutSnapshot(
    widthClass,
    width,
    height,
    topBarTop,
    topBarWidth,
    Math.max(profile.dockBottomGap, safeBottom),
    dockRightGap,
    dockWidth,
    fullPanelTop,
    fullPanelRightGap,
    fullPanelWidth,
    fullPanelHeight,
  );
}

export function createDefaultReaderControlLayout(): ReaderControlLayoutSnapshot {
  return resolveReaderControlLayout(0, 0, false, createDefaultReaderWindowMetrics());
}
