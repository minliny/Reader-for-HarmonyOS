import type { UIContext } from '@ohos.arkui.UIContext';
import { FrameCallback } from '@kit.ArkUI';
import type { ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderReadingTopBar } from '../../../ui/chrome/ReaderReadingTopBar';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_READER_CONTROL_SOURCE_ACTION } from '../../../ui/foundation/ReaderTypography';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { applyReaderPopupMaterial } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { PopupSurfaceSpec, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import { READER_CONTROL_HOME_SHORT_ACTION_HEIGHT } from './ReaderControlGeometry';
import type { ReaderControlMotionFrame } from './ReaderControlMotionGeometry';
import type { ReaderControlIntent, ReaderControlIntentResult, ReaderControlPanelFacts } from './ReaderControlPanelNativeContract';
import type { ReaderControlSessionState } from './ReaderControlSessionState';
import { readReaderControlNativeActor, readReaderControlPopupOwner,
  type MotionActor, type ReaderControlPopupOwnerObservation } from './ReaderControlVerificationMotion';
import type { ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';

interface ReaderControlMenuVerificationFrame {
  frameTimeNs: number;
  menu: MotionActor;
  popupOwner: ReaderControlPopupOwnerObservation;
  trigger?: MotionActor;
  mountedActions: string[];
}

interface ReaderControlMenuNativeState {
  visible: boolean;
  generation: number;
}

interface ReaderControlMenuNativeTrace extends ReaderControlMenuNativeState {
  layout: string;
  frames: ReaderControlMenuVerificationFrame[];
}

class ReaderControlMoreFrameCallback extends FrameCallback {
  private readonly callback: (time: number) => void;

  constructor(callback: (time: number) => void) {
    super();
    this.callback = callback;
  }

  onFrame(time: number): void { this.callback(time); }
  onIdle(_remaining: number): void {}
}

/** The mounted panel owns the @State reference. Only facts that affect native
 * popup painting are tracked. Tickets and measured-width reuse are private. */
@Observed
export class ReaderControlTopBarPaint {
  @Track visible: boolean = false;
  @Track topAnchor: ReaderRectVp | undefined = undefined;
  @Track shortAnchor: ReaderRectVp | undefined = undefined;
}

export interface ReaderControlTopBarOrigin {
  readonly x: number;
  readonly y: number;
}

export interface ReaderControlTopBarView {
  readonly paint: () => ReaderControlTopBarPaint;
  readonly facts: () => ReaderControlPanelFacts;
  readonly layout: () => ReaderControlLayoutSnapshot;
  readonly frame: () => ReaderControlMotionFrame;
  readonly visualSession: () => ReaderControlSessionState;
  readonly runtimeMounted: () => boolean;
  readonly scheme: () => string;
  readonly buildLeading: () => void;
  readonly buildTrailing: () => void;
  readonly buildMoreMenu: (generation: number) => void;
  readonly uiContext: () => UIContext;
  readonly origin: () => ReaderControlTopBarOrigin;
  readonly editingMetricsRevision: () => number;
  readonly popupMaterial: () => ReaderSurfaceMaterialDecision;
  readonly directSheetVisible: () => boolean;
  readonly shortHomeContentInput: () => boolean;
  readonly currentOwnerScope: () => string;
  readonly guardAction: (action: () => void) => () => void;
  readonly onIntent: (intent: ReaderControlIntent) => ReaderControlIntentResult;
  readonly syncProgressInput: () => void;
  readonly refreshDockPlacement: () => void;
  readonly reportBackdropRegions: () => void;
}

/** Owns one More menu shared by the regular and short-window controls.
 * Native callbacks are admitted only by their captured menu generation and
 * original mounted control scope. */
export class ReaderControlTopBarOwner {
  private readonly view: ReaderControlTopBarView;
  private moreMenuGeneration: number = 0;
  private moreMenuRecoveryIdentity: string = '';
  private moreMenuMeasuredWidth: number = 0;
  private moreMenuWidthKey: string = '';
  private moreMenuOwnerScope: string = '';
  private verificationMenuTicket: number = 0;
  private verificationPopupOwnerId: number = -1;
  private backdropRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(view: ReaderControlTopBarView) {
    this.view = view;
  }

  facts(): ReaderControlPanelFacts { return this.view.facts(); }
  layout(): ReaderControlLayoutSnapshot { return this.view.layout(); }
  frame(): ReaderControlMotionFrame { return this.view.frame(); }
  scheme(): string { return this.view.scheme(); }
  buildLeading(): void { this.view.buildLeading(); }
  buildTrailing(): void { this.view.buildTrailing(); }
  directSheetVisible(): boolean { return this.view.directSheetVisible(); }
  popupMaterial(): ReaderSurfaceMaterialDecision { return this.view.popupMaterial(); }
  menuVisible(): boolean { return this.view.paint().visible; }
  topBarRect(): ReaderControlBackdropRect { return this.backdropRect; }

  measureTopBar(current: Area): void {
    this.backdropRect = { x: Number(current.globalPosition.x), y: Number(current.globalPosition.y),
      width: Number(current.width), height: Number(current.height) };
    this.view.reportBackdropRegions();
  }

  retireMenuTrace(): void {
    this.verificationMenuTicket += 1;
  }

  toggleMoreMenu(): void {
    this.setMoreMenuVisible(!this.menuVisible());
  }

  guardAction(action: () => void): () => void { return this.view.guardAction(action); }

  exitReading(): void { this.view.onIntent({ kind: 'exitReading' }); }

  switchSource(shortWindow: boolean): void {
    this.view.onIntent({ kind: 'sourceSwitch', focusId: this.sourceFocusId(shortWindow) });
  }

  sourceFocusId(shortWindow: boolean): string {
    return sourceSwitchTriggerFocusId(this.facts().document.source.id, this.facts().document.source.bookId,
      shortWindow ? 'reader-control-short' : 'reader-control');
  }

  isLocalBook(): boolean {
    return this.facts().document.source.id === 'local';
  }

  private sourceLabel(): string {
    const label = this.facts().document.source.name.trim();
    if (this.isLocalBook()) {
      return label.length > 0 && label !== this.facts().document.source.id ? label : '本地书籍';
    }
    return label.length > 0 && label !== this.facts().document.source.id ? label : '在线书源';
  }

  topBarSubtitle(): string {
    const chapter = this.facts().document.chapterTitle.trim();
    return chapter.length > 0 ? `${chapter} · ${this.sourceLabel()}` : this.sourceLabel();
  }

  recoveryIdentityChanged(): void {
    if (this.menuVisible()) this.setMoreMenuVisible(false);
    this.moreMenuRecoveryIdentity = '';
  }

  private setMoreMenuVisible(visible: boolean): void {
    if (this.menuVisible() === visible) return;
    if (visible && (!this.view.runtimeMounted() || !this.facts().geometry.inputEnabled || this.facts().geometry.obscured || (this.facts().geometry.temporary.layer !== '') || this.frame().visibility <= 0)) return;
    if (visible) {
      this.moreMenuGeneration += 1;
      this.moreMenuRecoveryIdentity = this.facts().document.recovery.identity;
      this.moreMenuOwnerScope = this.view.currentOwnerScope();
      this.moreMenuMeasuredWidth = 0;
      this.moreMenuWidthKey = '';
    }
    this.view.paint().visible = visible;
    this.facts().geometry.verification?.layer('more', visible, this.moreMenuGeneration, this.view.visualSession());
    this.observeMoreMenuFrames(visible, this.moreMenuGeneration);
    this.view.syncProgressInput();
    this.view.onIntent({ kind: 'temporaryLayerChange', active: visible, layer: 'moreMenu' });
    this.view.refreshDockPlacement();
  }

  private observeMoreMenuFrames(visible: boolean, generation: number): void {
    const verification = this.facts().geometry.verification;
    if (verification?.observing() !== true) return;
    const ticket = ++this.verificationMenuTicket;
    if (visible) this.verificationPopupOwnerId = -1;
    const frames: ReaderControlMenuVerificationFrame[] = [];
    const context = this.view.uiContext();
    const target = this.layout().topBarVisible ? 'reader-control-more' : 'reader-control-more-short';
    const trigger = readReaderControlNativeActor(context, target);
    const menuId = 'reader-control-more-menu';
    const collect = (frameTimeNs: number): void => {
      if (!this.view.runtimeMounted() || ticket !== this.verificationMenuTicket || verification.observing() !== true) return;
      const menu = readReaderControlNativeActor(context, menuId);
      const actions: string[] = [];
      if (menu.mounted) {
        for (const action of ['info','refresh','download','recovery']) {
          const node = context.getAttachedFrameNodeById(menuId + '-item-' + action);
          if (node !== null && !node.isDisposed() && node.isAttached() && node.isVisible()) actions.push(action);
        }
      }
      const popupOwner = readReaderControlPopupOwner(context, menu, this.verificationPopupOwnerId);
      if (visible && popupOwner.status === 'measured' && popupOwner.relation === 'scroll-ancestor' &&
        popupOwner.uniqueId !== undefined) this.verificationPopupOwnerId = popupOwner.uniqueId;
      const frame: ReaderControlMenuVerificationFrame = { frameTimeNs: frameTimeNs, menu: menu, popupOwner: popupOwner,
        trigger: frames.length === 0 ? trigger : undefined, mountedActions: actions };
      frames.push(frame);
      // The system owns Popup animation. Read a bounded normal frame window;
      // a static/unavailable native stream is classified as an evidence gap.
      if (frames.length < 35) {
        context.postFrameCallback(new ReaderControlMoreFrameCallback(collect));
      } else {
        const trace: ReaderControlMenuNativeTrace = {
          visible: visible, generation: generation, layout: target, frames: frames,
        };
        verification.effect('more-popup', 'trace', trace, 'motion');
      }
    };
    context.postFrameCallback(new ReaderControlMoreFrameCallback(collect));
  }

  dismissMoreMenu(generation: number = this.moreMenuGeneration): void {
    if (generation === this.moreMenuGeneration) this.setMoreMenuVisible(false);
  }

  performMoreAction(action: 'info' | 'refresh' | 'download' | 'recovery', generation: number = this.moreMenuGeneration): void {
    if (generation !== this.moreMenuGeneration || !this.menuVisible() || !this.view.runtimeMounted() ||
      !this.facts().geometry.inputEnabled || this.facts().geometry.obscured || this.frame().visibility <= 0 ||
      this.moreMenuOwnerScope !== this.view.currentOwnerScope()) return;
    if (action === 'refresh' && !this.facts().document.allowChapterRefresh) return;
    if (action === 'download' && !this.facts().document.download.bookEnabled) return;
    if (action === 'recovery' && (!this.facts().document.recovery.available || this.moreMenuRecoveryIdentity.length === 0 ||
      this.moreMenuRecoveryIdentity !== this.facts().document.recovery.identity)) return;
    const recoveryIdentity = this.moreMenuRecoveryIdentity;
    this.dismissMoreMenu(generation);
    if (action === 'info') this.view.onIntent({ kind: 'openBookInfo' });
    else if (action === 'refresh') this.view.onIntent({ kind: 'refreshChapter' });
    else if (action === 'recovery') this.view.onIntent({ kind: 'openRecovery', identity: recoveryIdentity });
    else this.view.onIntent({ kind: 'downloadBook' });
  }

  private readerMoreMenuWidth(): number {
    const surface = this.readerMoreSurfaceSpec();
    const labels = this.readerMoreActions().map((action: ReaderMenuActionView): string => action.label);
    const key = JSON.stringify([labels, this.facts().geometry.minimum.metricsRevision, this.facts().geometry.minimum.key,
      surface.actionFontFamily, surface.actionFontSize, surface.actionFontWeight]);
    // Reuse ordinary motion publications. A live label/font publication owns
    // a new measurement even while the same native popup remains open.
    if (this.menuVisible() && key !== this.moreMenuWidthKey) {
      this.moreMenuWidthKey = key;
      this.moreMenuMeasuredWidth = 0;
      try {
        const context = this.view.uiContext();
        let width: number = 0;
        labels.forEach((label: string): void => {
          const measured = context.getMeasureUtils().measureTextSize({
            textContent: label, fontFamily: surface.actionFontFamily,
            fontSize: `${surface.actionFontSize}fp`, fontWeight: `${surface.actionFontWeight}`,
          });
          const measuredWidth = context.px2vp(Number(measured.width));
          if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) throw new Error('Invalid More label width');
          width = Math.max(width, measuredWidth);
        });
        this.moreMenuMeasuredWidth = Math.ceil(width) + surface.actionPaddingLeft + surface.actionPaddingRight;
      } catch (_) {
        // Native text measurement can be unavailable during window changes.
        // Keep the authored bounded menu until the next font/input revision.
        this.moreMenuMeasuredWidth = surface.width;
      }
    }
    return Math.max(surface.width, this.moreMenuMeasuredWidth);
  }

  recordMoreAnchor(area: Area, shortWindow: boolean): void {
    const left = Number(area.globalPosition.x);
    const top = Number(area.globalPosition.y);
    const width = Number(area.width);
    const height = Number(area.height);
    if (!Number.isFinite(left) || !Number.isFinite(top) || width <= 0 || height <= 0) return;
    const current = shortWindow ? this.view.paint().shortAnchor : this.view.paint().topAnchor;
    if (current !== undefined && current.left === left && current.top === top &&
      current.width === width && current.height === height) return;
    const anchor = new ReaderRectVp(left, top, width, height);
    if (shortWindow) this.view.paint().shortAnchor = anchor;
    else this.view.paint().topAnchor = anchor;
  }

  readerMoreAnchor(): ReaderRectVp | undefined {
    return this.layout().topBarVisible ? this.view.paint().topAnchor : this.view.paint().shortAnchor;
  }

  readerMorePopupRect(): ReaderRectVp {
    this.view.editingMetricsRevision();
    const metrics = readerWindowMetrics();
    const layout = this.layout();
    const origin = this.view.origin();
    const host = new ReaderRectVp(origin.x, origin.y, layout.viewportWidth, layout.viewportHeight);
    const anchor = this.readerMoreAnchor();
    const viewport = readerOverlayViewport(metrics, host, new ReaderInsetsVp(12, 8, 12, 8), anchor);
    const surface = this.readerMoreSurfaceSpec();
    const actionHeight = readerScaledControlHeight(surface.actionHeight, surface.actionLineHeight, metrics.systemFontScale);
    const height = readerOverlayListHeight(0, actionHeight, this.readerMoreActions().length, 0,
      0, 0, surface.borderWidth, surface.pointerHeight);
    return readerOverlayPanel(viewport, this.readerMoreMenuWidth(), height, 'anchor-end', anchor, 8);
  }

  readerMoreSurfaceSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('reader-more-menu');
  }

  readerMorePopupOptions(): CustomPopupOptions {
    const generation = this.moreMenuGeneration;
    const surface = this.readerMoreSurfaceSpec();
    const density = readerWindowMetrics().densityPixels;
    const material = this.view.popupMaterial();
    const anchor = this.readerMoreAnchor();
    const rect = this.readerMorePopupRect();
    const options: CustomPopupOptions = {
      builder: (): void => { this.view.buildMoreMenu(generation); },
      placement: anchor !== undefined && rect.top < anchor.top ? Placement.TopRight : Placement.BottomRight,
      width: rect.width,
      offset: anchor === undefined ? undefined : { x: rect.left - (anchor.left + anchor.width - rect.width), y: 0 },
      enableArrow: true, arrowWidth: surface.pointerWidth, arrowHeight: surface.pointerHeight,
      radius: surface.borderRadius,
      arrowPointPosition: ArrowPointPosition.CENTER,
      targetSpace: 8,
      popupColor: material.native ? Color.Transparent : readerAppColor(surface.surfaceBackgroundRole, this.scheme()),
      backgroundBlurStyle: BlurStyle.NONE,
      borderWidth: material.native ? 0 : surface.borderWidth,
      borderLinearGradient: material.native ? undefined : { colors: [
        [readerAppColor(surface.surfaceBorderRole, this.scheme()), 0],
        [readerAppColor(surface.surfaceBorderRole, this.scheme()), 1],
      ] },
      shadow: material.native ? undefined : { radius: surface.shadowRadius * density,
        color: readerAppColor(surface.surfaceShadowRole, this.scheme()),
        offsetY: surface.shadowOffsetY * density },
      autoCancel: true, mask: true, focusable: true, followTransformOfTarget: true,
      transition: this.facts().geometry.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : undefined,
      onStateChange: (event: PopupStateChangeParam): void => {
        const verification = generation === this.moreMenuGeneration ? this.facts().geometry.verification : undefined;
        if (verification?.observing() === true) {
          const facts: ReaderControlMenuNativeState = { visible: event.isVisible, generation: generation };
          verification.effect('more-popup', 'native-state', facts);
        }
        if (!event.isVisible) this.dismissMoreMenu(generation);
      },
    };
    applyReaderPopupMaterial(options, material);
    return options;
  }

  private readerMoreActionEnabled(action: 'info' | 'refresh' | 'download' | 'recovery'): boolean {
    return this.facts().geometry.inputEnabled && !this.facts().geometry.obscured &&
      (!this.menuVisible() || this.moreMenuOwnerScope === this.view.currentOwnerScope()) &&
      (action !== 'refresh' || this.facts().document.allowChapterRefresh) &&
      (action !== 'download' || this.facts().document.download.bookEnabled) &&
      (action !== 'recovery' || this.facts().document.recovery.available);
  }

  readerMoreActions(): ReaderMenuActionView[] {
    const actions: ReaderMenuActionView[] = [
      new ReaderMenuActionView('info', '书籍信息', this.readerMoreActionEnabled('info')),
      new ReaderMenuActionView('refresh', '刷新本章', this.readerMoreActionEnabled('refresh')),
      new ReaderMenuActionView('download', this.facts().document.download.bookActive ? '正在下载章节…' : '下载全部章节',
        this.readerMoreActionEnabled('download')),
    ];
    if (this.facts().document.recovery.available) actions.push(new ReaderMenuActionView('recovery', '待处理事项', this.readerMoreActionEnabled('recovery')));
    return actions;
  }

  topBarInputEnabled(): boolean {
    return this.view.runtimeMounted() && this.facts().geometry.inputEnabled && ((this.view.onIntent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.facts().geometry.obscured &&
      this.layout().topBarVisible && this.frame().topBar.opacity > 0;
  }

  sourceActionHeight(): number {
    return Math.max(44, this.layout().topBarHeight - 10);
  }

  shortWindowActionInput(): boolean {
    return this.view.runtimeMounted() && !this.layout().topBarVisible && this.view.shortHomeContentInput();
  }
}

export interface ReaderControlTopBarSlot {
  readonly owner: ReaderControlTopBarOwner;
}

interface ReaderControlMoreMenuInput extends ReaderControlTopBarSlot {
  readonly generation: number;
}

@Builder
export function ReaderControlTopBar($$: ReaderControlTopBarSlot) {
  Stack({ alignContent: Alignment.Top }) {
    ReaderControlTopBarContent($$);
  }
    .id('reader-control-motion-topbar')
    .width($$.owner.layout().topBarWidth).height($$.owner.layout().topBarHeight)
    .position({ x: ($$.owner.layout().viewportWidth - $$.owner.layout().topBarWidth) / 2,
      y: $$.owner.layout().topBarTop })
    .translate({ y: $$.owner.frame().topBar.translateY })
    .opacity($$.owner.layout().topBarVisible ? $$.owner.frame().topBar.opacity : 0)
    .enabled(!$$.owner.directSheetVisible() && $$.owner.topBarInputEnabled() && $$.owner.frame().topBar.opacity > 0)
    .hitTestBehavior(!$$.owner.directSheetVisible() && $$.owner.layout().topBarVisible && $$.owner.frame().topBar.opacity > 0 ?
      HitTestMode.Transparent : HitTestMode.None)
    .accessibilityLevel($$.owner.layout().topBarVisible && $$.owner.frame().topBar.opacity > 0 &&
      ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.menuVisible()) ? 'auto' : 'no-hide-descendants')
    .onAreaChange((_previous: Area, current: Area): void => $$.owner.measureTopBar(current));
}

@Builder
export function ReaderControlMoreMenu($$: ReaderControlMoreMenuInput) {
  ReaderActionMenuSurface({
    specId: 'reader-more-menu', nativeId: 'reader-control-more-menu',
    auditAnchoredPopup: true, auditPopupAnchor: $$.owner.readerMoreAnchor(),
    nativePopupMaterial: $$.owner.popupMaterial().native,
    scheme: $$.owner.scheme(), actions: $$.owner.readerMoreActions(),
    viewportHeight: Math.max(0, $$.owner.readerMorePopupRect().height - $$.owner.readerMoreSurfaceSpec().pointerHeight -
      2 * $$.owner.readerMoreSurfaceSpec().borderWidth),
    onAction: (id: string): void => {
      if (id === 'info' || id === 'refresh' || id === 'download' || id === 'recovery') $$.owner.performMoreAction(id, $$.generation);
    },
  });
}

@Builder
function ReaderControlTopBarContent($$: ReaderControlTopBarSlot) {
  ReaderReadingTopBar({ variant: 'reading', barWidth: $$.owner.layout().topBarWidth, barHeight: $$.owner.layout().topBarHeight,
    bookTitle: $$.owner.facts().document.bookTitle, subtitle: $$.owner.topBarSubtitle(), scheme: $$.owner.scheme(),
    inputEnabled: $$.owner.facts().geometry.inputEnabled,
    leading: (): void => { $$.owner.buildLeading(); },
    trailing: (): void => { $$.owner.buildTrailing(); },
  });
}

@Builder
export function ReaderControlTopBarBack($$: ReaderControlTopBarSlot) {
  // The 24vp Back glyph retains its alignment inside a 44vp action target.
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Image($r($$.owner.scheme() === 'night' ? 'app.media.book_detail_back_theme_night' : 'app.media.book_detail_back'))
      .width(24)
      .height(24).accessibilityLevel('no');
  }
  .width(44)
  .height(44)
  .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
  .responseRegion(readerActionTouchRegion(44, 44))
  .attributeModifier(new ReaderActionAccessibility('退出阅读，返回上一页',
    $$.owner.topBarInputEnabled() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.facts().geometry.temporary.layer === 'moreMenu'),
    false, true, new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999), 'nativeButton'))
  .accessibilityLevel($$.owner.menuVisible() || $$.owner.facts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
  .onClick($$.owner.guardAction((): void => {
    if ($$.owner.topBarInputEnabled() && !$$.owner.facts().geometry.obscured && $$.owner.facts().geometry.temporary.layer === '' && !$$.owner.menuVisible()) $$.owner.exitReading();
  }));
}

@Builder
function ReaderControlSourceActionLabel($$: ReaderControlTopBarSlot) {
  Row({ space: 4 }) {
    Image($r($$.owner.scheme() === 'night' ? 'app.media.rc_switch_horizontal_theme_night' : 'app.media.rc_switch_horizontal'))
      .width(14).height(14).accessibilityLevel('no');
    Text('换源').fontFamily(TYPE_READER_CONTROL_SOURCE_ACTION.fontFamily)
      .fontWeight(TYPE_READER_CONTROL_SOURCE_ACTION.fontWeight, { enableVariableFontWeight: true })
      .fontSize(TYPE_READER_CONTROL_SOURCE_ACTION.fontSizeFp).lineHeight(TYPE_READER_CONTROL_SOURCE_ACTION.lineHeightFp)
      .halfLeading(true).fontColor(readerAppColor('TOK_READ_INK', $$.owner.scheme())).maxLines(1);
  }.justifyContent(FlexAlign.Center).opacity($$.owner.isLocalBook() ? 0.45 : 1).accessibilityLevel('no-hide-descendants');
}

@Builder
export function ReaderControlTopBarActions($$: ReaderControlTopBarSlot) {
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    ReaderControlSourceActionLabel($$);
  }.width(62).height($$.owner.sourceActionHeight()).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
  .id($$.owner.sourceFocusId(false))
  .responseRegion(readerActionTouchRegion(62, $$.owner.sourceActionHeight()))
  .attributeModifier(new ReaderActionAccessibility('换源',
    $$.owner.topBarInputEnabled() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.facts().geometry.temporary.layer === 'moreMenu') && !$$.owner.isLocalBook(),
    false, true, new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999), 'nativeButton'))
  .accessibilityLevel($$.owner.menuVisible() || $$.owner.facts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
  .onClick($$.owner.guardAction((): void => {
    // 本地书籍换源置灰不可点; 仅在线书籍可换源。
    if ($$.owner.topBarInputEnabled() && !$$.owner.facts().geometry.obscured && $$.owner.facts().geometry.temporary.layer === '' && !$$.owner.menuVisible() && !$$.owner.isLocalBook()) {
      $$.owner.switchSource(false);
    }
  }));

  // 20vp 图标在独立的 44vp 响应区内居中。
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Image($r($$.owner.scheme() === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots'))
      .width(20)
      .height(20).accessibilityLevel('no');
  }
  .width(44)
  .height(44)
  .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
  .responseRegion(readerActionTouchRegion(44, 44))
  .id('reader-control-more')
  .attributeModifier(new ReaderActionAccessibility('更多',
    $$.owner.topBarInputEnabled() && !$$.owner.facts().geometry.obscured && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.menuVisible()), false, true,
    new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999), 'nativeButton'))
  .onClick($$.owner.guardAction((): void => { if ($$.owner.topBarInputEnabled()) $$.owner.toggleMoreMenu(); }))
  .onAreaChange((_previous: Area, area: Area): void => $$.owner.recordMoreAnchor(area, false))
  .bindPopup($$.owner.menuVisible() && $$.owner.layout().topBarVisible, $$.owner.readerMorePopupOptions());
}

@Builder
export function ReaderControlShortWindowActions($$: ReaderControlTopBarSlot) {
  Scroll() {
  Row({ space: 8 }) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image($r($$.owner.scheme() === 'night' ? 'app.media.book_detail_back_theme_night' : 'app.media.book_detail_back'))
        .width(24).height(24).accessibilityLevel('no');
    }.width(44).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999))
      .enabled($$.owner.shortWindowActionInput() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.facts().geometry.temporary.layer === 'moreMenu'))
      .accessibilityLevel($$.owner.menuVisible() || $$.owner.facts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
      .accessibilityText('退出阅读，返回上一页')
      .onClick($$.owner.guardAction((): void => {
        if ($$.owner.shortWindowActionInput() && $$.owner.facts().geometry.temporary.layer === '' && !$$.owner.menuVisible()) $$.owner.exitReading();
      }));
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      ReaderControlSourceActionLabel($$);
    }.width(76).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999))
      .id($$.owner.sourceFocusId(true))
      .enabled($$.owner.shortWindowActionInput() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.facts().geometry.temporary.layer === 'moreMenu') && !$$.owner.isLocalBook())
      .accessibilityLevel($$.owner.menuVisible() || $$.owner.facts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
      .accessibilityText('换源')
      .onClick($$.owner.guardAction((): void => {
        if ($$.owner.shortWindowActionInput() && $$.owner.facts().geometry.temporary.layer === '' && !$$.owner.menuVisible() && !$$.owner.isLocalBook())
          $$.owner.switchSource(true);
      }));
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image($r($$.owner.scheme() === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots')).width(20).height(20).accessibilityLevel('no');
    }.width(44).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.owner.scheme(), 999))
      .enabled($$.owner.shortWindowActionInput() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.menuVisible()))
      .id('reader-control-more-short')
      .accessibilityText('更多')
      .onClick($$.owner.guardAction((): void => {
        if ($$.owner.shortWindowActionInput() && ($$.owner.facts().geometry.temporary.layer === '' || $$.owner.menuVisible())) $$.owner.toggleMoreMenu();
      }))
      .onAreaChange((_previous: Area, area: Area): void => $$.owner.recordMoreAnchor(area, true))
      .bindPopup($$.owner.menuVisible() && !$$.owner.layout().topBarVisible, $$.owner.readerMorePopupOptions());
  }.width(Math.max(180, $$.owner.frame().content.width)).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).justifyContent(FlexAlign.End);
  }.width($$.owner.frame().content.width).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None).enableScrollInteraction($$.owner.frame().content.width < 180).clip(true);
}
