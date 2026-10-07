import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryHeaderHeight } from '../manga/MangaDirectoryVisual';
import { MangaDirectoryPressFeedback } from '../manga/MangaDirectoryPressFeedback';
import { readerAppColor } from './ReaderThemeRegistry';
import {
  TOK_SPACE_CONTROL_INLINE,
  TOK_SURFACE_SOLID,
} from './ReaderTokens';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from './ReaderWindowMetrics';
import { TYPE_PAGE_TITLE } from './ReaderTypography';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_650 } from './ReaderFontFamilies.ts';

// 二级页面统一返回栏:44×44 圆角返回钮 + 24px 思源宋体标题,58 高、20vp 内边距。
// 曾被 Settings/SourceManagement/Sync/Rss/LocalBookDetail 各自复制实现。
@Component
export struct PageBackBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  title: string = '';
  @Prop centered: boolean = false;
  @Prop floating: boolean = false;
  @Prop variant: 'standard' | 'mangaDirectory' = 'standard';
  /** 默认 `search_back`;详情页等可传其他返回图标。 */
  backIcon?: Resource;
  /** 可选父页面颜色；默认颜色在渲染时读取当前主题，不能冻结在构造阶段。 */
  @Prop titleColor: string = '';
  onBack: () => void = (): void => {};
  /** 可选尾部槽 (如 SourceManagement 的 44×44 more 钮); 未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row({ space: this.variant === 'mangaDirectory' ? 0 : TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.backIcon !== undefined ? this.backIcon : (this.appThemeScheme === 'night' ? $r('app.media.search_back_theme_night') : $r('app.media.search_back')))
          .width(this.variant === 'mangaDirectory' ? visual.headerIcon : 24)
          .height(this.variant === 'mangaDirectory' ? visual.headerIcon : 24);
      }
      .width(this.variant === 'mangaDirectory' ? visual.headerSlot : 44)
      .height(this.variant === 'mangaDirectory' ? visual.headerSlot : 44)
      .borderRadius(this.variant === 'mangaDirectory' ? visual.headerButtonRadius : 22)
      .attributeModifier(new MangaDirectoryPressFeedback(true, this.variant === 'mangaDirectory', this.appThemeScheme))
      .onClick((): void => this.onBack());

      Text(this.title)
        .fontFamily(this.variant === 'mangaDirectory' ? READER_FONT_NOTO_SANS_SC_UI_650 : this.floating ? READER_FONT_NOTO_SANS_SC_UI_BOLD : TYPE_PAGE_TITLE.fontFamily)
        .fontWeight(this.variant === 'mangaDirectory' ? visual.headerFontWeight : this.floating ? FontWeight.Bold : TYPE_PAGE_TITLE.fontWeight,
          { enableVariableFontWeight: this.variant === 'mangaDirectory' })
        .fontSize(this.variant === 'mangaDirectory' ? visual.headerFontSize : this.floating ? 19 : TYPE_PAGE_TITLE.fontSizeFp)
        .lineHeight(this.variant === 'mangaDirectory' ? visual.headerLineHeight : this.floating ? 28 : TYPE_PAGE_TITLE.lineHeightFp as number)
        .halfLeading(this.variant === 'mangaDirectory')
        .minFontScale(this.variant === 'mangaDirectory' ? Math.min(1, this.mangaFontScale()) : 0)
        .maxFontScale(this.variant === 'mangaDirectory' ? Math.max(1, this.mangaFontScale()) : 2)
        .fontColor(this.titleColor.length > 0 ? this.titleColor : this.variant === 'mangaDirectory' ? mangaDirectoryColor('ink', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
        .textAlign(this.centered ? TextAlign.Center : TextAlign.Start);

      if (this.trailing !== undefined) {
        Stack({ alignContent: Alignment.Center }) { this.trailing(); }.width(this.variant === 'mangaDirectory' ? visual.headerSlot : 44).height(this.variant === 'mangaDirectory' ? visual.headerSlot : 44);
      } else if (this.centered) {
        Blank().width(this.variant === 'mangaDirectory' ? visual.headerSlot : 44).height(this.variant === 'mangaDirectory' ? visual.headerSlot : 44);
      }
    }
    .width('100%')
    .height(this.variant === 'mangaDirectory' ? mangaDirectoryHeaderHeight(this.mangaFontScale()) : this.floating ? 52 : 58)
    .padding({ left: this.leftInset(), right: this.rightInset() })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.variant === 'mangaDirectory' ? mangaDirectoryColor('surface', this.appThemeScheme) : this.floating ? readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.floating ? this.variant === 'mangaDirectory' ? visual.borderWidth : 1 : 0,
      color: this.variant === 'mangaDirectory' ? mangaDirectoryColor('line', this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(this.floating ? this.variant === 'mangaDirectory' ? visual.headerRadius : 18 : 0)
    .clip(this.floating)
    .shadow(this.floating ? { radius: this.variant === 'mangaDirectory' ? visual.shadowRadius : 18,
      color: this.variant === 'mangaDirectory' ? mangaDirectoryColor('shadow', this.appThemeScheme) : readerAppColor('app.BookshelfPage.projectionBookCoverLayer.color.1A594632', this.appThemeScheme),
      offsetX: 0, offsetY: this.variant === 'mangaDirectory' ? visual.shadowOffsetY : 5 } : { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private leftInset(): number {
    if (this.variant === 'mangaDirectory') return visual.headerPadding;
    // The floating frame's parent owns cutouts; keep internal slots symmetric.
    if (this.floating) return 4;
    if (this.readerWindowMetricsRevision < 0) {
      return this.floating ? 4 : 20;
    }
    return Math.max(this.floating ? 4 : 20, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private rightInset(): number {
    if (this.variant === 'mangaDirectory') return visual.headerPadding;
    if (this.floating) return 4;
    if (this.readerWindowMetricsRevision < 0) {
      return this.floating ? 4 : 20;
    }
    return Math.max(this.floating ? 4 : 20, readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()));
  }
}
