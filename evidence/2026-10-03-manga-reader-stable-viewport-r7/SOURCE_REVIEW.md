# R7 独立源码复核

日期：2026-10-03。复核者：`sheet_motion_reaudit`。

结论：在下面绑定的四个产品文件中，本轮源码审查已通过，未发现仍需修改的源码阻塞。这个结论只覆盖源码调用链、布局责任和请求参数，**不包含 SDK 回归通过、原生布局、VM 像素、主线交付或用户验收**。根任务已暂停产品修改，最终源码冻结及交付仍以根任务的 allowlist / manifest 为准。

本次没有修改产品、测试或 R4/R5/R6 冻结材料，没有操作 HDC、设备或构建。仅创建本报告。

## 比较基线与审查输入

使用 R6 冻结 `r6-source-delta.tar.gz` 中的 Surface / Shell 原字节，以及其 R4 完整父档案中保持至 R6 的 Index / Coordinator 原字节。没有以当前 Git HEAD 或累计 dirty diff 代替 R6 基线。R6 的父链和操作清单由 `source-delta/delta-manifest.json` 指定。

审查输入为临时交付树 `/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913/Reader-for-HarmonyOS`。

| 产品文件 | R6 SHA-256 | 本次审查 SHA-256 |
| --- | --- | --- |
| `entry/src/main/ets/features/manga/MangaReadingSurface.ets` | `f84e5289f30711f31b9c7df2999fdba30dc6af4d175d6100c0e0bfb801ee3448` | `4e8cda54f879494a574de75ab2c85821d02edd96b70bdbf8e3e1085150461676` |
| `entry/src/main/ets/features/shell/ReaderShell.ets` | `edd9b4ade1b4f2ebe7953816742460b38263b1ae804b345f7f4dd4ebd906d560` | `420928dc7906498d6c1bc54301cf3f624300ef8600e720904e611fcaed411336` |
| `entry/src/main/ets/pages/Index.ets` | `0e54a722f8bd7da88e50acd021e58f1380cfdd945608b6ea5938ab68962692c5` | `1b7004f488376fbd172073af0a1b9fe65025effcd730d0f2faec1de274d79d71` |
| `entry/src/main/ets/app/ReaderWindowCoordinator.ts` | `60a7ea600175454a3351be9266077575e6b910709a945ff204447f531722a1e9` | `35ab98291f518958f33a53a117fdc2e1c3ccb47322064d2b3c4fed7129b5b27d` |

## R6 根因的可达调用链

R6 `MangaReadingSurface.build` 对整个外层 Column 调用 `padding(readerInteractiveSafeInsets(metrics))`。图片 Scroll、平板目录、控制栏、内置面板及章末状态均在这个 Column 内。系统栏显隐触发 Coordinator 的 `avoidAreaChange` / geometry refresh，改变 `readerWindowMetricsRevision` 和安全区事实，随之改变图片子级的可用空间。

`imageViewport.Scroll.onAreaChange` 调用 `resizeViewport`；后者写 `viewportWidth` / `viewportHeight`，并对已打开的阅读 owner 调用 `restore(anchor)`。`contain` 模式的 `rowDisplayWidth` / `rowDisplayHeight` 直接使用视口高度计算图片及槽高；`width` 模式也仍会进入 restore / updateViewport 链路。因此系统栏显隐与图片重新排版之间存在明确生产路径。

另一条独立的绘制路径是原生系统栏背景：R6 漫画请求不透明纸色；Shell 在外层目录或换源出现时还会以 `ReaderStatusBarPaper` 的 fallbackColor 覆盖顶部 band。仅移除图片 padding 不足以处理这些绘制责任。

## 最新源码处理

### 图片与父级布局

- Manga 外层不再消费 safe padding，保留不透明漫画背景，但通过 `expandSafeArea(SYSTEM,CUTOUT,all edges)` 与 `ignoreLayoutSafeArea(SYSTEM,ALL)` 请求全窗口绘制及布局。
- Index 只在 `readingSessionActive && readingContentKind==='manga' && readerOwnsWindowEdges()` 时请求上述 layout 忽略与四边绘制扩展；阅读态原有 root padding 仍为 0。
- Shell 只在 `contentKind==='manga'` 时请求该布局策略。文本阅读仍使用原有 expand 请求，新增 ignore 请求传空类型及空边集合。普通 App 路由继续使用原有 safe-top padding。
- `imageViewport`、图片 row 几何、真实 Area 回调、resize / restore、controller 及锚点生命周期没有被修改。真实窗口尺寸变化仍进入原有恢复逻辑。本次消除的是系统安全区对图片祖先的显式空间预留。

本机 SDK `ets/component/common.d.ts:21048,21060` 区分绘制安全区扩展与布局安全区扩展，`ignoreLayoutSafeArea` 声明自 API 20 支持；当前工作区兼容 SDK 为 `6.1.0(23)`。API 声明及请求存在不证明当前 VM engine 的实际布局结果。

### 浮层避让责任

| 层 | 最新安全区责任 |
| --- | --- |
| 图片 / 背景 / scrim | 不消费安全区 padding，保持全窗口或完整漫画 pane |
| `windowInteractiveInsets` | 读取 shared window safe helpers 的全局事实；交互呈现时可复用同几何的已测 `statusBarRect`，用于 reveal 回执早于 avoid-area 更新的情况 |
| `interactiveInsets` | 平板分栏时扣除已由左侧目录占用的宽度，得到主漫画 pane 的左边安全区交集 |
| `panelInsets` | 宽屏右侧面板再扣除主 pane 中位于面板左边的空间，避免把左侧窗口 cutout 再加到右侧面板 |
| 顶 / 底控制栏 | 只有 overlay Stack 消费主 pane 的安全区，设计间距保持原有值；底卡宽度使用对应左右交集 |
| 常驻平板目录 | 消费 window 左边、顶部及底部事实，不改变列的外部固定宽度 |
| 内置面板 | scrim 保持完整 pane；面板内容消费 panel 安全区，宽屏内容高度扣 top / bottom，手机内容高度扣 bottom |
| 章末卡与章末页码 | 在各自 overlay 上消费主 pane 的安全区，原有 48 / 12 设计间距仍在其外叠加 |
| 沉浸页码 | 独立 overlay 消费安全区，图片布局不受它影响；保持 `HitTestMode.None` |
| 外层目录 / 换源 | 原有 ReaderFullDirectory / SourceSwitchWindow 自行计算 safe edges；没有再给整个 Shell 增加 padding |

局部投影的源级例子：窗口 920、左目录 258、主 pane 662、右面板 340，窗口左侧 unsafe band 为 32。主 pane 的左侧交集 `max(0,32-258)=0`；右面板再扣 `662-340`，仍为 0。右边安全区保留窗口右边事实。这个算式只说明源级边界投影，不模拟原生布局。

### 原生颜色、去重与恢复

- `ReaderWindowChromeStyle` 新增 `transparentSystemBars`，默认 false；underlayColor 仍为真实不透明背景，不把 Shell 首帧背景和原生透明请求混成一个值。
- 漫画请求明确传 true，reader / overlay 请求均复用该 style。Coordinator 对 status 和 navigation 背景写 `#00000000`，前景继续采用对应漫画主题的精确 ink。
- `requestChrome` 的完整去重包含透明字段，避免只改变透明意图却被相同颜色请求吞掉。
- App style 及现有文本调用默认 false；退出沿 R6 已有 captured App style / policy 恢复。挂载、失活、旧 identity、dispose 和异步窗口写入门禁没有在本轮变动。
- Shell 的 status paper underlay 增加 `contentKind!=='manga'` 条件，避免漫画外层目录 / 换源重新覆盖顶部纸色 band。文本分支继续保留原责任。
- 漫画 policy 的 `extendIntoCutout` 语义声明改 true；本轮具体全窗口布局请求来自 ArkUI layout / drawing 属性。不能把这一个 policy 布尔值当作独立原生 cutout API 的成功凭据。

## 复核发现并已在绑定源码修正的两项问题

1. 初稿 `panelContentHeight=panelHeight-bottom[-top]`，手机仍使用 `minHeight:260`，会出现 maxHeight 低于 minHeight 的新增矛盾。最新手机最小高度为 `min(260,panelContentHeight)`，宽屏仍为 0。例如手机 settings viewportHeight=400，snap 最大高度268、bottom=24时，内容 max/min 均为244，不再自相矛盾。
2. 初稿将窗口左 unsafe band 重复套到平板主 pane 和右侧面板。最新拆分 window / main-pane / panel 三个薄业务投影，复用 shared safe helper，不新增通用布局引擎。

上述两项由根任务修改，审查者没有编辑产品。

## 验证边界与后续交接

本报告的通过范围是绑定源码的独立审查。SDK 测试由另一 owner 执行和登记；本报告不将其进行中的结果提前判通过。建议 SDK 合链记录同一 mounted 图片 actor 在 controls State / live insets 变化后仍有相同全窗口请求、图像及 row 尺寸、锚点和受控 scroll 请求，而不是只搜索属性字符串；真实 OS Area 投递与布局求解仍须由后续目标样本证明。

后续 VM 取证需回答：沉浸态上下纸带是否消除；控制栏显示与隐藏时图片像素位置 / 尺寸是否保持；系统图标及 indicator 是否绘制在透明 band 上；控栏、目录面板、章末状态是否仍在正确安全边界内。横屏、真实设备、不同图片背景上的系统图标可读性，以及逐帧精确时序尚未证明。

R6 的静止系统栏显示 / 隐藏证明仍作为历史保留；它没有证明图片覆盖全窗口或切换时图片布局稳定，本轮不能回写 R6 历史结论。
