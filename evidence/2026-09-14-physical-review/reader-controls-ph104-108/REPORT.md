# PH104–PH108 代码审计与修复

基线：Harmony `5fb96de4cf322c9b4f35c558051ba1fea5196ad5`，Core `bf49495317798f68b98928712eb6e106af02bed1`，两仓开始工作树 clean。问题原始描述见上级 FEEDBACK.md。最近已记录的手机安装是 `20260916T003557Z-b37f745a-f7e147cb`，并非本轮对现场包的重新核验。本轮未操作 VM 或真机；设备视觉、连续帧耗时、实际字体字形、系统音量行为与用户验收 OPEN。

## PH108：状态栏全链路审计

本轮没有继续修改主题原色，先区分三个事实：发送给窗口的颜色、ArkUI 实际背景层、翻页截图缓存。前两轮只证明颜色队列/几何各自的部分行为，不能证明最终合成一致。

### 确定缺口

1. **状态栏底色的显示条件没有订阅控制栏变化。** `LocalReadingExperience.controlsPresentedForWindow` 在无胶囊动效时读 `latestControlVisualSession`；这个字段刻意不是可观察状态。`readerStatusBarUnderlay` 的 If 使用该方法，开启 `extendIntoCutout` 后、保持相同主题和窗口尺寸打开控制栏，系统显隐策略更新，但该 If 没有控制栏变化的观察依赖。修复增加仅在可见性边沿更新的 `windowControlsPresented`，供 If 直接观察。保留已有几何 revision 的 Row 订阅。实际 SDK 编译的闭包探针在基线失败，当前通过。
2. **主题变化没有完整失效翻页投影/纹理。** `admitAppearanceSnapshot` 旧逻辑只在字体/排版变化时调用 `invalidatePageTurnRuntime`，纯主题变更更新 `appearanceSnapshot` 和窗口颜色后直接返回。页面纹理身份包含主题，但已缓存投影仍按 `pageTurnRenderRevision` 复用；原生纹理准备/已有冻结投影不因此自动全部失效。修复将主题也纳入变更及翻页中延迟应用门禁，清旧纹理并恢复预备工作；纯主题变更不重新分页。8 个主题的生产方法探针在基线全部缺失失效动作，修后通过。该测试证明代码缺口，不声称用户每次偏色都是旧纹理可见。
3. **阅读子树底色被兄弟弹层覆盖。** `ReaderShell` 中目录和换源界面是 `ReadingExperience` 的后置兄弟；换源有全屏半透明背景，目录也绘制应用主题面。阅读子树内部的 zIndex 无法越过兄弟整体。现于 Shell 兄弟之上按 Coordinator 发布的同一个 underlayColor 绘制状态栏带，继续观察实测矩形。8 主题×目录/换源的实际 SDK Builder 属性回归通过；未模拟设备 GPU 合成。
4. **应用根容器仍使用固定日间资源。** `Index` 根节点与启动异常节点使用 `app.color.reader_surface`，该资源只有 base 定义 `#F8F4EC`，没有夜间版本；窗口却取当前应用主题（夜间 `#FF24211E`）。应用内容留出安全区时，固定底色可能与窗口前景/页面主题不一致。已将这两个根背景绑定到与窗口完全相同的应用调色板角色，并补充应用根与窗口颜色一致性的回归；最终编译通过。新增状态带的初始回退色也来自注册表。

### 审计覆盖与排除

- 全应用原生写入扫描：`window-entrypoints.txt`。系统栏颜色唯一写入者为 `ReaderWindowCoordinator.flushChrome`，没有找到页面绕过它直接写颜色的第二入口。
- 主题路径：`ReaderThemeRegistry` → `ReaderAppearanceState/Store` → `ReaderThemeHost.publish` → `LocalReadingExperience.admitAppearanceSnapshot`。应用与阅读主题仍分域；阅读下的状态栏前景保持阅读主题 ink。
- 日夜/跟随系统：`ReaderThemeHost.install/systemChanged/selectApp/publish` 和现有主题选择测试；不改变“同日夜类型不取消跟随系统”的规则。
- 窗口路径：install/detach、App/Reader/Overlay ownership、显隐策略、foreground reapply、旧窗口晚到回执和失败请求 drain。PH98 已有修复继续通过实际 Coordinator 的 8 主题、失败、替换窗口、延迟显隐和几何归零场景。
- 实际绘制：Index 根背景、ReaderShell 的兄弟层、ReadingSurface 的主题渐变/纹理、阅读状态带、ReaderControlPanel、目录、换源以及 PageTurnStage/原生纹理。纸张纹理有设计上的局部像素变化，不能仅用纹理像素不同认定 palette 错误。
- 上游显隐是否覆盖颜色：沿用仓库 PH98 固定官方源码审计，不把模拟“无条件重置颜色”当真实上游行为。显隐 Promise 不证明物理画面已显示，仍保留 revealPending 几何保护。
- 历史测试漏洞：旧状态带回归固定 `extendIntoCutout=false`，或把 `controlsPresentedForWindow` 简化为常量，只检查已挂载 Row 的几何和颜色；这种探针不能发现负责挂载 Row 的 If 根本没订阅控制栏状态。本轮补测的是实际 SDK If 的观察依赖。

仍需设备回答：最终原生状态栏文字/图标与背景是否一致、系统窗口是否额外合成/变色。当前本地证据不代替这些事实，不将四次反馈统一归成某一个未经现场关联的唯一原因。

## 其他四项

| 问题 | 定位与修复 | 本地验证边界 |
|---|---|---|
| PH104 快捷朗读动效少量卡顿 | 动效中途控制栏隐藏会触发邻页预备、整页截图和纹理上传，但胶囊仍在飞行。移动阶段暂停这些预备任务，包含异步上传再次准入；进入原有稳定停留段或退出后恢复。业务 TTS 不等待动效结束。 | 实际生产 capture/queue 方法的基线探针能进入工作，修后在移动段拒绝、稳定段恢复。保持原动效曲线与时长。不能以本地计数声称手机帧率通过。 |
| PH105 下载全部章节无反馈 | 菜单已接到 Core 离线能力，但只更新目录数组。补即时开始提示、限频进度、按实际 completed 状态计算的完成/部分完成提示；菜单显示进行中，失败沿用已有对话框。 | 实际 Index 方法覆盖开始、完成、部分完成、异常、换书后的过期回调，保留书签合并及任务归属。没有联网下载实际书籍。 |
| PH106 导入字体未新增模块且不生效 | `import` 被用来显示已导入名称/选中态，但点击永远导入；Host 的 familySrc 为裸沙箱路径。增加独立 `custom` 选择格，保持 `import` 独立；迁移已有描述符和排序、增加快捷区滚动以显示第九字体。注册改 `file://`，已保存字体在重新进入时恢复注册，选择前检查文件，失败提示。 | 状态迁移、保存恢复、实际 SDK 字体按钮的独立回调、字体路径注册边界通过。正文/分页统一使用 descriptor.familyName。沿用当前一个自定义字体描述符的数据模型，不在本轮扩展多字体收藏管理。实际字形需设备验证。 |
| PH107 控制栏打开仍截获音量键 | 只按设置注册 inputConsumer，回调禁用翻页不能把事件还给系统。改为按阅读可交互、控制栏、外部遮挡和前后台决定实际订阅；相同启用状态不重复注册，第二按键注册失败会释放第一个。 | 实际 LRE 策略及实际 InputKit Host 的注册、注销、失败、恢复、dispose 回归通过。硬件系统音量响应仍未设备验证。 |

字体官方依据：[华为自定义字体的注册和使用](https://developer.huawei.com/consumer/cn/doc/doccenter-dev-faq/faqs-arkui-1064)，明确说明沙箱字体路径需加 `file://`，直接用下载沙箱路径会设置失败。持久化仍保存原有文件路径和指纹，文件内容及用户数据未迁移或删除。

## 验证记录

- `production-baseline.log`：对基线原始 LRE/Index/Host 方法及 SDK Builder 的受控回归，6 项失败。纯状态模块在旧版初始日志仍取当前 import，不作为基线字体列表结论；后续 baseline 模式已排除该混用场景。
- `production-green.log`：当前专项生产方法/SDK Builder 回归。最后结果在交付节记录。
- `local-tests/results.json`：首次 278 组，13 项未通过。8 项为行为/接线变更后旧 fixture 或旧断言需更新；5 项本地 C/C++ 编译工具环境异常（默认 Xcode 未接受许可或找不到 C++ 标准头）。失败原日志全部保留。
- `local-tests/retry-results.json`：采用已安装 CLT 的 `DEVELOPER_DIR`/`SDKROOT`，不修改/接受 Xcode 许可。环境的 5 项全部通过；遗留两个 fixture 已继续修复并单独通过，最终以 pipeline 全量检查为准。
- 编译/HAP/manifest：已通过，见交付节。未进行设备安装或抓取。

## 开源与平台能力边界

本轮属于 Reader 既有事件接线、UI 状态、主题归属和平台生命周期修复，沿用 HarmonyOS 字体注册、文件选择、动画与 inputConsumer，以及既有 Core 下载能力。无新增通用解析器、缓存算法或字体引擎。没有替换上游库，也未引入新的第三方许可。

## 交付

最终 run：`20260916T010839Z-5fb96de4-506ded9e`。

- 278 组 Harmony 本地检查全部 PASS；ArkTS、隔离非增量构建、签名和独立 manifest 复验 PASS。
- manifest：最终产物仅本地保留。
- signed HAP SHA-256：`2dab755e315eac6f11649da44c524dea5730d78e01420020d7d2f7ba46aa9de8`；签名已验证，Profile=debug。
- Harmony 基线 `5fb96de4` + 本轮未提交修改，manifest dirty=true；Core `bf4949531` clean、未修改。build fingerprint=`506ded9e032667737289bb5380014dfc5678abacc8bc3b595e24aec3ba0f2542`。
- 9 项新增专项场景组全部 PASS（其中状态栏覆盖当前 8 主题及 16 个外部弹层组合）；`production-baseline-final.log` 对基线原始组件/方法重放，6 项失败。独立 SDK 字体按钮回调和状态栏根背景合同另由既有检查覆盖。
- `package-receipt.json` / `hap-build.log` / `hap-verify.log` 为最终证据。前两份构建日志/包保留为中间版本，已被最终 run 取代，均未安装。
- iteration / acceptanceEligible=false；vmInstall、physicalInstall、featureInteraction、userAcceptance 均 OPEN。未连接、安装、抓取或清理设备，应用数据未动。
- 当前源码索引：SOURCE_MAP.md（原始证据仅本地保留）。

结论：5 项的代码定位和修复、本地回归与签名产物完成；不以这些证据宣布手机卡顿消失、字体字形或状态栏最终像素已验收。
