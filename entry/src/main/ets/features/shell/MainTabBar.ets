import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_SPACE_MD,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';


// 公共主导航 —— 数据驱动的 tab 栏。四个主页面（书架/发现/RSS/设置）复用。
// tab 列表来自单一配置（MAIN_TABS）：增删 tab 只改配置，宽度按数量自适应平分。
// 选中态由 current 驱动；点击非当前 tab 回调 onSelect(key)，由宿主页映射到各自回调。
// Figma 重绘版：公共主导航 362×68 r24 bg #E6FFFCF8 border #C1C7CD，item 高 52.9 r24，
// 选中 bg #1F3528 + 文字 #FFFAF4，未选中文字 #756F69；icon 24，标签 Inter ExtraBold 11。
// 颜色直接使用 TOK_* 语义 token (无二次别名)。

export interface MainTabDef {
  key: string;
  label: string;
}

export const MAIN_TABS: MainTabDef[] = [
  { key: 'bookshelf', label: '书架' },
  { key: 'discover', label: '发现' },
  { key: 'rss', label: 'RSS' },
  { key: 'settings', label: '设置' },
];

@Component
export struct MainTabBar {
  @Prop current: string = 'bookshelf';
  onSelect: (key: string) => void = (_key: string): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Row() {
      ForEach(MAIN_TABS, (tab: MainTabDef) => {
        this.tabItem(tab, this.current === tab.key);
      }, (tab: MainTabDef): string => `main-tab-${tab.key}`);
    }
    .width('100%')
    .constraintSize({ maxWidth: 362 })
    .height(68)
    .padding(TOK_SPACE_XS)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(24)
    .margin({ bottom: TOK_SPACE_MD });
  }

  @Builder
  private tabItem(tab: MainTabDef, active: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        this.tabIcon(tab.key, active);
      }
      .width(30)
      .height(30);

      Text(tab.label)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(active ? TOK_ON_PRIMARY : TOK_MUTED);
    }
    .layoutWeight(1)
    .height(54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? TOK_PRIMARY_DARK : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (!active) {
        this.onSelect(tab.key);
      }
    });
  }

  // 镜像 canonical Navigation/MainTabItem 语义: 选中态用 Filled(白 #FFFAF4),
  // 未选中用 outline(灰 #756F69)。修复书架 tab 未选中时白图标"丢失"。
  private tabIconResource(key: string, active: boolean): string {
    if (key === 'bookshelf') {
      return active ? 'bookshelf_library_filled' : 'bookshelf_library_outline';
    } else if (key === 'discover') {
      return active ? 'bookshelf_compass_filled' : 'bookshelf_compass_outline';
    } else if (key === 'rss') {
      return active ? 'bookshelf_rss_filled' : 'bookshelf_rss_outline';
    }
    return active ? 'bookshelf_settings_filled' : 'bookshelf_settings_outline';
  }

  @Builder
  private tabIcon(key: string, active: boolean) {
    Image($r(`app.media.${this.tabIconResource(key, active)}`)).width(24).height(24);
  }
}
