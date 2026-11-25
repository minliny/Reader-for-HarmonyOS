import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import {
  TOK_HOME_TOP_BAR_INSET,
} from '../foundation/ReaderTokens';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from '../foundation/ReaderWindowMetrics';
import { TYPE_APP_HOME_TITLE } from '../foundation/ReaderTypography';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../foundation/ReaderFontFamilies.ts';
import { APP_FLOATING_HEADER_BAR_HEIGHT, APP_HEADER_BAR_HEIGHT } from '../foundation/ReaderHeaderMetrics';
import { readerScaledBarHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerHeaderVeilBorder, readerHeaderVeilMaterial, readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';

// AppTopBar —— 首页顶部标题栏统一组件 (Figma HomeTopBar): 58 高、左右 20 + 顶部 6
// 内边距、29px 思源黑体 UI 粗题 + 可选尾部槽。收敛 Bookshelf/Discover/Settings 三页
// 标题栏 (此前各页复制 Row+title+按钮 结构)。RSS 例外:其 Figma 节点 (2305:26) 为
// 胶囊簇紧贴标题 (Container 距标题 10)、非右对齐尾部, 与 layoutWeight 标题模型互斥,
// 故 RssPage 保留页私有实现 (见该页注释)。
@Component
export struct AppTopBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop title: string = '';
  /** Visible boundary for a fixed header, requested by the bookshelf review. */
  divider: boolean = false;
  @Prop floating: boolean = false;
  /** Fixed app headers use a solid surface by default. Transparent is an
   * explicit overlay variant and must be selected by the owning page. */
  @Prop surface: 'solid' | 'transparent' = 'solid';
  /** Floating manga/shelf headers use a symmetric slot grid so the title is centered. */
  @Prop centered: boolean = false;
  /** 可选尾部槽 (图标钮簇);未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  private barHeight(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale;
    return this.floating
      ? readerScaledBarHeight(APP_FLOATING_HEADER_BAR_HEIGHT, 28, scale, 0)
      : readerScaledBarHeight(APP_HEADER_BAR_HEIGHT, TYPE_APP_HOME_TITLE.lineHeightFp as number, scale, 6);
  }

  build() {
    Row() {
      if (this.floating && this.centered) {
        Blank().width(44).height(44);

        Text(this.title)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Center)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
          .fontWeight(FontWeight.Bold)
          .fontSize(16)
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
    .constraintSize({ minHeight: this.barHeight(), maxWidth: this.floating ? 580 : undefined })
    .padding({ left: this.floating ? 9 : this.leftInset(), right: this.floating ? 9 : this.rightInset(), top: this.floating ? 0 : 6 })
    .alignItems(VerticalAlign.Center)
    .backgroundEffect(this.floating ? readerHeaderVeilMaterial(false, this.appThemeScheme) : undefined)
    .backgroundColor(!this.floating && this.surface === 'solid' ?
      readerAppColor('TOK_PAPER', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.floating ? 1 : { bottom: this.divider ? 1 : 0 },
      color: this.floating ? readerHeaderVeilBorder(this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(this.floating ? this.barHeight() / 2 : 0)
    .clip(false)
    .shadow(readerSurfaceElevation(this.floating ? 'raised' : 'fixed', this.appThemeScheme))
    .hitTestBehavior(this.floating || this.surface === 'solid' ? HitTestMode.Default : HitTestMode.None)
    .onTouch((): void => {});
  }

  private leftInset(): number {
    if (this.floating) return TOK_HOME_TOP_BAR_INSET;
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeLeft(readerWindowMetrics()),
    );
  }

  private rightInset(): number {
    if (this.floating) return TOK_HOME_TOP_BAR_INSET;
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeRight(readerWindowMetrics()),
    );
  }
}
