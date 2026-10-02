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

// 二级页面统一返回栏:44×44 圆角返回钮 + 24px 思源宋体标题,58 高、20vp 内边距。
// 曾被 Settings/SourceManagement/Sync/Rss/LocalBookDetail 各自复制实现。
@Component
export struct PageBackBar {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  title: string = '';
  @Prop centered: boolean = false;
  @Prop floating: boolean = false;
  /** 默认 `search_back`;详情页等可传其他返回图标。 */
  backIcon?: Resource;
  /** 可选父页面颜色；默认颜色在渲染时读取当前主题，不能冻结在构造阶段。 */
  @Prop titleColor: string = '';
  onBack: () => void = (): void => {};
  /** 可选尾部槽 (如 SourceManagement 的 44×44 more 钮); 未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.backIcon !== undefined ? this.backIcon : (this.appThemeScheme === 'night' ? $r('app.media.search_back_theme_night') : $r('app.media.search_back')))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text(this.title)
        .fontFamily(this.floating ? 'ReaderNotoSansSC' : TYPE_PAGE_TITLE.fontFamily)
        .fontWeight(this.floating ? 650 : TYPE_PAGE_TITLE.fontWeight)
        .fontSize(this.floating ? 19 : TYPE_PAGE_TITLE.fontSizeFp)
        .lineHeight(this.floating ? 28 : TYPE_PAGE_TITLE.lineHeightFp as number)
        .fontColor(this.titleColor.length > 0 ? this.titleColor : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
        .textAlign(this.centered ? TextAlign.Center : TextAlign.Start);

      if (this.trailing !== undefined) {
        Stack({ alignContent: Alignment.Center }) { this.trailing(); }.width(44).height(44);
      } else if (this.centered) {
        Blank().width(44).height(44);
      }
    }
    .width('100%')
    .height(this.floating ? 52 : 58)
    .padding({ left: this.leftInset(), right: this.rightInset() })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.floating ? readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.floating ? 1 : 0,
      color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(this.floating ? 18 : 0)
    .clip(this.floating)
    .shadow(this.floating ? { radius: 18,
      color: readerAppColor('app.BookshelfPage.projectionBookCoverLayer.color.1A594632', this.appThemeScheme),
      offsetX: 0, offsetY: 5 } : { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private leftInset(): number {
    // The floating frame's parent owns cutouts; keep internal slots symmetric.
    if (this.floating) return 4;
    if (this.readerWindowMetricsRevision < 0) {
      return this.floating ? 4 : 20;
    }
    return Math.max(this.floating ? 4 : 20, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private rightInset(): number {
    if (this.floating) return 4;
    if (this.readerWindowMetricsRevision < 0) {
      return this.floating ? 4 : 20;
    }
    return Math.max(this.floating ? 4 : 20, readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()));
  }
}
