import type { ReaderAppColorRole } from './ReaderThemeRegistry';

/**
 * Finite dialog surface specs. Data-only registry; the surface component
 * resolves one entry by id, so a shared-spec change propagates to every
 * consumer while a per-variant change stays scoped. Visual values are owned
 * here, not re-derived by callers.
 */
export type DialogSpecId = 'book-removal' | 'json-import' | 'shelf-group' | 'local-import';

export type DialogHeaderFontFamily = 'ReaderNotoSansSC' | 'ReaderNotoSerifSCBold';

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

const DIALOG_SPECS: Record<DialogSpecId, DialogSurfaceSpec> = {
  // Figma Library/BookDetail/DeleteDialog 2269:46. Native CustomDialog host.
  'book-removal': new DialogSurfaceSpec({
    maxWidth: 306, edgeGap: 20, widthPercent: 0, frameMode: 'cap', usesKeyboardSafeArea: false,
    padding: 17, borderRadius: 12,
    backgroundRole: 'TOK_CARD_BG_HI', hasShadow: true, hasBorder: true,
    headerFontSize: 17, headerFontFamily: 'ReaderNotoSansSC', headerTextAlign: TextAlign.Start,
    headerLineHeight: 20,
    // bodyActionsGap stays 0: the shared surface's inner body wrapper owns
    // the 30vp body→actions spacing as the single spacing owner.
    headerGap: 16, bodyActionsGap: 0,
    actionsLayout: 'row', actionHeight: 38, actionBorderRadius: 12, actionUsesPressFeedback: true,
    actionExtendsTouchRegion: true,
    bodyActionsOwnMargin: 30,
    actionPrimarySurfaceRole: 'TOK_SURFACE_PANEL_SOFT', actionPrimaryLabelRole: 'TOK_INK',
  }),
  // Portable JSON acquisition surface. Self-drawn full-height overlay host;
  // the mask and zIndex stay in the caller, only the framed card is shared.
  // The original business order puts the local-file action between the
  // description and the URL form, so only the trailing online-import action
  // uses the shared actions row; the body embeds the local button itself.
  // bodyActionsGap 16 reproduces the original Column({ space: TOK_SPACE_MD })
  // separation between the URL group and the trailing action.
  'json-import': new DialogSurfaceSpec({
    maxWidth: 520, edgeGap: 20, widthPercent: 0, frameMode: 'card-inset', usesKeyboardSafeArea: true,
    padding: 16, borderRadius: 14,
    backgroundRole: 'TOK_SURFACE_SOLID', hasShadow: false, hasBorder: true,
    headerFontSize: 22, headerFontFamily: 'ReaderNotoSerifSCBold', headerTextAlign: TextAlign.Start,
    headerLineHeight: 28,
    headerGap: 16, bodyActionsGap: 16, bodyActionsOwnMargin: 0,
    actionsLayout: 'stack', actionHeight: 44, actionBorderRadius: 8, actionUsesPressFeedback: false,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_PRIMARY_DARK', actionPrimaryLabelRole: 'TOK_ON_PRIMARY',
  }),
  // Index default-group assignment overlay (formerly hand-drawn width('75%')
  // frame). Percentage width is a preserved legacy spec, not a new pattern;
  // no actions row — dismissal is owned by the caller's mask tap.
  'shelf-group': new DialogSurfaceSpec({
    maxWidth: 0, edgeGap: 0, widthPercent: 75, frameMode: 'cap', usesKeyboardSafeArea: false,
    padding: 20, borderRadius: 20,
    backgroundRole: 'TOK_SURFACE_SOLID', hasShadow: false, hasBorder: false,
    // The former inline Column centered its intrinsic title by default. Keep
    // that visual baseline explicit now that the shared header is full-width.
    headerFontSize: 17, headerFontFamily: 'ReaderNotoSansSC', headerTextAlign: TextAlign.Center,
    headerLineHeight: 20,
    headerGap: 12, bodyActionsGap: 0, bodyActionsOwnMargin: 0,
    actionsLayout: 'row', actionHeight: 0, actionBorderRadius: 0, actionUsesPressFeedback: false,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_SURFACE_PANEL_SOFT', actionPrimaryLabelRole: 'TOK_INK',
  }),
  // Local file import keeps its measured state-specific heights and state
  // machine. This entry owns only the outer frame and safe horizontal role.
  'local-import': new DialogSurfaceSpec({
    maxWidth: 350, edgeGap: 20, widthPercent: 0, frameMode: 'card-inset', usesKeyboardSafeArea: true,
    padding: 20, borderRadius: 20,
    backgroundRole: 'TOK_SURFACE_SOLID', hasShadow: true, hasBorder: false,
    headerFontSize: 18, headerFontFamily: 'ReaderNotoSerifSCBold', headerTextAlign: TextAlign.Start,
    headerLineHeight: 24.75,
    headerGap: 17, bodyActionsGap: 16, bodyActionsOwnMargin: 0,
    actionsLayout: 'stack', actionHeight: 44, actionBorderRadius: 22, actionUsesPressFeedback: false,
    actionExtendsTouchRegion: false,
    actionPrimarySurfaceRole: 'TOK_PRIMARY_DARK', actionPrimaryLabelRole: 'TOK_ON_PRIMARY',
  }),
};

export function resolveDialogSpec(id: DialogSpecId): DialogSurfaceSpec {
  return DIALOG_SPECS[id];
}

/**
 * Menu/popup surfaces use the same data-only registry as dialogs. The
 * consumer keeps labels, icons, enabled state and callbacks; this contract
 * owns frame geometry, touch rows and visual roles.
 */
export type PopupSpecId = 'bookshelf-more-menu';

export interface PopupSurfaceSpecInit {
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
}

const POPUP_SPECS: Record<PopupSpecId, PopupSurfaceSpec> = {
  // Figma interaction registry 1982:313 / approved phone reference 4572:1796.
  // These values mirror the existing menu until the popup family is migrated
  // and the visual baseline is reviewed as a batch.
  'bookshelf-more-menu': new PopupSurfaceSpec({
    width: 176, pointerWidth: 24, pointerHeight: 12,
    actionHeight: 50, actionCount: 4,
    trailingExtension: 11, anchorOverlap: 5,
    borderWidth: 1, borderRadius: 16,
    shadowRadius: 28, shadowOffsetY: 10,
    actionPaddingLeft: 18, actionPaddingRight: 16,
    actionIconSize: 24, dividerInset: 16, dividerHeight: 1,
    pointerPoints: [[0, 12], [12, 0], [24, 12]],
    surfaceBackgroundRole: 'app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8',
    surfaceBorderRole: 'app.BookshelfMoreMenu.build.color.FFE3DED6',
    surfaceShadowRole: 'app.BookshelfMoreMenu.build.color.292E261F',
    pointerFillRole: 'app.BookshelfMoreMenu.build.fill.FFFFFCF8',
    pointerStrokeRole: 'app.BookshelfMoreMenu.build.stroke.FFE3DED6',
    actionTextRole: 'app.BookshelfMoreMenu.action.fontColor.FF1F1B17',
    dividerRole: 'app.BookshelfMoreMenu.action.color.FFE8E2DA',
    actionFontFamily: 'ReaderNotoSansSC', actionFontSize: 15, actionLineHeight: 22,
  }),
};

export function resolvePopupSpec(id: PopupSpecId): PopupSurfaceSpec {
  return POPUP_SPECS[id];
}
