import { readerLayoutCarrierResponseRegion } from '../layout/ReaderPageNativeAttributes';
import { DIRECTORY_CHROME_VISUAL as visual, mangaDirectoryScale, mangaDirectoryHeaderHeight } from '../foundation/ReaderDirectoryChromeVisual';
import { MangaDirectoryPressFeedback } from '../foundation/MangaDirectoryPressFeedback';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerSurfaceElevation, readerHeaderVeilMaterial, readerHeaderVeilBorder } from '../surfaces/ReaderSurfaceSpecs';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../layout/ReaderRaisedShape';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { readerActionTouchRegion } from '../controls/ReaderActionAccessibility';
import { TOK_SPACE_CONTROL_INLINE } from '../foundation/ReaderTokens';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from '../foundation/ReaderWindowMetrics';
import { TYPE_DOWNLOAD_HEADER_TITLE, TYPE_PAGE_TITLE } from '../foundation/ReaderTypography';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../foundation/ReaderFontFamilies.ts';
import { APP_FLOATING_HEADER_BAR_HEIGHT, APP_HEADER_BAR_HEIGHT, DOWNLOAD_HEADER_HEIGHT,
  DOWNLOAD_HEADER_ACTION_WIDTH, DOWNLOAD_HEADER_ACTION_HEIGHT } from '../foundation/ReaderHeaderMetrics';
import { readerScaledBarHeight } from '../foundation/ReaderSurfaceResolvers';

const DOWNLOAD_HEADER_SLOT_WIDTH = 80;
const DOWNLOAD_HEADER_PADDING_Y = 3;
const DOWNLOAD_HEADER_RADIUS = 18;

// 二级页面共用返回栏和标题字阶。漫画目录沿用其独立视觉合同。
// 曾被 Settings/SourceManagement/Sync/Rss/LocalBookDetail 各自复制实现。
@Component
export struct PageBackBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop title: string = '';
  @Prop trailingWidthVp: number = 44;
  @Prop centered: boolean = false;
  @Prop @Watch('onRaisedRecipeChanged') floating: boolean = false;
  /** Rounded fixed bars keep their geometry without inheriting lift. */
  @Prop elevation: 'fixed' | 'floating' | 'raised' = 'fixed';
  @Prop material: 'solid' | 'veil' = 'solid';
  @Prop scrolled: boolean = false;
  @State private raisedShape: ReaderRaisedShape | undefined = undefined;
  private mounted: boolean = false;
  private appearanceEpoch: number = 0;
  @Prop @Watch('onRaisedRecipeChanged') variant: 'standard' | 'mangaDirectory' | 'download' = 'standard';
  /**
   * Header surface is an explicit variant contract. Secondary pages are
   * fixed above a scrolling body, so the standard variant is solid by
   * default; callers that intentionally float over reader content must opt
   * into transparent explicitly. Manga and floating variants always retain
   * their own surface treatment below.
   */
  @Prop surface: 'solid' | 'transparent' = 'solid';
  /** 可选父页面颜色；默认颜色在渲染时读取当前主题，不能冻结在构造阶段。 */
  @Prop titleColor: string = '';
  @Prop backLabel: string = '返回';
  @Prop backFocusId: string = '';
  @Prop showBack: boolean = true;
  onBack: () => void = (): void => {};
  onHeightChange: (height: number) => void = (_height: number): void => {};
  /** 可选尾部槽 (如 SourceManagement 的 44×44 more 钮); 未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  aboutToAppear(): void { this.appearanceEpoch += 1; this.raisedShape = undefined; this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    if (this.raised()) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.panel();
      }.width('100%').clip(false).hitTestBehavior(HitTestMode.Default)
        .responseRegion(readerLayoutCarrierResponseRegion());
    } else {
      this.panel();
    }
  }

  @Builder
  private panel() {
    Row({ space: this.variant === 'standard' ? TOK_SPACE_CONTROL_INLINE : 0 }) {
      if (!this.showBack) {
        if (this.centered || this.variant === 'download') {
          Blank().width(this.variant === 'download' ? DOWNLOAD_HEADER_SLOT_WIDTH : this.trailingWidthVp).height(44);
        }
      } else if (this.variant === 'download') {
        this.downloadBack();
      } else {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.backIconResource())
            .width(this.variant === 'mangaDirectory' ? visual.headerIcon : 24)
            .height(this.variant === 'mangaDirectory' ? visual.headerIcon : 24)
            .objectFit(ImageFit.Contain).accessibilityLevel('no');
        }
        .width(this.variant === 'mangaDirectory' ? visual.headerSlot : 44)
        .height(this.variant === 'mangaDirectory' ? visual.headerSlot : 44)
        .padding(0).backgroundColor(Color.Transparent)
        .borderRadius(this.variant === 'mangaDirectory' ? visual.headerButtonRadius : 22)
        .attributeModifier(new MangaDirectoryPressFeedback(true, this.variant === 'mangaDirectory', this.appThemeScheme, 'nativeButton'))
        .accessibilityText(this.backLabel).accessibilityRole(AccessibilityRoleType.BUTTON)
        .id(this.backFocusId)
        .onClick((): void => this.onBack());
      }

      if (this.variant === 'download') {
        Text(this.title).fontFamily(TYPE_DOWNLOAD_HEADER_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_HEADER_TITLE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_HEADER_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_HEADER_TITLE.lineHeightFp as number)
          .halfLeading(true).fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Center).layoutWeight(1);
      } else {
        Text(this.title)
          .fontFamily(this.variant === 'mangaDirectory' ? READER_FONT_NOTO_SANS_SC_UI_BOLD : TYPE_PAGE_TITLE.fontFamily)
          .fontWeight(this.variant === 'mangaDirectory' ? visual.headerFontWeight : TYPE_PAGE_TITLE.fontWeight)
          .fontSize(this.variant === 'mangaDirectory' ? visual.headerFontSize : TYPE_PAGE_TITLE.fontSizeFp)
          .lineHeight(this.adaptsTitleSize() ? undefined :
            this.variant === 'mangaDirectory' ? visual.headerLineHeight : TYPE_PAGE_TITLE.lineHeightFp as number)
          .minFontSize(this.adaptsTitleSize() ? Math.round(TYPE_PAGE_TITLE.fontSizeFp * 0.75) : undefined)
          .maxFontSize(this.adaptsTitleSize() ? TYPE_PAGE_TITLE.fontSizeFp : undefined)
          .heightAdaptivePolicy(TextHeightAdaptivePolicy.LAYOUT_CONSTRAINT_FIRST)
          .constraintSize({ maxHeight: this.multilineTitle() ? this.standardTitleHeightLimit() : undefined })
          .halfLeading(true)
          .minFontScale(this.variant === 'mangaDirectory' ? Math.min(1, this.mangaFontScale()) : 0)
          .maxFontScale(this.variant === 'mangaDirectory' ? Math.max(1, this.mangaFontScale()) : Math.max(1, this.fontScale()))
          .fontColor(this.titleColor.length > 0 ? this.titleColor : readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(this.multilineTitle() ? 2 : 1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(this.title)
          .layoutWeight(1)
          .textAlign(this.centered ? TextAlign.Center : TextAlign.Start);
      }

      if (this.variant === 'download') {
        Row() {
          Blank().layoutWeight(1);
          if (this.trailing !== undefined) { this.trailing(); }
        }.width(DOWNLOAD_HEADER_SLOT_WIDTH);
      } else if (this.trailing !== undefined) {
        Stack({ alignContent: Alignment.Center }) { this.trailing(); }.width(this.variant === 'mangaDirectory' ? visual.headerSlot : this.trailingWidthVp)
          .height(this.variant === 'mangaDirectory' ? visual.headerSlot : undefined)
          .constraintSize({ minHeight: this.variant === 'mangaDirectory' ? undefined : 44 });
      } else if (this.centered) {
        Blank().width(this.variant === 'mangaDirectory' ? visual.headerSlot : 44).height(this.variant === 'mangaDirectory' ? visual.headerSlot : 44);
      }
    }
    .width('100%')
    .constraintSize({ minHeight: this.barHeight() })
    .padding({ left: this.leftInset(), right: this.rightInset(), top: this.verticalInset(), bottom: this.verticalInset() })
    .alignItems(VerticalAlign.Center)
    .backgroundEffect(this.veil() ? readerHeaderVeilMaterial(this.scrolled, this.appThemeScheme) : undefined)
    .backgroundColor(this.veil() || this.surface === 'transparent' ? Color.Transparent :
      readerAppColor('TOK_PAPER', this.appThemeScheme))
    .border({ width: this.framed() ? this.variant === 'mangaDirectory' ? visual.borderWidth : 1 : 0,
      color: this.veil() ? readerHeaderVeilBorder(this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(this.panelRadius())
    .clip(this.variant === 'download' && this.elevation === 'fixed' && !this.veil() && this.surface === 'solid')
    .shadow(readerSurfaceElevation(this.raised() ? 'raised' : this.elevation === 'floating' ? 'floating' : 'fixed', this.appThemeScheme))
    .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion(this.veil() || this.surface === 'solid'))
    .onTouch((): void => {})
    .onAreaChange(this.panelAreaChangeHandler());
  }

  @Builder
  private downloadBack() {
    Row() {
      Button({ type: ButtonType.Normal }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.download_visual_back_theme_night') :
          $r('app.media.download_visual_back')).width(18).height(18);
      }.id(this.backFocusId).width(DOWNLOAD_HEADER_ACTION_WIDTH).height(DOWNLOAD_HEADER_ACTION_HEIGHT)
        .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .responseRegion(readerActionTouchRegion(DOWNLOAD_HEADER_ACTION_WIDTH, DOWNLOAD_HEADER_ACTION_HEIGHT))
        .accessibilityText(this.backLabel).onClick((): void => this.onBack());
    }.width(DOWNLOAD_HEADER_SLOT_WIDTH);
  }

  private framed(): boolean { return this.floating || this.variant === 'download'; }
  private multilineTitle(): boolean { return this.variant === 'standard' && !this.floating; }
  private adaptsTitleSize(): boolean { return this.multilineTitle() && this.fontScale() > 1; }
  private standardTitleHeightLimit(): number { return APP_HEADER_BAR_HEIGHT * 2; }
  private verticalInset(): number { return this.variant === 'download' ? DOWNLOAD_HEADER_PADDING_Y : 0; }
  private raised(): boolean { return this.variant === 'standard' && this.elevation === 'raised'; }
  private veil(): boolean { return this.floating || (this.variant === 'standard' && this.material === 'veil'); }

  private backIconResource(): Resource {
    if (this.variant === 'mangaDirectory') {
      return this.appThemeScheme === 'night' ? $r('app.media.manga_directory_back_theme_night') :
        $r('app.media.manga_directory_back');
    }
    return this.appThemeScheme === 'night' ? $r('app.media.book_detail_back_theme_night') :
      $r('app.media.book_detail_back');
  }

  private requestedRadius(): number {
    return this.variant === 'download' ? DOWNLOAD_HEADER_RADIUS : this.floating ? this.barHeight() / 2 : 0;
  }

  private raisedShapeIdentity(): string {
    return JSON.stringify(['page-back', this.appearanceEpoch, this.readerWindowMetricsRevision,
      this.variant, this.floating, this.elevation, this.barHeight(), this.requestedRadius()]);
  }

  private currentRaisedShape(): ReaderRaisedShape | undefined {
    return this.mounted ? this.raisedShape : undefined;
  }

  private onRaisedRecipeChanged(): void {
    const shape = this.raisedShape;
    if (shape !== undefined) this.raisedShape = resolveReaderRaisedShape(this.raisedShapeIdentity(),
      shape.width, shape.height, this.requestedRadius());
  }

  private panelRadius(): number {
    return this.currentRaisedShape()?.radius ?? resolveReaderRaisedShape(this.raisedShapeIdentity(),
      readerWindowMetrics().windowRect.width, this.barHeight(), this.requestedRadius())?.radius ?? 0;
  }

  private panelAreaChangeHandler(): (_old: Area, next: Area) => void {
    const identity = this.raisedShapeIdentity();
    const variant = this.variant;
    return (_old: Area, next: Area): void => {
      if (!this.mounted || identity !== this.raisedShapeIdentity() || variant !== this.variant) return;
      if (this.raised()) this.captureRaisedArea(next, identity);
      if (variant === 'download') this.onHeightChange(readerPageAreaLength(next.height));
    };
  }

  private captureRaisedArea(next: Area, identity: string): void {
    if (!this.mounted || identity !== this.raisedShapeIdentity()) return;
    const width = readerPageAreaLength(next.width);
    const height = readerPageAreaLength(next.height);
    const shape = resolveReaderRaisedShape(identity, width, height, this.requestedRadius());
    if (shape === undefined) return;
    const previous = this.raisedShape;
    if (previous?.identity === identity && Math.abs(width - previous.width) <= .25 && Math.abs(height - previous.height) <= .25) return;
    this.raisedShape = shape;
  }

  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : readerWindowMetrics().systemFontScale);
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    const scale = readerWindowMetrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private barHeight(): number {
    if (this.variant === 'download') return DOWNLOAD_HEADER_HEIGHT;
    if (this.variant === 'mangaDirectory') return mangaDirectoryHeaderHeight(this.mangaFontScale());
    return this.floating
      ? readerScaledBarHeight(APP_FLOATING_HEADER_BAR_HEIGHT, TYPE_PAGE_TITLE.lineHeightFp as number, this.fontScale(), 0)
      : Math.min(this.standardTitleHeightLimit(),
        readerScaledBarHeight(APP_HEADER_BAR_HEIGHT, TYPE_PAGE_TITLE.lineHeightFp as number, this.fontScale(), 0));
  }

  private leftInset(): number {
    if (this.variant === 'mangaDirectory') return visual.headerPadding;
    // The floating frame's parent owns cutouts; keep internal slots symmetric.
    if (this.floating || this.variant === 'download') return 9;
    if (this.readerWindowMetricsRevision < 0) {
      return 20;
    }
    return Math.max(20, readerInteractiveSafeLeft(readerWindowMetrics()));
  }

  private rightInset(): number {
    if (this.variant === 'mangaDirectory') return visual.headerPadding;
    if (this.floating || this.variant === 'download') return 9;
    if (this.readerWindowMetricsRevision < 0) {
      return 20;
    }
    return Math.max(20, readerInteractiveSafeRight(readerWindowMetrics()));
  }
}
