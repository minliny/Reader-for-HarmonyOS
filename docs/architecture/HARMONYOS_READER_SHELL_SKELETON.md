# HarmonyOS ReaderShell 骨架结构对齐说明

本文档记录 HarmonyOS ArkUI 第一阶段 ReaderShell 骨架的完成口径。它只用于约束原生前端结构，不等同于视觉还原、真实业务接入或全量 route 迁移。

## 结构来源

本轮只继承 Reader UI canonical demo 的结构语义：

- `/Users/minliny/Documents/Reader UI/frontend-demo/shared-shell-kit/kit.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/route-contract.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_CONTRACT.md`
- `/Users/minliny/Documents/Reader UI/frontend-demo/MOTION_EFFECTS.md`

不得继承的内容：

- Web CSS、DOM class、`data-*` selector。
- query 参数、fixture route stack。
- demo 中用于录屏和验证的网页运行时实现细节。

可以继承的内容：

- Shell 插槽语义。
- route 到 Shell 的归属。
- ReaderShell presentation 状态。
- Motion ID、互斥规则、打断规则、reduced-motion 规则。
- 最终状态约束。

## ArkUI 当前骨架

### MainTabShell

主 Tab 只包含：

- 书架。
- 发现。
- RSS。
- 设置。

搜索、阅读页、书源管理、阅读控制层都不是主 Tab。

### ReaderShell

ReaderShell 当前拆成以下 ArkUI 原生结构：

- `ReadingBackgroundLayer`：阅读背景层。
- `ReadingTextLayer`：正文排版层。
- `BrightnessDimLayer`：全局亮度遮罩钩子。
- `ImmersiveInfoLayer`：沉浸态顶部信息、页脚进度、运行胶囊。
- `ImmersiveTapZones`：上一页、打开控制层、下一页热区钩子。
- `TextSelectionLayer`：文本选择层钩子。
- `ReaderControlLayer`：非沉浸 presentation 容器。

沉浸阅读最终状态必须保持 `immersive-reading`，不自动打开 `reader` 控制层。

### ReaderControlLayer

控制层当前拆成以下结构：

- `ControlTopBar`：返回来源、书名/当前 presentation、换源/更多入口骨架。
- `CompactControlPanel`：紧凑控制层。
- `ReaderControlMain`：搜索、自动翻页、内容替换快捷动作，以及章节/进度控制区。
- `QuickActionPanel`：`content-search`、`auto-page`、`content-replacement` 的行内快捷面板。
- `ModulePanel`：目录、朗读、界面、设置四模块面板。
- `FullControlPanel`：`reader-full-directory`、`reader-full-tts`、`reader-full-appearance`、`reader-full-settings` 大半屏控制窗骨架。
- `BookCachePanel`、`DebugInfoPanel`：更多菜单后续承接页骨架。
- `BrightnessRail`：亮度控制结构钩子。
- `ReaderModuleNav`：目录 / 朗读 / 界面 / 设置模块导航。
- `ControlSpace`：自动翻页或朗读运行时，控制层内运行空间。

## Route 和 Presentation 边界

应用真实 route：

- `bookshelf`
- `discover`
- `rss`
- `settings`
- `immersive-reading`

ReaderShell 内部 presentation：

- `reader`
- `toc-bookmarks`
- `tts`
- `reader-appearance`
- `reader-settings`
- `reader-full-directory`
- `reader-full-tts`
- `reader-full-appearance`
- `reader-full-settings`
- `auto-page`
- `content-search`
- `content-replacement`
- `reader-book-cache`
- `reader-debug-info`

这些 presentation 使用 `replaceReaderPresentation` 管理，不作为主 Tab，也不追加主 route stack。启动自动翻页或朗读后，presentation replace 回 `immersive-reading`，并显示运行胶囊。

## 当前完成口径

可以说已完成：

- Slice 0 到 Slice 2 的原生 ArkUI 最小 vertical slice。
- MainTabShell 四主 Tab 原生骨架。
- 书架进入沉浸阅读，最终状态为 `immersive-reading`。
- 返回来源页的 route/back stack 语义。
- ReaderShell 第一版结构拆分。
- ReaderControlLayer 第一版结构拆分。
- reduced-motion 开关和 token adapter 钩子。

不能说已完成：

- 与 demo 的精确视觉一致。
- 完整业务数据。
- 真实分页、目录、书签、TTS、自动翻页计时。
- 拖拽展开、dock 长按拖动、完整焦点陷阱。
- fold posture、键盘安全区、无障碍、性能专项。
- 131 routes 全量迁移。

## 下一步唯一主线

下一步只做 ReaderShell 骨架收敛，不做视觉精调和业务数据：

1. 补齐控制层更多菜单状态和来源切换结构，不接真实网络。
2. 补齐文本选择层、进度拖动、亮度拖动的 ArkUI 手势钩子。
3. 给 `reader.panel.expand` 和 `reader.control.handle.*` 建立最小状态机。
4. 对照 demo 截图做元素存在性检查，再进入视觉密度/间距调整。
