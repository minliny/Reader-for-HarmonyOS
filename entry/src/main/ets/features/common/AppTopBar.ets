import { readerAppColor } from './ReaderThemeRegistry';
import {
  TOK_HOME_TOP_BAR_INSET,
  TOK_INK,
  TOK_SURFACE_SOLID,
} from './ReaderTokens';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from './ReaderWindowMetrics';
import { TYPE_APP_HOME_TITLE } from './ReaderTypography';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from './ReaderFontFamilies.ts';
import { ReaderHeaderFrameModifier } from './ReaderPageShell';

// AppTopBar —— 首页顶部标题栏统一组件 (Figma HomeTopBar): 58 高、左右 20 + 顶部 6
// 内边距、29px 思源宋体粗题 + 可选尾部槽。收敛 Bookshelf/Discover/Settings 三页
// 标题栏 (此前各页复制 Row+title+按钮 结构)。RSS 例外:其 Figma 节点 (2305:26) 为
// 胶囊簇紧贴标题 (Container 距标题 10)、非右对齐尾部, 与 layoutWeight 标题模型互斥,
// 故 RssPage 保留页私有实现 (见该页注释)。
@Component
export struct AppTopBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  title: string = '';
  /** Visible boundary for a fixed header, requested by the bookshelf review. */
  divider: boolean = false;
  @Prop floating: boolean = false;
  /** Fixed app headers use a solid surface by default. Transparent is an
   * explicit overlay variant and must be selected by the owning page. */
  @Prop surface: 'solid' | 'transparent' = 'solid';
  /** Floating manga/shelf headers use a symmetric slot grid so the title is centered. */
  @Prop centered: boolean = false;
  /** The shelf header owns its search action in the leading 44vp slot. */
  @Prop showLeadingSearch: boolean = false;
  onLeadingTap: () => void = (): void => {};
  /** 可选尾部槽 (图标钮簇);未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row() {
      if (this.floating && this.centered) {
        if (this.showLeadingSearch) {
          Stack({ alignContent: Alignment.Center }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.bookshelf_search_theme_night') : $r('app.media.bookshelf_search'))
              .width(24)
              .height(24);
          }
          .width(44)
          .height(44)
          .borderRadius(22)
          .onClick((): void => this.onLeadingTap());
        } else {
          Blank().width(44).height(44);
        }

        Text(this.title)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Center)
          // ArkUI does not reliably interpolate a 650 weight on the bundled
          // variable CJK face. The static UI bold face keeps the 650-like
          // header contrast used by the manga design across devices.
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
          .fontWeight(FontWeight.Bold)
          .fontSize(19)
          .lineHeight(28)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));

        if (this.trailing !== undefined) {
          this.trailing();
        } else {
          Blank().width(44).height(44);
        }
      } else {
        Text(this.title)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(TYPE_APP_HOME_TITLE.fontFamily)
          .fontWeight(TYPE_APP_HOME_TITLE.fontWeight)
          .fontSize(TYPE_APP_HOME_TITLE.fontSizeFp)
          .lineHeight(TYPE_APP_HOME_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));

        if (this.trailing !== undefined) {
          this.trailing();
        }
      }
    }
    .width('100%')
    .height(this.floating ? 52 : 58)
    .padding({ left: this.floating ? 4 : this.leftInset(), right: this.floating ? 4 : this.rightInset(), top: this.floating ? 0 : 6 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.floating ? readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme) : this.surface === 'solid' ? readerAppColor('TOK_PAPER', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.floating ? 1 : { bottom: this.divider ? 1 : 0 },
      color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .borderRadius(this.floating ? 18 : 0)
    .clip(this.floating)
    .shadow(this.floating ? { radius: 18,
      color: readerAppColor('app.BookshelfPage.projectionBookCoverLayer.color.1A594632', this.appThemeScheme),
      offsetX: 0, offsetY: 5 } : { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
    .attributeModifier(new ReaderHeaderFrameModifier(this.floating ? 'floating' : 'home',
      this.surface, this.appThemeScheme))
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private leftInset(): number {
    if (this.floating) return TOK_HOME_TOP_BAR_INSET;
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()),
    );
  }

  private rightInset(): number {
    if (this.floating) return TOK_HOME_TOP_BAR_INSET;
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()),
    );
  }
}
