import { MainTabBar } from './MainTabBar';
import { PageBackBar } from '../common/PageBackBar';
import {
  TOK_INK,
  TOK_PAPER,
  TOK_SCREEN_INSET,
  TOK_SETTINGS_TOP_BAR_INSET,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';


// SettingsShell —— Settings 页面骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七/§十)。
// 负责 Settings Home TopBar + BackTopBar + Scroll Content + BottomNav + 子页返回结构 +
// 响应式页面边距。Settings 分 Home 与 General 两态(不互替): Home 显示设置菜单 + 底部栏,
// General 显示返回栏 + 通用设置区块。页面只提供 homeContent/generalContent + activeSection/
// onSectionChange + 导航回调; 不复制 TopBar/BackBar/BottomNav/Scroll 骨架。
@Component
export struct SettingsShell {
  @Prop activeSection: 'home' | 'general' = 'home';
  onSectionChange: (section: 'home' | 'general') => void = (_section: 'home' | 'general'): void => {};
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  @BuilderParam homeContent: () => void;
  @BuilderParam generalContent: () => void;

  build() {
    Column() {
      if (this.activeSection === 'home') {
        this.homeTopBar();
      } else {
        PageBackBar({
          title: '通用设置',
          onBack: (): void => this.onSectionChange('home'),
        });
      }
      if (this.activeSection === 'home') {
        Scroll() {
          Column({ space: TOK_SPACE_SM }) {
            this.homeContent();
          }
          .width('100%')
          .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
        }
        .layoutWeight(1)
        .width('100%')
        .align(Alignment.Top)
        .scrollBar(BarState.Off);
        MainTabBar({ current: 'settings', onSelect: (key: string): void => this.onMainTab(key) });
      } else {
        Scroll() {
          Column({ space: TOK_SPACE_SM }) {
            this.generalContent();
          }
          .width('100%')
          .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
        }
        .layoutWeight(1)
        .width('100%')
        .scrollBar(BarState.Off);
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private homeTopBar() {
    Row() {
      Text('设置')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(38)
        .fontColor(TOK_INK);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SETTINGS_TOP_BAR_INSET, right: TOK_SETTINGS_TOP_BAR_INSET, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    }
    // 'settings' is this page; MainTabBar suppresses the current tab.
  }
}