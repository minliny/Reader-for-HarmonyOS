# 公共消息与完整门禁记录

本记录只陈述实际运行结果。源码/SDK、完整编译、包验签、设备与用户验收分别记账。

## 第四次完整准入后的公共修复

完整 703 项首轮结果为 643 PASS / 60 FAIL；失败尝试为 `1792344662432-d66dd220-f617-4176-b34f-32cbba3dd882`，没有可交付 HAP。失败项没有被移出全量清单。

公共 SDK 探针现在挂载实际 ReaderPageState / ReaderRecoveryAction / ReaderRecoveryNotice，选入实际声明的 Watch 回调；图标 Prop 探针按完整父投影更新。保留 SDK 编译诊断，不用空业务方法消除依赖。

以下定向回归已实际通过：

- `test-manga-preview-entry-sdk`、`test-manga-system-bar-viewport-sdk`：原真实图片/视口/宿主接线和透明占位。
- `test-reader-automatic-page-start`、`test-reader-continuous-input-runtime`：样本初始化实际手势状态，保留所有指针/连续输入行为断言。
- `test-reader-physical-reading-repair`：书签 Image 保持几何，通过 visibility / opacity 显隐；方法名称不表示真机验证。
- `test-reader-window-chrome-p0`、`test-reader-window-chrome-order`：实际 PageState 子树及实际 Manga 错误事实/颜色方法，保留布局顺序与原动作。
- `test-switch-enum-shared-contract`：实际 Watch 与共享有限动作依赖。
- `test-shared-action-role-focus-sdk`：四种实际 Stack 动作、忙态/焦点/旧代次负对照。
- `test-shared-download-visual-contract`：批准消息字体后的实际 674vp 正文预算，保留容量、范围、按钮与滚动事实。
- `test-responsive-surface-widths`：实际空书架 PageState / 两导航动作、200/280/352/390 宽度重排；精确解析三个批准 Dialog 规格，保留其他页面安全区及响应式断言。
- `test-theme-local-consumers`：仅将书签空态的原颜色站点映射至实际共用 PageState / Action，日夜色和原切换目录回调保留。
- `test-theme-primary-text`：原 31 处前景逐项归属到 16 个直接 AST、11 个有限公共控件和 4 个批准消息后继；实际 SDK 日/夜/日、原空书架两个导航、忙态原生指示与既有普通按钮颜色不变。
- `test-svg-provenance`：413 项受控 SVG 来源通过。ImageOff 固定版本、完整许可及源/包/许可哈希已登记；11 个退役装饰生产资源已移除，历史 Figma 来源和其他现存 SVG 字节保留。
- `generate-theme-registry.mjs --check`：613 个完整 App 角色、8 个阅读调色板、权威来源哈希校验通过。

后续完整规范构建结果追加到本记录；不将本节定向结果提升为全量、安装或原生视觉通过。

编译前窄复核已对照当前 SDK 声明：MeasureOptions 显式导入、MeasureUtils/px2vp、FlexSpaceOptions 的 LengthMetrics、Span 文本底色半径及 ReaderTextStyle 构造参数均匹配。该复核不替代全工程语义编译。

## 第五次完整门禁

全 703 项实际执行，694 PASS / 9 FAIL，耗时 673550ms；失败尝试 `1792346380243-e33e0072-e605-4bc1-9adc-f93ad831cb49`，未进入打包。完整日志 `/tmp/reader-message-full-pipeline-20261019-r5.log`，子日志 `reader-contract-run-QzCcfS`。

有限消息属性现在按实际 @State / @Prop 声明补入既有 ArkUI property runtime；新增属性仍是原SDK实现，没有手写get/set替代或关闭Watch。详情获取/返回、详情独立目录、可读入架、漫画错误恢复和漫画位置恢复五项已定向通过；原Core、旧内容、generation/route/owner、真实callback及负对照保留。书架Shell与More两项由页面记录核实，15组及真实高度回调/内容避让通过。

精确架构后继只同步共用Notice的单行显式SDK类型导入，以及已单独验证的设置页两条明确busy输入。原历史fixture、旧100项业务预算及其他输入全部保留；更新通过完整字节和有限差异断言完成，固定新哈希 `91ed0749a103e10c7517f00eea214ba2254a4dc5ee90c1d2c4dbaa9a4ac0c342`。

`test-architecture-consumer-baseline` 和 `test-architecture-shared-producers` 最终均退出 0，完整有限绑定、字体/布局见证和原负对照通过。第五轮全部9项失败已定向修复通过；接下来重新完整执行703项，不复用本节PASS凭证。

## 最终完整交付结果

第六轮规范命令：`READER_CONTRACT_TEST_WORKERS=2 node scripts/hap-pipeline.mjs build --class iteration --signing local`，退出 0。

- 完整703/703 PASS，omitted 0；合同阶段 717149ms（runner 714321ms）。529项 integration 完整分类，未复用旧PASS、未放宽110秒单项期限。
- `arktsTypeCheck`、`nonIncrementalBuild`、`bundledSourceBytes`、`requiredResourceBytes` 均 PASS。存在既有 SDK WARN（如未改动的 ArkWebResourceDiagnostic / ReaderPageShell / SearchPage），无阻断编译错误；不宣称零告警。
- runId：`20261018T182618Z-5a01ec1c-ffaa901e`。
- manifest：`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20261018T182618Z-5a01ec1c-ffaa901e/manifest.json`。
- signed HAP：同目录 `entry-default-signed.hap`，215827324 bytes；SHA256 `4b4a3eb3619905120de8c5ff7d33bc0d4d08b6dab61fe487a1ff3516712cf85f`。
- 证书为指定 `minliny_HarmonyOS`，SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`；signature verified true，Profile debug，包名 `io.reader.minliny`。
- Harmony源码基点 `5a01ec1cdbd5ec864046e1b9202963ead23a513a`，本次实施分支 `codex/message-ui-unification-20261019`，dirty true（未提交）；Core `b52365329f1312c7bb80605c8a74eecaf8f4bc44`，dirty false。
- 本次2005个构建输入指纹：`ffaa901efcd02185e5822f96a4017b5b962a0b01761bae19076795cc0e4ddee8`。Native输入与包内经工具链处理的Native字节分别由manifest绑定，不混用两种哈希。
- 再执行唯一 `hap-pipeline.mjs verify --manifest <上述manifest>`，退出0、PASS。完整构建日志 `/tmp/reader-message-full-pipeline-20261019-r6.log`，独立复验日志 `/tmp/reader-message-package-verify-20261019.log`；实际测试凭证及逐项日志已封存于immutable run。

这是 `iteration` 开发产物，`acceptanceEligible=false`；本轮未运行Core完整development gate、线上书源网络验收，未安装、启动、卸载、清除或操作任何设备/应用数据。VM安装、真机安装、原生视觉/交互与用户验收全部 OPEN。最终文档记录不改变已经冻结和验证的生产/控制器输入。

## VM基础问题修复后的当前包

前节保留原构建时点。VM基础测试发现F1显示方式缺失和F2消息细字后，已完成修复及新一轮完整703/703检查、规范构建和独立verify。当前新run `20261019T051558Z-5a01ec1c-8508d63b`，signed SHA256 `21e2486d723f3174e3d36b7d1fa59b562deb63632a65669fcb14554aa6be2462`，同一指定证书及debug Profile。原VM保数据安装/启动与F1/F2基础交互、原生截图复验通过，最终配置及筛选已恢复。新的Core/Harmony dirty状态、Native身份、两次完整检查结果、部署回执与证据边界见 [vm-fix-20261019.md](vm-fix-20261019.md)。未将本次有限VM复验提升为所有复杂消息/故障分支、真机或用户验收通过。
