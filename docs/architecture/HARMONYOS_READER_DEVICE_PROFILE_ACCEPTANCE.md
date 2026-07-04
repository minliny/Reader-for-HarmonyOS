# Reader HarmonyOS 自适应设备验收基准

本文记录 Reader for HarmonyOS 当前前端垂直切片的自适应验收基准。具体分辨率只作为代表性回归样机和截图证据标签，不是布局实现的硬编码接口。

## 关键原则

Reader for HarmonyOS 不按某一个物理分辨率开发页面。布局逻辑按 ArkUI 逻辑尺寸、方向和壳层模式派生：

```text
物理分辨率 + DPI -> vp 窗口尺寸 -> widthClass / orientation -> ShellMode / ComponentVariant
```

因此：

- `1320 x 2856 / 560dpi` 只是手机 portrait 类的代表样机。
- `1280 x 2832` 这类相近竖屏手机也应该落入同一 phone portrait 行为。
- `2560 x 1600 / 360dpi` 只是 `tablet-expanded` 类的代表样机。
- 真正不能互相替代的是 phone portrait 与 `tablet-expanded` / `compact-landscape` 这些 demo viewport class，而不是某几个像素点。

## demo 源码规则

canonical demo 的 `frontend-demo/render-runtime.js` 使用 `viewportClassSnapshot()` 分类：

| demo 字段 | demo 阈值 |
|---|---|
| `widthClass=compact` | `width < 360` |
| `widthClass=standard` | `360 <= width < 480` |
| `widthClass=large` | `480 <= width < 600` |
| `widthClass=expanded` | `600 <= width < 840` |
| `widthClass=tablet` | `width >= 840` |
| `viewportClass=compact-landscape` | `orientation=landscape && height < 520` |
| `viewportClass=tablet-expanded` | `width >= 840` |
| `viewportClass=expanded-width` | `600 <= width < 840` |
| `viewportClass=large-portrait` | `portrait && width >= 480` |
| `viewportClass=standard-portrait` | `portrait && width >= 360` |
| `viewportClass=compact-portrait` | 其他 portrait |

source-switch 的结构来自 demo：

- 普通 portrait phone：`fd-source-phone-flow`，窗口槽绝对定位，result slot 隐藏。
- `tablet-expanded` / `compact-landscape`：`fd-source-reader-continuation` 三槽结构，`grid-template-areas: "reader window result"`。

HarmonyOS 不能按 Web CSS selector 实现，但必须按这些 viewport class 语义翻译成 ArkUI-native `ReaderAdaptiveState`。

## 当前代表性回归档位

| 档位 | 物理规格 | DPI | 方向 | ArkUI 逻辑尺寸 | 验收用途 |
|---|---:|---:|---|---:|---|
| 手机代表样机 | `1320 x 2856` | `560` | 竖屏 | `377 x 816vp` | 手机主 Tab、书架、沉浸阅读、bottom sheet 控制层、phone source-switch overlay |
| 当前模拟器近似手机 | `1280 x 2832` | 设备实际 DPI | 竖屏 | 由系统窗口推导 | 可作为 phone portrait 近似视觉证据，不作为固定像素回归样机 |
| 平板代表样机 | `2560 x 1600` | `360` | 横屏 | `1138 x 711vp` | 平板 nav rail、side dock 控制层、source-switch 三槽 FlowShell |

换算公式：

```text
scale = dpi / 160
widthVp = widthPx / scale
heightVp = heightPx / scale
```

当前代码已通过 `ReaderAdaptive.fromPhysicalMetrics(widthPx, heightPx, dpi)` 提供物理尺寸到 vp 的换算验证。业务布局仍消费 `ReaderAdaptiveState`，不会读取固定机型、固定 DPI 或固定截图尺寸。

## 派生布局预期

### 手机 portrait 类

| 字段 | 预期 |
|---|---|
| demo 类别 | `compact-portrait` / `standard-portrait` / `large-portrait` |
| HarmonyOS 等价 | compact 或 medium portrait，未达到 tablet/expanded 横向壳层 |
| `orientation` | `portrait` |
| `mainTabMode` | `bottomTabs` |
| `readerPanelMode` | `bottomSheet` |
| `readerContentMode` | `single` |
| `sourceSwitchUsesFlowLayout` | `false` |

### 平板 / 宽屏类

| 字段 | 预期 |
|---|---|
| demo 类别 | `tablet-expanded`，以及 source-switch 的 `compact-landscape` |
| HarmonyOS 等价 | expanded/large 宽屏，或 medium landscape |
| `mainTabMode` | `tablet-expanded` 使用 `navRail`；compact landscape 不强制改变主 Tab 语义 |
| `readerPanelMode` | `sideDock` 或更宽屏的 `splitPane` |
| `readerContentMode` | `wideSingle` |
| `bookshelfColumns` | `5` |
| `sourceSwitchUsesFlowLayout` | `true` |

注意：代表平板 `2560 x 1600 / 360dpi` 当前不会进入 `large` 或 `dualCandidate`。如果后续希望这类平板进入双页阅读，需要另行定义平板专属阈值，不能在本轮里顺手修改。

## 需要补的设备证据

连接设备后，必须先确认设备窗口尺寸和布局类别，不能只看截图观感。

```bash
hdc list targets
hdc shell snapshot_display -f /data/local/tmp/reader-check.jpeg
hdc shell hidumper -s WindowManagerService -a '-a'
```

代表样机回归窗口：

```text
手机代表样机：[ 0 0 1320 2856 ]
平板代表样机：[ 0 0 2560 1600 ]
```

如果窗口不是上述尺寸，但仍落在同一布局类别，例如当前 `1280 x 2832` 竖屏手机窗口，则可以记录为 phone portrait 近似视觉证据。它不能替代 `tablet-expanded` / `compact-landscape`，也不应该被说成精确的 `1320 x 2856` 像素回归截图。

## 当前已补代码级验证

`entry/src/main/ets/__tests__/ReaderUiStateValidator.ets` 已覆盖：

- 手机代表样机 `1320 x 2856 / 560dpi` 推导为 phone portrait。
- 当前模拟器近似尺寸 `1280 x 2832 / 560dpi` 仍推导为 phone portrait。
- 平板代表样机 `2560 x 1600 / 360dpi` 推导为 `tablet-expanded` 等价类。
- 手机 source-switch 保持 phone overlay。
- 平板 source-switch 触发三槽 FlowShell。
- overlay/focus 关闭后回到来源焦点。
- 键盘 inset 写入 `adaptive.keyboardInsetBottom` 后不抢占当前 overlay/focus。
- TTS 与自动翻页 session 互斥切换，只保留最后目标。

## 仍未完成

- 手机和平板真实设备截图、布局树和录屏证据。
- 平板 FlowShell 三槽的真实设备视觉验收。
- 真实业务数据接入。
- 折叠姿态、2in1、自由窗口、键盘安全区专项、无障碍专项、性能专项。
