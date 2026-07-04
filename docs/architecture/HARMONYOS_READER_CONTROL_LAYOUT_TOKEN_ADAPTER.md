# Reader 控制层 ArkUI layout token adapter

日期：2026-07-03

本文件记录 `ReaderControlLayout.ets` 的职责边界。它不是 Web CSS 迁移层，也不暴露 DOM selector；它只把 canonical demo 中已经审计过的布局语义翻译成本地 ArkUI 可调用的 token / 几何推导。

## 1. 落点

| 类型 | 文件 |
|---|---|
| token adapter | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/ReaderControlLayout.ets` |
| 使用方 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/ui/components/ReaderControlLayer.ets` |
| 状态验证 | `/Users/minliny/Documents/Reader for HarmonyOS/entry/src/main/ets/__tests__/ReaderUiStateValidator.ets` |

## 2. 已集中管理的 token

| 分组 | 当前覆盖 |
|---|---|
| 基础模式 | `isBottomSheetMode`、`isCompactLandscape` |
| sheet | 高度、底部间距、body top/bottom |
| brightness rail | rail 宽度、间距、保留空间、高度、track 高度 |
| panel | panel 数字宽度 |
| action / chapter | action panel、chapter panel、控制区左右 inset、按钮尺寸、章节按钮、章节标题字号 |
| dropdown | TTS / 设置 dropdown 行数、高度、row top、drop-up、可见高度、y 位置 |
| module nav | 高度、间距、padding、icon shell、label 字号和间距、bottom |
| top bar | top、水平 inset、最小高度、返回/换源/更多列宽、gap、padding、按钮高度、标题/章节/按钮字号 |
| source-switch FlowShell | flow padding/gap、reader/window/result 三槽 x/y/width/height、reader sheet/nav/text inset |
| reader-more | layer/menu zIndex、菜单 top/right/width/padding/gap/radius、菜单项高度和文字间距 |
| full / utility host | host top/bottom/inset、panel padding/radius、header/action/content、独立 grabber 位置 |
| session capsule / controlSpace | 控制层上方胶囊锚点、host 宽高、capsule 宽高、countdown/voice/control 尺寸 |
| utility panel | summary/action row 高度、block gap、section gap |

## 3. demo 对齐规则

`source-switch` 三槽只允许以下 demo viewport class 触发：

```text
tablet-expanded
compact-landscape
```

不再用以下条件近似：

```text
width >= 768
landscape
sideDock
具体设备分辨率或 DPI
```

## 4. 已验证的代表几何

| 输入 | demo 类别 | 期望 |
|---|---|---|
| `390 x 844` | `standard-portrait` | 不进入三槽 FlowShell |
| `812 x 640` | `expanded-width` | 即使是 sideDock，也不进入三槽 FlowShell |
| `812 x 430` | `compact-landscape` | reader/window/result 为三槽；reader slot `300 x 406` |
| `1024 x 640` | `tablet-expanded` | reader/window/result 为三槽；reader slot 宽 `476` |
| `2560 x 1600 / 360dpi` | `tablet-expanded` | 换算 `1138 x 711vp`；reader slot 宽 `590` |

## 5. 仍未完成

- `ReaderControlLayer.ets` 内完整页模块的内部内容行、更多菜单非 route 动作、部分 utility 行内文字/按钮 token 还没有全部抽出。
- `ReaderSharedSurface` 在 source-switch FlowShell 下已改为 reader slot 承载正文，避免三槽 FlowShell 双层正文；真实横屏/平板设备截图/录屏仍需验证 z-order 和正文归槽。
- 真实业务换源未接入。当前只提交本地 `ReaderContext.sourceId` 和 UI state，不改 Reader Core、网络、书源解析或数据层。
- fold posture、键盘安全区、无障碍和性能专项仍未开始。

## 6. 本轮设备证据

| 证据 | 路径 |
|---|---|
| 书架 | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/01-bookshelf.jpeg` |
| 沉浸阅读 | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/02-immersive.jpeg` |
| 控制层 | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/03-control.jpeg` |
| 更多菜单 | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/04-reader-more-fixed.jpeg` |
| 更多菜单外点关闭 | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/06-more-outside-click.jpeg` |
| 书籍缓存 utility host | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/05-book-cache-hitfix.jpeg` |
| source-switch phone overlay | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/07-source-switch-phone.jpeg` |
| source-switch phone layout tree | `/Users/minliny/Documents/Reader for HarmonyOS/evidence/reader-ui-20260703-p1-token/07-source-switch-phone-layout.json` |
