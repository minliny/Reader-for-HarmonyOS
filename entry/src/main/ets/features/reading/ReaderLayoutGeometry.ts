import {
  ReaderWindowMetricsSnapshot,
  createDefaultReaderWindowMetrics,
  readerContentSafeHorizontal,
  readerContentSafeTop,
  readerInteractiveSafeBottom,
  readerVisualSafeLeft,
  readerVisualSafeRight,
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

  constructor(
    widthClass: ReaderWidthClass,
    viewportWidth: number,
    viewportHeight: number,
    contentTop: number,
    contentRight: number,
    contentBottom: number,
    contentLeft: number,
    systemFontScale: number,
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
  }

  bodyWidth(): number {
    return Math.max(1, this.viewportWidth - this.contentLeft - this.contentRight);
  }

  bodyHeight(showChapterTitle: boolean): number {
    const titleTrack = showChapterTitle ? this.titleTrackHeightVp : 0;
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
): ReaderReadingLayoutSnapshot {
  const widthClass = readerWidthClass(viewportWidth, expandedHint);
  const profile = new ReaderDesignProfile(widthClass === 'expanded');
  const width = viewportWidth > 0 ? viewportWidth : profile.referenceWidth;
  const height = viewportHeight > 0 ? viewportHeight : profile.referenceHeight;
  const cutoutSafeLeft = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.left);
  const cutoutSafeTop = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.top);
  const cutoutSafeRight = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.right);
  const cutoutSafeBottom = extendIntoCutout ? 0 : Math.max(0, metrics.cutoutInsets.bottom);
  const contentLeft = Math.max(profile.contentHorizontal, Math.max(metrics.systemInsets.left, cutoutSafeLeft));
  const contentRight = Math.max(profile.contentHorizontal, Math.max(metrics.systemInsets.right, cutoutSafeRight));
  const contentTop = Math.max(metrics.systemInsets.top, cutoutSafeTop);
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
    contentRight,
    Math.max(profile.contentBottom, contentBottom),
    contentLeft,
    systemFontScale,
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
  const safeBottom = readerInteractiveSafeBottom(metrics, true);
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
  const fullPanelTop = Math.max(READER_FULL_PANEL_TOP, safeTop);
  const fullPanelBottom = Math.max(READER_FULL_PANEL_BOTTOM_GAP, safeBottom);
  // This is the live height budget, not one panel's design height. Each full
  // panel clamps its own Figma height to this shared budget and scrolls its
  // internal content when the window is shorter.
  const fullPanelHeight = Math.max(0, height - fullPanelTop - fullPanelBottom);
  return new ReaderControlLayoutSnapshot(
    widthClass,
    width,
    height,
    Math.max(profile.topBarTop, safeTop),
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
