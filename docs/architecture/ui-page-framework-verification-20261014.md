# 分类页面框架验证记录

实施工作树：`codex/ui-framework-completion-20261014`。基线 `4764886e` 是主工作树已存在修改的独立快照，新增补全仅按相对基线 diff 统计。

## 初轮本地验证

- `test-reader-layout-architecture.mjs`：PASS，阅读几何/安全区合同保持。
- `test-floating-page-content.mjs`：FAIL，旧 SDK fixture 未挂入新公共高度计算的真实方法；在更新真实方法接线，保留原滚动断言。
- `test-book-directory-page.mjs`：FAIL，测试枚举新增公共子组件时直接访问不存在的 params；将修正遍历并保留目录语义断言。
- `test-shared-download-ui-sdk.mjs`：FAIL，BookshelfShell 的 trailing Builder 后属性链被实际 SDK 拒绝。复测确认不是临时编辑状态；已改成 props 内显式 content Builder，并保持原 onAreaChange 回调。所有编辑停止后重新全源扫描。

## 证据边界

实际 SDK lowering、业务留存回归、完整 ArkTS 编译、HAP、VM/设备行为和视觉/用户验收分开记账。当前尚未构建、安装或执行设备验收。

独立审查另发现：浮动卡片若重复应用帧 Modifier 会覆盖卡片背景/clip，现已删除卡片层的重复 Modifier，仅公共宿主使用；书架恢复消息成为固定区后缺不透明背景，现交公共 HeaderHost 单独绘制消息区，外浮动胶囊保持原有视觉。最终回归结果待填。

## 补全后的本地结果

以下实际执行通过，不能替代设备像素结论：

- 公共页框架门禁：20 个生产路由、22 个实际分类绑定；日夜不透明遮罩、真实 Builder 槽委托、展开头部高度传递、窄宿主 vp 字符串、窗口阅读纸底及阅读可见性留存；缺遮罩、缺壳、新增未登记路由及内联裸 UI 构造调用负例均拒绝。
- 架构门禁：19 个精确公共生产者及 1 个有限页策略；93 条原私有预算及 7 个已有批准迁移的原始哈希保持，未抬高旧预算。144 个实际 UI 文件均有明确登记。
- 阅读几何、刘海正文、纸面和状态栏组合、入场 handoff、详情完整目录入口及漫画目录路由。
- 搜索历史生命周期及真实卡片布局；标准目录和漫画目录栏；详情 Scroll/dock、下载视觉合同。
- 主页面、RSS/发现、设置、书架状态、二级页避让和安全区 7 项回归。二级页实测 96→58vp 时正文避让 104→66vp，原 Scroll 保留；书架实测 header 经 Index 更新原列表 actor。

Native 与当前 Core 的 1140 文件输入指纹匹配；隔离配套 Core/UI、19 项工作区投影通过身份门禁，规范 sync-native/sync-signing 已通过。完整 HAP 编译结果另行填入。

## 第一轮规范 HAP 门禁失败及修复

`node scripts/hap-pipeline.mjs build --class iteration` 的 Native、工作区身份、签名输入和主题预检通过；完整合同门禁未通过，未发布 HAP。日志位于私有 `.reader-local/ui-framework/hap-build.log`。该轮运行在已出现失败后停止，合同阶段约 193 秒；不能将已执行的部分视为全套通过。

- 隔离 Core 尚无当前快照的 `reader-cli`，七项集成用例出现 ENOENT。已在隔离 Core 执行 `cargo build --locked -p reader-cli`，书源导入、管理共享 owner 和持久删除三项随后复测通过；其余交由第二轮完整门禁核验。
- 迁移后的真实公共 Builder 路径需要原 SDK fixture 同步。已接入真实 Scaffold/HeaderHost 方法，保留原 Scroll、回调、路由和负控断言；临时返回 leaf/index、反馈及产品范围四项通过，38 个原路由守卫保留。
- 合同回归发现实际导航缺陷：旧导航控件可能借用新的回调代号。公共导航控件现在按 presentation generation 轮换，MainTabShell、BookshelfShell 和 Index 校验代号、挂载生命周期与 Runtime。真实 SDK 用例验证旧回调拒绝、新代可用、卸载后拒绝和跨 Runtime 重建；读取 live generation 的 mutation 被拒绝。目录 List/Scroller 未随导航代号重建。
- 字体 carrier 的 Builder owner 迁移已逐项证明，五项字体门禁通过。有限 successor 证明 11 个样式、4 个 AUTO 的同文件 owner 迁移及书架 rail 的唯一共享委托；书架 18 个逻辑 occurrence 保留，真实 wide SDK 验证四个标题/回调和原 UIBold 700/11/18 字体元组。九个新增负控拒绝历史字节、计数、slot、vertical、variant 或私有预算篡改。四个历史 fixture 未修改。
- 搜索/发现/同步 30 项实际 SDK 布局及交互对比、两个复合头负控通过；正文列表、Scroller、原回调和几何保持。

当前尚无本次修改的成功 HAP、安装、VM 或视觉验收证据。
