import { MainTabBar } from './MainTabBar';
import { TOK_PAPER } from '../common/ReaderTokens';


// MainTabShell —— 主页面(书架/发现/RSS/设置)公共骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七)。
// 页面背景 + 内容区 + 响应式主导航。主页面只提供 content + activeTab + onMainTab，
// Phone 使用 BottomNav；完成 Tablet 版式的页面可启用共享左侧导航轨道。状态栏 padding
// 与安全区仍由 Index 根 Stack 统一处理，避免双 padding。
@Component
export struct MainTabShell {
  @Prop activeTab: string = 'bookshelf';
  @Prop showBottomNav: boolean = true;
  @Prop showTabletRail: boolean = false;
  onMainTab: (key: string) => void = (_key: string): void => {};
  @BuilderParam content: () => void;

  build() {
    if (this.showTabletRail) {
      Stack({ alignContent: Alignment.Start }) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.content();
        }
        .width('100%')
        .height('100%');

        MainTabBar({
          current: this.activeTab,
          vertical: true,
          onSelect: (key: string): void => this.onMainTab(key),
        })
          .margin({ left: 16 });
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    } else {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          this.content();
        }
        .layoutWeight(1)
        .width('100%');

        if (this.showBottomNav) {
          MainTabBar({ current: this.activeTab, onSelect: (key: string): void => this.onMainTab(key) });
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER);
    }
  }
}
