# HarmonyOS ArkUI 页面骨架和元素结构计划

本文件定义 Reader for HarmonyOS 第一阶段前端实现的页面骨架和元素结构。它只继承 Reader UI 交付的语义、状态、动效 ID、最终状态约束和自适应意图，不继承 Web DOM、CSS class、`data-*` selector 或查询参数。

## 输入来源

- UI 契约：`/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js`
- 动效契约：`/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md`
- 动效说明：`/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md`
- 平台映射：`/Users/minliny/Documents/Reader UI/docs/ui-handoff/MOTION_PLATFORM_MAPPING.md`
- 演示证明渲染器：`/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- HarmonyOS 入口：`entry/src/main/ets/entryability/EntryAbility.ets` -> `pages/Index`
- 自适应落地记录：`docs/architecture/HARMONYOS_ADAPTIVE_UI_FOUNDATION.md`

演示渲染器只作为结构和状态语义证据。ArkUI 代码必须使用原生组件和原生状态。

## 页面外壳分类

### 主 Tab 外壳（`MainTabShell`）

归属路由：

- `bookshelf`
- `discover`
- `rss`
- `settings`
- `bookshelf-empty`：书架拥有的空状态，不是单独的顶层 Tab。
- `sort-filter`：书架本地覆盖层或状态，不是被入栈的主路由。

ArkUI 结构：

- `ReaderAppShell`
  - 原生安全区宿主
  - 只包含四个 `TabContent` 的 `Tabs`
  - 当前 Tab 的顶部内容区
  - 手机竖屏下的原生底部 Tab 栏
  - 后续为展开宽度、平板和折叠姿态预留自适应侧边导航
  - `MainStateHost`，承载弹出层、轻提示、本地反馈和非路由 UI 状态

规则：

- 搜索、阅读、书源管理、书籍详情和阅读控制页都不能成为主 Tab。
- 主 Tab 切换使用 Tab 状态，不做路由入栈。
- `activeTab` 状态映射到 `tab.item.press`、`tab.item.select`、`tab.item.switch` 和 `app.tab.switch`。

### 书库栈外壳（`LibraryShell`）

后续阶段再实现。它归属 `book-search`、`book-detail`、`book-directory`、分组管理、本地导入和批量管理。

ArkUI 结构：

- `LibraryStackShell`
  - 原生导航栈
  - 返回顶栏
  - 内容区
  - 底部操作宿主
  - 抽屉、对话框和状态宿主

该页面外壳不能折叠进主 Tab 外壳。书架空状态仍留在书架所有权内。

### 阅读外壳（`ReaderShell`）

归属路由：

- `immersive-reading`
- `reader`
- `toc-bookmarks`
- `reader-appearance`
- `tts`
- `reader-settings`
- `reader-full-directory`
- `reader-full-tts`
- `reader-full-appearance`
- `reader-full-settings`
- `reader-book-cache`
- `reader-debug-info`
- `auto-page`
- `content-search`
- `content-replacement`

ArkUI 结构：

- `ReaderShell`
  - `ReaderFrame`
    - `ReaderBackgroundLayer`
    - `ReaderReadingSurface`
      - `ReaderTextLayer`
      - `ReaderBrightnessDim`
    - `ReaderOverlayHost`
      - 沉浸阅读信息层或阅读顶层覆盖层
      - 阅读点击热区
      - 底部抽屉宿主
      - 模块导航
      - 亮度调节栏
    - `ReaderStateHost`
      - 阅读会话胶囊状态
      - async/loading/error 状态
      - focus return 与 interrupt 元数据

阅读外壳不变量：

- 阅读正文层在控制层、模块面板、完整面板、加载面板和阅读会话胶囊状态变化期间保持挂载。
- 控制层不能让正文变暗，也不能让正文重排。
- 阅读外壳永远不显示主 Tab 外壳的底部 Tab 栏。

### 设置外壳（`SettingsShell`）

第一阶段视觉实现之后再实现。它归属 `settings-general`、`bookshelf-search-settings`、`sync-backup`、WebDAV、`about-feedback` 和书源管理相关设置页。

### 流程外壳（`FlowShell`）

第一阶段视觉实现之后再实现。它归属 `source-switch` 和横向对比流程。

## 主 Tab 外壳元素结构（`MainTabShell`）

### 书架

手机竖屏目标结构：

- 顶部应用栏
  - 标题 `书架`
  - 搜索动作
  - 更多动作
- 继续阅读卡片
  - 封面按钮，作为 `reader.entry.coverToImmersive` 的来源锚点
  - `继续阅读` 标签
  - 书名
  - 作者或来源行
  - 阅读动作按钮，作为 `reader.entry.actionToImmersive` 的来源
- 书架分区
  - 分区标题 `我的书架`
  - 视图切换：封面/列表
  - 筛选/排序动作
  - 显示设置动作
- 书籍集合
  - 默认封面网格模式
  - 后续列表模式复用同一 item identity 和滚动锚点
- 状态宿主
  - 书籍聚焦层
  - 书架更多层
  - 筛选 popover
  - 本地 Tab 反馈

HarmonyOS 第一版实现建议组件：

- `BookshelfTab`
- `ContinueReadingCard`
- `BookshelfToolbar`
- `BookCoverGrid`
- `BookCoverTile`
- `BookshelfStateHost`

### 发现

当前第一阶段只需要兼容 MainTabShell 的原生首屏：

- 顶部应用栏
- 书源或发现入口摘要
- 入口卡片或分类行
- 本地 loading/empty/error 状态占位

发现页不能把书源管理变成主 Tab。

### RSS

当前第一阶段只需要：

- 顶部应用栏
- 订阅摘要
- 订阅源或来源行
- 未读、收藏和来源筛选作为本地状态

RSS 详情阅读后续归入书库栈外壳或阅读外壳。

### 设置

当前第一阶段只需要：

- 顶部应用栏
- 减弱动效开关
- 本地导入、同步、阅读偏好、书源管理等入口行
- 诊断面板隐藏在开发开关后面

设置页不能变成无关阅读控件的堆放区。

## 阅读外壳路由状态（`ReaderShell`）

阅读外壳需要拆成两个概念：

- `navigationStack`：应用级返回栈，例如 `[bookshelf, immersive-reading]`
- `readerPresentationRoute`：当前阅读外壳展示态，例如 `immersive-reading`、`reader`、`toc-bookmarks`、`reader-full-settings`

这样既能避免把控制层入栈成第二个应用页面，又能匹配 UI 契约的 route 语义。

返回行为：

- 如果 `readerPresentationRoute !== immersive-reading`，先把展示态回到 `immersive-reading`。
- 如果 `readerPresentationRoute === immersive-reading`，再从 `navigationStack` pop 回来源页。
- 如果覆盖层或对话框打开，先关闭覆盖层或对话框，再改变展示态。

### `immersive-reading`

这是从书架进入阅读后的最终状态。

元素：

- `ReaderBackgroundLayer`
  - 纸张主题
  - 可选纹理
  - 默认无遮罩覆盖层
- `ReaderTextLayer`
  - 章节标题
  - 段落正文
  - 排版设置：字号、行高、段距、字距、字体族
  - 分页元数据
- `ImmersiveInfoLayer`
  - 左上书名/章节/状态
  - 右上时间/状态，按需显示
  - 底部进度和页码读数
  - 仅当 `activeSession` 存在时显示阅读会话胶囊
- `ImmersiveTapZones`
  - 上一页热区
  - 中间热区打开阅读控制层
  - 下一页热区
- `ReaderStateHost`

不得包含：

- 控制面板
- 模块导航
- 完整面板
- MainTabShell 底部 Tab 栏
- 深色遮罩或半透明控制覆盖层

动效/状态：

- 入口：`reader.entry.coverToImmersive` 或 `reader.entry.actionToImmersive`
- 应用路由：`app.route.push`
- 最终路由语义：`immersive-reading`
- 打断策略：最后一次阅读入口胜出
- 减弱动效：即时完成路由状态或仅保留短反馈

### `reader`

这是挂在同一个阅读正文层上的阅读控制层。

元素：

- `ReaderTopOverlay`
  - 返回/退出按钮
  - 书名
  - 来源/章节行
  - 换源入口
  - 更多动作
- `ReaderDismissZone`
  - 展示态回到 `immersive-reading`
- `ReaderControlSheet`
  - grabber
  - 可选运行中会话控制区
  - 快捷动作：搜索、自动翻页、替换
  - 章节控制：上一章/当前章/下一章
  - 进度滑杆和读数
- `ReaderModuleNav`
  - 目录
  - 朗读
  - 界面
  - 设置
- `BrightnessRail`

动效/状态：

- 显示：`reader.control.show`，语义转移 `immersive-reading -> reader`
- 隐藏：`reader.control.hide`，语义转移 `reader -> immersive-reading`
- 显隐应是类似 replace 的展示态变化，不是应用栈入栈
- 阅读正文保持稳定挂载

### 快捷面板

路由：

- `content-search`
- `auto-page`
- `content-replacement`

元素：

- 同一个 `ReaderTopOverlay`
- 同一个 `ReaderModuleNav`
- 底部抽屉宿主包含快捷面板
- 下层仍是同一个阅读正文层

规则：

- 进入快捷面板是阅读外壳展示态替换。
- 启动自动翻页必须 replace 回 `immersive-reading`，并设置 `activeSession=autoPage`。

### 模块面板

路由：

- `toc-bookmarks`
- `tts`
- `reader-appearance`
- `reader-settings`

元素：

- 同一个顶部覆盖层
- 同一个底部抽屉宿主
- 模块专属内容区
- 稳定的模块导航几何结构

规则：

- 模块切换映射到 `reader.module.switch`
- 只改变选中背景、图标色和文字色；导航几何保持稳定

### 完整面板

路由：

- `reader-full-directory`
- `reader-full-tts`
- `reader-full-appearance`
- `reader-full-settings`
- `reader-book-cache`
- `reader-debug-info`

元素：

- 阅读正文层仍挂载在下层
- 完整或大面板宿主
- 面板拖拽柄
- 面板标题区
- 内容区

规则：

- 完整面板展开/收起是阅读外壳展示态。
- 返回或关闭按来源回到快捷面板、模块面板或沉浸阅读。

## 阅读会话胶囊

`activeSession` 必须是状态 reducer 的一等字段：

- `none`
- `autoPage`
- `tts`

规则：

- 自动翻页和 TTS 互斥。
- 启动任一会话后，展示态 replace 回 `immersive-reading`。
- 沉浸态只显示一个会话胶囊。
- 运行会话时打开控制层，`ReaderControlSheet` 内显示控制区。
- 减弱动效禁用循环脉冲动效，保留静态状态。

动效 ID：

- `reader.session.autoPage.start`
- `reader.session.tts.start`
- `reader.session.capsule.enter`
- `reader.session.capsule.update`
- `reader.session.capsule.switch`
- `reader.session.capsule.exit`
- `reader.session.controlSpace.enter`
- `reader.session.controlSpace.update`
- `reader.session.controlSpace.exit`

## 自适应结构

手机竖屏：

- 主 Tab 外壳使用底部 Tab 栏。
- 书架使用封面网格，宽度允许时通常是三列。
- 阅读控制层使用底部抽屉加底部模块导航。

紧凑竖屏：

- 保留底部 Tab 栏。
- 收紧间距和卡片高度。
- 保持书名可读，避免顶部动作重叠。

大手机竖屏：

- 保留手机结构。
- 增加可见内容，不因为截图更高就切换到平板侧边导航。

平板或展开宽度：

- 主 Tab 外壳可以把底部导航切换为侧边导航。
- 阅读外壳可以把控制抽屉和模块导航放成侧边停靠区。
- 该判断必须由 ArkUI 窗口指标和折叠姿态驱动，不能复制某张截图尺寸。

紧凑横屏：

- 阅读正文区域和控制停靠区必须联合测量。
- 控制面板必须保持为一个连续结构。

## HarmonyOS 状态模型目标

最小目标字段：

- `activeTab`
- `navigationStack`
- `currentRoute`
- `readerPresentationRoute`
- `readerContext`
- `overlayState`
- `focusState`
- `activeSession`
- `asyncResult`
- `motion`
- `motionInterrupt`
- `reducedMotion`
- `adaptive`

状态 reducer 目标：

- `selectTab(tab)`
- `pushReaderEntry(target)`
- `showReaderControls()`
- `hideReaderControls()`
- `replaceReaderPresentation(route)`
- `startReaderSession(kind)`
- `stopReaderSession()`
- `pop()`
- `setReducedMotion(enabled)`

## 第一阶段实现顺序

1. 引入 `ReaderVisualTokens` 和 `ReaderAdaptive`，作为原生 ArkUI 辅助模块。
2. 调整 `Index`，手机竖屏下主 Tab 放到底部，并为展开宽度窗口预留侧边导航钩子。
3. 将 `BookshelfTab` 重构为继续阅读卡片、工具栏和封面网格。
4. 将 `ImmersiveReaderSurface` 重构为阅读外壳默认 `immersive-reading` 结构，默认无控制覆盖层。
5. 将阅读控制层重构为阅读外壳的 `reader` 展示态，不作为主 Tab，也不作为第二个应用级路由入栈。
6. 先补手机竖屏布局证据；平板、折叠姿态和横屏保持为后续明确工作。

## 本阶段非目标

- 不用 WebView 加载 `frontend-demo`。
- 不做 131 个 route 全量迁移。
- 不接真实业务数据。
- 不改 Core、网络、解析器或书源管理。
- 不声称折叠姿态、键盘安全区、无障碍或性能已完成。
