# 阅读顶部栏、书架导航与标签对齐（2026-10-24）

## 用户现象与基线

- 真机当前包反馈：隐藏系统状态栏时，应用顶部信息栏被移入原系统状态栏的位置；要求只隐藏系统栏，信息栏位置保持不动。
- 书架底部 Tab 背景变为半透明。
- 书架页面标签文本与轮廓不居中。
- 源码基线：Host `main` / `6b1bd753`，包含既有未提交修改；本记录只覆盖以下定位与定向修改，未覆盖或回滚其他 WIP。

## 代码定位

1. `ReaderLayoutGeometry.resolveReaderReadingLayout` 与 `ReaderPageChromeLayout.resolveReaderPageChromeLayout` 把信息栏定位在 `statusBarRect` 原点；`LocalReadingExperience` 在系统栏可见时隐藏顶部信息，因此两个不同的区域实际互相替换。`ReaderWindowCoordinator.statusBarMeasurement` 已保留隐藏前测得的状态栏矩形，可以复用其固定几何，不必根据可见 avoid area 移动信息栏。
2. `MainTabBar.bottomBar` 的公共语义色 `app.navigation.floatingSurface` 在 Day 方案中为 `#9EFFFCF8`，alpha 为 158/255；Night 已不透明。这直接导致底栏透出下方书架内容。
3. 实际书架筛选胶囊 `BookshelfPage.filterChip` 使用不含中文字形的 Inter 与固定行高；书封更新角标也用 Inter。文字和框都挂在同一 Text 节点，混排依赖 CJK 字体 fallback 的基线。底部 Tab 的 30 + 2 + 18vp 垂直预算恰好等于 50vp，并未定义文字自身水平居中、单行与大字体预算。
4. `BookshelfGroupSelector` 当前没有生产引用，不能把修改这个旧组件算作当前书架修复。

## 修复边界

- 阅读信息栏独立占据保留的系统状态栏带下方；系统栏隐藏与显示使用相同信息栏/正文几何。控制面板仍可临时隐藏信息栏。书签继续属于页面。
- 浮动导航背景使用相同日间纸色的不透明版本，不更改其他主题角色。
- 真实标签的居中与字体由当前宿主/公共排版定义修复，保留回调与筛选状态。

## 必要检查计划

- `test-reader-page-chrome.mjs --case status-sdk-track`：本次直接修改系统带与信息栏几何，必须确认 SDK 输出的 Text 位置在系统栏显示/隐藏时一致、在保留系统带下方并与正文不重叠。内部仅 SDK lowering、真实几何方法和伪测量端口，不编包、不占用 HDC，不附带其他 case。现有断言描述旧的同带替换语义，需要先改为本轮用户要求。
- 新的导航/标签定向检查：只运行实际底栏 Builder/色角色与实际标签的生产方法探针，确认不透明和居中属性；未形成设备像素/字体视觉证据。
- `test-shelf-label-layout.mjs --case shelf-capsules`：本次确实重构书架筛选与更新胶囊外框，选此 case 检查实际 SDK Row/Text 的职责、中文角色与点击参数。内部只选 `BookshelfPage.filterChip` / `projectionBookCoverLayer`，后者为 SDK 语法登记只读引入 `NoCoverCover` 声明，不执行其视觉树、构建或设备动作；不附带其他页面检查。
- 构建、签名、安装、设备交互、用户验收均为 `NOT_RUN`，由主任务交付时分别处理。

## 当前结果

- 纯几何已将信息栏移到保留系统状态带下方；共享宿主的抑制/书签槽分支由主任务统一修改。
- 日间浮动导航背景改为 `#FFFFFCF8`，保留相同纸色。两个专属书架中文标签排版角色已加入，避免修改其他页面的通用 Inter 角色。
- Tab 底栏与侧栏明确文字水平居中和单行；外容器用最小高度保留内容增长预算。
- 定向 `status-sdk-track` 首次检查发现非零 status origin 与 cutoutInsets 混用导致 3vp 二次偏移，已修正为绝对边界取 max；重跑 160 个 SDK Text 输出组合 PASS。
- `test-shelf-label-layout.mjs --case floating-tab` PASS：实际 SDK Builder 在 Day/Night/Day 中的标签属性、居中容器及不透明背景。
- `test-shelf-label-layout.mjs --case shelf-capsules` PASS：实际 6 类筛选标签的选中/未选中、Day/Night 及原点击参数；更新角标 1/999 章使用同一字体与居中外框。初次运行 SDK lowering 未登记未执行分支的 `NoCoverCover` 声明而报错，补齐实际子组件声明后通过，没有放宽检查。
- 当前实际书架没有 `listStatusPill` 方法；主题中同名历史色角色不能当作当前可见标签，未据此新增虚构节点。已无生产引用的分组组件保持不动。
- 未运行构建、HDC、安装或真机取证；本地 Builder 记录属性与伪测量端口不证明设备像素、真实字体渲染或用户验收。

## 2026-10-25 书架顶部更多 Sheet 与状态栏关闭时序

- 当前 `main` checkout 的书架顶部更多原来由 `BookshelfMoreMenu` 自绘锚定下拉；书籍列表右侧更多已经由 `BookshelfPage.bindSheet` 使用原生底部 Sheet。顶部入口现迁移到同一 `FIT_CONTENT` / `BOTTOM` / `TOK_SS_DRAWER_SCRIM` 宿主，内容复用书籍操作 Sheet 的 grip、圆角、标题和 action-row recipe，五个既有业务动作与 presentation identity 保持不变。
- 代码定位确认 native Sheet 的 `maskColor` 与系统状态栏/导航栏 chrome 是两条渲染提交路径。关闭前原实现只在 `onDisappear` 调 `requestAppChrome()`，因此主体蒙版退场后状态栏仍可能保留 dim，随后还要等待 `ReaderWindowCoordinator.flushChrome()` 的异步系统栏写入。
- 本次为书架顶部 Sheet 和书籍操作 Sheet 增加确认关闭边界的 chrome release，`onDisappear` 保留幂等兜底；这缩短状态栏阴影晚退窗口，但仍不把两个渲染路径宣称为同一帧同步。
- 本次仅完成源码/ETS lowering 检查与定向 chrome lease 检查；构建、签名、HDC、安装、设备像素和用户验收均未运行。
