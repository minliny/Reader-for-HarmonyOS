import { readerControlAppearanceThemeSwatch, readerControlAppearanceThemeLabel } from './ReaderControlAppearanceStyle';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSelectPanel } from '../common/ReaderSelectPanel';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_PRIMARY_SOFT,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_BODY_INK,
  TOK_READ_DISABLED_BG,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_FIELD,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot,
  isReaderAppearanceFont,
  moveReaderAppearanceFontSlot,
  readerAppearanceCanStep,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import {
  readerAppearanceFontSlotFamily,
  readerAppearanceFontSlotLabel,
} from './ReaderAppearanceRenderStyle';
import type { ReaderChineseConversionMode } from './ReaderChineseConversionGateway';
import type { ReaderPageTurnStyle } from './ReaderSettingsState';
import { motionAnimateParam, panelActorTransition } from '../common/MotionSpec';
import {
  READER_APPEARANCE_FULL_HEIGHT,
  readerAppearanceMotionViewportHeight,
  readerAppearanceMotionViewportWidth,
  readerAppearanceScrollCompensationVp,
  sampleReaderAppearanceMasterProgress,
  type ReaderAppearanceMotionFrame,
} from './ReaderAppearanceMotionGeometry';
import { ReaderAppearanceSharedActors } from './ReaderAppearanceSharedActors';
import {
  READER_FULL_PANEL_HEIGHT_TABLET,
  READER_FULL_PANEL_MAX_WIDTH_PHONE,
  READER_FULL_PANEL_MAX_WIDTH_TABLET,
} from './ReaderLayoutGeometry';

const READER_APPEARANCE_FULL_PANEL_HEIGHT_PHONE = 840;
const READER_FONT_REORDER_HOLD_MS = 160;
const READER_FONT_REORDER_ROW_STRIDE = 38;

/**
 * Figma Reader Full Appearance sheet: Phone `942:82`, Tablet `942:84`.
 *
 * The component is presentation-only. The reading experience owns applying
 * the returned settings and the gateway owns persistence. Phone and Tablet
 * are one semantic panel. Only the outer geometry and the
 * widths of the same internal rows/cards vary with the viewport profile.
 */
@Component
export struct ReaderAppearanceFullPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop isTablet: boolean = false;
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop reduceMotion: boolean = false;
  /** Shared primitive progress from the immediate frame-clock owner. */
  @Prop motionProgress: number = 1;
  @Prop motionEnabled: boolean = false;
  @Prop motionFullHeight: number = READER_APPEARANCE_FULL_HEIGHT;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop showGrabber: boolean = true;
  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop pageTurnStyle: ReaderPageTurnStyle = 'slide';
  @Prop pageTurnSimulationAvailable: boolean = true;
  onCollapse: () => void = (): void => {};
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => void =
    (_fontOrder: ReaderAppearanceFontSlot[]): void => {};
  onCustomFontImport: () => void = (): void => {};
  onIndentRequest: (indent: ReaderAppearanceIndent) => void = (_indent: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode) => void =
    (_mode: ReaderChineseConversionMode): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};
  onFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  @State private openSelect: string = '';
  @State private selectClosing: boolean = false;
  @State private selectAnchorX: number = 0;
  @State private selectAnchorY: number = 0;
  @State private panelOriginX: number = 0;
  @State private panelOriginY: number = 0;
  @State private draggedFontId: string = '';
  @State private draggedFontIndex: number = -1;
  @State private draggedFontHoverIndex: number = -1;
  @State private draggedFontOffsetX: number = 0;
  @State private draggedFontOffsetY: number = 0;
  @State private previewFontOrder: ReaderAppearanceFontSlot[] = [];
  @State private fontDragSettling: boolean = false;
  @State private motionScrollOffsetY: number = 0;
  private readonly contentScroller: Scroller = new Scroller();
  private fontDragGeneration: number = 0;
  private fontTouchStartX: number = 0;
  private fontTouchStartY: number = 0;
  private fontTouchCurrentX: number = 0;
  private fontTouchCurrentY: number = 0;
  private fontTouchId: number = -1;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  private onInteractionEnabledChanged(): void {
    if (this.interactionEnabled) {
      return;
    }
    this.openSelect = '';
    this.selectClosing = false;
    this.fontDragGeneration += 1;
    this.clearFontDragState();
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.showGrabber) {
        Row()
          .width(42)
          .height(4)
          .backgroundColor(readerAppColor('TOK_READ_HANDLE', this.appThemeScheme))
          .borderRadius(999)
          .position({ x: this.handleX(), y: 9 });
      }

      this.header();

      if (!this.motionEnabled) {
        this.staticContentSurface();
        this.staticAppearanceContent();
      } else {
        // Figma 1505:18040 owns two visual trees: QuickMorph finishes its
        // geometry first and fades over the independently revealed Full tree.
        this.motionAppearanceContent();
      }

      this.selectOverlay();
    }
    .width(this.sheetWidth())
    .height(this.sheetHeight())
    // MorphShell 壳板（ReaderControlPanel）统一提供 surface/边框/圆角；
    // 此处仅保留内容裁剪与量测（Figma Review J~Q 壳体 morph 单一背景来源）。
    .clip(true)
    .hitTestBehavior(this.motionEnabled ? HitTestMode.Transparent : HitTestMode.Default)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.panelOriginX = Number(newValue.globalPosition.x);
      this.panelOriginY = Number(newValue.globalPosition.y);
    });
  }

  @Builder
  private staticContentSurface() {
    Row()
      .width(this.viewportWidth())
      .height(this.viewportHeight())
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .borderRadius(12)
      .position({ x: 13, y: 57 })
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
        TransitionEffect.asymmetric(
          panelActorTransition('reader.panel.appearance.surface.in', 0, 128),
          TransitionEffect.IDENTITY,
        ));
  }

  @Builder
  private staticAppearanceContent() {
    Scroll(this.contentScroller) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.themeLibrary();
        this.typographyLibrary();
        this.fontLibrary();
      }
      .width(this.viewportWidth())
      .height(this.contentHeight());
    }
    .width(this.viewportWidth())
    .height(this.scrollViewportHeight())
    .scrollBar(BarState.Off)
    .enableScrollInteraction(this.interactionEnabled && this.draggedFontId === '' && !this.fontDragSettling)
    .onScrollStart((): void => this.onAppearanceScrollStart())
    .position({ x: 13, y: 57 })
    .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
      TransitionEffect.asymmetric(
        panelActorTransition('reader.panel.appearance.content.in', 0, 146),
        TransitionEffect.IDENTITY,
      ));
  }

  @Builder
  private motionAppearanceContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.motionContentSurface();
      this.motionFullAppearanceContent();
      this.motionQuickAppearanceContent();
    }
    .width(this.sheetWidth())
    .height(this.sheetHeight())
    .hitTestBehavior(HitTestMode.Transparent)
    .position({ x: 0, y: 0 });
  }

  @Builder
  private motionContentSurface() {
    Row()
      .width(this.motionFullViewportWidth())
      .height(this.motionFullViewportHeight())
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .borderRadius(12)
      .position({
        x: this.currentMotionFrame().contentSurface.x,
        y: this.currentMotionFrame().contentSurface.y,
      })
      .opacity(this.currentMotionFrame().contentSurface.opacity)
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private motionFullAppearanceContent() {
    Scroll(this.contentScroller) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.themeLibrary();
        this.fontLibrary();
        this.typographyLibrary();
      }
      .width(this.currentMotionFrame().appearanceContent.width)
      .height(this.contentHeight())
      // Preserve the Full endpoint's retained scroll while cancelling it as
      // the same master progress returns toward Quick.
      .translate({ y: this.motionScrollCompensationY() });
    }
    .width(this.motionFullViewportWidth())
    .height(this.motionFullViewportHeight())
    .borderRadius(12)
    .clip(true)
    .scrollBar(BarState.Off)
    .enableScrollInteraction(this.fullEndpointInteractionEnabled() &&
      this.draggedFontId === '' && !this.fontDragSettling)
    .enabled(this.fullEndpointInteractionEnabled())
    .hitTestBehavior(this.fullEndpointInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .onScrollStart((): void => this.onAppearanceScrollStart())
    .onDidScroll((_xOffset: number, _yOffset: number, _state: ScrollState): void =>
      this.captureMotionScrollOffset())
    .onScrollStop((): void => this.captureMotionScrollOffset())
    .position({
      x: this.currentMotionFrame().appearanceContent.x,
      y: this.currentMotionFrame().appearanceContent.y,
    })
    .opacity(this.currentMotionFrame().appearanceContent.opacity);
  }

  @Builder
  private motionQuickAppearanceContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderAppearanceSharedActors({
        motionProgress: this.motionProgress,
        fullHeight: this.motionFullHeight,
        interactionEnabled: this.quickEndpointInteractionEnabled(),
        reduceMotion: this.reduceMotion,
        snapshot: this.snapshot,
        onThemeChange: (theme: ReaderAppearanceTheme): void => this.onThemeChange(theme),
        onFontChange: (font: ReaderAppearanceFont): void => this.onFontChange(font),
        onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): void =>
          this.onFontOrderChange(fontOrder),
        onFontReorderActivityChange: (_active: boolean): void => {},
      });
    }
    .width(this.motionViewportWidth())
    .height(this.motionViewportHeight())
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .borderRadius(8)
    .clip(true)
    .enabled(this.quickEndpointInteractionEnabled())
    .hitTestBehavior(this.quickEndpointInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .position({
      x: this.currentMotionFrame().quickMorph.x,
      y: this.currentMotionFrame().quickMorph.y,
    })
    .translate({
      x: this.currentMotionFrame().quickMorph.translateX,
      y: this.currentMotionFrame().quickMorph.translateY,
    })
    .opacity(this.currentMotionFrame().quickMorph.opacity)
    .blur(this.currentMotionFrame().quickMorph.blurVp);
  }

  private onAppearanceScrollStart(): void {
    this.openSelect = '';
    this.selectClosing = false;
    if (this.draggedFontId !== '' && !this.fontDragSettling) {
      this.cancelFontDrag();
    }
  }

  private captureMotionScrollOffset(): void {
    const offset = this.contentScroller.currentOffset();
    this.motionScrollOffsetY = Math.max(0, offset.yOffset);
  }

  @Builder
  private header() {
    Row() {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_header_theme_night') : $r('app.media.reader_appearance_header')))
        .width(20)
        .height(20);
      Text('界面')
        .margin({ left: 8 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Blank();
      Text('收起')
        .width(40)
        .height(26)
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .borderRadius(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .enabled(this.motionEnabled ? this.fullEndpointInteractionEnabled() :
          this.interactionEnabled)
        .accessibilityText('收起界面设置')
        .onClick((): void => this.onCollapse());
    }
    .width(this.headerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 13, y: 19 })
    // N 帧 Header 全分量由共享 frame 同步采样：opacity 0→1、y -12→0、
    // blur 8→0。TransitionEffect 没有 blur 分量，所以 motion stage 走属性通道。
    .opacity(this.motionFrameOrUndefined()?.header.opacity ?? 1)
    .translate({
      x: this.motionFrameOrUndefined()?.header.translateX ?? 0,
      y: this.motionFrameOrUndefined()?.header.translateY ?? 0,
    })
    .blur(this.motionFrameOrUndefined()?.header.blurVp ?? 0)
    .transition(this.reduceMotion || this.motionEnabled ? TransitionEffect.IDENTITY :
      TransitionEffect.asymmetric(
        panelActorTransition('reader.panel.appearance.header.in', -12, 146),
        TransitionEffect.IDENTITY,
      ));
  }

  @Builder
  private themeLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库')
        .width(this.sectionInnerWidth() - 132)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(17)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .position({ x: 2, y: 10 });
      Text(this.themeSummary())
        .width(122)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.End)
        .maxLines(1)
        .position({ x: this.sectionInnerWidth() - 120, y: 10 });

      ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
        this.fullThemeCard(theme, index);
      }, (theme: ReaderAppearanceTheme): string => `reader-appearance-full-theme-${theme}`);

      this.themeAction(true);
      this.themeAction(false);

      Row()
        .width(this.sectionWidth())
        .height(1)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: 0, y: 209 });
    }
    .width(this.sectionWidth())
    .height(210)
    .position({ x: 11, y: 11 })
    .opacity(this.motionFrameOrUndefined()?.themeLibrary.opacity ?? 1)
    .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
      TransitionEffect.asymmetric(
        panelActorTransition('reader.panel.appearance.theme.in', 0, 146),
        TransitionEffect.IDENTITY,
      ));
  }

  @Builder
  private fullThemeCard(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(this.fullCardWidth() - 10)
        .height(24)
        .backgroundColor(this.themeColor(theme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('app.ReaderAppearanceFullPanel.fullThemeCard.color.1F5B5046', this.appThemeScheme) })
        .borderRadius(6)
        .position({ x: 5, y: 10 });
      Text(this.themeLabel(theme))
        .width(this.fullCardWidth() - 10)
        .height(11)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .position({ x: 5, y: 42.9 });
    }
    .width(this.fullCardWidth())
    .height(58.8)
    .backgroundColor(this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : readerAppColor('TOK_READ_DISABLED_BG', this.appThemeScheme))
    .opacity(this.snapshot.activeTheme === theme ? 1 : 0.8)
    .borderRadius(8)
    .position({
      x: 2 + (index % 4) * this.fullCardStride(),
      y: 32.39 + Math.floor(index / 4) * 64.8,
    })
    .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
    .onClick((): void => this.onThemeChange(theme));
  }

  @Builder
  private themeAction(day: boolean) {
    Text(day ? '设为日间主题' : '设为夜间主题')
      .width(74)
      .height(28)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(9)
      .lineHeight(13)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
      .textAlign(TextAlign.Center)
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .borderRadius(6)
      .position({ x: day ? this.sectionInnerWidth() - 152 : this.sectionInnerWidth() - 72, y: 172 })
      .accessibilityText(day ? '将当前主题设为日间主题' : '将当前主题设为夜间主题')
      .onClick((): void => {
        if (day) {
          this.onSetDayTheme(this.snapshot.activeTheme);
        } else {
          this.onSetNightTheme(this.snapshot.activeTheme);
        }
      });
  }

  @Builder
  private fontLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('字体库')
        .width(this.sectionInnerWidth() - 78)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(14.4)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .position({ x: 1, y: 10 });
      Text('可拖动调整位置')
        .width(70)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.End)
        .position({ x: this.sectionWidth() - 72, y: 10 });

      Stack({ alignContent: Alignment.TopStart }) {
        if (this.draggedFontId !== '') {
          this.fontDragPlaceholder();
        }
        ForEach(this.fullFontIds(), (fontId: ReaderAppearanceFontSlot) => {
          this.fullFontCell(fontId);
        }, (fontId: ReaderAppearanceFontSlot): string => `reader-appearance-full-font-${fontId}`);
      }
      .width(this.sectionWidth())
      .height(106)
      .position({ x: 0, y: 30 });
    }
    .width(this.sectionWidth())
    .height(136)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .position({ x: 11, y: 220.98 })
    .opacity(this.motionFrameOrUndefined()?.fontLibrary.opacity ?? 1)
    .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
      TransitionEffect.asymmetric(
        panelActorTransition('reader.panel.appearance.font.in', 0, 175),
        TransitionEffect.IDENTITY,
      ));
  }

  @Builder
  private fontDragPlaceholder() {
    Row()
      .width(this.fullFontCardWidth())
      .height(30)
      .backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme), style: BorderStyle.Dashed })
      .borderRadius(6)
      .opacity(0.58)
      .position({
        x: this.fontSlotX(this.draggedFontHoverIndex),
        y: this.fontSlotY(this.draggedFontHoverIndex),
      })
      .zIndex(0);
  }

  @Builder
  private fullFontCell(fontId: ReaderAppearanceFontSlot) {
    Text(readerAppearanceFontSlotLabel(this.snapshot, fontId))
      .width(this.fullFontCardWidth())
      .height(30)
      .backgroundColor(this.isActiveFont(fontId) ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : Color.Transparent)
      .border({
        width: TOK_BORDER_W,
        color: this.isActiveFont(fontId) ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme),
        style: fontId === 'import' ? BorderStyle.Dashed : BorderStyle.Solid,
      })
      .borderRadius(6)
      .fontFamily(readerAppearanceFontSlotFamily(this.snapshot, fontId))
      .fontWeight(FontWeight.Regular)
      .fontSize(10)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .position({
        x: this.fontSlotX(this.fontDisplayIndex(fontId)),
        y: this.fontSlotY(this.fontDisplayIndex(fontId)),
      })
      .translate({
        x: this.fontDragTranslateX(fontId),
        y: this.fontDragTranslateY(fontId),
      })
      .scale({
        x: this.draggedFontId === fontId ? 1.035 : 1,
        y: this.draggedFontId === fontId ? 1.035 : 1,
      })
      .shadow(this.draggedFontId === fontId ?
        { radius: 12, color: readerAppColor('app.ReaderAppearanceFullPanel.fullFontCell.color.2B332C25', this.appThemeScheme), offsetX: 0, offsetY: 5 } :
        { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
      .opacity(this.draggedFontId === fontId ? 0.96 : 1)
      .zIndex(this.draggedFontId === fontId ? 3 : 1)
      .enabled(this.isSelectableFont(fontId))
      .accessibilityText(this.isSelectableFont(fontId) ?
        `切换到${readerAppearanceFontSlotLabel(this.snapshot, fontId)}` :
        `${readerAppearanceFontSlotLabel(this.snapshot, fontId)}，暂不可用`)
      .onClick((): void => {
        if (this.draggedFontId !== '' || this.fontDragSettling) {
          return;
        }
        if (fontId === 'import') {
          this.onCustomFontImport();
        } else if (isReaderAppearanceFont(fontId)) {
          this.onFontChange(fontId);
        }
      })
      .onTouch((event: TouchEvent): void => this.handleFontTouch(fontId, event))
      .gesture(
        LongPressGesture({ fingers: 1, repeat: false, duration: READER_FONT_REORDER_HOLD_MS })
          .onAction((): void => this.beginFontDrag(fontId))
          .onActionCancel((): void => {
            if (this.draggedFontId === fontId) {
              this.cancelFontDrag();
            }
          }),
      );
  }

  @Builder
  private typographyLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('排版库')
        .width(180)
        .height(20)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(17)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .position({ x: 2, y: 11 });
      Text('即时应用')
        .width(70)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.End)
        .position({ x: this.sectionInnerWidth() - 70, y: 13 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.indentRow();
        this.selectField('language', 9, 61);
        this.selectField('pageTurn', 21 + this.selectRowWidth(), 61);
        this.selectField('alignment', 9, 113);
      }
      .width(this.sectionInnerWidth())
      .height(168)
      .position({ x: 2, y: 44 });

      Stack({ alignContent: Alignment.TopStart }) {
        this.stepperRow('fontSize', 0);
        this.stepperRow('lineHeightMultiplier', 1);
        this.stepperRow('paragraphSpacing', 2);
        this.stepperRow('letterSpacing', 3);
      }
      .width(this.stepperPanelWidth())
      .height(140)
      .borderRadius(8)
      .position({ x: 2, y: 228 });
    }
    .width(this.sectionWidth())
    .height(406)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .position({ x: 11, y: 366.98 })
    .opacity(this.motionFrameOrUndefined()?.typography.opacity ?? 1)
    .translate({
      x: this.motionFrameOrUndefined()?.typography.translateX ?? 0,
      y: this.motionFrameOrUndefined()?.typography.translateY ?? 0,
    })
    .blur(this.motionFrameOrUndefined()?.typography.blurVp ?? 0)
    // N 帧 Typography 卡: opacity 0->1 @ 164ms (delay 256)。
    .transition(this.reduceMotion || this.motionEnabled ? TransitionEffect.IDENTITY :
      TransitionEffect.asymmetric(
        panelActorTransition('reader.panel.appearance.typography.in', 0, 256),
        TransitionEffect.IDENTITY,
      ));
  }

  @Builder
  private indentRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('首行缩进')
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(readerAppColor('app.control.itemInk', this.appThemeScheme))
        .position({ x: 9, y: 15 });

      Row()
        .width(200)
        .height(36)
        .backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
        .borderRadius(6)
        .position({ x: this.indentRowWidth() - 209, y: 4 });

      Row() {
        this.indentOption('不缩进', 'none');
        this.indentOption('单字缩进', 'single');
        this.indentOption('双字缩进', 'firstLine');
      }
      .width(200)
      .height(36)
      .padding({ top: 6, bottom: 6 })
      .borderRadius(6)
      .position({ x: this.indentRowWidth() - 209, y: 4 });
    }
    .width(this.indentRowWidth())
    .height(44)
    .position({ x: 9, y: 9 });
  }

  @Builder
  private indentOption(label: string, value: string) {
    Text(label)
      .layoutWeight(1)
      .height(24)
      .backgroundColor(this.indentOptionActive(value) ? readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme) : Color.Transparent)
      .borderRadius(6)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(this.indentOptionActive(value) ? FontWeight.Bold : FontWeight.Medium)
      .fontSize(9)
      .fontColor(this.indentOptionActive(value) ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
      .textAlign(TextAlign.Center)
      .accessibilityText(label)
      .onClick((): void => {
        if ((value === 'none' || value === 'single' || value === 'firstLine') &&
          this.snapshot.indent !== value) {
          this.onIndentRequest(value);
        }
      });
  }

  @Builder
  private selectField(kind: string, x: number, y: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.selectLabel(kind))
        .width(this.selectLabelWidth(kind))
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(readerAppColor('app.control.itemInk', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 9, y: 14 });

      if (this.selectEnabled(kind)) {
        ReaderSelect({
          value: this.selectValue(kind),
          options: this.selectOptions(kind),
          isOpen: this.openSelect === kind,
          variant: 'appearanceCompact',
          reduceMotion: this.reduceMotion,
          controlWidth: this.selectControlWidth(kind),
          onToggle: (): void => {
            if (this.openSelect === kind) {
              this.requestCloseSelect();
            } else {
              this.selectClosing = false;
              this.openSelect = kind;
            }
          },
        })
          .position({ x: this.selectRowWidth() - this.selectControlWidth(kind) - 8, y: 3 })
          .accessibilityText(this.selectAccessibilityText(kind))
          .onAreaChange((_oldValue: Area, newValue: Area): void => {
            this.selectAnchorX = Number(newValue.globalPosition.x);
            this.selectAnchorY = Number(newValue.globalPosition.y);
          });
      } else {
        Row() {
          Text(this.selectValue(kind))
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
          Blank();
          Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_primary_theme_night') : $r('app.media.reader_chevron_down_primary')))
            .width(8)
            .height(4);
        }
        .width(this.selectControlWidth(kind))
        .height(36)
        .padding({ left: 8, right: 6 })
        .alignItems(VerticalAlign.Center)
        .backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('app.ReaderAppearanceFullPanel.selectField.color.FFC1C7CD', this.appThemeScheme) })
        .borderRadius(6)
        .opacity(0.38)
        .position({ x: this.selectRowWidth() - this.selectControlWidth(kind) - 8, y: 3 })
        .enabled(false)
        .accessibilityText(this.selectAccessibilityText(kind));
      }
    }
    .width(this.selectRowWidth())
    .height(44)
    .position({ x, y });
  }

  @Builder
  private selectOverlay() {
    if (this.openSelect !== '') {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor(Color.Transparent)
        .hitTestBehavior(HitTestMode.Default)
        .zIndex(9)
        .onClick((): void => {
          this.requestCloseSelect();
        });

      ReaderSelectPanel({
        value: this.selectValue(this.openSelect),
        options: this.selectOptions(this.openSelect),
        x: this.selectAnchorX - this.panelOriginX,
        y: this.selectAnchorY - this.panelOriginY,
        variant: 'appearanceCompact',
        reduceMotion: this.reduceMotion,
        closing: this.selectClosing,
        controlWidth: this.selectControlWidth(this.openSelect),
        onSelect: (option: string): void => {
          const kind = this.openSelect;
          this.openSelect = '';
          this.selectClosing = false;
          this.applySelectValue(kind, option);
        },
        onDismiss: (): void => {
          this.openSelect = '';
          this.selectClosing = false;
        },
      });
    }
  }

  private requestCloseSelect(): void {
    if (this.openSelect === '') {
      return;
    }
    if (this.reduceMotion) {
      this.openSelect = '';
      this.selectClosing = false;
      return;
    }
    this.selectClosing = true;
  }

  @Builder
  private stepperRow(metric: ReaderAppearanceMetric, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.metricLabel(metric))
        .height(16)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(readerAppColor('app.control.itemInk', this.appThemeScheme))
        .position({ x: 8, y: index === 0 ? 9 : 9.5 });

      Row({ space: 4 }) {
        this.stepButton(metric, -1);
        Text(this.metricValue(metric))
          .width(42)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center);
        this.stepButton(metric, 1);
      }
      .width(110)
      .height(28)
      .alignItems(VerticalAlign.Center)
      .position({ x: this.stepperRowWidth() - 118, y: 3 });
    }
    .width(this.stepperRowWidth())
    .height(34)
    .border({ width: { top: index === 0 ? 0 : TOK_BORDER_W }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .position({ x: 9, y: 2 + index * 34 });
  }

  @Builder
  private stepButton(metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) {
    Stack({ alignContent: Alignment.Center }) {
      Text(direction < 0 ? '-' : '+')
        .width(24)
        .height(28)
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .borderRadius(8)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(14)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);
    }
    .width(30)
    .height(28)
    .opacity(readerAppearanceCanStep(this.snapshot, metric, direction) ? 1 : 0.38)
    .enabled(readerAppearanceCanStep(this.snapshot, metric, direction))
    .accessibilityText(`${this.metricLabel(metric)}${direction < 0 ? '减小' : '增大'}`)
    .onClick((): void => {
      if (readerAppearanceCanStep(this.snapshot, metric, direction)) {
        this.onMetricStep(metric, direction);
      }
    });
  }

  private sheetWidth(): number {
    const designWidth = this.isTablet ? READER_FULL_PANEL_MAX_WIDTH_TABLET :
      READER_FULL_PANEL_MAX_WIDTH_PHONE;
    return this.availableWidth > 0 ? Math.min(designWidth, this.availableWidth) : designWidth;
  }

  private sheetHeight(): number {
    const designHeight = this.isTablet ? READER_FULL_PANEL_HEIGHT_TABLET :
      READER_APPEARANCE_FULL_PANEL_HEIGHT_PHONE;
    return designHeight;
  }

  private headerWidth(): number {
    return Math.max(0, this.sheetWidth() - 26);
  }

  private viewportWidth(): number {
    return Math.max(0, this.sheetWidth() - 26);
  }

  private currentMotionFrame(): ReaderAppearanceMotionFrame {
    if (!this.motionEnabled) {
      throw new Error('ReaderAppearanceFullPanel: motion frame is required by the Phone motion owner');
    }
    return sampleReaderAppearanceMasterProgress(this.motionProgress, this.motionFullHeight);
  }

  private motionFrameOrUndefined(): ReaderAppearanceMotionFrame | undefined {
    if (!this.motionEnabled) {
      return undefined;
    }
    return sampleReaderAppearanceMasterProgress(this.motionProgress, this.motionFullHeight);
  }

  private motionViewportWidth(): number {
    return readerAppearanceMotionViewportWidth(this.currentMotionFrame(), this.sheetWidth());
  }

  private motionViewportHeight(): number {
    return readerAppearanceMotionViewportHeight(this.currentMotionFrame());
  }

  private motionFullViewportWidth(): number {
    const frame = this.currentMotionFrame();
    const available = Math.max(0, this.sheetWidth() - frame.contentSurface.x);
    return Math.max(0, Math.min(frame.contentSurface.width, available));
  }

  private motionFullViewportHeight(): number {
    const frame = this.currentMotionFrame();
    const available = Math.max(0, frame.shellHeight - frame.contentSurface.y);
    return Math.max(0, Math.min(frame.contentSurface.height, available));
  }

  private motionScrollCompensationY(): number {
    return readerAppearanceScrollCompensationVp(
      this.motionScrollOffsetY,
      this.currentMotionFrame().masterProgress,
    );
  }

  private fullEndpointInteractionEnabled(): boolean {
    return this.interactionEnabled && this.currentMotionFrame().masterProgress >= 0.999;
  }

  private quickEndpointInteractionEnabled(): boolean {
    return this.interactionEnabled && this.currentMotionFrame().masterProgress <= 0.001;
  }

  private viewportHeight(): number {
    return Math.max(0, this.sheetHeight() - 68);
  }

  private scrollViewportHeight(): number {
    if (this.availableHeight <= 0) {
      return this.viewportHeight();
    }
    return Math.max(0, Math.min(this.viewportHeight(), this.availableHeight - 68));
  }

  private contentHeight(): number {
    return this.isTablet ? 832 : 989;
  }

  private handleX(): number {
    const designX = this.isTablet ? 489 : 134;
    return Math.min(designX, Math.max(0, this.sheetWidth() - 42));
  }

  private sectionWidth(): number {
    return Math.max(0, this.viewportWidth() - 22);
  }

  private sectionInnerWidth(): number {
    return Math.max(0, this.sectionWidth() - 4);
  }

  private fullCardWidth(): number {
    return Math.max(0, (this.sectionInnerWidth() - 18) / 4);
  }

  private fullCardStride(): number {
    return this.fullCardWidth() + 6;
  }

  private fullFontCardWidth(): number {
    if (!this.isTablet) {
      return 73;
    }
    return this.fullCardWidth();
  }

  private fullFontCardStride(): number {
    if (!this.isTablet) {
      return 81;
    }
    return this.fullFontCardWidth() + 6;
  }

  private indentRowWidth(): number {
    return Math.max(0, this.sectionInnerWidth() - 20);
  }

  private indentOptionActive(value: string): boolean {
    return value === this.snapshot.indent;
  }

  private selectRowWidth(): number {
    return Math.max(0, (this.indentRowWidth() - 12) / 2);
  }

  private stepperPanelWidth(): number {
    return Math.max(0, this.sectionInnerWidth() - 2);
  }

  private stepperRowWidth(): number {
    return Math.max(0, this.sectionInnerWidth() - 20);
  }

  private themeIds(): ReaderAppearanceTheme[] {
    return ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
  }

  private fullFontIds(): ReaderAppearanceFontSlot[] {
    if (this.draggedFontId !== '' && this.previewFontOrder.length === this.snapshot.fontOrder.length) {
      return this.previewFontOrder.slice();
    }
    return this.snapshot.fontOrder.slice();
  }

  private beginFontDrag(fontId: ReaderAppearanceFontSlot): void {
    if (this.fontDragSettling) {
      return;
    }
    const index = this.snapshot.fontOrder.indexOf(fontId);
    if (index < 0) {
      return;
    }
    this.fontDragGeneration += 1;
    const applyLift = (): void => {
      this.draggedFontId = fontId;
      this.draggedFontIndex = index;
      this.draggedFontHoverIndex = index;
      this.draggedFontOffsetX = 0;
      this.draggedFontOffsetY = 0;
      this.previewFontOrder = this.snapshot.fontOrder.slice();
      this.fontDragSettling = false;
      this.onFontReorderActivityChange(true);
    };
    if (this.reduceMotion) {
      applyLift();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.shift'), applyLift);
  }

  private handleFontTouch(fontId: ReaderAppearanceFontSlot, event: TouchEvent): void {
    const touch = event.touches.length > 0 ? event.touches[0] : event.changedTouches[0];
    if (touch === undefined) {
      return;
    }
    if (event.type === TouchType.Down) {
      this.fontTouchId = touch.id;
      this.fontTouchStartX = touch.windowX;
      this.fontTouchStartY = touch.windowY;
      this.fontTouchCurrentX = touch.windowX;
      this.fontTouchCurrentY = touch.windowY;
      return;
    }
    if (this.fontTouchId >= 0 && touch.id !== this.fontTouchId) {
      return;
    }
    this.fontTouchCurrentX = touch.windowX;
    this.fontTouchCurrentY = touch.windowY;
    if (event.type === TouchType.Move) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        event.stopPropagation();
        this.updateFontDrag(
          this.fontTouchCurrentX - this.fontTouchStartX,
          this.fontTouchCurrentY - this.fontTouchStartY,
        );
      }
      return;
    }
    if (event.type === TouchType.Up) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        event.stopPropagation();
        this.finishFontDrag(
          this.fontTouchCurrentX - this.fontTouchStartX,
          this.fontTouchCurrentY - this.fontTouchStartY,
        );
      }
      this.clearFontTouchState();
      return;
    }
    if (event.type === TouchType.Cancel) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        this.cancelFontDrag();
      }
      this.clearFontTouchState();
    }
  }

  private updateFontDrag(offsetX: number, offsetY: number): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      return;
    }
    this.draggedFontOffsetX = offsetX;
    this.draggedFontOffsetY = offsetY;
    const targetIndex = this.fontDragTargetIndex(offsetX, offsetY);
    if (targetIndex === this.draggedFontHoverIndex) {
      return;
    }
    const nextOrder = moveReaderAppearanceFontSlot(
      this.snapshot.fontOrder,
      this.draggedFontIndex,
      targetIndex,
    );
    const applyPreview = (): void => {
      this.draggedFontHoverIndex = targetIndex;
      this.previewFontOrder = nextOrder;
    };
    if (this.reduceMotion) {
      applyPreview();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.shift'), applyPreview);
  }

  private finishFontDrag(offsetX: number, offsetY: number): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      this.cancelFontDrag();
      return;
    }
    this.updateFontDrag(offsetX, offsetY);
    const targetIndex = this.draggedFontHoverIndex;
    const nextOrder = this.previewFontOrder.slice();
    const changed = nextOrder.some((fontId: ReaderAppearanceFontSlot, index: number): boolean =>
      fontId !== this.snapshot.fontOrder[index]);
    const generation = this.fontDragGeneration;
    const targetOffsetX = this.fontSlotX(targetIndex) - this.fontSlotX(this.draggedFontIndex);
    const targetOffsetY = this.fontSlotY(targetIndex) - this.fontSlotY(this.draggedFontIndex);
    this.fontDragSettling = true;
    const finish = (): void => {
      if (generation !== this.fontDragGeneration) {
        return;
      }
      if (changed) {
        this.onFontOrderChange(nextOrder);
      }
      this.clearFontDragState();
    };
    const settle = (): void => {
      this.draggedFontOffsetX = targetOffsetX;
      this.draggedFontOffsetY = targetOffsetY;
    };
    if (this.reduceMotion) {
      settle();
      finish();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.settle', finish), settle);
  }

  private cancelFontDrag(): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      return;
    }
    this.fontDragGeneration += 1;
    const generation = this.fontDragGeneration;
    this.fontDragSettling = true;
    const rollback = (): void => {
      this.draggedFontHoverIndex = this.draggedFontIndex;
      this.previewFontOrder = this.snapshot.fontOrder.slice();
      this.draggedFontOffsetX = 0;
      this.draggedFontOffsetY = 0;
    };
    const finish = (): void => {
      if (generation === this.fontDragGeneration) {
        this.clearFontDragState();
      }
    };
    if (this.reduceMotion) {
      rollback();
      finish();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.settle', finish), rollback);
  }

  private clearFontDragState(): void {
    const wasActive = this.draggedFontId !== '' || this.fontDragSettling;
    this.draggedFontId = '';
    this.draggedFontIndex = -1;
    this.draggedFontHoverIndex = -1;
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.previewFontOrder = [];
    this.fontDragSettling = false;
    this.clearFontTouchState();
    if (wasActive) {
      this.onFontReorderActivityChange(false);
    }
  }

  private clearFontTouchState(): void {
    this.fontTouchId = -1;
    this.fontTouchStartX = 0;
    this.fontTouchStartY = 0;
    this.fontTouchCurrentX = 0;
    this.fontTouchCurrentY = 0;
  }

  private fontDisplayIndex(fontId: ReaderAppearanceFontSlot): number {
    const index = this.fullFontIds().indexOf(fontId);
    return index >= 0 ? index : 0;
  }

  private fontSlotX(index: number): number {
    return Math.max(0, index % 4) * this.fullFontCardStride();
  }

  private fontSlotY(index: number): number {
    return Math.max(0, Math.floor(index / 4)) * READER_FONT_REORDER_ROW_STRIDE;
  }

  private fontDragTranslateX(fontId: ReaderAppearanceFontSlot): number {
    if (this.draggedFontId !== fontId) {
      return 0;
    }
    return this.draggedFontOffsetX + this.fontSlotX(this.draggedFontIndex) -
      this.fontSlotX(this.fontDisplayIndex(fontId));
  }

  private fontDragTranslateY(fontId: ReaderAppearanceFontSlot): number {
    if (this.draggedFontId !== fontId) {
      return 0;
    }
    return this.draggedFontOffsetY + this.fontSlotY(this.draggedFontIndex) -
      this.fontSlotY(this.fontDisplayIndex(fontId));
  }

  private fontDragTargetIndex(offsetX: number, offsetY: number): number {
    const originColumn = this.draggedFontIndex % 4;
    const originRow = Math.floor(this.draggedFontIndex / 4);
    const centerX = originColumn * this.fullFontCardStride() + this.fullFontCardWidth() / 2 + offsetX;
    const centerY = originRow * READER_FONT_REORDER_ROW_STRIDE + 15 + offsetY;
    const column = Math.max(0, Math.min(3, Math.floor(centerX / this.fullFontCardStride())));
    const row = Math.max(0, Math.min(2, Math.floor(centerY / READER_FONT_REORDER_ROW_STRIDE)));
    return Math.max(0, Math.min(this.snapshot.fontOrder.length - 1, row * 4 + column));
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === 'import' ? this.snapshot.font === 'custom' : fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return fontId === 'import' || (isReaderAppearanceFont(fontId) && fontId !== 'custom');
  }

  private selectEnabled(kind: string): boolean {
    return kind === 'alignment' || kind === 'language' || kind === 'pageTurn';
  }

  private selectOptions(kind: string): string[] {
    if (kind === 'language') {
      return ['原文', '繁转简', '简转繁'];
    }
    if (kind === 'alignment') {
      return ['开启', '关闭'];
    }
    if (kind === 'pageTurn' && !this.pageTurnSimulationAvailable) {
      return ['覆盖', '平移', '滚动', '无动画'];
    }
    return ['仿真', '覆盖', '平移', '滚动', '无动画'];
  }

  private selectControlWidth(kind: string): number {
    const narrowDelta = Math.max(0, READER_FULL_PANEL_MAX_WIDTH_PHONE - this.sheetWidth());
    return Math.max(52, 56 - narrowDelta / 3);
  }

  private selectLabelWidth(kind: string): number {
    const controlX = this.selectRowWidth() - this.selectControlWidth(kind) - 8;
    return Math.max(0, controlX - 9);
  }

  private applySelectValue(kind: string, option: string): void {
    if (kind === 'language') {
      const next: ReaderChineseConversionMode = option === '繁转简' ? 't2s' :
        (option === '简转繁' ? 's2t' : 'none');
      if (next !== this.chineseConversionMode) {
        this.onChineseConversionChange(next);
      }
    } else if (kind === 'alignment') {
      const next: ReaderAppearanceAlignment = option === '开启' ? 'justify' : 'start';
      if (next !== this.snapshot.alignment) {
        this.onAlignmentRequest(this.snapshot.alignment);
      }
    } else if (kind === 'pageTurn') {
      const next: ReaderPageTurnStyle = option === '仿真' ? 'simulation' : (option === '覆盖' ? 'cover' :
        (option === '滚动' ? 'scroll' : (option === '无动画' ? 'none' : 'slide')));
      if (next === 'simulation' && !this.pageTurnSimulationAvailable) {
        return;
      }
      if (next !== this.pageTurnStyle) {
        this.onPageTurnStyleChange(next);
      }
    }
  }

  private selectLabel(kind: string): string {
    if (kind === 'indent') {
      return '缩进';
    }
    if (kind === 'language') {
      return '简繁';
    }
    if (kind === 'pageTurn') {
      return '翻页动画';
    }
    return '文字两端对齐';
  }

  private selectValue(kind: string): string {
    if (kind === 'indent') {
      if (this.snapshot.indent === 'none') {
        return '无';
      }
      return this.snapshot.indent === 'single' ? '单字' : '双字';
    }
    if (kind === 'language') {
      if (this.chineseConversionMode === 'none') {
        return '原文';
      }
      return this.chineseConversionMode === 't2s' ? '繁转简' : '简转繁';
    }
    if (kind === 'pageTurn') {
      if (this.pageTurnStyle === 'simulation') {
        return this.pageTurnSimulationAvailable ? '仿真' : '仿真不可用';
      }
      if (this.pageTurnStyle === 'cover') {
        return '覆盖';
      }
      if (this.pageTurnStyle === 'scroll') {
        return '滚动';
      }
      return this.pageTurnStyle === 'none' ? '无动画' : '平移';
    }
    return this.snapshot.alignment === 'justify' ? '开启' : '关闭';
  }

  private selectAccessibilityText(kind: string): string {
    if (kind === 'pageTurn') {
      if (this.pageTurnStyle === 'simulation' && !this.pageTurnSimulationAvailable) {
        return '翻页动画，仿真当前宿主能力不可用，本会话使用无动画';
      }
      return `翻页动画，当前${this.selectValue(kind)}`;
    }
    return `${this.selectLabel(kind)}，当前${this.selectValue(kind)}`;
  }

  private metricLabel(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') {
      return '字号';
    }
    if (metric === 'lineHeightMultiplier') {
      return '行距';
    }
    if (metric === 'paragraphSpacing') {
      return '段距';
    }
    return '字距';
  }

  private metricValue(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') {
      return `${this.snapshot.fontSize}`;
    }
    if (metric === 'lineHeightMultiplier') {
      return this.snapshot.lineHeightMultiplier.toFixed(2);
    }
    if (metric === 'paragraphSpacing') {
      return `${this.snapshot.paragraphSpacing}`;
    }
    return `${this.snapshot.letterSpacing}`;
  }

  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private themeLabel(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeLabel(theme);
  }

  private themeColor(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeSwatch(theme);
  }

}
