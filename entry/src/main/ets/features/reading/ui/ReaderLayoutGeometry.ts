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
} from '../../../ui/foundation/ReaderWindowMetrics.ts';
import { READER_CONTROL_TOP_BAR_HEIGHT } from './ReaderControlGeometry.ts';
import {
  READER_CONTROL_MOTION_QUICK_CONTENT_VERTICAL_RESERVE,
  READER_CONTROL_MOTION_CONTENT_INSET_MAX,
  READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE,
} from './ReaderControlMotionGeometry.ts';

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
// The immersive information row is a measured content lane, not a second
// status-bar guess.  Keep enough vertical breathing room around the platform
// text line while allowing large accessibility metrics to grow the lane.
export const READER_PAGE_CHROME_TOP_ROW_PADDING_VP = 8;
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
  pageChromeStatusMetrics: ReaderWindowMetricsSnapshot | undefined;

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
    pageChromeStatusMetrics?: ReaderWindowMetricsSnapshot,
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
    this.pageChromeStatusMetrics = pageChromeStatusMetrics;
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

export type ReaderControlContentModule = 'home' | 'directory' | 'search' | 'tts' | 'autoPage' |
  'appearance' | 'settings' | 'replace';

export interface ReaderControlCandidateWidths {
  panelWidthVp: number;
  quickContentWidthVp: number;
  fullContentWidthVp: number;
}

export interface ReaderControlFormMinimum {
  heightVp: number;
  minWidthVp: number;
  fits: boolean;
}

export interface ReaderControlModuleMinimum {
  module: ReaderControlContentModule;
  quick: ReaderControlFormMinimum;
  full: ReaderControlFormMinimum;
}

export interface ReaderControlChromeMinimum {
  topBarVisible?: boolean;
  topBarHeightVp?: number;
  quickReserveVp: number;
  fullReserveVp: number;
  navigationHeightVp: number;
  headerHeightVp: number;
  brightnessAutoHeightVp: number;
  brightnessAutoWidthVp: number;
}

export interface ReaderControlSharedShellMinimum {
  minimum: ReaderControlModuleMinimum;
  chrome: ReaderControlChromeMinimum;
}

export interface ReaderControlCandidateMinimum {
  key: string;
  widths: ReaderControlCandidateWidths;
  minimum: ReaderControlModuleMinimum;
  chrome: ReaderControlChromeMinimum;
  sharedShell?: ReaderControlSharedShellMinimum;
}

export type ReaderControlModuleMeasurer = (widths: ReaderControlCandidateWidths,
  key: string) => ReaderControlModuleMinimum | undefined;
export type ReaderControlContentMeasurer = (widths: ReaderControlCandidateWidths,
  key: string) => ReaderControlCandidateMinimum | undefined;

export class ReaderControlLayoutSnapshot {
  widthClass: ReaderWidthClass;
  viewportWidth: number;
  viewportHeight: number;
  topBarTop: number;
  topBarHeight: number = READER_CONTROL_TOP_BAR_HEIGHT;
  topBarVisible: boolean = true;
  minimumPanelTop: number = 0;
  topBarWidth: number;
  dockBottomGap: number;
  dockRightGap: number;
  dockWidth: number;
  fullPanelTop: number;
  fullPanelRightGap: number;
  fullPanelWidth: number;
  fullPanelHeight: number;
  quickPanelHeight: number | undefined;
  minimumKey: string = '';
  minimumStatus: 'legacy' | 'preferred' | 'constrained' = 'legacy';
  quickMinimumFits: boolean = true;
  fullMinimumFits: boolean = true;
  contentBudget: ReaderControlContentBudget | undefined = undefined;

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
    quickPanelHeight?: number,
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
    this.quickPanelHeight = quickPanelHeight;
  }

  isExpanded(): boolean {
    return this.widthClass === 'expanded';
  }
}

export interface ReaderControlContentBudget {
  key: string;
  quickContentHeightVp: number;
  fullContentHeightVp: number;
  brightnessContentHeightVp?: number;
  navigationHeightVp: number;
  headerHeightVp: number;
  brightnessAutoHeightVp: number;
  brightnessAutoWidthVp: number;
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
  measuredTopInfoHeightVp: number = 0,
  measuredPersistentBottomVp: number = 0,
  measuredSessionTargetHeightVp: number = 0,
): ReaderReadingLayoutSnapshot {
  const widthClass = readerWidthClass(viewportWidth, expandedHint);
  const profile = new ReaderDesignProfile(widthClass === 'expanded');
  const width = viewportWidth > 0 ? viewportWidth : profile.referenceWidth;
  const height = viewportHeight > 0 ? viewportHeight : profile.referenceHeight;
  // Extending places only the top information on either side of the cutout.
  // The full-width body must remain below the physical cutout in both modes.
  const cutoutSafeTop = Math.max(0, metrics.cutoutInsets.top,
    metrics.statusBarCutoutRect.height > 0 ?
      metrics.statusBarCutoutRect.top + metrics.statusBarCutoutRect.height : 0);
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
  // The immersive metadata uses the real status-bar origin and a lane that is
  // at least as high as the measured status region.  Its own text line also
  // gets measured breathing room, so a small status bar cannot make the
  // information row look shorter than the system chrome.
  // `statusBarRect` is the most precise source, but on HarmonyOS it can be
  // temporarily empty while the visible/hidden system-bar transaction is
  // settling.  Keep the origin in the window coordinate space and derive the
  // lane from every platform-provided top boundary so the information row
  // never falls back to the authored 72/92.44vp height for one frame.
  const informationTop = Number.isFinite(metrics.statusBarRect.top) ?
    Math.max(0, metrics.statusBarRect.top) : 0;
  const measuredInformationHeight = Number.isFinite(measuredTopInfoHeightVp) ? Math.max(0, measuredTopInfoHeightVp) : 0;
  const measuredInformationLane = measuredInformationHeight > 0 ?
    measuredInformationHeight + READER_PAGE_CHROME_TOP_ROW_PADDING_VP * 2 : 0;
  const cutoutRectBottom = metrics.statusBarCutoutRect.height > 0 ?
    Math.max(0, metrics.statusBarCutoutRect.top) + Math.max(0, metrics.statusBarCutoutRect.height) - informationTop : 0;
  const statusBarLane = Math.max(
    Number.isFinite(metrics.statusBarHeight) ? Math.max(0, metrics.statusBarHeight) : 0,
    Number.isFinite(metrics.statusBarRect.height) ? Math.max(0, metrics.statusBarRect.height) : 0,
    Number.isFinite(metrics.systemInsets.top) ? Math.max(0, metrics.systemInsets.top) : 0,
    Number.isFinite(metrics.cutoutInsets.top) ? Math.max(0, metrics.cutoutInsets.top) : 0,
    Math.max(0, cutoutRectBottom),
  );
  const informationLaneHeight = Math.max(statusBarLane, measuredInformationLane);
  const informationBottom = informationTop + informationLaneHeight;
  const contentTop = Math.max(metrics.systemInsets.top, cutoutSafeTop,
    informationBottom > 0 ? informationBottom + 8 : 0);
  // Once the real status region is known, this measured information lane owns
  // the body budget. The authored 72/92.44vp fallback remains only for the
  // genuinely unknown/landscape-without-status case.
  const resolvedContentTop = metrics.ready && informationLaneHeight > 0 ? contentTop :
    Math.max(profile.contentTop, contentTop);
  const persistentBottom = widthClass === 'compact' && width < height && Number.isFinite(measuredPersistentBottomVp) ?
    Math.max(0, measuredPersistentBottomVp) : 0;
  const contentBottom = Math.max(
    metrics.systemInsets.bottom,
    cutoutSafeBottom,
    metrics.gestureInsets.bottom,
    metrics.navigationInsets.bottom,
  );
  const systemFontScale = metrics.systemFontScale > 0 ? metrics.systemFontScale : 1;
  const sessionTargetHeight = Number.isFinite(measuredSessionTargetHeightVp) ? Math.max(0, measuredSessionTargetHeightVp) : 0;
  const sessionBottomBudget = sessionTargetHeight > 0 ?
    Math.max(23, readerInteractiveSafeBottom(metrics, false)) + sessionTargetHeight : 0;
  return new ReaderReadingLayoutSnapshot(
    widthClass,
    width,
    height,
    Math.max(resolvedContentTop, persistentBottom > 0 ? persistentBottom + 8 : 0),
    contentHorizontal,
    Math.max(profile.contentBottom, contentBottom, sessionBottomBudget),
    contentHorizontal,
    systemFontScale,
    informationTop,
    readerVisualSafeRight(metrics),
    readerVisualSafeBottom(metrics),
    readerVisualSafeLeft(metrics),
    readerInteractiveSafeRight(metrics, true),
    readerInteractiveSafeBottom(metrics, true),
    informationLaneHeight,
    metrics,
  );
}

export function createDefaultReaderReadingLayout(): ReaderReadingLayoutSnapshot {
  return resolveReaderReadingLayout(0, 0, false, createDefaultReaderWindowMetrics());
}

interface ReaderControlPanelSize {
  width: number;
  quickHeight: number;
  fullHeight: number;
  measured?: ReaderControlCandidateMinimum;
  preferred?: boolean;
}

const PHONE_PANEL_WIDTH_SHARE = 364 / 390;
const PHONE_QUICK_RATIO = 364 / 330;
const PHONE_FULL_RATIO = 364 / 736;
// The deepest action of the stacked Quick modules is the speed control.
const STACKED_QUICK_CONTENT_HEIGHT = 183;

function pixelWithin(preferred: number, min: number, max: number, density: number): number | undefined {
  const lo = Math.ceil(min * density - 1e-8);
  const hi = Math.floor(max * density + 1e-8);
  if (lo > hi) return undefined;
  return Math.max(lo, Math.min(hi, Math.ceil(preferred * density - 0.5))) / density;
}

/** Only candidate widths are measured. A selected width never borrows the
 * minimum of a neighbouring width: wrapping belongs to that exact candidate. */
export function readerControlCandidateWidths(viewportWidth: number, viewportHeight: number,
  expandedHint: boolean, metrics: ReaderWindowMetricsSnapshot): ReaderControlCandidateWidths[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return [];
  const profile = new ReaderDesignProfile(readerWidthClass(viewportWidth, expandedHint) === 'expanded');
  const density = Number.isFinite(metrics.densityPixels) && metrics.densityPixels > 0 ? metrics.densityPixels : 1;
  const available = Math.max(0, viewportWidth - readerContentSafeHorizontal(metrics) * 2);
  const lo = Math.ceil(viewportWidth * 0.91 * density - 1e-8);
  const hi = Math.floor(Math.min(viewportWidth * 0.96, available) * density + 1e-8);
  const widths: number[] = [];
  if (readerWidthClass(viewportWidth, expandedHint) === 'compact' && viewportWidth < viewportHeight) {
    for (let pixel = lo; pixel <= hi; pixel++) widths.push(pixel / density);
  } else {
    widths.push(Math.min(profile.fullPanelMaxWidth, Math.max(0, viewportWidth -
      Math.max(profile.fullPanelLeftGap, readerContentSafeHorizontal(metrics)) -
      Math.max(profile.fullPanelRightGap, readerContentSafeHorizontal(metrics)))));
  }
  if (widths.length === 0) widths.push(pixelWithin(viewportWidth * PHONE_PANEL_WIDTH_SHARE, 0, available, density) ?? 0);
  const preferred = viewportWidth * PHONE_PANEL_WIDTH_SHARE;
  widths.sort((a: number, b: number): number => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  return widths.filter((width: number): boolean => width > 0).map((width: number): ReaderControlCandidateWidths => {
    const inset = Math.min(READER_CONTROL_MOTION_CONTENT_INSET_MAX, width / 4);
    const fullWidth = Math.max(0, width - inset * 2);
    return { panelWidthVp: width, fullContentWidthVp: fullWidth,
      quickContentWidthVp: Math.max(0, fullWidth - READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE) };
  });
}

function validControlMinimum(value: ReaderControlSharedShellMinimum): boolean {
  const q = value?.minimum?.quick;
  const f = value?.minimum?.full;
  const c = value?.chrome;
  if (q === undefined || f === undefined || c === undefined) return false;
  return Number.isFinite(q.heightVp) && q.heightVp >= 0 && Number.isFinite(q.minWidthVp) && q.minWidthVp >= 0 &&
    Number.isFinite(f.heightVp) && f.heightVp >= 0 && Number.isFinite(f.minWidthVp) && f.minWidthVp >= 0 &&
    Number.isFinite(c.quickReserveVp) && c.quickReserveVp >= 0 &&
    Number.isFinite(c.fullReserveVp) && c.fullReserveVp >= 0 &&
    Number.isFinite(c.navigationHeightVp) && c.navigationHeightVp >= 0 &&
    Number.isFinite(c.headerHeightVp) && c.headerHeightVp > 0 &&
    Number.isFinite(c.brightnessAutoHeightVp) && c.brightnessAutoHeightVp > 0 &&
    Number.isFinite(c.brightnessAutoWidthVp) && c.brightnessAutoWidthVp > 0;
}

function validControlCandidate(value: ReaderControlCandidateMinimum, availableWidth: number): boolean {
  const inset = Math.min(READER_CONTROL_MOTION_CONTENT_INSET_MAX, value.widths.panelWidthVp / 4);
  const fullWidth = Math.max(0, value.widths.panelWidthVp - inset * 2);
  return value.key.length > 0 && Number.isFinite(value.widths.panelWidthVp) &&
    value.widths.panelWidthVp > 0 && value.widths.panelWidthVp <= availableWidth + 0.01 &&
    Number.isFinite(value.widths.fullContentWidthVp) && Math.abs(value.widths.fullContentWidthVp - fullWidth) < 0.01 &&
    Number.isFinite(value.widths.quickContentWidthVp) && Math.abs(value.widths.quickContentWidthVp -
      Math.max(0, fullWidth - READER_CONTROL_MOTION_QUICK_CONTENT_HORIZONTAL_RESERVE)) < 0.01 &&
    validControlMinimum(value) && (value.sharedShell === undefined ||
      (value.sharedShell?.minimum?.module === 'home' && validControlMinimum(value.sharedShell)));
}

/** Content modules scroll within one measured Home/chrome shell. Their natural
 * content minimum remains on the original candidate for viewport/fit truth. */
function controlShellMinimum(value: ReaderControlCandidateMinimum): ReaderControlSharedShellMinimum {
  return value.sharedShell ?? value;
}

function resolveMeasuredPortraitControlPanelSize(width: number, height: number,
  availableWidth: number, availableHeight: number, density: number,
  candidates: ReaderControlCandidateMinimum[]): ReaderControlPanelSize | undefined {
  const ordered = candidates.filter((value: ReaderControlCandidateMinimum): boolean =>
    validControlCandidate(value, availableWidth)).slice();
  const preferredWidth = width * PHONE_PANEL_WIDTH_SHARE;
  ordered.sort((a: ReaderControlCandidateMinimum, b: ReaderControlCandidateMinimum): number =>
    Math.abs(a.widths.panelWidthVp - preferredWidth) - Math.abs(b.widths.panelWidthVp - preferredWidth) ||
      a.widths.panelWidthVp - b.widths.panelWidthVp);
  const ready = ordered.filter((value: ReaderControlCandidateMinimum): boolean => {
    const shell = controlShellMinimum(value);
    return shell.minimum.quick.fits && shell.minimum.full.fits &&
      shell.minimum.quick.minWidthVp <= value.widths.quickContentWidthVp &&
      shell.minimum.full.minWidthVp <= value.widths.fullContentWidthVp;
  });
  const candidate = ready[0] ?? ordered[0];
  if (candidate === undefined) return undefined;
  const shell = controlShellMinimum(candidate);
  const panelWidth = candidate.widths.panelWidthVp;
  const fullRequired = shell.minimum.full.heightVp + shell.chrome.fullReserveVp;
  const quickRequired = shell.minimum.quick.heightVp + shell.chrome.quickReserveVp;
  // Reference proportions choose a preferred size. Physical safe area and
  // real text/content budgets determine feasibility, without percentage caps.
  const fullHeight = pixelWithin(Math.max(panelWidth / PHONE_FULL_RATIO, fullRequired, quickRequired),
    0, availableHeight, density) ?? 0;
  const quickHeight = pixelWithin(Math.max(panelWidth / PHONE_QUICK_RATIO, quickRequired),
    0, fullHeight, density) ?? 0;
  return { width: panelWidth, quickHeight: quickHeight, fullHeight: fullHeight,
    measured: candidate, preferred: ready.length > 0 && fullRequired <= fullHeight && quickRequired <= quickHeight };
}

function resolvePortraitControlPanelSize(width: number, height: number,
  availableWidth: number, availableHeight: number, density: number): ReaderControlPanelSize {
  const stackedHeight = STACKED_QUICK_CONTENT_HEIGHT + READER_CONTROL_MOTION_QUICK_CONTENT_VERTICAL_RESERVE;
  const panelWidth = pixelWithin(width * PHONE_PANEL_WIDTH_SHARE, 0, availableWidth, density) ?? 0;
  const fullHeight = pixelWithin(Math.max(stackedHeight, panelWidth / PHONE_FULL_RATIO), 0,
    availableHeight, density) ?? 0;
  const quickHeight = pixelWithin(Math.max(stackedHeight, panelWidth / PHONE_QUICK_RATIO), 0,
    fullHeight, density) ?? 0;
  return { width: panelWidth, quickHeight: quickHeight, fullHeight: fullHeight };
}

export function resolveReaderControlLayout(
  viewportWidth: number,
  viewportHeight: number,
  expandedHint: boolean,
  metrics: ReaderWindowMetricsSnapshot,
  measuredPersistentBottomVp: number = 0,
  candidates?: ReaderControlCandidateMinimum[],
): ReaderControlLayoutSnapshot {
  const widthClass = readerWidthClass(viewportWidth, expandedHint);
  const profile = new ReaderDesignProfile(widthClass === 'expanded');
  const width = viewportWidth > 0 ? viewportWidth : profile.referenceWidth;
  const height = viewportHeight > 0 ? viewportHeight : profile.referenceHeight;
  const safeHorizontal = readerContentSafeHorizontal(metrics);
  // Control invocation reveals system chrome asynchronously. Its target lane
  // is already measured even while the current visible avoid-area is zero.
  const safeTop = Math.max(readerContentSafeTop(metrics), metrics.statusBarRect.top + metrics.statusBarHeight);
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
  const topBarTop = Math.max(profile.topBarTop, safeTop + READER_CONTROL_SAFE_TOP_GAP);
  const dockBottomGap = Math.max(profile.dockBottomGap, safeBottom);
  // Reserve the complete top-bar box plus a breathing gap before the full
  // sheet. Previously the sheet's fixed 88vp anchor could overlap the 54vp
  // top bar whenever a visible status/cutout inset was present.
  const persistentBottom = Number.isFinite(measuredPersistentBottomVp) ? Math.max(0, measuredPersistentBottomVp) : 0;
  const measuredTopBars = (candidates ?? []).map((value: ReaderControlCandidateMinimum): number =>
    value.chrome.topBarHeightVp ?? 0).filter((value: number): boolean => Number.isFinite(value) && value > 0);
  // Before the current provider answers, reserve a conservative scaled shell.
  // It is replaced only by a real current candidate's native line receipt.
  const topBarHeight = measuredTopBars.length > 0 ? Math.max(READER_CONTROL_TOP_BAR_HEIGHT, ...measuredTopBars) :
    Math.ceil(READER_CONTROL_TOP_BAR_HEIGHT * Math.max(1, Number.isFinite(metrics.systemFontScale) ? metrics.systemFontScale : 1));
  const topBarVisible = candidates !== undefined && candidates.some((value: ReaderControlCandidateMinimum): boolean => value.chrome.topBarVisible !== undefined) ?
    candidates.every((value: ReaderControlCandidateMinimum): boolean => value.chrome.topBarVisible !== false) :
    height - Math.max(READER_FULL_PANEL_TOP, topBarTop + topBarHeight + 8) - Math.max(READER_FULL_PANEL_BOTTOM_GAP, dockBottomGap) >= 184;
  const minimumPanelTop = persistentBottom > 0 ? persistentBottom + 8 : 0;
  const fullPanelTop = Math.max(topBarVisible ? READER_FULL_PANEL_TOP : topBarTop,
    topBarVisible ? topBarTop + topBarHeight + 8 : topBarTop, minimumPanelTop);
  const fullPanelBottom = Math.max(READER_FULL_PANEL_BOTTOM_GAP, dockBottomGap);
  const availablePanelHeight = Math.max(0, height - fullPanelTop - fullPanelBottom);
  const defaultPanelWidth = Math.min(profile.fullPanelMaxWidth,
    Math.max(0, width - fullPanelLeftGap - fullPanelRightGap));
  const density = Number.isFinite(metrics.densityPixels) && metrics.densityPixels > 0 ? metrics.densityPixels : 1;
  const portraitPanel = widthClass === 'compact' && width < height ?
    (candidates !== undefined && candidates.length > 0 ?
      resolveMeasuredPortraitControlPanelSize(width, height, Math.max(0, width - safeHorizontal * 2),
        availablePanelHeight, density, candidates) : undefined) ??
      resolvePortraitControlPanelSize(width, height, Math.max(0, width - safeHorizontal * 2), availablePanelHeight, density) :
    undefined;
  // Wide and landscape windows use their exact dock width. Their measured
  // natural extent is allowed to scroll inside the physical viewport.
  const otherCandidate = candidates?.find((value: ReaderControlCandidateMinimum): boolean =>
    validControlCandidate(value, Math.max(0, width - safeHorizontal * 2)) &&
    Math.abs(value.widths.panelWidthVp - defaultPanelWidth) < 0.01);
  const otherShell = otherCandidate === undefined ? undefined : controlShellMinimum(otherCandidate);
  const otherPanel: ReaderControlPanelSize | undefined = portraitPanel === undefined && otherCandidate !== undefined && otherShell !== undefined ? {
    width: otherCandidate.widths.panelWidthVp,
    fullHeight: availablePanelHeight,
    quickHeight: Math.min(availablePanelHeight, Math.max(otherShell.minimum.quick.heightVp +
      otherShell.chrome.quickReserveVp, 330)), measured: otherCandidate, preferred: false,
  } : undefined;
  const selectedPanel = portraitPanel ?? otherPanel;
  const snapshot = new ReaderControlLayoutSnapshot(
    widthClass,
    width,
    height,
    topBarTop,
    topBarWidth,
    dockBottomGap,
    dockRightGap,
    dockWidth,
    fullPanelTop,
    fullPanelRightGap,
    selectedPanel?.width ?? defaultPanelWidth,
    selectedPanel?.fullHeight ?? availablePanelHeight,
    selectedPanel?.quickHeight,
  );
  snapshot.topBarHeight = topBarHeight; snapshot.topBarVisible = topBarVisible; snapshot.minimumPanelTop = minimumPanelTop;
  const measured = selectedPanel?.measured;
  if (measured !== undefined && selectedPanel !== undefined) {
    snapshot.minimumKey = measured.key;
    snapshot.minimumStatus = selectedPanel.preferred ? 'preferred' : 'constrained';
    const quickHeight = Math.max(0, selectedPanel.quickHeight - measured.chrome.quickReserveVp);
    const fullHeight = Math.max(0, selectedPanel.fullHeight - measured.chrome.fullReserveVp);
    snapshot.quickMinimumFits = measured.minimum.quick.fits &&
      measured.minimum.quick.heightVp <= quickHeight + 0.01 &&
      measured.minimum.quick.minWidthVp <= measured.widths.quickContentWidthVp + 0.01;
    snapshot.fullMinimumFits = measured.minimum.full.fits &&
      measured.minimum.full.heightVp <= fullHeight + 0.01 &&
      measured.minimum.full.minWidthVp <= measured.widths.fullContentWidthVp + 0.01;
    const sharedShell = controlShellMinimum(measured);
    snapshot.contentBudget = { key: measured.key, quickContentHeightVp: quickHeight,
      brightnessContentHeightVp: Math.max(0, selectedPanel.quickHeight - sharedShell.chrome.quickReserveVp),
      fullContentHeightVp: fullHeight, navigationHeightVp: measured.chrome.navigationHeightVp,
      headerHeightVp: measured.chrome.headerHeightVp,
      brightnessAutoHeightVp: measured.chrome.brightnessAutoHeightVp,
      brightnessAutoWidthVp: measured.chrome.brightnessAutoWidthVp };
  }
  return snapshot;
}

export function createDefaultReaderControlLayout(): ReaderControlLayoutSnapshot {
  return resolveReaderControlLayout(0, 0, false, createDefaultReaderWindowMetrics());
}
