# Reader UI demo 严格结构与样式对齐审计

审计日期：2026-07-03

## 结论

当前 HarmonyOS ArkUI 实现没有严格按照 `frontend-demo` 的结构和样式完成转译。

已对齐的部分主要是少量 route / slot 语义，例如 `ReaderTopBar`、`ReaderBottomSheetHost`、`ReaderModuleNav`、`source-switch` 的基础出现条件。未对齐的部分覆盖结构层级、位置锚点、颜色 token、透明度、阴影、断点规则、候选行内容结构和宽屏 FlowShell 槽位关系。

后续不能继续按截图局部微调。必须先建立 ArkUI 本地的等价层：

- `ReaderVisualTokens`：承接 demo 的 `reader-control-*` / `fd-*` 语义色、透明度、边框、阴影、圆角。
- `ReaderLayoutSlots`：承接 demo 的 top / sheet / nav / rail / source-switch 在不同 viewport-class 下的锚点、尺寸和相对关系。
- `ReaderSourceSwitchFlow`：承接 demo 的 FlowShell 三槽结构，而不是把 source-switch 当成普通 overlay。

## demo 基准来源

- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
  - `readerTopOverlay(...)`
  - `readerBottomSheetHtml(...)`
  - `readerModuleNavHtml(...)`
  - `flowScreen(...)`
  - `sourceCandidateRow(...)`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/04-settings-source.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/05-flow-adaptive.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/06-responsive.css`

## 严格结构基准

### ReaderTopBar

demo 结构：

```text
section.fd-reader-top
  button[data-reader-exit]
  span
    strong: data.reader.title
    small: data.reader.sourceLine
  button[data-route="source-switch"]
  button[data-reader-more-toggle]
```

demo 位置与样式：

| 项 | demo 值 |
|---|---|
| top | portrait `18px`，compact-landscape `12px` |
| left / right | portrait `14px`，tablet-expanded `28px`，compact-landscape `14px` |
| min-height | portrait `54px`，compact-landscape `48px` |
| columns | portrait `44px 1fr 62px 34px`，compact-landscape `40px 1fr 58px 32px` |
| gap | portrait `8px`，compact-landscape `6px` |
| padding | portrait `0 12px`，compact-landscape `0 10px` |
| border | `rgba(154,139,124,0.35)` |
| background | `rgba(255,250,244,0.92)` |
| shadow | `reader-control-shadow` / `fd-soft-shadow` |
| title | `16px`，large font `18px`，compact-landscape `13px` |
| subtitle | `12px`，large font `14px`，compact-landscape `10px` |
| button | min-height `42px`，font `12px` weight `800` |

当前 ArkUI 差异：

- 顶栏结构接近，但 `换源` 按钮没有包含 source-switch 图标，demo 是 `icon + 文本`。
- 按钮 font weight 仍偏轻，当前使用 `Medium`，demo 是 `800`。
- 阴影、半透明背景、边框 token 目前是局部硬编码，不是统一 token。
- `sourceLine` 没有作为独立字段接入，只是临时由 `chapterTitle + sourceLabel` 拼出。

### BottomSheetHost / ReaderControlMain

demo 结构：

```text
div.fd-reader-sheet
  ReaderControlMain
    fd-reader-actions
      3 action buttons
    fd-reader-chapter-panel
      fd-reader-chapter-control-row
      fd-reader-progress-row
  fd-brightness-rail
  grabber

nav.fd-reader-module-nav
```

demo 位置与样式：

| 项 | demo 值 |
|---|---|
| sheet left/right | `12px` |
| sheet bottom | `18px` |
| sheet height | portrait `330px` |
| sheet border | `rgba(164,149,132,0.42)` |
| sheet background | `rgba(255,250,244,0.98)` |
| sheet shadow | `reader-control-shadow` / `fd-shadow` |
| control top | `28px` |
| control bottom | control `110px`，quick portrait `104px`，quick default `12px` |
| rail width/gap | portrait `38px / 14px`，compact-landscape `30px / 8px` |
| actions | gap `8px`，padding `9px 8px` |
| actions button | font `11px` weight `800`，gap `6px` |
| chapter panel | padding `9px 10px`，gap `6px` |
| chapter row | `34px 1fr 34px`，min-height `52px` |
| module nav | left/right `24px`，bottom `32px`，min-height `78px` |

当前 ArkUI 差异：

- `ReaderControlMain` 用 Column + 固定高度近似，未严格表达 demo 的 grid rows `0.82fr / 1.18fr`。
- action panel 和 chapter panel 的透明度、边框、背景没有统一 token。
- ModuleNav 的 selected icon shell、文本颜色、背景和 demo 仍不一致。
- compact-landscape / tablet-expanded 下 sheet、nav 与 source-switch continuity 的压缩规则没有完整验证。
- 亮度 rail 的位置已有右侧固定语义，但视觉 token、太阳图标尺寸、auto 按钮内外层关系还未完全还原。

### source-switch / FlowShell

demo 结构：

```text
FlowShell frame: fd-flow-frame fd-source-phone-flow fd-source-reader-continuation
  step slot: fd-source-continuity-slot
    fd-source-reader-continuity
      sharedReaderSurface
      fd-source-control-overlay
        readerTopOverlay
        fd-reader-sheet fd-source-control-sheet
        fd-reader-module-nav fd-source-control-nav
  comparison slot: fd-source-window-slot
    fd-source-switch-window
      fd-source-window-info
      fd-source-candidate-list
  result slot: fd-source-result-slot
```

phone demo 槽位：

| 项 | demo 值 |
|---|---|
| window slot left/right | `12px` |
| window slot top | `92px` |
| window slot bottom | `360px` |
| window padding | `7px 9px` |
| window border | `rgba(155,132,102,0.24)` |
| window background | `#fffcf8` |
| header min-height | `32px` |
| header columns | `20px 1fr auto 24px` |
| header gap | `8px` |
| candidate row min-height | `32px` |
| candidate row padding | `2px 9px` |
| candidate columns | `minmax(82px,1fr) 45px minmax(86px,1.08fr)` |

tablet / compact-landscape demo 槽位：

| 项 | demo 值 |
|---|---|
| frame width | `fd-runtime-flow-width` |
| structure | 3 columns |
| columns | `minmax(300px,1fr) minmax(260px,300px) minmax(160px,200px)` |
| areas | `"reader window result"` |
| gap | `12px` |
| padding | `12px` |
| reader top | tablet `18px`，landscape `12px` |
| reader nav top | tablet `112px`，landscape `74px` |
| reader sheet | right `12px`，bottom `18px`，width `min(340px, calc(100% - 24px))` |
| reader sheet height | tablet `230px`，landscape `196px` |
| source-control actions | gap `4px`，padding `4px`，button min-height `34px`，font `9px` |

当前 ArkUI 差异：

- phone window slot 已按 overlay 语义保留，宽屏已建立 ArkUI 原生 `reader/window/result` 三槽 FlowShell 骨架。
- tablet / landscape 已有三槽容器和 min/max 宽度计算；底层 ReadingSurface 仍未归入 reader slot，需要后续结构重构和多设备视觉验收。
- result slot 内容仍是临时骨架，不是 demo 的状态驱动结果面板。
- 候选行没有真实 `state / match / checks / selectedSource` 状态，当前只是 fixture 静态行。
- 关闭按钮暂用文本 `x`，demo 使用 close icon；需要本地资源化，不能手写图形。

## 颜色与 token 差距

当前最大问题是 ArkUI 里大量颜色直接写在组件中，导致不同组件视觉不统一。

必须抽出的 token：

| demo 语义 | demo 值 / 语义 | ArkUI 状态 |
|---|---|---|
| `reader-control-surface` | `rgba(255,250,244,0.92/0.96/0.98)` | 多处硬编码 |
| `reader-control-panel` | `rgba(255,252,248,0.62)` / `rgba(255,250,244,0.82)` | 多处硬编码 |
| `reader-control-elevated` | `rgba(255,255,255,0.5)` / `rgba(250,244,236,0.86)` | 多处硬编码 |
| `reader-control-line-strong` | `rgba(154,139,124,0.35)` / `rgba(180,166,151,0.34)` | 多处硬编码 |
| `reader-control-shadow` | `fd-soft-shadow` / `fd-shadow` | 局部补了 shadow，未统一 |
| `fd-primary` | source / brightness / active icon 主色 | 资源和组件值不统一 |
| `fd-muted` | subtitle / meta 文本 | 未统一 |

## 修复顺序

1. 建立 `ReaderVisualTokens.ets`，禁止继续在 Reader 控制层散写颜色、阴影、边框。
2. 建立 `ReaderLayoutSlots.ets`，把 topbar、sheet、nav、rail、source-switch phone/flow slot 的位置和尺寸集中计算。
3. 将 `ReaderControlLayer.ets` 拆成结构组件：`ReaderTopBar`、`ReaderBottomSheetHost`、`ReaderControlMain`、`ReaderBrightnessRail`、`ReaderModuleNav`、`ReaderSourceSwitchFlow`。
4. source-switch 已有三槽 FlowShell skeleton、候选行状态和 result slot；下一步做 ReadingSurface 归槽、确认换源 reducer 和多设备视觉验收。
5. 每次只修一组区域，并输出 phone + compact-landscape / tablet-expanded 截图，不再只给 390x844。

## 当前不能宣称完成

- 不能宣称“严格还原 demo”。
- 不能宣称 source-switch FlowShell 视觉和真实业务闭环完成。
- 不能宣称 tablet / landscape 视觉已通过。
- 不能宣称颜色系统已对齐。
- 不能宣称控制层所有组件结构位置已对齐。
