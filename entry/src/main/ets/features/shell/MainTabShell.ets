import { MainTabBar } from './MainTabBar';
import { TOK_PAPER } from '../common/ReaderTokens';


// MainTabShell —— 主页面(书架/发现/RSS/设置)公共骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七)。
// 页面背景 + 内容区 + BottomNav。主页面只提供 content + activeTab + onMainTab, 不再
// 复制 BottomNav 骨架。状态栏 padding 与底部安全区仍由 Index 根 Stack 统一处理
// (Batch 2 deferred, 避免双 padding)。Tablet 书架用左侧导航轨道, 经 showBottomNav=false
// 关闭底部栏; 其余主页面双向都显示底部栏。
@Component
export struct MainTabShell {
  @Prop activeTab: string = 'bookshelf';
  @Prop showBottomNav: boolean = true;
  onMainTab: (key: string) => void = (_key: string): void => {};
  @BuilderParam content: () => void;

  build() {
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