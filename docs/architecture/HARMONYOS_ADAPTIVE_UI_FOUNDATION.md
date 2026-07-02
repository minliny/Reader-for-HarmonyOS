# HarmonyOS 自适应 UI 基础设施落地记录

本文记录深度研究结论在 Reader for HarmonyOS 第一阶段的工程落点。目标是提前建立可扩展的自适应 UI 基础，避免后续为手机、折叠屏、平板、横屏和大屏重复开发多套页面。

## 核心决策

Reader for HarmonyOS 的自适应主轴采用：

```text
AdaptiveState -> ShellMode -> ComponentVariant
```

不采用：

```text
PhonePage / FoldPage / TabletPage
```

也就是说，路由语义不随屏幕变化而变化。屏幕变化只改变壳层模式、面板位置、正文宽度、网格列数和组件密度。

## 状态分层

- route state：`activeTab`、`routeStack`、`currentRoute`、`readerContext`。
- UI state：`overlayState`、`focusState`、`activeSession`、`asyncResult`、`motionInterrupt`。
- layout state：`adaptive`，类型为 `ReaderAdaptiveState`。

`adaptive` 是布局环境输入，不应该混入书籍 ID、章节、搜索词或书源状态。

## 当前落地文件

- `entry/src/main/ets/ui/ReaderAdaptive.ets`
  - 定义 `ReaderAdaptiveState`。
  - 根据窗口宽高推导 `widthClass`、`heightClass`、`orientation`。
  - 派生 `mainTabMode`、`readerPanelMode`、`readerContentMode` 和 `bookshelfColumns`。
- `entry/src/main/ets/ui/ReaderUiState.ets`
  - 将 `adaptive` 纳入单一 UI state。
  - 通过 `ReaderUiReducer.setAdaptive` 更新布局状态。
  - 将 `readerPresentationRoute` 纳入阅读外壳展示态。
  - 增加 `startReaderSession` 和 `stopReaderSession`，用于互斥控制自动翻页与朗读会话胶囊。
- `entry/src/main/ets/pages/Index.ets`
  - 在根组件使用 `onAreaChange` 更新 `adaptive`。
  - 只保留根状态、reducer 调度、返回栈和自适应探针。
- `entry/src/main/ets/ui/shells/MainTabShell.ets`
  - 承载四个主 Tab：书架、发现、RSS、设置。
  - 手机竖屏走底部 Tab，展开横向或大宽度走侧边导航。
  - 主 Tab 切换仍然只改变 `activeTab`，不做路由入栈。
- `entry/src/main/ets/ui/shells/ReaderShell.ets`
  - 承载阅读外壳入口。
  - 第一阶段接入 `immersive-reading`、阅读控制层显隐和运行中会话胶囊。
  - 后续目录、TTS、外观和设置面板继续归入该外壳。
- `entry/src/main/ets/ui/components/BookshelfTab.ets`
  - 书架从固定列表改为继续阅读入口、工具栏和封面网格骨架。
  - 网格列数由 `ReaderAdaptive.bookshelfGridTemplate` 派生。
- `entry/src/main/ets/ui/components/ReaderSurface.ets`
  - 沉浸阅读正文根据 `readerContentMode` 约束宽度。
  - 沉浸态显示运行中的自动翻页或朗读会话胶囊。
- `entry/src/main/ets/ui/components/ReaderControlLayer.ets`
  - 阅读控制层根据 `readerPanelMode` 在底部抽屉和侧边停靠之间切换。
  - 控制层不再使用整屏深色遮罩压暗正文。
  - 拆出控制区、运行中会话控制区、模块导航和模块内容骨架。
  - 第一阶段覆盖目录、朗读、界面和设置四个阅读内展示态。

## 第一阶段边界

当前实现只建立最小自适应基础：

- 根部布局探针使用 ArkUI `onAreaChange`。
- 折叠姿态、窗口模式、安全区和键盘避让字段已在模型中预留。
- 还没有接入 `@ohos.window`、`@ohos.display`、`@ohos.mediaquery` 的完整系统采集。
- 还没有实现双页阅读、半折叠专用布局、自由窗口专项和外接键鼠体验。

## 后续接入顺序

1. 把 `ReaderAdaptive` 的采集层从组件区域变化扩展到系统窗口、显示、折叠姿态、安全区和键盘规避区。
2. 将 `MainTabShell` 从 `Index.ets` 中拆出为独立壳层组件。
3. 将 `ReaderShell` 从 `ReaderSurface.ets` 中拆出为独立壳层组件。
4. 为手机竖屏、手机横屏、展开横向和大宽度建立截图矩阵。
5. 在真机或模拟器验证折叠屏、键盘、安全区、手势冲突、无障碍和性能。

## 不变约束

- 不使用 WebView 加载 `frontend-demo`。
- 不复制 Web CSS、DOM 或 `data-*` selector。
- 不把搜索、阅读页或书源管理做成主 Tab。
- 不因为宽屏就改变 route 语义。
- 不在每个组件里各自读取窗口环境；组件只消费已经派生好的布局模式。
