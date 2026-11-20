# 开发者页面挂载崩溃的永久定向检查（2026-10-24）

## 现象与范围

用户反馈点击“开发者模式”直接闪退。当前 Host `main` / `6b1bd753` 含其他未提交修改。本记录只覆盖 `SettingsPage` 开发者页面的 Builder 编译与回调准入，不包含调试边界扫描器、所有设置项、HAP 或真机验收。

## 定位与修复审查

原 `developerPage` 的 `ReaderStandardPage.header` 闭包直接实例化 `PageBackBar`。该表达式没有位于独立 `@Builder` 中，实际安装 SDK lowering 保留普通函数调用；组件为 class，执行 header 时出现 class constructor cannot be invoked without new。主任务将其提取为 `@Builder developerPageHeader`，`header` / `content` 只调用实际 Builder。

新检查会实际执行：`developerPage` → header/content → CategorySection.content → 两个 CategoryRow.content（chevron 与 ReaderToggle），不能只证明外层页面返回一个函数。后续回调继续执行当前源码的身份/宿主准入方法。

## 必要执行项

仅 `node tools/test-developer-page-builders.mjs --case mounted-developer-page`。本次新增独立 Builder 正是为修复延迟挂载时崩溃，所以需要安装 SDK 的真实编译输出及全部业务槽调用，普通源码字符串检查无法证实。

嵌套范围：现有 `createReaderBuilderProbe` 的 SDK lowering、实际 SDK 属性运行时、当前生产方法；PageBackBar/ReaderStandardPage/CategorySection/CategoryRow/ReaderToggle 用窄平台 Slot 记录构造参数并显式执行传入槽。组件声明直接从生产源码登记，不执行 Card 视觉树、不构建、不签名、不调用 HDC，不附带其他测试。

负对照只在内存中恢复原内联 PageBackBar 的 header 闭包，使用同一 SDK 和同一 Slot；挂载该 header 必须复现 class-as-function TypeError，且在构造返回栏前失败。保留新源码中的独立 Builder 与旧实例化语法，避免伪造另一种业务算法。

## 夹具与证据边界

先前临时诊断尝试复用 cardSdk，因它的无关 ReaderTextStyle 依赖不完整而失败；这是夹具装配失败，不能归因于本次开发者页面。永久检查使用上述窄组件边界及现有真实属性运行时，既不放宽生产 Builder lowering 也不泛化公共 helper。

该检查能证明原语法在当前 SDK 输出上的挂载异常与修复后的全部业务槽、身份准入。Slot 不模拟平台组件像素或设备页面，不能由此声称真机闪退已验收。

## 结果

- `node tools/test-developer-page-builders.mjs --case mounted-developer-page`：PASS。
- 当前 Day/Night 均挂载 header、content、overlay、分类 content、导航 chevron、嵌套 ReaderToggle。返回按钮确实退出当前开发者页；预览按钮只打开一次；预览遮挡期间不能执行边界开关；旧开发者 identity、已卸载、切换 section、reset 及 runtime owner 失效均拒绝旧回调。
- 原 header 内联源码的内存负对照：外层页面可先创建，调用其延迟 header 后出现 TypeError，BackBar 尚未构造。这说明只测试外层页面构造会漏报原故障。
- 独立审查：当前 developerPage 的 header/content 闭包只调用专门的 Builder；CategorySection / CategoryRow 的 trailing 块处于 `@Builder developerPageContent` / `@Builder navRow` 中，安装 SDK 正确展开组件构造。上述槽均实际执行通过，本轮抽取没有留住同类内联组件调用。
- `git diff --check`（仅新增检查与本记录）通过。构建、安装、设备、用户验收均 `NOT_RUN`。
