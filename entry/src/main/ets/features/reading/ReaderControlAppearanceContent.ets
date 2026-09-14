import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { MotionPointTrack } from '../common/MotionPointTrack';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { motionSpecGet } from '../common/MotionSpec';
import { sampleReaderControlMotionPresentation, ReaderControlMotionPathCache, readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  readerControlMorphScrollPath, sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath, type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSelectPanel } from '../common/ReaderSelectPanel';
import { ReaderSelect } from '../common/ReaderSelect';
import { APPEARANCE_SELECT_MENU_WIDTH,
  appearanceSelectMenuPosition } from '../common/ReaderSelectAppearanceStyle';
import { APPEARANCE_LAYOUT_SURFACE, APPEARANCE_LAYOUT_BORDER, APPEARANCE_LAYOUT_CAPTION,
  READER_CONTROL_APPEARANCE_THEMES, readerControlAppearanceThemeLabel,
  readerControlAppearanceThemeSwatch,
  readerControlAppearanceThemeScheme } from './ReaderControlAppearanceStyle';
import {
  TOK_BORDER_W, TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot, isReaderAppearanceFont, moveReaderAppearanceFontSlot,
  normalizeReaderAppearanceFontOrder,
  readerAppearanceCanStep, type ReaderAppearanceAlignment, type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot, type ReaderAppearanceIndent, type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot, type ReaderAppearanceStepDirection, type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import { readerAppearanceFontSlotFamily, readerAppearanceFontSlotLabel } from './ReaderAppearanceRenderStyle';
import type { ReaderChineseConversionMode } from './ReaderChineseConversionGateway';
import type { ReaderPageTurnStyle } from './ReaderSettingsState';
import {
  readerControlAppearanceEndpoint, readerControlAppearanceFontActor,
  readerControlAppearanceFontDropIndex, readerControlAppearanceFontInput, sampleReaderControlAppearance,
  type ReaderControlAppearanceActor, type ReaderControlAppearanceFrame,
  type ReaderControlAppearanceImportLayout,
} from './ReaderControlAppearanceGeometry';

interface ReaderControlAppearancePoint { x: number; y: number; }

class ReaderFontMotionFrameCallback extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

/**
 * Restored Appearance 1691:20749: viewport content ONLY. The common Stage owns
 * shell, brightness, module navigation, Full header, handle, gesture and clock.
 * Registry swatches and font cells keep one semantic identity for the whole
 * morph. There is no Quick tree / Full tree cross-fade or actor-local animation.
 *
 * Source issue: Import 20807 overlaps System 20799 in the live Full endpoint.
 * User override approved 2026-09-05: use a distinct ordered slot, default last;
 * preserve valid custom ordering. Raw source comparison is explicit opt-in.
 * Make LOYUJr93KwespD5j7N6icw V9 updates swatches and the typography card only;
 * the shared actor identities, gesture arbitration and progress axis stay intact.
 */
@Component
export struct ReaderControlAppearanceContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop isTablet: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved';
  @Prop @Watch('requestSelectClose') dismissTemporaryRevision: number = 0;
  @Prop @Watch('onSnapshotChanged') snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop pageTurnStyle: ReaderPageTurnStyle = 'slide';
  @Prop pageTurnSimulationAvailable: boolean = true;
  // Header owns onCollapse; retained here for business-prop compatible callers.
  onCollapse: () => void = (): void => {};
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onFontOrderChange: (order: ReaderAppearanceFontSlot[]) => void = (_order: ReaderAppearanceFontSlot[]): void => {};
  onCustomFontImport: () => void = (): void => {};
  onIndentRequest: (indent: ReaderAppearanceIndent) => void = (_indent: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void = (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode) => void = (_mode: ReaderChineseConversionMode): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void = (_style: ReaderPageTurnStyle): void => {};
  onFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};

  @State private openSelect: string = '';
  @State private selectClosing: boolean = false;
  @State private selectIdentity: string = '';
  private selectGeneration: number = 0;
  @State private selectAnchorX: number = 0;
  @State private selectAnchorY: number = 0;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @State private draggedFontId: string = '';
  @State private draggedFontOffsetX: number = 0;
  @State private draggedFontOffsetY: number = 0;
  @State private previewFontOrder: ReaderAppearanceFontSlot[] = [];
  private readonly scroller: Scroller = new Scroller();
  private fontPointerId: number = -1;
  private fontDownX: number = 0;
  private fontDownY: number = 0;
  private fontOriginalIndex: number = -1;
  private fontOriginalOrder: ReaderAppearanceFontSlot[] = [];
  private fontOrigin: ReaderControlAppearancePoint = { x: 0, y: 0 };
  private suppressFontClick: boolean = false;
  @State private fontMotionTimeMs: number = 0;
  private fontMotionGeneration: number = 0;
  private readonly fontTracks: Map<string, MotionPointTrack> = new Map();
  private readonly fontMotionCurve = curves.cubicBezierCurve(0, 0, .58, 1);
  private cachedFrame: ReaderControlAppearanceFrame = sampleReaderControlAppearance(0, 286, 666);
  private cachedProgress: number = 0;
  private cachedWidth: number = 286;
  private cachedFullHeight: number = 666;
  private cachedThemeCount: number = -1;

  private endpointWidth: number = -1;
  private endpointHeight: number = -1;
  private endpointThemeCount: number = -1;
  private quickEndpoint: ReaderControlAppearanceFrame | undefined = undefined;
  private fullEndpoint: ReaderControlAppearanceFrame | undefined = undefined;
  private paintProgress: number = -1;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private fontOrderKey: string = '';
  private cachedFontIds: ReaderAppearanceFontSlot[] = [];
  // Added registry rows may overflow both endpoints. Reuse the existing
  // endpoint scroll path, preserving one native Scroll and stable theme IDs.
  @State private extendedScrollOffset: number = 0;
  private extendedScrollPath: ReaderControlMorphScrollPath = readerControlMorphScrollPath(0, 0);
  private extendedScrollInMotion: boolean = false;
  private extendedScrollEndpoint: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    if (this.extendedThemes()) this.syncExtendedThemeScroll();
  }
  aboutToDisappear(): void { this.dismissTemporaryLayer(); this.cancelFontDrag(); }

  private frame(): ReaderControlAppearanceFrame {
    // Many declarative attributes read the frame. Share that one sampled value
    // rather than allocate actor arrays again for every width/position/opacity.
    const count = this.themeIds().length;
    if (this.cachedProgress !== this.motionProgress || this.cachedWidth !== this.availableWidth ||
      this.cachedFullHeight !== this.fullContentHeight || this.cachedThemeCount !== count) {
      this.cachedProgress = this.motionProgress;
      this.cachedWidth = this.availableWidth;
      this.cachedFullHeight = this.fullContentHeight;
      this.cachedThemeCount = count;
      this.cachedFrame = sampleReaderControlAppearance(this.motionProgress, this.availableWidth,
        this.fullContentHeight, count);
    }
    return this.cachedFrame;
  }
  private endpointFrame(full: boolean): ReaderControlAppearanceFrame {
    const count = this.themeIds().length;
    if (this.endpointWidth !== this.availableWidth || this.endpointHeight !== this.fullContentHeight ||
      this.endpointThemeCount !== count || this.quickEndpoint === undefined || this.fullEndpoint === undefined) {
      this.endpointWidth = this.availableWidth;
      this.endpointHeight = this.fullContentHeight;
      this.endpointThemeCount = count;
      this.quickEndpoint = sampleReaderControlAppearance(0, this.availableWidth, this.fullContentHeight, count);
      this.fullEndpoint = sampleReaderControlAppearance(1, this.availableWidth, this.fullContentHeight, count);
    }
    return full ? this.fullEndpoint! : this.quickEndpoint!;
  }
  private fullInput(): boolean {
    return readerControlAppearanceEndpoint(this.motionProgress, this.interactionEnabled) === 'full';
  }
  private sharedInput(): boolean {
    return readerControlAppearanceEndpoint(this.motionProgress, this.interactionEnabled) !== 'none';
  }
  private extendedThemes(): boolean { return this.themeIds().length > 8; }
  private scrollInput(): boolean { return this.extendedThemes() ? this.sharedInput() : this.fullInput(); }
  private scrollContentHeight(): number {
    if (!this.extendedThemes()) return Math.max(this.frame().contentHeight,
      this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion));
    const frame = this.frame();
    return Math.max(this.availableHeight, frame.quickContentHeight +
      (frame.contentHeight - frame.quickContentHeight) * frame.progress,
      this.availableHeight + this.extendedScrollOffset);
  }
  private presentation(): ReaderControlMotionPresentation {
    if (this.cachedPaint === undefined || this.paintProgress !== this.motionProgress) {
      this.paintProgress = this.motionProgress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.motionProgress);
    }
    return this.cachedPaint;

  }
  private pathCache: ReaderControlMotionPathCache<PathShape> = new ReaderControlMotionPathCache<PathShape>(
    (path: string): PathShape => new PathShape().commands(path));
  private sharedClip(kind: 'theme' | 'font', index: number, font: ReaderAppearanceFontSlot = 'system'): PathShape {
    const full = this.endpointFrame(true);
    const quick = this.endpointFrame(false);
    const a = kind === 'theme' ? full.themeSwatches[index] : this.fontActorAt(font, full);
    const b = kind === 'theme' ? this.frame().themeSwatches[index] : this.fontActor(font);
    const c = kind === 'theme' ? quick.themeSwatches[index] : this.fontActorAt(font, quick);
    if (this.extendedThemes()) {
      const currentOffset = this.extendedScrollInMotion ?
        sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress) : this.extendedScrollOffset;
      const fullOffset = this.extendedScrollInMotion ? this.extendedScrollPath.fullOffset :
        this.motionProgress === 1 ? this.extendedScrollOffset : 0;
      const quickOffset = this.extendedScrollInMotion ? this.extendedScrollPath.quickOffset :
        this.motionProgress === 0 ? this.extendedScrollOffset : 0;
      return this.pathCache.fromPath(`${kind}:${index}:${font}`,
        readerControlMotionClipPath(readerControlMotionClipRects(this.motionProgress,
          { x: a.x, y: a.y - fullOffset, width: a.width, height: a.height },
          { x: b.x, y: b.y - currentOffset, width: b.width, height: b.height },
          { x: c.x, y: c.y - quickOffset, width: c.width, height: c.height },
          this.fullContentHeight, 0), this.getUIContext().vp2px(1)));
    }
    // The common content x transform is identical for source and destination;
    // it does not change the actor-local clipping coordinate space.
    const rects: ReaderControlMotionClipRect[] = font === 'import' && kind === 'font' ?
      [{ x: 0, y: 0, width: b.width, height: b.height }] :
      readerControlMotionClipRects(this.motionProgress, a, b, c, this.fullContentHeight, this.scrollMotion.fullScrollOffset);
    return this.pathCache.fromPath(`${kind}:${index}:${font}`,
      readerControlMotionClipPath(rects, this.getUIContext().vp2px(1)));
  }
  private actorPosition(actor: ReaderControlAppearanceActor, shared: boolean = false): ReaderControlAppearancePoint {
    return { x: actor.x, y: actor.y + (shared ? this.sharedScrollTranslation() : this.fullOnlyScrollTranslation()) };
  }
  private syncMorphScroll(): void {
    if (this.extendedThemes()) { this.syncExtendedThemeScroll(); return; }
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, this.scroller.currentOffset().yOffset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    if (this.extendedThemes()) {
      this.extendedScrollOffset = Math.max(0, this.scroller.currentOffset().yOffset);
      return;
    }
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      this.scroller.currentOffset().yOffset, this.fullInput());
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    if (this.extendedThemes()) return { xOffset: 0,
      yOffset: this.scrollInput() || source === ScrollSource.SCROLLER ? y : 0 };
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    if (this.extendedThemes()) return this.extendedScrollInMotion ? this.extendedScrollOffset -
      sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress) : 0;
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
  }
  private fullOnlyScrollTranslation(): number {
    if (this.extendedThemes()) return this.extendedScrollInMotion ?
      this.extendedScrollOffset - this.extendedScrollPath.fullOffset : 0;
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'fullOnly');
  }

  private syncExtendedThemeScroll(): void {
    const offset = Math.max(0, this.scroller.currentOffset().yOffset);
    this.extendedScrollOffset = offset;
    if (!this.sharedInput()) {
      if (!this.extendedScrollInMotion) {
        this.extendedScrollPath = readerControlMorphScrollPath(this.extendedScrollEndpoint, offset);
        this.extendedScrollInMotion = true;
        this.scroller.scrollTo({ xOffset: 0, yOffset: offset, animation: false });
      }
      return;
    }
    if (this.extendedScrollInMotion) {
      const target = sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress);
      this.scroller.scrollTo({ xOffset: 0, yOffset: target, animation: false });
      this.extendedScrollOffset = target;
      this.extendedScrollInMotion = false;
    }
    this.extendedScrollEndpoint = this.motionProgress;
  }

  private onMotionChanged(): void {
    this.syncMorphScroll();
    if (!this.fullInput()) {
      if (this.openSelect !== '') this.dismissTemporaryLayer();
      if (this.draggedFontId !== '' || this.fontPointerId >= 0 || this.fontTracks.size > 0 ||
        this.previewFontOrder.length > 0) this.cancelFontDrag();
    }
  }
  private onInputChanged(): void {
    this.syncMorphScroll();
    if (!this.interactionEnabled) {
      if (this.openSelect !== '') this.dismissTemporaryLayer();
      if (this.draggedFontId !== '' || this.fontPointerId >= 0 || this.fontTracks.size > 0 ||
        this.previewFontOrder.length > 0) this.cancelFontDrag();
    }
  }
  private dismissTemporaryLayer(): void {
    if (this.openSelect === '') return;
    this.openSelect = '';
    this.selectClosing = false;
    this.selectIdentity = '';
    this.selectGeneration += 1;
    this.onTemporaryLayerChange(false);
  }

  private requestSelectClose(): void { if (this.openSelect !== '') this.selectClosing = true; }

  private onSnapshotChanged(): void {
    if (this.draggedFontId === '' && this.previewFontOrder.join('|') ===
      normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder).join('|')) this.previewFontOrder = [];
  }

  private commitSelect(value: string, identity: string): void {
    if (identity !== this.selectIdentity || this.openSelect === '' || !this.fullInput()) return;
    const kind = this.openSelect;
    if (!this.selectOptions(kind).includes(value)) return;
    this.applySelect(kind, value);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.scroller) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.themeHeaders();
          ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
            this.themeShell(theme, index);
            this.themeSwatch(theme, index);
          }, (theme: ReaderAppearanceTheme): string => `control-appearance-theme-${theme}`);
          this.themeAction(true);
          this.themeAction(false);
          Row().width(this.frame().divider.width).height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
            .position(this.actorPosition(this.frame().divider)).opacity(this.frame().divider.opacity)
            .hitTestBehavior(HitTestMode.None);
          this.fontHeaders();
          ForEach(this.fontIds(), (font: ReaderAppearanceFontSlot) => {
            this.fontCell(font);
          }, (font: ReaderAppearanceFontSlot): string => `control-appearance-font-${font}`);
          this.layoutLibrary();
        }
        .width(this.availableWidth).height(this.scrollContentHeight())
        .translate({ x: this.frame().contentTranslateX });
      }
      .width(this.availableWidth).height(this.availableHeight).scrollBar(BarState.Off)
      .enableScrollInteraction(this.scrollInput() && this.draggedFontId === '' && this.openSelect === '')
      .edgeEffect(EdgeEffect.None)
      .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
        this.nativeScrollDelta(y, source))
      .onDidScroll((): void => this.onFullDidScroll());
      this.selectOverlay();
    }
    .width(this.availableWidth).height(this.availableHeight).clip(true);
  }

  @Builder
  private themeHeaders() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库').fontFamily('ReaderNotoSansSCUIBold').fontSize(9).lineHeight(9.9)
        .fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).position({ x: 0, y: 0 });
      Text(this.themeSummary()).width(88).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(7.5).lineHeight(8)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textAlign(TextAlign.End)
        .position({ x: Math.max(0, this.frame().quickThemeHeader.width - 88), y: 3.95 });
    }.width(this.frame().quickThemeHeader.width).height(15.898)
      .position(this.actorPosition(this.frame().quickThemeHeader, true))
      .opacity(this.frame().quickThemeHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.motionProgress === 0 ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库').fontFamily('ReaderNotoSansSCUIBold').fontSize(12).lineHeight(17)
        .fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).position({ x: 0, y: 1 });
      Text(this.themeSummary()).width(140).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(9).lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textAlign(TextAlign.End)
        .position({ x: Math.max(0, this.frame().fullThemeHeader.width - 140), y: 3 });
    }.width(this.frame().fullThemeHeader.width).height(20)
      .position(this.actorPosition(this.frame().fullThemeHeader))
      .opacity(this.frame().fullThemeHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private themeShell(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.themeLabel(theme)).width(Math.max(0, this.frame().themeShells[index].width - 10))
        .height(13).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(9).lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center).maxLines(1)
        .position({ x: 5, y: 39 });
    }.width(this.frame().themeShells[index].width).height(58.8).borderRadius(8)
      .backgroundColor(this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: this.snapshot.activeTheme === theme ? TOK_BORDER_W : 0,
        color: readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) })
      .position(this.actorPosition(this.frame().themeShells[index]))
      .opacity(this.frame().themeShells[index].opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel('no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private themeSwatch(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(46).height(18).backgroundColor(this.themeColor(theme))
        .borderRadius(6)
        .border({ width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme) })
        .position({ x: 8.25, y: 2 })
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
    }.width(62.5).height(24).borderRadius(8)
      .position(this.actorPosition(this.frame().themeSwatches[index], true))
      .clipShape(this.sharedClip('theme', index))
      .responseRegion({ x: this.fullInput() ? -(this.frame().themeShells[index].width - 62.5) / 2 : 0,
        y: this.fullInput() ? -10 : 0,
        width: this.fullInput() ? this.frame().themeShells[index].width : 62.5,
        height: this.fullInput() ? 58.8 : 24 })
      .enabled(this.sharedInput()).hitTestBehavior(this.sharedInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants')
      .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
      .onClick((): void => { if (this.sharedInput()) this.onThemeChange(theme); });
  }

  @Builder
  private themeAction(day: boolean) {
    Text(this.defaultThemeActionLabel(day)).width(74).height(28)
      .fontFamily('ReaderNotoSansSCUIBold').fontSize(9).lineHeight(13).fontWeight(FontWeight.Bold)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Center).borderRadius(6)
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .position(this.actorPosition(day ? this.frame().themeDayAction : this.frame().themeNightAction))
      .opacity(this.motionProgress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.fullInput())
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None)
      .onClick((): void => {
        this.requestDefaultTheme(day);
      });
  }

  private defaultThemeActionLabel(day: boolean): string {
    const current = day ? this.snapshot.dayTheme : this.snapshot.nightTheme;
    return current === this.snapshot.activeTheme ? (day ? '已设为日间' : '已设为夜间') :
      (day ? '设为日间主题' : '设为夜间主题');
  }

  private requestDefaultTheme(day: boolean): void {
    if (!this.fullInput()) return;
    const scheme = day ? 'day' : 'night';
    if (readerControlAppearanceThemeScheme(this.snapshot.activeTheme) !== scheme) {
      this.getUIContext().getPromptAction().showToast({ message: day ? '请先选择日间阅读主题' : '请先选择夜间阅读主题' });
      return;
    }
    if (day) this.onSetDayTheme(this.snapshot.activeTheme);
    else this.onSetNightTheme(this.snapshot.activeTheme);
  }

  @Builder
  private fontHeaders() {
    Text('字体库').width(this.frame().quickFontHeader.width).height(10)
      .fontFamily('ReaderNotoSansSCUIBold').fontSize(9).lineHeight(9.9).fontWeight(FontWeight.Bold)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).position(this.actorPosition(this.frame().quickFontHeader, true))
      .accessibilityLevel(this.motionProgress === 0 ? 'auto' : 'no-hide-descendants')
      .opacity(this.frame().quickFontHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(HitTestMode.None);
    Row() {
      Text('字体库').fontFamily('ReaderNotoSansSCUIMedium').fontSize(13).fontWeight(FontWeight.Medium).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Blank();
      Text('可拖动调整位置').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(10).fontColor(readerAppColor('app.appearance.layoutCaption', this.appThemeScheme));
    }.width(this.frame().fullFontHeader.width).height(16)
      .position(this.actorPosition(this.frame().fullFontHeader))
      .opacity(this.frame().fullFontHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  private fontIds(): ReaderAppearanceFontSlot[] {
    const key = this.draggedFontId === '' ? `saved:${this.snapshot.fontOrder.join(',')}` :
      `drag:${this.draggedFontId}:${this.previewFontOrder.join(',')}`;
    if (key !== this.fontOrderKey) {
      this.fontOrderKey = key;
      this.cachedFontIds = this.draggedFontId === '' ? normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder) :
        this.previewFontOrder.slice();
    }
    return this.cachedFontIds;
  }
  private fontActor(font: ReaderAppearanceFontSlot): ReaderControlAppearanceActor {
    return this.fontActorAt(font, this.frame());
  }
  private fontActorAt(font: ReaderAppearanceFontSlot, frame: ReaderControlAppearanceFrame): ReaderControlAppearanceActor {
    const full = this.fontIds();
    const quick = full.filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
    return readerControlAppearanceFontActor(frame, quick.indexOf(font), full.indexOf(font),
      font === 'import', this.importLayout);
  }
  private fontInput(font: ReaderAppearanceFontSlot): boolean {
    return readerControlAppearanceFontInput(this.motionProgress, this.interactionEnabled,
      font === 'import', this.importLayout);
  }
  private activeFont(font: ReaderAppearanceFontSlot): boolean {
    return font === 'import' ? this.snapshot.font === 'custom' : this.snapshot.font === font;
  }

  @Builder
  private fontCell(font: ReaderAppearanceFontSlot) {
    Stack({ alignContent: Alignment.Center }) {
      // Keep the rounded surface separate from the rectangular motion clip.
      // A PathShape on the painted node overrides its rounded background in RS,
      // making the borderless selected font appear as a square-cornered block.
      Row().width(this.fontActor(font).width).height(this.fontActor(font).height)
        .backgroundColor(this.activeFont(font) ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('app.ReaderControlAppearanceContent.fontCell.backgroundColor.FFFFFCF8', this.appThemeScheme))
        .border({ width: this.activeFont(font) ? 0 : TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme),
          style: font === 'import' ? BorderStyle.Dashed : BorderStyle.Solid })
        .borderRadius(12).clip(true).hitTestBehavior(HitTestMode.None);
      Text(readerAppearanceFontSlotLabel(this.snapshot, font))
        .width(this.fontActor(font).width).height(this.fontActor(font).height)
        .fontFamily(readerAppearanceFontSlotFamily(this.snapshot, font) === 'ReaderNotoSansSC' ?
          'ReaderNotoSansSCUIRegular' : readerAppearanceFontSlotFamily(this.snapshot, font)).fontSize(12)
        .fontWeight(FontWeight.Regular, { enableVariableFontWeight: true })
        .fontColor(this.activeFont(font) ? readerAppColor('app.ReaderControlAppearanceContent.fontCell.fontColor.FFFFFAF4', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
    }.width(this.fontActor(font).width).height(this.fontActor(font).height)
      .clipShape(this.sharedClip('font', 0, font))
      .position(this.fontCellPosition(font)).opacity(this.fontActor(font).opacity)
      .zIndex(this.draggedFontId === font ? 3 : 1).enabled(this.fontInput(font))
      .accessibilityLevel(this.fontInput(font) ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fontInput(font) ? HitTestMode.Default : HitTestMode.None)
      .accessibilityText(font === 'import' && this.importLayout === 'source-overlap-pending' ?
        '原始设计重叠位置，仅供对照' : font === 'import' ? '导入自定义字体' :
        `切换到${readerAppearanceFontSlotLabel(this.snapshot, font)}`)
      .onClick((): void => {
        if (!this.fontInput(font) || this.draggedFontId !== '' || this.suppressFontClick) return;
        if (font === 'import') this.onCustomFontImport();
        else if (isReaderAppearanceFont(font)) this.onFontChange(font);
      })
      .onTouch((event: TouchEvent): void => this.fontTouch(font, event))
      // Existing font-order interaction, not a second control-panel driver.
      .gesture(LongPressGesture({ fingers: 1, repeat: false, duration: 160 })
        .onAction((): void => this.beginFontDrag(font))
        .onActionCancel((): void => { if (this.draggedFontId !== '') this.settleFontDrag(false); }));
  }

  @Builder
  private layoutLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('排版库').fontFamily('ReaderNotoSansSCUIMedium').fontSize(13).lineHeight(17).fontWeight(FontWeight.Medium).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
        Blank();
        Text('即时应用').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(10).lineHeight(13).fontColor(readerAppColor('app.appearance.layoutCaption', this.appThemeScheme));
      }.width(Math.max(0, this.frame().sectionWidth - 8)).height(17)
        .position({ x: 4, y: 10 });
      Row().width(Math.max(0, this.frame().sectionWidth - 4)).height(254)
        .backgroundColor(readerAppColor('app.appearance.layoutSurface', this.appThemeScheme)).border({ width: 1, color: readerAppColor('app.appearance.layoutBorder', this.appThemeScheme) })
        .borderRadius(12).position({ x: 2, y: 37 }).hitTestBehavior(HitTestMode.None);
      this.selectField('indent', 38);
      this.selectField('language', 80);
      this.stepperRow('fontSize', 122);
      this.stepperRow('lineHeightMultiplier', 164);
      this.stepperRow('paragraphSpacing', 206);
      this.stepperRow('letterSpacing', 248);
    }.width(this.frame().layout.width).height(322).position(this.actorPosition(this.frame().layout))
      .opacity(this.frame().layout.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private selectField(kind: string, y: number) {
    Row() {
      Text(this.selectLabel(kind)).fontFamily('ReaderNotoSansSCUIRegular').fontSize(12).lineHeight(18)
        .fontWeight(FontWeight.Regular).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1);
      Blank();
      ReaderSelect({ value: this.selectValue(kind), options: this.selectOptions(kind),
        isOpen: this.openSelect === kind && !this.selectClosing, variant: 'appearanceLibrary',
        reduceMotion: this.reduceMotion, onToggle: (): void => this.toggleSelect(kind, y),
      }).enabled(this.fullInput())
        .accessibilityText(`${this.selectLabel(kind)}，当前${this.selectValue(kind)}`);
    }.width(Math.max(0, this.frame().sectionWidth - 6)).height(42)
      .padding({ left: 13, right: 9 }).border({ width: { bottom: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .position({ x: 3, y: y });
  }

  private toggleSelect(kind: string, localY: number): void {
    if (!this.fullInput() || (kind !== 'indent' && kind !== 'language')) return;
    if (this.openSelect === kind) { this.requestSelectClose(); return; }
    const anchor = appearanceSelectMenuPosition(this.frame().layout.x + this.frame().sectionWidth - 12,
      this.frame().layout.y + localY + 5.5 - this.scrollMotion.nativeScrollOffset,
      this.selectOptions(kind).length, this.availableWidth, this.availableHeight);
    this.selectAnchorX = anchor.x;
    this.selectAnchorY = anchor.y;
    this.openSelect = kind;
    this.selectClosing = false;
    this.selectIdentity = `${kind}:${++this.selectGeneration}`;
    this.onTemporaryLayerChange(true);
  }

  @Builder
  private selectOverlay() {
    if (this.openSelect !== '') {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent).zIndex(9)
        .onClick((): void => this.requestSelectClose());
      ReaderSelectPanel({
        value: this.selectValue(this.openSelect), options: this.selectOptions(this.openSelect),
        x: this.selectAnchorX, y: this.selectAnchorY, variant: 'appearanceLibrary',
        // The menu remains a shared business control. It never contributes a
        // second time/progress channel to this control-bar morph.
        reduceMotion: this.reduceMotion, controlWidth: APPEARANCE_SELECT_MENU_WIDTH,
        closing: this.selectClosing, selectionId: this.selectIdentity,
        onCommit: (value: string, identity: string): void => this.commitSelect(value, identity),
        onDismiss: (identity: string): void => {
          if (identity === this.selectIdentity) this.dismissTemporaryLayer();
        },
      });
    }
  }

  @Builder
  private stepperRow(metric: ReaderAppearanceMetric, y: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.metricLabel(metric)).height(18).fontFamily('ReaderNotoSansSCUIRegular').fontSize(12).lineHeight(18)
        .fontWeight(FontWeight.Regular).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).position({ x: 13, y: 12 });
      Row().width(98).height(27).backgroundColor(readerAppColor('app.appearance.selectSurface', this.appThemeScheme))
        .border({ width: 1, color: readerAppColor('app.appearance.selectBorder', this.appThemeScheme) }).borderRadius(8)
        .position({ x: Math.max(0, this.frame().sectionWidth - 113), y: 7 }).hitTestBehavior(HitTestMode.None);
      this.stepButton(metric, -1, Math.max(0, this.frame().sectionWidth - 121));
      Text(this.metricValue(metric)).width(44).height(25).fontFamily('ReaderNotoSansSCUIMedium').fontSize(11)
        .fontWeight(FontWeight.Medium).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Center)
        .border({ width: { left: 1, right: 1 }, color: readerAppColor('app.ReaderControlAppearanceContent.stepperRow.color.339B8466', this.appThemeScheme) })
        .position({ x: Math.max(0, this.frame().sectionWidth - 86), y: 8 }).hitTestBehavior(HitTestMode.None);
      this.stepButton(metric, 1, Math.max(0, this.frame().sectionWidth - 51));
    }.width(Math.max(0, this.frame().sectionWidth - 6)).height(42)
      .border({ width: { bottom: metric === 'letterSpacing' ? 0 : 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .position({ x: 3, y: y });
  }

  @Builder
  private stepButton(metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection, x: number) {
    Stack({ alignContent: Alignment.Center }) {
      Text(direction < 0 ? '−' : '+').width(26).height(25).fontFamily('ReaderNotoSansSCUIRegular').fontSize(15)
        .fontWeight(FontWeight.Regular).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.width(44).height(42).position({ x: x, y: 0 })
      .opacity(readerAppearanceCanStep(this.snapshot, metric, direction) ? 1 : 0.38)
      .enabled(this.fullInput() && readerAppearanceCanStep(this.snapshot, metric, direction))
      .accessibilityText(`${this.metricLabel(metric)}${direction < 0 ? '减小' : '增大'}`)
      .onClick((): void => {
        if (this.fullInput() && readerAppearanceCanStep(this.snapshot, metric, direction))
          this.onMetricStep(metric, direction);
      });
  }

  private selectLabel(kind: string): string {
    return kind === 'indent' ? '缩进' : (kind === 'language' ? '简繁' : '');
  }
  private selectOptions(kind: string): string[] {
    if (kind === 'indent') return ['无', '1字符', '2字符'];
    if (kind === 'language') return ['原文', '繁转简', '简转繁'];
    return [];
  }
  private selectValue(kind: string): string {
    if (kind === 'indent') return this.snapshot.indent === 'none' ? '无' :
      (this.snapshot.indent === 'single' ? '1字符' : '2字符');
    if (kind === 'language') return this.chineseConversionMode === 'none' ? '原文' :
      (this.chineseConversionMode === 't2s' ? '繁转简' : '简转繁');
    return '';
  }
  private applySelect(kind: string, value: string): void {
    if (kind === 'indent') {
      const indent: ReaderAppearanceIndent = value === '无' ? 'none' : (value === '1字符' ? 'single' : 'firstLine');
      if (indent !== this.snapshot.indent) this.onIndentRequest(indent);
    } else if (kind === 'language') {
      const mode: ReaderChineseConversionMode = value === '繁转简' ? 't2s' : (value === '简转繁' ? 's2t' : 'none');
      if (mode !== this.chineseConversionMode) this.onChineseConversionChange(mode);
    }
  }
  private metricLabel(metric: ReaderAppearanceMetric): string {
    return metric === 'fontSize' ? '字号' : (metric === 'lineHeightMultiplier' ? '行距' :
      (metric === 'paragraphSpacing' ? '段距' : '字距'));
  }
  private metricValue(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') return `${this.snapshot.fontSize}px`;
    if (metric === 'lineHeightMultiplier') return this.snapshot.lineHeightMultiplier.toFixed(2);
    return metric === 'paragraphSpacing' ? `${this.snapshot.paragraphSpacing}px` : `${this.snapshot.letterSpacing}px`;
  }
  private themeIds(): ReaderAppearanceTheme[] {
    return READER_CONTROL_APPEARANCE_THEMES;
  }
  private themeLabel(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeLabel(theme);
  }
  private themeColor(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeSwatch(theme);
  }
  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private beginFontDrag(font: ReaderAppearanceFontSlot): void {
    if (!this.fullInput() || !this.fontInput(font) || this.fontPointerId < 0 || this.draggedFontId !== '') return;
    this.dismissTemporaryLayer();
    const visible = this.fontCellPosition(font);
    this.fontOriginalOrder = normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder);
    this.previewFontOrder = this.fontOriginalOrder.slice();
    this.fontOriginalIndex = this.fontOriginalOrder.indexOf(font);
    this.fontOrigin = visible;
    this.draggedFontId = font;
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.suppressFontClick = true;
    this.onFontReorderActivityChange(true);
  }
  private fontTouch(font: ReaderAppearanceFontSlot, event: TouchEvent): void {
    if (!this.fullInput()) return;
    if (event.type === TouchType.Cancel) { this.settleFontDrag(false); return; }
    const touches = event.type === TouchType.Up ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      if (this.fontPointerId >= 0) return;
      const pointer = event.changedTouches.length > 0 ? event.changedTouches[0] : touches[0];
      if (pointer === undefined) return;
      this.suppressFontClick = false;
      this.fontPointerId = pointer.id;
      this.fontDownX = pointer.windowX;
      this.fontDownY = pointer.windowY;
      const track = this.fontTracks.get(font);
      if (track !== undefined) {
        const visible = this.fontCellPosition(font);
        this.fontTracks.set(font, new MotionPointTrack(visible, visible, readerMotionNowMs(), 0));
      }
      return;
    }
    for (let index = 0; index < touches.length; index += 1) {
      const pointer = touches[index];
      if (pointer.id !== this.fontPointerId) continue;
      if (this.draggedFontId === font) {
        event.stopPropagation();
        this.updateFontDrag(pointer.windowX - this.fontDownX, pointer.windowY - this.fontDownY);
        if (event.type === TouchType.Up) {
          this.settleFontDrag(true);
        }
      }
      if (event.type === TouchType.Up) {
        this.fontPointerId = -1;
        if (this.draggedFontId === '') this.animateFontPositions(this.captureFontPositions(),
          motionSpecGet('reader.font.reorder.settle')!.durationMs);
      }
      return;
    }
  }
  private updateFontDrag(x: number, y: number): void {
    if (this.fontOriginalIndex < 0) return;
    const positions = this.captureFontPositions();
    const previous = this.previewFontOrder.join('|');
    this.draggedFontOffsetX = x;
    this.draggedFontOffsetY = y;
    const target = readerControlAppearanceFontDropIndex(this.frame(), this.fontOrigin.x,
      this.fontOrigin.y, x, y, this.fontOriginalOrder.length);
    // Raw import source geometry cannot be moved or implicitly resolved by
    // a drag of another font. Its existing ordered index remains unchanged.
    if (this.importLayout === 'source-overlap-pending') {
      const visible = this.fontOriginalOrder.filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
      const from = visible.indexOf(this.draggedFontId as ReaderAppearanceFontSlot);
      const ordered = moveReaderAppearanceFontSlot(visible, from, Math.min(7, target))
        .filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
      const result: ReaderAppearanceFontSlot[] = [];
      let visibleIndex = 0;
      this.fontOriginalOrder.forEach((slot: ReaderAppearanceFontSlot): void => {
        if (slot === 'import') result.push(slot);
        else { result.push(ordered[visibleIndex]); visibleIndex += 1; }
      });
      this.previewFontOrder = result;
    } else {
      this.previewFontOrder = moveReaderAppearanceFontSlot(this.fontOriginalOrder, this.fontOriginalIndex, target);
    }
    if (previous !== this.previewFontOrder.join('|')) this.animateFontPositions(positions,
      motionSpecGet('reader.font.reorder.shift')!.durationMs);
  }
  private cancelFontDrag(): void {
    const active = this.draggedFontId !== '';
    this.draggedFontId = '';
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.previewFontOrder = [];
    this.fontOriginalIndex = -1;
    this.fontPointerId = -1;
    this.fontMotionGeneration += 1;
    this.fontTracks.clear();
    this.fontMotionTimeMs = readerMotionNowMs();
    if (active) this.onFontReorderActivityChange(false);
  }

  private fontCellPosition(font: ReaderAppearanceFontSlot): ReaderControlAppearancePoint {
    if (this.draggedFontId === font) return { x: this.fontOrigin.x + this.draggedFontOffsetX,
      y: this.fontOrigin.y + this.draggedFontOffsetY };
    const track = this.fontTracks.get(font);
    return track === undefined ? this.actorPosition(this.fontActor(font), font !== 'import') :
      track.sample(this.fontMotionTimeMs, (p: number): number => this.fontMotionCurve.interpolate(p));
  }

  private captureFontPositions(): Map<string, ReaderControlAppearancePoint> {
    const positions: Map<string, ReaderControlAppearancePoint> = new Map();
    for (const font of this.fontIds()) positions.set(font, this.fontCellPosition(font));
    return positions;
  }

  private animateFontPositions(positions: Map<string, ReaderControlAppearancePoint>, duration: number): void {
    const now = readerMotionNowMs();
    this.fontMotionTimeMs = now;
    const generation = ++this.fontMotionGeneration;
    this.fontTracks.clear();
    if (this.reduceMotion || !this.fullInput()) return;
    for (const font of this.fontIds()) {
      if (font === this.draggedFontId) continue;
      const from = positions.get(font);
      if (from !== undefined) this.fontTracks.set(font, new MotionPointTrack(from,
        this.actorPosition(this.fontActor(font), font !== 'import'), now, duration));
    }
    this.scheduleFontFrame(generation);
  }

  private scheduleFontFrame(generation: number): void {
    this.getUIContext().postFrameCallback(new ReaderFontMotionFrameCallback((): void => {
      if (generation !== this.fontMotionGeneration) return;
      this.fontMotionTimeMs = readerMotionNowMs();
      let running = false;
      this.fontTracks.forEach((track: MotionPointTrack): void => {
        if (track.running(this.fontMotionTimeMs)) running = true;
      });
      if (running) this.scheduleFontFrame(generation);
      else if (this.fontPointerId < 0) {
        this.fontTracks.clear();
        this.onSnapshotChanged();
      }
    }));
  }

  private settleFontDrag(commit: boolean): void {
    if (this.draggedFontId === '') { this.cancelFontDrag(); return; }
    const positions = this.captureFontPositions();
    const next = this.previewFontOrder.slice();
    const changed = next.join('|') !== normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder).join('|');
    this.cancelFontDrag();
    // Keep the intended layout while the host admits the new order.
    if (commit) this.previewFontOrder = next;
    if (commit && changed) this.onFontOrderChange(next);
    this.animateFontPositions(positions, motionSpecGet('reader.font.reorder.settle')!.durationMs);
  }
}
