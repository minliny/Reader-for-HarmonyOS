import { readerAppColor } from './ReaderThemeRegistry';
import {
  TOK_HOME_TOP_BAR_INSET,
  TOK_INK,
} from './ReaderTokens';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
} from './ReaderWindowMetrics';
import { TYPE_APP_HOME_TITLE } from './ReaderTypography';

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
  /** 可选尾部槽 (图标钮簇);未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row() {
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
    .width('100%')
    .height(58)
    .padding({ left: this.leftInset(), right: this.rightInset(), top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  private leftInset(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()),
    );
  }

  private rightInset(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return TOK_HOME_TOP_BAR_INSET;
    }
    return Math.max(
      TOK_HOME_TOP_BAR_INSET,
      readerInteractiveSafeRight(ReaderWindowCoordinator.metrics()),
    );
  }
}
