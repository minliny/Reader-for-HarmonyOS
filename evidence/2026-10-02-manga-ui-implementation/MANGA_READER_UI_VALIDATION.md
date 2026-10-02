# 漫画阅读界面代码与本地验证

日期：2026-10-02。设计来源：工作区 `evidence/2026-10-02-manga-ui-demo/DESIGN_PLAN.md`。实施位置：独立 `manga-ui-20261002` HarmonyOS worktree。本文仅记录漫画阅读 surface 与漫画偏好；ReaderShell、Index、目录组件、元数据及换源由对应工作项统一验证。

## 实施边界

- 初始沉浸，轻触显示顶部与底部悬浮控制；控件显隐不改变图片 viewport。真实图片仍由现有 Controller/Host、lease、虚拟行及裁片提供。
- 顶栏以真实漫画书名居中，实际章名作为副标题；更多菜单调用现有换源、缓存本章、刷新图片、详情与书架操作入口。
- 底部页码与滑块使用 Controller 的实际总页数和当前逻辑图页，跳页先保存已确认位置，目标图片尚未确认时不写目标进度。
- 目录复用 Native navigation surface 与 Core target proof；漫画行不提供文字书签。定位当前触发独立 revision，保留其他目录折叠与作用域状态。
- 阅读方式只含漫画方向、图片适配与缩放；设置只含漫画底色、既有亮度 owner、页码及漫画偏好重置。
- 1180×820 平板为左侧常驻 320vp 目录、剩余图片区域、右侧 360vp 方式/设置面板。目录是否常驻由整个安全区的宽高及平台 tablet 身份决定，独立于 controls 状态；phone 820×420 使用目录侧浮层。
- 章尾必须基于已确认的最后一图；下一话从当前同书同源目录的真实可读项取值。缺少可靠目录时不声明下一话或虚构全书完结。
- MangaBookPresentation 只接收已有 prepared entry / 成功 CAS 的 confirmed location，不增加渲染期间 Core 查询或第二套进度存储。Owner 变化与事实变化由 helper revision 通知外部界面。

## 定位与修复记录

1. 新目录/图标组件引入后，旧 SDK probe 缺少已导入的 custom component 属性注册，导致 lowering 不能正确检查 child props。修复测试 harness：从真实组件源码注册属性及依赖边界。生产组件未用替身替代，probe 只控制其子组件绘制边界。
2. 初始竖向滑块跳页在异步 Controller 发布时被旧原生行位置重新接纳，可能回到旧图。现先冻结显式目标 anchor，再请求 Controller；seek 期间忽略不匹配行回调，实际手势可取消，目标绘制确认后解除冻结。新增真实 Surface + Controller 回归证明未绘制目标不会进入持久位置。
3. 初始宽屏目录随其他面板统一出现在右侧，缺少设计要求的常驻左目录。现左目录拥有固定列宽，图片 Stack 使用剩余空间；目录不受控制显隐影响，方式/设置保持右侧浮层。SDK fixture 验证列宽、剩余布局权重及隐藏控件时目录挂载。

## 已通过的本地检查

以下各独立测试均限制单次运行不超过 120 秒：

- `tools/test-manga-ui-state.mjs`：偏好迁移、非法值、false 保留、旧文字阅读表单不覆盖漫画偏好、写入回滚、并发串行、邻章事实、章尾确认、已卸载 seek、宽屏列宽策略。
- `tools/test-manga-surface-sdk.mjs`：安装 SDK lowering、原有安全区与 CAS 退出、卸载后的布局 fencing、实际目录 child props、平板左右栏布局约束。
- `tools/test-manga-surface-render-key-sdk.mjs`：图片禁止拖动、原生滚动回调、现有 virtual row/key/替换 URI/可见行保持。
- `tools/test-manga-viewport-restore-sdk.mjs`：原有原生几何输入、帧回调、虚拟行和锚点恢复 fencing。
- `tools/test-manga-cross-chapter-counter-sdk.mjs`：同 ordinal 的章切换仍更新真实页数与按钮。
- `tools/test-manga-motion-progress.mjs`：缩放、横向翻页、CAS、刷新、退出、实际 Controller 竖向 seek 和已确认位置保护。
- `tools/test-manga-display-policy.mjs`、`tools/test-manga-cancelled-banner.mjs`：原有 fit/缩放/refresh/login/取消横幅行为。
- `tools/test-reader-settings.mjs`：旧偏好版本与文字阅读设置合同保持。
- `git diff --check`。

## 定稿组件 assembly 检查

新增只读可复跑脚本 `node tools/test-manga-ui-assembly-sdk.mjs`，在各单次不超过 120 秒的约束下通过：

- 安装 SDK 解析当前 355 个生产 ETS/TS 文件（包括新增漫画 layout/presentation helper），无 parser diagnostics。
- 从真实源码注册 117 个组件的字段、decorator 与 BuilderParam 元数据，逐一核对 657 个实际组件初始化字段。覆盖 Index → ReaderShell → Manga/Source、书架、详情、目录及 Native 目录组件。
- Index、ReaderShell、MangaReadingSurface、BookshelfPage、LocalBookDetail、BookDirectoryPage、SourceSwitchPanel、SourceSwitchWindow、ReaderDirectoryNavigationSurface/List、ReaderDirectoryList 均完成真实 SDK component transform，无 transform diagnostics。包含书架、漫画目录最新 `contentStartOffset` / `contentEndOffset` 调整后的源码。
- 漫画设置的跟随系统亮度与始终显示页码两处 Native Toggle 原先未显式指定选中颜色，可能采用系统默认色。已仅在这两处添加 `selectedColor('#1F3528')`，与批准稿深绿一致；真实 SDK 生成属性探针验证日间／深墨及开启／关闭四组输入、选中属性和原有各自回调。
- 首轮临时 assembly harness 未收集 BuilderParam，导致书架尾随 lambda 产生 `10905102`。补齐实际 SDK frontend 的 BuilderParam prepass 后全部通过；生产尾随 lambda 及组件未因此修改。

此项仅证明安装 SDK 的 parser、组件转换和真实声明字段存在。未执行全工程语义 typecheck／ArkTS 全量编译，未生成 HAP；Native 布局、命中区域、实际像素与设备验收仍独立记账。

## 未验证边界

上述为代码、本地纯逻辑及安装 SDK 生成方法/属性验证。Native Scroller 几何与帧送达是受控输入，不代表平台像素、真实手势或设备结果；没有执行 HAP 构建、VM/真机安装或用户视觉验收。全 Shell child props、全合同 tier、helper owner fencing 及构建由统一验证负责。

## 本轮独立 worktree 收束

- 设计稿已保存在 `Reader-UI/design/manga-ui-20261002`，原始 demo、输入 hash、逐页计划和 22 张截图保持不可变；生产改动在本 worktree 的 `codex/manga-ui-20261002` 三仓配对分支。
- 书架列表与目录的浮栏留白已移到原生 `contentStartOffset` / `contentEndOffset`，不会再用外层 padding 缩短可滚动视口；详情/目录标题使用安全区外层 + 4vp 对称浮栏内槽。
- `LOCAL_REGRESSION_FINAL.json` 记录通过项和三个旧夹具边界。旧夹具失败不作为生产通过依据。
