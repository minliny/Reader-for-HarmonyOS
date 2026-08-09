import {
  TOK_HOME_TOP_BAR_INSET,
  TOK_INK,
} from './ReaderTokens';

// AppTopBar —— 首页顶部标题栏统一组件 (Figma HomeTopBar): 58 高、左右 20 + 顶部 6
// 内边距、29px 思源宋体粗题 + 可选尾部槽。收敛 Bookshelf/Discover/Settings 三页
// 标题栏 (此前各页复制 Row+title+按钮 结构)。RSS 例外:其 Figma 节点 (2305:26) 为
// 胶囊簇紧贴标题 (Container 距标题 10)、非右对齐尾部, 与 layoutWeight 标题模型互斥,
// 故 RssPage 保留页私有实现 (见该页注释)。
@Component
export struct AppTopBar {
  title: string = '';
  /** 可选尾部槽 (图标钮簇);未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row() {
      Text(this.title)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(38)
        .fontColor(TOK_INK);

      if (this.trailing !== undefined) {
        this.trailing();
      }
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_HOME_TOP_BAR_INSET, right: TOK_HOME_TOP_BAR_INSET, top: 6 })
    .alignItems(VerticalAlign.Center);
  }
}
