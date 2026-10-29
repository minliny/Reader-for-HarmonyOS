import { readerAppColor } from './ReaderThemeRegistry';
import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { SOURCE_SWITCH_VISUAL } from '../source/SourceSwitchVisual';

export type ReaderSurfaceElevationKind = 'embedded' | 'fixed' | 'floating' | 'popover' | 'sheet';
class ReaderSurfaceElevationSpec {
  readonly radiusVp: number;
  readonly offsetYVp: number;
  readonly shadowRole: ReaderAppColorRole;
  constructor(radiusVp: number, offsetYVp: number, shadowRole: ReaderAppColorRole) {
    this.radiusVp = radiusVp; this.offsetYVp = offsetYVp; this.shadowRole = shadowRole;
  }
}

// The material relationship owns the lift. Fixed position does not imply
// elevation; cover and reader-body lighting remain separate contracts.
const FLAT_ELEVATION = new ReaderSurfaceElevationSpec(0, 0, 'app.surface.transparent');
const FLOATING_ELEVATION = new ReaderSurfaceElevationSpec(20, 8, 'app.navigation.floatingShadow');
const POPOVER_ELEVATION = new ReaderSurfaceElevationSpec(20, 5, 'app.shadow.menu');
const SHEET_ELEVATION = new ReaderSurfaceElevationSpec(24, -4, 'app.shadow.sheet');

function resolveSurfaceElevationSpec(kind: ReaderSurfaceElevationKind): ReaderSurfaceElevationSpec {
  if (kind === 'embedded' || kind === 'fixed') return FLAT_ELEVATION;
  if (kind === 'floating') return FLOATING_ELEVATION;
  if (kind === 'popover') return POPOVER_ELEVATION;
  if (kind === 'sheet') return SHEET_ELEVATION;
  throw new Error('Unknown Reader surface elevation');
}

/** ArkUI ShadowOptions radius/offset are physical px (SDK common.d.ts:7484).
 * Specs are logical vp, resolved once through the live window density. */
export function readerSurfaceElevation(kind: ReaderSurfaceElevationKind, scheme: string): ShadowOptions {
  const spec = resolveSurfaceElevationSpec(kind);
  const observedDensity = ReaderWindowCoordinator.metrics().densityPixels;
  const density = Number.isFinite(observedDensity) && observedDensity > 0 ? observedDensity : 1;
  return { radius: spec.radiusVp * density, offsetX: 0, offsetY: spec.offsetYVp * density,
    color: readerAppColor(spec.shadowRole, scheme) };
}

/** Raised chrome keeps its multi-layer geometry in the same surface authority.
 * Canvas blur is px; path/spread/offset coordinates remain logical vp. */
export class ReaderShadowLayerSpec {
  readonly radiusVp: number;
  readonly offsetXVp: number;
  readonly offsetYVp: number;
  readonly spreadVp: number;
  readonly shadowRole: ReaderAppColorRole;
  constructor(radiusVp: number, offsetYVp: number, spreadVp: number, shadowRole: ReaderAppColorRole) {
    this.radiusVp = radiusVp;
    this.offsetXVp = 0;
    this.offsetYVp = offsetYVp;
    this.spreadVp = spreadVp;
    this.shadowRole = shadowRole;
  }
}

export class ReaderRaisedSurfaceSpec {
  readonly canvasOutsetVp: number = 48;
  readonly casterShiftVp: number = 1024;
  // Paint far-to-near; CSS lists the frontmost contact shadow first.
  readonly layers: ReaderShadowLayerSpec[] = [
    new ReaderShadowLayerSpec(28, 12, 3, 'app.chrome.raisedShadowAmbient'),
    new ReaderShadowLayerSpec(8, 3, 0, 'app.chrome.raisedShadowNear'),
    // A zero-blur offset casts a second hard outline beside the owner's border.
    // Keep contact depth, with a short falloff at every display density.
    new ReaderShadowLayerSpec(1, 1, 0, 'app.chrome.raisedShadowContact'),
  ];
}
const RAISED_SURFACE_SPEC = new ReaderRaisedSurfaceSpec();
export function readerRaisedSurfaceSpec(): ReaderRaisedSurfaceSpec { return RAISED_SURFACE_SPEC; }

export class ReaderHeaderVeilSpec {
  readonly idleBlurRadius: number = 10;
  readonly scrolledBlurRadius: number = 14;
  readonly surfaceRole: ReaderAppColorRole = 'app.header.veilSurface';
  readonly scrolledSurfaceRole: ReaderAppColorRole = 'app.header.veilSurfaceScrolled';
  readonly borderRole: ReaderAppColorRole = 'app.header.veilBorder';
}
const HEADER_VEIL_SPEC = new ReaderHeaderVeilSpec();

/** Clearing veil requires backgroundEffect(undefined) AND a solid background;
 * native radius=0 does not paint the opaque effect color (P0 native evidence). */
export function readerHeaderVeilMaterial(scrolled: boolean, scheme: string): BackgroundEffectOptions {
  return { radius: scrolled ? HEADER_VEIL_SPEC.scrolledBlurRadius : HEADER_VEIL_SPEC.idleBlurRadius,
    color: readerAppColor(scrolled ? HEADER_VEIL_SPEC.scrolledSurfaceRole : HEADER_VEIL_SPEC.surfaceRole, scheme) };
}
export function readerHeaderVeilBorder(scheme: string): string {
  return readerAppColor(HEADER_VEIL_SPEC.borderRole, scheme);
}

/** Actual drawer frames, including the selected source drawer. Owners supply
 * measured geometry and safe insets; the existing bounded surface paints it. */
export type DrawerSpecId = 'reader-action-sheet' | 'source-switch-drawer';
export class DrawerSurfaceSpec {
  readonly maxWidth: number = SOURCE_SWITCH_VISUAL.drawerMaxWidth;
  readonly cornerRadius: number = SOURCE_SWITCH_VISUAL.drawerCornerRadius;
  readonly surfaceRole: ReaderAppColorRole = 'TOK_SS_WINDOW_BG';
  readonly lineRole: ReaderAppColorRole = 'app.border.menu';
  readonly edgeHighlightRole: ReaderAppColorRole = 'app.border.modalHighlight';
  readonly edgeWidth: number = 1;
  readonly elevation: ReaderSurfaceElevationKind = 'sheet';
  readonly scrimRole: ReaderAppColorRole = 'TOK_SS_DRAWER_SCRIM';
  readonly inkRole: ReaderAppColorRole = 'TOK_INK';
  readonly minimumContentHeight: number = 0;
  readonly contentInset: number = SOURCE_SWITCH_VISUAL.normalSideInset;
  readonly sideContentInset: number = SOURCE_SWITCH_VISUAL.normalSideInset;
  readonly compactSideContentInset: number = SOURCE_SWITCH_VISUAL.narrowSideInset;
  readonly compactViewportWidth: number = SOURCE_SWITCH_VISUAL.narrowWidthThreshold;
  readonly handleWidth: number = SOURCE_SWITCH_VISUAL.gripWidth;
  readonly handleHeight: number = SOURCE_SWITCH_VISUAL.gripHeight;
  readonly handleTop: number = SOURCE_SWITCH_VISUAL.gripMarginTop;
  readonly handleBottom: number = SOURCE_SWITCH_VISUAL.gripMarginBottom;
  readonly handleZone: number = SOURCE_SWITCH_VISUAL.gripMarginTop + SOURCE_SWITCH_VISUAL.gripHeight + SOURCE_SWITCH_VISUAL.gripMarginBottom;
  readonly closeSize: number = 44;
  readonly closeIcon: number = SOURCE_SWITCH_VISUAL.closeIconSize;
  readonly closeTop: number = 0;
  readonly closeRight: number = 0;
  readonly titleFontFamily: string = 'ReaderNotoSerifSCBold';
  readonly titleFontWeight: number = SOURCE_SWITCH_VISUAL.titleFontWeight;
  readonly titleFontSize: number = SOURCE_SWITCH_VISUAL.titleFontSize;
  readonly titleLineHeight: number = SOURCE_SWITCH_VISUAL.titleLineHeight;
  readonly titleMinFontScale: number = 0;
  readonly titleMaxFontScale: number = 2;
  readonly titleHeight: number = SOURCE_SWITCH_VISUAL.headingHeight;
  readonly titleBottom: number = 0;
  readonly sideTitleFontFamily: string = 'ReaderNotoSerifSCBold';
  readonly sideTitleFontWeight: number = SOURCE_SWITCH_VISUAL.titleFontWeight;
  readonly sideTitleFontSize: number = SOURCE_SWITCH_VISUAL.titleFontSize;
  readonly sideTitleLineHeight: number = SOURCE_SWITCH_VISUAL.titleLineHeight;
  readonly sideHeaderHeight: number = SOURCE_SWITCH_VISUAL.headingHeight + SOURCE_SWITCH_VISUAL.gripMarginTop + SOURCE_SWITCH_VISUAL.gripMarginBottom;
  readonly sideHeaderBottom: number = 0;
  readonly handleRole: ReaderAppColorRole = 'TOK_SS_DRAWER_HANDLE';
  constructor(_id: DrawerSpecId) {}
}
const DRAWER_SPECS: Record<DrawerSpecId, DrawerSurfaceSpec> = {
  'reader-action-sheet': new DrawerSurfaceSpec('reader-action-sheet'),
  'source-switch-drawer': new DrawerSurfaceSpec('source-switch-drawer'),
};
export function resolveDrawerSpec(id: DrawerSpecId): DrawerSurfaceSpec { return DRAWER_SPECS[id]; }

/**
 * Finite dialog surface specs. Data-only registry; the surface component
 * resolves one entry by id, so a shared-spec change propagates to every
 * consumer while a per-variant change stays scoped. Visual values are owned
 * here, not re-derived by callers.
 */
export type DialogSpecId = 'book-removal' | 'json-import' | 'shelf-group' | 'local-import' | 'download-confirmation';

export type DialogHeaderFontFamily = 'ReaderMangaSans600' | 'ReaderNotoSerifSCBold';

/**
 * cap        — the surface column width is clamped to maxWidth (native modal).
 * inset      — the surface column fills the host overlay and the host applies
 *              the resolved left/right gaps as padding, so content may sit
 *              wider than maxWidth while the visual frame stays centered.
 * card-inset — the surface column width is the resolved card width
 *              (min(maxWidth, container - 2*edgeGap)); the host overlay
 *              positions it without owning any gap padding.
 * A widthPercent > 0 replaces the cap/inset resolution with a plain percentage
 * of the host width (legacy hand-drawn overlays; prefer cap/inset for new
 * surfaces).
 */
export type DialogFrameMode = 'cap' | 'inset' | 'card-inset';

/** row — actions laid out horizontally with layoutWeight; stack — full-width
 * primary actions stacked vertically. */
export type DialogActionsLayout = 'row' | 'stack';

/** Named ArkTS contract for registry entries. ArkTS rejects inline object
 * literal type declarations in constructor parameters, while a named
 * interface keeps the data-only registry readable and compiler-safe. */
export interface DialogSurfaceSpecInit {
  maxWidth: number;
  edgeGap: number;
  widthPercent: number;
  frameMode: DialogFrameMode;
  usesKeyboardSafeArea: boolean;
  padding: number;
  borderRadius: number;
  backgroundRole: ReaderAppColorRole;
  hasShadow: boolean;
  hasBorder: boolean;
  headerFontSize: number;
  headerFontFamily: DialogHeaderFontFamily;
  headerTextAlign: TextAlign;
  headerLineHeight: number;
  headerGap: number;
  bodyActionsGap: number;
  bodyActionsOwnMargin: number;
  actionsLayout: DialogActionsLayout;
  actionHeight: number;
  actionBorderRadius: number;
  actionUsesPressFeedback: boolean;
  actionExtendsTouchRegion: boolean;
  actionPrimarySurfaceRole: ReaderAppColorRole;
  actionPrimaryLabelRole: ReaderAppColorRole;
}

export class DialogSurfaceSpec {
  readonly headerFontWeight: number = 600;
  readonly maxWidth: number;
  readonly edgeGap: number;
  readonly widthPercent: number;
  readonly frameMode: DialogFrameMode;
  readonly usesKeyboardSafeArea: boolean;
  readonly padding: number;
  readonly borderRadius: number;
  readonly backgroundRole: ReaderAppColorRole;
  readonly hasShadow: boolean;
  readonly hasBorder: boolean;
  readonly headerFontSize: number;
  readonly headerFontFamily: DialogHeaderFontFamily;
  readonly headerTextAlign: TextAlign;
  readonly headerLineHeight: number;
  readonly headerGap: number;
  readonly bodyActionsGap: number;
  readonly bodyActionsOwnMargin: number;
  readonly actionsLayout: DialogActionsLayout;
  readonly actionHeight: number;
  readonly actionBorderRadius: number;
  readonly actionUsesPressFeedback: boolean;
  readonly actionExtendsTouchRegion: boolean;
  readonly actionPrimarySurfaceRole: ReaderAppColorRole;
  readonly actionPrimaryLabelRole: ReaderAppColorRole;

  constructor(init: DialogSurfaceSpecInit) {
    this.maxWidth = init.maxWidth;
    this.edgeGap = init.edgeGap;
    this.widthPercent = init.widthPercent;
    this.frameMode = init.frameMode;
    this.usesKeyboardSafeArea = init.usesKeyboardSafeArea;
    this.padding = init.padding;
    this.borderRadius = init.borderRadius;
    this.backgroundRole = init.backgroundRole;
    this.hasShadow = init.hasShadow;
    this.hasBorder = init.hasBorder;
    this.headerFontSize = init.headerFontSize;
    this.headerFontFamily = init.headerFontFamily;
    this.headerTextAlign = init.headerTextAlign;
    this.headerLineHeight = init.headerLineHeight;
    this.headerGap = init.headerGap;
    this.bodyActionsGap = init.bodyActionsGap;
    this.bodyActionsOwnMargin = init.bodyActionsOwnMargin;
    this.actionsLayout = init.actionsLayout;
    this.actionHeight = init.actionHeight;
    this.actionBorderRadius = init.actionBorderRadius;
    this.actionUsesPressFeedback = init.actionUsesPressFeedback;
    this.actionExtendsTouchRegion = init.actionExtendsTouchRegion;
    this.actionPrimarySurfaceRole = init.actionPrimarySurfaceRole;
    this.actionPrimaryLabelRole = init.actionPrimaryLabelRole;
  }
}

// User-approved confirmation/form/task family, 2026-10-19. Hosts continue
// to own focus, masks, keyboard/safe-area bounds and operation admission.
const DIALOG_SPECS: Record<DialogSpecId, DialogSurfaceSpec> = {
  'download-confirmation': new DialogSurfaceSpec({
    maxWidth: 306, edgeGap: 24, widthPercent: 0, frameMode: 'cap', usesKeyboardSafeArea: false,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_MESSAGE_SURFACE', hasShadow: false, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderMangaSans600', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24, headerGap: 0, bodyActionsGap: 0, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 44, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_MESSAGE_SOFT', actionPrimaryLabelRole: 'TOK_MESSAGE_SOFT_INK',
  }),
  'book-removal': new DialogSurfaceSpec({
    maxWidth: 306, edgeGap: 20, widthPercent: 0, frameMode: 'cap', usesKeyboardSafeArea: false,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_MESSAGE_SURFACE', hasShadow: true, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderMangaSans600', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24, headerGap: 12, bodyActionsGap: 28, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 44, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_MESSAGE_SOFT', actionPrimaryLabelRole: 'TOK_MESSAGE_SOFT_INK',
  }),
  'json-import': new DialogSurfaceSpec({
    maxWidth: 360, edgeGap: 16, widthPercent: 0, frameMode: 'card-inset', usesKeyboardSafeArea: true,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_MESSAGE_SURFACE', hasShadow: true, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderMangaSans600', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24, headerGap: 12, bodyActionsGap: 28, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 44, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_MESSAGE_SOFT', actionPrimaryLabelRole: 'TOK_MESSAGE_SOFT_INK',
  }),
  'shelf-group': new DialogSurfaceSpec({
    maxWidth: 360, edgeGap: 16, widthPercent: 0, frameMode: 'card-inset', usesKeyboardSafeArea: true,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_MESSAGE_SURFACE', hasShadow: true, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderMangaSans600', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24, headerGap: 12, bodyActionsGap: 28, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 44, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_MESSAGE_SOFT', actionPrimaryLabelRole: 'TOK_MESSAGE_SOFT_INK',
  }),
  'local-import': new DialogSurfaceSpec({
    maxWidth: 350, edgeGap: 16, widthPercent: 0, frameMode: 'card-inset', usesKeyboardSafeArea: true,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_MESSAGE_SURFACE', hasShadow: true, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderMangaSans600', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24, headerGap: 12, bodyActionsGap: 28, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 44, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_MESSAGE_SOFT', actionPrimaryLabelRole: 'TOK_MESSAGE_SOFT_INK',
  }),
};

export function resolveDialogSpec(id: DialogSpecId): DialogSurfaceSpec {
  return DIALOG_SPECS[id];
}

/**
 * Finite bottom-sheet surface specs. The host continues to own presentation
 * and width; the sheet content reads one shared contract for its measured
 * frame, handle, title and action rows.
 */
export type SheetSpecId = 'bookshelf-book-action' | 'search-result-filter' | 'search-task-status';

/** The native book Sheet owns its one opaque frame and safe area. Content
 * flows naturally into FIT_CONTENT; no fixed legacy row offsets or height. */
export class SheetSurfaceSpec {
  readonly maxWidth: number = SOURCE_SWITCH_VISUAL.drawerMaxWidth;
  readonly horizontalInset: number = SOURCE_SWITCH_VISUAL.normalSideInset;
  readonly handleWidth: number = SOURCE_SWITCH_VISUAL.gripWidth;
  readonly handleHeight: number = SOURCE_SWITCH_VISUAL.gripHeight;
  readonly handleTop: number = SOURCE_SWITCH_VISUAL.gripMarginTop;
  readonly handleBottom: number = SOURCE_SWITCH_VISUAL.gripMarginBottom;
  readonly titleInset: number = SOURCE_SWITCH_VISUAL.normalSideInset;
  readonly titleHeight: number = SOURCE_SWITCH_VISUAL.headingHeight;
  readonly titleBottom: number = 0;
  readonly titleFontFamily: string = 'ReaderNotoSerifSCBold';
  readonly titleFontWeight: number = SOURCE_SWITCH_VISUAL.titleFontWeight;
  readonly titleFontSize: number = SOURCE_SWITCH_VISUAL.titleFontSize;
  readonly titleLineHeight: number = SOURCE_SWITCH_VISUAL.titleLineHeight;
  readonly contentBottom: number = SOURCE_SWITCH_VISUAL.normalSideInset;
  readonly borderRadius: number = SOURCE_SWITCH_VISUAL.drawerCornerRadius;
  readonly handleRole: ReaderAppColorRole = 'TOK_SS_DRAWER_HANDLE';
  readonly titleRole: ReaderAppColorRole = 'TOK_INK';
  readonly hostBackgroundRole: ReaderAppColorRole = 'app.bookshelf.sheetSurface';
  readonly hostMaskRole: ReaderAppColorRole = 'TOK_SS_DRAWER_SCRIM';
  readonly hostElevation: ReaderSurfaceElevationKind = 'sheet';
  readonly hostBorderWidth: number = 1;
  readonly hostBorderRole: ReaderAppColorRole = 'app.border.modalHighlight';
  readonly compactHeader: boolean = false;
  readonly closeSize: number = 44;
  readonly closeIcon: number = 18;
  readonly titleGap: number = 8;

  constructor(compactHeader: boolean = false) {
    this.compactHeader = compactHeader;
    if (compactHeader) {
      this.handleWidth = 34; this.handleHeight = 4;
      this.handleTop = 10; this.handleBottom = 7;
      this.titleHeight = 44; this.titleBottom = 12;
      this.titleFontFamily = 'ReaderNotoSansSCUIMedium';
      this.titleFontWeight = 500; this.titleFontSize = 16; this.titleLineHeight = 24;
    }
  }
}

const SHEET_SPECS: Record<SheetSpecId, SheetSurfaceSpec> = {
  'bookshelf-book-action': new SheetSurfaceSpec(),
  'search-result-filter': new SheetSurfaceSpec(true),
  'search-task-status': new SheetSurfaceSpec(true),
};

export function resolveSheetSpec(id: SheetSpecId): SheetSurfaceSpec {
  return SHEET_SPECS[id];
}

/** Shared content-only action-sheet recipes. Hosts still own the scrim,
 * placement and dismissal; these values keep row rhythm identical across
 * reading, bookshelf and future download action surfaces. */
export type ActionSheetSpecId = 'grouped' | 'quick' | 'bookshelf';

/** All action-sheet owners share one finite row recipe. Variant names keep
 * existing business API compatibility; none selects a different appearance. */
export class ActionSheetSurfaceSpec {
  readonly regularFontFamily: string = 'ReaderNotoSansSCUIRegular';
  readonly regularFontWeight: number = 400;
  readonly labelFontFamily: string = 'ReaderNotoSansSCUIMedium';
  readonly labelFontWeight: number = 500;
  readonly inkRole: ReaderAppColorRole = 'TOK_INK';
  readonly mutedRole: ReaderAppColorRole = 'TOK_MUTED';
  readonly dangerRole: ReaderAppColorRole = 'TOK_DOWNLOAD_DANGER';
  readonly lineRole: ReaderAppColorRole = 'TOK_ROW_DIVIDER';
  readonly groupRole: ReaderAppColorRole = 'TOK_SS_WINDOW_BG';
  readonly iconContainer: number = 36;
  readonly iconRadius: number = 14;
  readonly rowHeight: number = SOURCE_SWITCH_VISUAL.rowHeight;
  readonly rowPaddingY: number = SOURCE_SWITCH_VISUAL.rowPaddingY;
  readonly rowGap: number = SOURCE_SWITCH_VISUAL.rowGap;
  readonly rowInsetLeft: number = 0;
  readonly rowInsetRight: number = 0;
  readonly labelFontSize: number = SOURCE_SWITCH_VISUAL.sourceNameFontSize;
  readonly labelLineHeight: number = SOURCE_SWITCH_VISUAL.sourceNameLineHeight;
  readonly secondaryFontSize: number = SOURCE_SWITCH_VISUAL.latestChapterFontSize;
  readonly secondaryLineHeight: number = SOURCE_SWITCH_VISUAL.latestChapterLineHeight;
  readonly trailingFontSize: number = SOURCE_SWITCH_VISUAL.latestChapterFontSize;
  readonly trailingLineHeight: number = SOURCE_SWITCH_VISUAL.latestChapterLineHeight;
  readonly iconSize: number = 22;
  readonly chevronSize: number = 14;
  readonly dividerHeight: number = 0.5;
  readonly dividerInset: number = 48;
}
const ACTION_SHEET_SPEC: ActionSheetSurfaceSpec = new ActionSheetSurfaceSpec();
export function resolveActionSheetSpec(_id: ActionSheetSpecId): ActionSheetSurfaceSpec {
  return ACTION_SHEET_SPEC;
}

/**
 * Menu/popup surfaces use the same data-only registry as dialogs. The
 * consumer keeps labels, icons, enabled state and callbacks; this contract
 * owns frame geometry, touch rows and visual roles.
 */
export type PopupSpecId = 'bookshelf-more-menu' | 'reader-more-menu' | 'source-switch-window' | 'tts-config-manager' | 'tts-config-picker' | 'settings-select-tablet';

export interface PopupSurfaceSpecInit {
  actionMutesContent?: boolean;
  height: number;
  width: number;
  pointerWidth: number;
  pointerHeight: number;
  actionHeight: number;
  actionCount: number;
  trailingExtension: number;
  anchorOverlap: number;
  borderWidth: number;
  borderRadius: number;
  shadowRadius: number;
  shadowOffsetY: number;
  actionPaddingLeft: number;
  actionPaddingRight: number;
  actionIconSize: number;
  dividerInset: number;
  dividerHeight: number;
  pointerPoints: Array<Array<number>>;
  surfaceBackgroundRole: ReaderAppColorRole;
  surfaceBorderRole: ReaderAppColorRole;
  surfaceShadowRole: ReaderAppColorRole;
  pointerFillRole: ReaderAppColorRole;
  pointerStrokeRole: ReaderAppColorRole;
  actionTextRole: ReaderAppColorRole;
  dividerRole: ReaderAppColorRole;
  actionFontFamily: string;
  actionFontSize: number;
  actionLineHeight: number;
}

export class PopupSurfaceSpec {
  readonly actionFontWeight: number = 500;
  readonly actionMutesContent: boolean;
  readonly height: number;
  readonly width: number;
  readonly pointerWidth: number;
  readonly pointerHeight: number;
  readonly actionHeight: number;
  readonly actionCount: number;
  readonly trailingExtension: number;
  readonly anchorOverlap: number;
  readonly borderWidth: number;
  readonly borderRadius: number;
  readonly shadowRadius: number;
  readonly shadowOffsetY: number;
  readonly actionPaddingLeft: number;
  readonly actionPaddingRight: number;
  readonly actionIconSize: number;
  readonly dividerInset: number;
  readonly dividerHeight: number;
  readonly pointerPoints: Array<Array<number>>;
  readonly surfaceBackgroundRole: ReaderAppColorRole;
  readonly surfaceBorderRole: ReaderAppColorRole;
  readonly surfaceShadowRole: ReaderAppColorRole;
  readonly pointerFillRole: ReaderAppColorRole;
  readonly pointerStrokeRole: ReaderAppColorRole;
  readonly actionTextRole: ReaderAppColorRole;
  readonly dividerRole: ReaderAppColorRole;
  readonly actionFontFamily: string;
  readonly actionFontSize: number;
  readonly actionLineHeight: number;

  constructor(init: PopupSurfaceSpecInit) {
    this.actionMutesContent = init.actionMutesContent ?? false;
    this.height = init.height;
    this.width = init.width;
    this.pointerWidth = init.pointerWidth;
    this.pointerHeight = init.pointerHeight;
    this.actionHeight = init.actionHeight;
    this.actionCount = init.actionCount;
    this.trailingExtension = init.trailingExtension;
    this.anchorOverlap = init.anchorOverlap;
    this.borderWidth = init.borderWidth;
    this.borderRadius = init.borderRadius;
    this.shadowRadius = init.shadowRadius;
    this.shadowOffsetY = init.shadowOffsetY;
    this.actionPaddingLeft = init.actionPaddingLeft;
    this.actionPaddingRight = init.actionPaddingRight;
    this.actionIconSize = init.actionIconSize;
    this.dividerInset = init.dividerInset;
    this.dividerHeight = init.dividerHeight;
    this.pointerPoints = init.pointerPoints;
    this.surfaceBackgroundRole = init.surfaceBackgroundRole;
    this.surfaceBorderRole = init.surfaceBorderRole;
    this.surfaceShadowRole = init.surfaceShadowRole;
    this.pointerFillRole = init.pointerFillRole;
    this.pointerStrokeRole = init.pointerStrokeRole;
    this.actionTextRole = init.actionTextRole;
    this.dividerRole = init.dividerRole;
    this.actionFontFamily = init.actionFontFamily;
    this.actionFontSize = init.actionFontSize;
    this.actionLineHeight = init.actionLineHeight;
  }

  get actionsHeight(): number {
    return this.actionHeight * this.actionCount;
  }

  get expandedHeight(): number {
    return this.pointerHeight + this.actionsHeight;
  }

  get collapsedHeight(): number {
    return this.pointerHeight + this.actionHeight;
  }

  /** Authored row height plus the enlarged line box, so labels keep their
   * original padding instead of being clipped by the fixed popup frame. */
  actionHeightFor(fontScale: number): number {
    const scale = Number.isFinite(fontScale) && fontScale > 0 ? Math.max(1, fontScale) : 1;
    return Math.ceil(this.actionHeight + this.actionLineHeight * Math.max(0, scale - 1));
  }

  expandedHeightFor(fontScale: number): number {
    return this.pointerHeight + this.actionHeightFor(fontScale) * this.actionCount;
  }

  collapsedHeightFor(fontScale: number): number {
    return this.pointerHeight + this.actionHeightFor(fontScale);
  }
}

const POPUP_SPECS: Record<PopupSpecId, PopupSurfaceSpec> = {
  // Figma interaction registry 1982:313 / approved phone reference 4572:1796.
  // These values mirror the existing menu until the popup family is migrated
  // and the visual baseline is reviewed as a batch.
  'bookshelf-more-menu': new PopupSurfaceSpec({
    actionMutesContent: true,
    height: 0,
    width: 176, pointerWidth: 24, pointerHeight: 12,
    actionHeight: 50, actionCount: 5,
    trailingExtension: 11, anchorOverlap: 5,
    borderWidth: 1, borderRadius: 16,
    shadowRadius: 28, shadowOffsetY: 10,
    actionPaddingLeft: 18, actionPaddingRight: 16,
    actionIconSize: 24, dividerInset: 16, dividerHeight: 1,
    pointerPoints: [[0, 12], [12, 0], [24, 12]],
    surfaceBackgroundRole: 'app.surface.menuSolid',
    surfaceBorderRole: 'app.border.menu',
    surfaceShadowRole: 'app.shadow.menu',
    pointerFillRole: 'app.surface.menuSolid',
    pointerStrokeRole: 'app.border.menu',
    actionTextRole: 'app.text.heading',
    dividerRole: 'app.border.menuDivider',
    actionFontFamily: 'ReaderNotoSansSC', actionFontSize: 15, actionLineHeight: 22,
  }),
  // Reader control More menu. It shares the bookshelf More surface family,
  // while keeping its audited three-row height and native popup dimensions.
  // The action state and labels remain owned by ReaderControlPanel.
  'reader-more-menu': new PopupSurfaceSpec({
    height: 0,
    width: 176, pointerWidth: 24, pointerHeight: 12,
    actionHeight: 50, actionCount: 3,
    trailingExtension: 11, anchorOverlap: 5,
    borderWidth: 1, borderRadius: 16,
    shadowRadius: 28, shadowOffsetY: 10,
    actionPaddingLeft: 18, actionPaddingRight: 18,
    actionIconSize: 0, dividerInset: 16, dividerHeight: 1,
    pointerPoints: [[0, 12], [12, 0], [24, 12]],
    surfaceBackgroundRole: 'app.surface.menuSolid',
    surfaceBorderRole: 'app.border.menu',
    surfaceShadowRole: 'app.shadow.menu',
    pointerFillRole: 'app.surface.menuSolid',
    pointerStrokeRole: 'app.border.menu',
    actionTextRole: 'TOK_INK',
    dividerRole: 'app.border.menuDivider',
    actionFontFamily: 'ReaderNotoSansSC', actionFontSize: 15, actionLineHeight: 22,
  }),
  // Source-switch window: the content state machine remains in the consumer;
  // this entry owns the finite outer frame used by phone and tablet hosts.
  'source-switch-window': new PopupSurfaceSpec({
    height: 385,
    width: 300, pointerWidth: 0, pointerHeight: 0,
    actionHeight: 0, actionCount: 0,
    trailingExtension: 0, anchorOverlap: 0,
    borderWidth: 1, borderRadius: 20,
    shadowRadius: 0, shadowOffsetY: 0,
    actionPaddingLeft: 0, actionPaddingRight: 0,
    actionIconSize: 0, dividerInset: 0, dividerHeight: 0,
    pointerPoints: [],
    surfaceBackgroundRole: 'TOK_SS_WINDOW_BG',
    surfaceBorderRole: 'TOK_SS_WINDOW_BORDER',
    surfaceShadowRole: 'TOK_SS_WINDOW_BORDER',
    pointerFillRole: 'TOK_SS_WINDOW_BG',
    pointerStrokeRole: 'TOK_SS_WINDOW_BORDER',
    actionTextRole: 'TOK_SS_FOOTER_TEXT',
    dividerRole: 'TOK_SS_WINDOW_BORDER',
    actionFontFamily: 'ReaderInter', actionFontSize: 0, actionLineHeight: 0,
  }),
  // TTS manager content-cover card. The form remains owned by the TTS
  // consumer; this finite entry owns only the existing modal frame geometry
  // and visual roles so the host does not repeat its panel contract.
  'tts-config-manager': new PopupSurfaceSpec({
    height: 0, width: 364, pointerWidth: 0, pointerHeight: 0,
    actionHeight: 0, actionCount: 0,
    trailingExtension: 0, anchorOverlap: 0,
    borderWidth: 0.5, borderRadius: 22,
    shadowRadius: 48, shadowOffsetY: 18,
    actionPaddingLeft: 0, actionPaddingRight: 0,
    actionIconSize: 0, dividerInset: 0, dividerHeight: 0,
    pointerPoints: [],
    surfaceBackgroundRole: 'app.surface.readerConfig',
    surfaceBorderRole: 'app.border.readerConfig',
    surfaceShadowRole: 'app.shadow.readerConfig',
    pointerFillRole: 'app.surface.readerConfig',
    pointerStrokeRole: 'app.border.readerConfig',
    actionTextRole: 'TOK_TTS_INK', dividerRole: 'app.border.readerConfig',
    actionFontFamily: 'ReaderNotoSansSCUIRegular', actionFontSize: 0, actionLineHeight: 0,
  }),
  // Reader picker keeps its dedicated material and legacy physical shadow;
  // the bounded renderer does not maintain a second private geometry tuple.
  'tts-config-picker': new PopupSurfaceSpec({
    height: 0, width: 364, pointerWidth: 0, pointerHeight: 0,
    actionHeight: 0, actionCount: 0,
    trailingExtension: 0, anchorOverlap: 0,
    borderWidth: 0.5, borderRadius: 14,
    shadowRadius: 36, shadowOffsetY: 14,
    actionPaddingLeft: 0, actionPaddingRight: 0,
    actionIconSize: 0, dividerInset: 0, dividerHeight: 0,
    pointerPoints: [],
    surfaceBackgroundRole: 'app.surface.readerConfig',
    surfaceBorderRole: 'app.border.readerConfig',
    surfaceShadowRole: 'app.shadow.readerConfigSecondary',
    pointerFillRole: 'app.surface.readerConfig',
    pointerStrokeRole: 'app.border.readerConfig',
    actionTextRole: 'TOK_TTS_INK', dividerRole: 'app.border.readerConfig',
    actionFontFamily: 'ReaderNotoSansSCUIRegular', actionFontSize: 0, actionLineHeight: 0,
  }),
  // Tablet settings selector popover.  The options and selection callbacks
  // remain owned by SettingsSelectOverlay; this entry owns the finite panel
  // frame and row geometry that used to be duplicated in that consumer.
  'settings-select-tablet': new PopupSurfaceSpec({
    height: 0, width: 160, pointerWidth: 0, pointerHeight: 0,
    actionHeight: 42, actionCount: 0,
    trailingExtension: 0, anchorOverlap: 6,
    borderWidth: 1, borderRadius: 10,
    shadowRadius: 24, shadowOffsetY: 8,
    actionPaddingLeft: 14, actionPaddingRight: 14,
    actionIconSize: 14, dividerInset: 14, dividerHeight: 1,
    pointerPoints: [],
    surfaceBackgroundRole: 'app.surface.menuSolid',
    surfaceBorderRole: 'app.border.menu',
    surfaceShadowRole: 'app.shadow.selectPanel',
    pointerFillRole: 'app.surface.menuSolid',
    pointerStrokeRole: 'app.border.menu',
    actionTextRole: 'app.text.heading',
    dividerRole: 'app.border.control',
    actionFontFamily: 'ReaderNotoSansSCUIRegular', actionFontSize: 13, actionLineHeight: 16,
  }),
};

export function resolvePopupSpec(id: PopupSpecId): PopupSurfaceSpec {
  return POPUP_SPECS[id];
}
