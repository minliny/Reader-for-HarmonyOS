# Reader for HarmonyOS 前端架构设计文档 v2

> **文档定位**：作为开发前的规划基线，覆盖 demo 契约的所有维度，避免开发到一半发现规划不完整。
>
> **替代关系**：本文档取代 v1 阶段的所有碎片化规划（HARMONYOS_READER_SHELL_SKELETON.md / HARMONYOS_ADAPTIVE_UI_FOUNDATION.md / HARMONYOS_ARKUI_PAGE_STRUCTURE.md 等），作为唯一的架构基线。
>
> **使用方式**：每一层开发前，先对照本文档对应章节确认覆盖度检查清单全部满足，再启动编码。开发中发现规划缺失时，先更新本文档再补代码。

---

## 0. 设计原则

### 0.1 防止规划不完整的 5 条铁律

1. **契约先行**：任何组件开发前，必须先在本文档登记其完整字段、接口、状态机、动效契约。未登记的组件不允许编码。
2. **层级隔离**：9 层架构每层职责单一，跨层依赖只能向下。L3 动效运行时层、L5 应用基础设施层是独立架构层，不允许塞到其他层。
3. **覆盖度检查清单**：每层有"完成前必须满足的检查项"。清单未通过的层，不允许进入下一层开发。
4. **demo 契约对齐**：所有视觉/动效/交互契约的源头是 demo（`/Users/minliny/Documents/Reader UI/frontend-demo/`），不允许凭印象编码。
5. **BLOCKER 优先**：BLOCKER 级缺失不解决，应用不可用。不允许跳过 BLOCKER 做下一阶段。

### 0.2 与 demo 契约的关系

| demo 产物 | 本项目消费方式 |
|---|---|
| `tokens.css` / `00-foundation.css` | 静态 fallback，**不是最终值**。最终值看 `fixture.js` + `render-runtime.js` |
| `fixture.js` | 实际主题数据（paperStart/paperEnd/ink），L1 颜色 token 的真实来源 |
| `render-runtime.js` | 运行时 day/night control 对象，L1 control token 的真实来源 |
| `motion-tokens.css` | 跨端动效 token（duration/easing/distance/scale），L1 动效 token 的真实来源 |
| `motion-controller.js` | 47 个 Motion ID 状态机 + transaction 生命周期，L3 MotionReducer 的参考实现 |
| `MOTION_EFFECTS.md` | 每个动效的具体效果（方向/位移/缩放/关键帧），L3 状态机和 L4 原生动效的实现依据 |
| `MOTION_CONTRACT.md` | 32 条 family rule + 4 端组件映射，L3 ContractRegistry 的数据源 |
| `MOTION_SELECTOR_MATRIX.md` | 148 个交互入口，L7 组件层的交互实现清单 |
| `route-contract.js` | 131 个路由，L6 Shell 层 + L8 页面层的路由清单 |
| `shared-shell-kit/kit.js` | 5-slot shell 结构，L6 Shell 层的结构契约 |
| `MOTION_INTERACTION_COMPONENT_AUDIT.md` | 通用组件族纳管级别，L7 组件层的实现优先级 |

### 0.3 demo 的双层 token 架构（关键认知）

demo 的 token 系统有**三层**，必须识别清楚：

```
Layer A: 静态 CSS fallback（00-foundation.css :root）
  → 仅用于 demo 静态预览，不是最终值
  → 例：--fd-paper-solid: #f8f4ec

Layer B: 运行时动态注入（render-runtime.js）
  → day/night 两套 control 对象，运行时按主题切换
  → 例：day control.surfaceSolid = rgba(255,252,248,0.98)
       night control.surfaceSolid = rgba(38,35,31,0.96)

Layer C: 主题数据层（fixture.js）
  → 实际主题数据，是 render-runtime.js 注入值的来源
  → 例：paper.paperStart = "#fbf4e9"（不是 #f8f4ec）
```

**项目必须使用 Layer B + Layer C 的值，不能用 Layer A 的 fallback 值**。这是 v1 阶段最大的契约误读。

### 0.4 ArkUI 平台能力清单

| 能力 | ArkUI API | 用途 |
|---|---|---|
| 关键帧动画 | `keyframeAnimateTo` | 18 个 @keyframes 等价实现 |
| Animator | `@Animator` | 循环动画（voice pulse / loading spin） |
| 自定义可动画属性 | `@AnimatableExtend` | capsuleDockProgress / themeTransitionProgress |
| 组件转场 | `transition(TransitionEffect)` | if/else 挂载/卸载转场 |
| 共享元素转场 | `sharedTransition` + `geometryTransition` | 封面 → 沉浸阅读 |
| 原生导航 | `Navigation` + `NavPathStack` + `NavDestination` | 路由栈管理 |
| 手势 | `SwipeGesture` / `PinchGesture` / `PanGesture` / `LongPressGesture` | 翻页 / 字号 / 拖动 / 长按 |
| 列表虚拟化 | `LazyForEach` + `LazyListDataSource` | 长列表性能 |
| 状态管理 | `@ObservedV2` + `@Trace` | 精细订阅（替代全量 clone） |

---

## 1. 架构总览

### 1.1 9 层架构

```
┌─────────────────────────────────────────────────────────────┐
│ L8 页面层        Index.ets + 131 个子页面                     │
├─────────────────────────────────────────────────────────────┤
│ L7 组件层        Tab 组件 + ReaderControlLayer + Shared       │
├─────────────────────────────────────────────────────────────┤
│ L6 Shell 层     MainTabShell / ReaderShell / LibraryShell    │
│                 SettingsShell / FlowShell（5-slot 契约）      │
├─────────────────────────────────────────────────────────────┤
│ L5 应用基础设施层 ViewModel + Repository + StateCard         │
│                 PerformanceMonitor + ImageCache              │ ← 新增
├─────────────────────────────────────────────────────────────┤
│ L4 原生能力适配层 Navigation + Gesture + Transition          │
│                 Animator + AnimatableProperty                 │ ← 新增
├─────────────────────────────────────────────────────────────┤
│ L3 动效运行时层  MotionReducer + ContractRegistry            │
│                 Interrupt + AsyncGuard + ViewportAdapter     │ ← 新增
├─────────────────────────────────────────────────────────────┤
│ L2 状态契约层    ReaderUiState + ReaderUiReducer + MotionState│
├─────────────────────────────────────────────────────────────┤
│ L1 Token 层     ReaderThemeState + ReaderMotion +            │
│                ReaderTypography + ReaderSpacing + ReaderSize │
├─────────────────────────────────────────────────────────────┤
│ L0 资源层       color.json base/dark + string.json + 图片    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 层间依赖规则

- 依赖只能向下：L8 → L7 → L6 → L5 → L4 → L3 → L2 → L1 → L0
- 同层之间允许互相引用（如 L7 组件引用 L7 共享组件）
- 跨层跳级引用禁止（如 L7 组件直接读 L0 color.json 资源，必须通过 L1 token）

### 1.3 数据流向

```
用户操作 → L4 GestureAdapter / Navigation 触发
         ↓
L2 ReaderUiReducer dispatch action
         ↓
L2 ReaderUiState 更新（含 MotionState.phase）
         ↓
L3 MotionReducer 接管动画 transaction
  ├─ 查询 L3 ContractRegistry 获取状态机
  ├─ 启动 L4 keyframeAnimateTo / transition
  └─ 监听完成 → 更新 phase 为 settled
         ↓
L7 组件层读取新 state + phase
         ↓
L6 Shell 重新渲染（LazyForEach + transition）
```

### 1.4 v1 → v2 架构变化对照

| 维度 | v1 状态 | v2 目标 |
|---|---|---|
| 视觉契约层 | 已建，覆盖度 ~70% | 100%（按 fixture.js + render-runtime.js） |
| 状态契约层 | 已建，契约完整但无消费者 | 保留契约 + 扩展 phase 字段 + 接入 L3 |
| 动效运行时层 | **完全缺失** | 新增 L3 层，参考 motion-controller.js |
| 原生能力层 | **完全缺失** | 新增 L4 层，接入 ArkUI 原生 API |
| 应用基础设施层 | **基本缺失** | 新增 L5 层，ViewModel + StateCard + Performance |
| Shell 结构层 | 已建，slot 错位 | 修正 slot 错位，对齐 kit.js 5-slot 契约 |
| 组件层 | 已建，硬编码严重 | 全量 token 化 + 接入 L3/L4 |
| 页面层 | 仅 Index + 4 归档页 | Index + 131 路由的 NavDestination |

---

## 2. L0 资源层

### 2.1 职责定义

存放所有平台资源文件，不包含任何逻辑。L1 token 层通过 `$r('app.color.xxx')` 引用。

### 2.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/resources/base/element/color.json` | day 模式颜色资源 | 需修正 + 扩展 |
| `entry/src/main/resources/dark/element/color.json` | night 模式颜色资源 | 需修正 + 扩展 |
| `entry/src/main/resources/base/element/string.json` | 字符串资源 | 需补齐 |
| `entry/src/main/resources/base/element/float.json` | 尺寸/间距资源 | 新增 |
| `entry/src/main/resources/base/media/` | 图片资源 | 需补齐 |
| `entry/src/main/resources/rawfile/fonts/` | 字体文件 | 需补齐 |
| `entry/src/main/resources/profile/main_pages.json` | 页面注册 | 已修正为 pages/Index |

### 2.3 color.json 完整 entry 清单

**day 模式（base/element/color.json）**：必须包含以下 entry，值来源于 `fixture.js` + `render-runtime.js` 的 day control 对象。

| entry name | 值来源 | 当前状态 |
|---|---|---|
| reader_paper_start | fixture.js paper.paperStart `#FBF4E9` | ❌ 当前 `#FFF9F2` |
| reader_paper_end | fixture.js paper.paperEnd `#EFE2D0` | ❌ 当前 `#F8ECDE` |
| reader_paper_solid | 00-foundation.css `#F8F4EC` | ✅ |
| reader_paper_bright | fixture.js paper.paperBright | ❌ 缺失 |
| reader_surface | render-runtime.js day surface `rgba(255,252,248,0.9)` → `#E6FFFCF8` | ✅ |
| reader_ink | fixture.js paper.ink `#332C25` | ✅ |
| reader_muted | render-runtime.js day muted | ⚠️ 需核对 |
| reader_border | 00-foundation.css `#C1C7CD` | ✅ |
| reader_primary | render-runtime.js day primary `#2F6373` | ✅ |
| reader_primary_dark | render-runtime.js day primaryDark | ❌ 缺失 |
| reader_on_primary | `#FFFAF4` | ✅ |
| reader_accent | render-runtime.js day accent | ❌ 缺失 |
| reader_forest | `#367A4D` | ❌ 缺失 |
| reader_danger | `#D62222` | ✅ |
| reader_success | `#2F8A50` | ✅ |
| reader_warning | `#9A6817` | ✅ |
| reader_control_surface | `rgba(255,252,248,0.92)` → `#EBFFFCF8` | ✅ |
| reader_control_surface_solid | `rgba(255,252,248,0.98)` → `#FAFFFCF8` | ✅ |
| reader_control_panel | `rgba(255,252,248,0.62)` → `#9EFFFCF8` | ✅ |
| reader_control_panel_soft | `rgba(238,230,219,0.64)` → `#A3EEE6DB` | ✅ |
| reader_control_elevated | `rgba(255,252,248,0.74)` → `#BDFFFCF8` | ✅ |
| reader_control_field | `rgba(255,248,239,0.78)` → `#C7FFF8EF` | ✅ |
| reader_control_line | `rgba(155,132,102,0.18)` → `#2E9B8466` | ✅ |
| reader_control_line_strong | `rgba(180,166,151,0.34)` → `#57B4A697` | ✅ |
| reader_control_action | render-runtime.js day controlAction | ❌ 缺失 |
| reader_control_icon | render-runtime.js day controlIcon | ❌ 缺失 |
| reader_control_active_bg | render-runtime.js day controlActiveBg | ❌ 缺失 |
| reader_control_active_strong | render-runtime.js day controlActiveStrong | ❌ 缺失 |
| reader_control_disabled_bg | render-runtime.js day controlDisabledBg | ❌ 缺失 |
| reader_control_handle | `#B9AD9F` | ❌ 缺失 |
| reader_action_soft | `rgba(47,99,115,0.10)` → `#1A2F6373` | ✅ |
| reader_soft_shadow | `rgba(89,70,50,0.19)` → `#31594632` | ⚠️ 需核对 |
| reader_control_shadow | `rgba(47,99,115,0.22)` → `#382F6373` | ⚠️ 需核对 |
| reader_tts_cursor | `rgba(47,99,115,0.46)` → `#752F6373` | ❌ 当前 `#6B2F6373` |
| reader_tts_cursor_soft | `rgba(47,99,115,0.08)` → `#142F6373` | ❌ 当前 `#0C2F6373` |
| reader_annotation_line | `rgba(233,222,206,0.58)` → `#94E9DECE` | ✅ |
| reader_selection_* (7 个) | render-runtime.js day selection 对象 | ❌ 全缺 |

**night 模式（dark/element/color.json）**：必须包含上述所有 entry，值来源于 `render-runtime.js` 的 night control 对象。**alpha 值必须独立核算，不能复制 day 的 alpha**。

### 2.4 字体资源

```
entry/src/main/resources/rawfile/fonts/
  ├─ ReaderSerif-Regular.ttf
  ├─ ReaderSerif-Bold.ttf
  ├─ ReaderSerif-SemiBold.ttf
  └─ HarmonyOS Sans SC（系统字体，无需打包）
```

### 2.5 L0 覆盖度检查清单

- [ ] color.json base 包含上述 ~40 个 entry，值来源于 fixture.js + render-runtime.js day
- [ ] color.json dark 包含上述 ~40 个 entry，值来源于 render-runtime.js night，alpha 独立核算
- [ ] string.json 包含所有 UI 文案
- [ ] float.json 包含所有尺寸/间距值
- [ ] 字体文件齐全
- [ ] 图片资源齐全（reader_icon_*）

---

## 3. L1 Token 层

### 3.1 职责定义

集中定义所有视觉/动效/排版/间距/尺寸 token 字段。L2+ 层只能通过 token 引用，不允许硬编码字面量。

### 3.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/ReaderThemeState.ets` | 颜色 token（~50 字段） | 需扩展 |
| `entry/src/main/ets/ui/ReaderMotion.ets` | 动效 token（duration/easing/distance/scale，~40 字段） | 需扩展 |
| `entry/src/main/ets/ui/ReaderTypography.ets` | 排版 token（fontSize/fontWeight/lineHeight/fontFamily，~40 字段） | 需扩展 |
| `entry/src/main/ets/ui/ReaderSpacing.ets` | 间距 token | 新增 |
| `entry/src/main/ets/ui/ReaderSize.ets` | 尺寸 token | 新增 |
| `entry/src/main/ets/ui/ReaderRadius.ets` | 圆角 token | 新增 |
| `entry/src/main/ets/ui/ReaderShadow.ets` | 阴影 token | 新增 |

### 3.3 ReaderThemeState 完整字段表

**来源**：`fixture.js` + `render-runtime.js` 的 day/night control 对象

```typescript
export class ReaderThemeState {
  // Paper（背景）
  paper: string = '#FBF4E9';          // fixture.js paper.paperStart
  paperStart: string = '#FBF4E9';     // fixture.js paper.paperStart
  paperEnd: string = '#EFE2D0';       // fixture.js paper.paperEnd
  paperSolid: string = '#F8F4EC';     // 00-foundation.css --fd-paper-solid
  paperBright: string = '#FFFCF8';    // fixture.js paper.paperBright

  // Surface（表面）
  surface: string = '#E6FFFCF8';      // rgba(255,252,248,0.9)

  // Text
  ink: string = '#332C25';            // fixture.js paper.ink
  muted: string = '#5B5046';          // render-runtime.js day muted
  border: string = '#C1C7CD';         // 00-foundation.css --fd-border

  // Brand
  primary: string = '#2F6373';        // render-runtime.js day primary
  primaryDark: string = '#1F4A56';   // render-runtime.js day primaryDark
  onPrimary: string = '#FFFAF4';      // 00-foundation.css --fd-on-primary
  accent: string = '#D69B5F';         // render-runtime.js day accent
  forest: string = '#367A4D';        // 00-foundation.css --fd-forest

  // Status
  danger: string = '#D62222';
  success: string = '#2F8A50';
  warning: string = '#9A6817';

  // Control（来源：render-runtime.js day control 对象）
  controlSurface: string = '#EBFFFCF8';       // rgba(255,252,248,0.92)
  controlSurfaceSolid: string = '#FAFFFCF8';  // rgba(255,252,248,0.98)
  controlPanel: string = '#9EFFFCF8';         // rgba(255,252,248,0.62)
  controlPanelSoft: string = '#A3EEE6DB';     // rgba(238,230,219,0.64)
  controlElevated: string = '#BDFFFCF8';       // rgba(255,252,248,0.74)
  controlField: string = '#C7FFF8EF';          // rgba(255,248,239,0.78)
  controlLine: string = '#2E9B8466';           // rgba(155,132,102,0.18)
  controlLineStrong: string = '#57B4A697';     // rgba(180,166,151,0.34)
  controlAction: string = '#2F6373';           // controlAction
  controlIcon: string = '#5B5046';             // controlIcon
  controlActiveBg: string = '#1A2F6373';      // controlActiveBg rgba(47,99,115,0.10)
  controlActiveStrong: string = '#2F6373';     // controlActiveStrong
  controlDisabledBg: string = '#0F9B8466';     // controlDisabledBg
  controlHandle: string = '#B9AD9F';           // controlHandle
  controlInk: string = '#332C25';              // controlInk

  // Action
  actionSoft: string = '#1A2F6373';            // rgba(47,99,115,0.10)

  // Shadow
  softShadow: string = '#31594632';            // rgba(89,70,50,0.19)
  controlShadow: string = '#382F6373';         // rgba(47,99,115,0.22)
  elevatedShadow: string = '#5C000000';        // rgba(0,0,0,0.36)

  // TTS
  ttsCursor: string = '#752F6373';             // rgba(47,99,115,0.46)
  ttsCursorSoft: string = '#142F6373';         // rgba(47,99,115,0.08)

  // Annotation
  annotationLine: string = '#94E9DECE';         // rgba(233,222,206,0.58)

  // Selection（7 个，来源：render-runtime.js day selection 对象）
  selectionText: string = '#332C25';
  selectionHighlight: string = '#1F393128';     // 暖棕色高亮
  selectionHandle: string = '#2F6373';
  selectionToolbarBg: string = '#F2302A23';     // 深色工具栏
  selectionToolbarText: string = '#FFFAF4';
  selectionToolbarBorder: string = '#57B4A697';
  selectionToolbarShadow: string = '#5C000000';

  // Methods
  clone(): ReaderThemeState { /* deep copy all fields */ }
  static day(): ReaderThemeState { /* 返回 day 主题 */ }
  static night(): ReaderThemeState { /* 返回 night 主题，alpha 独立核算 */ }
}
```

**night 模式关键差异**（来源：`render-runtime.js` night control 对象）：
- `paper` / `paperSolid` → `#1C1A18`
- `paperBright` → `#2C2824`
- `surface` → `#F526231F`（rgba(38,35,31,0.96)）
- `ink` → `#E9DECE`
- `muted` → `#BAAD9C`
- `border` → `#33E2D1B9`（rgba(226,209,185,0.2)）
- `primary` → `#D2BD96`
- `primaryDark` → `#7A684F`
- `control*` 系列 → 全部按 night control 对象重算 alpha
- `ttsCursor` → `#94E9DECE`（alpha 0.58，**不是 day 的 0.46**）
- `softShadow` → `#3D000000`（alpha 0.24，**不是 day 的 0.19**）

### 3.4 ReaderMotion 完整字段表

**来源**：`motion-tokens.css`

```typescript
export class ReaderMotion {
  // ─── Duration ───（20 个）
  // Reader 主链路
  durationReaderEntry: number = 240;        // --reader-motion-duration-reader-entry
  durationReaderSession: number = 200;      // --reader-motion-duration-reader-session
  durationPageTurn: number = 220;           // --reader-motion-duration-page-turn
  durationChapterJump: number = 160;        // --reader-motion-duration-chapter-jump
  durationLoadingSpin: number = 800;        // --reader-motion-duration-loading-spin

  // Capsule
  durationCapsuleEnter: number = 160;       // --reader-motion-duration-capsule-enter
  durationCapsuleControl: number = 120;    // --reader-motion-duration-capsule-control
  durationCapsuleTick: number = 120;        // --reader-motion-duration-capsule-tick
  durationVoicePulse: number = 960;         // --reader-motion-duration-voice-pulse

  // Control space
  durationRunningSpace: number = 180;       // --reader-motion-duration-running-space

  // Overlay
  durationOverlay: number = 240;           // --reader-motion-duration-overlay
  durationBase: number = 160;               // --reader-motion-duration-base

  // Interrupt
  durationInterruptSettle: number = 80;     // --reader-motion-duration-interrupt-settle

  // Viewport
  durationViewportReshape: number = 240;    // --reader-motion-duration-viewport-reshape
  durationOrientationFreeze: number = 80;    // --reader-motion-duration-orientation-freeze
  durationOrientationSettle: number = 240;  // --reader-motion-duration-orientation-settle

  // App
  durationFirstOpen: number = 280;           // --app-motion-duration-first-open
  durationDropdownExpand: number = 160;     // --app-motion-duration-dropdown-expand
  durationDropdownCollapse: number = 120;   // --app-motion-duration-dropdown-collapse

  // ─── Easing ───（5 个，新增）
  easingStandard: Curve = Curve.EaseInOut;     // --reader-motion-easing-standard
  easingEnter: Curve = Curve.EaseOut;          // --reader-motion-easing-enter
  easingExit: Curve = Curve.EaseIn;           // --reader-motion-easing-exit
  easingReshape: Curve = Curve.EaseInOut;      // --reader-motion-easing-reshape
  easingLinear: Curve = Curve.Linear;         // loading spin / voice pulse

  // ─── Distance ───（8 个）
  distancePageTurnX: number = 16;          // --reader-motion-distance-page-turn-x
  distanceCapsuleY: number = 6;            // --reader-motion-distance-capsule-y
  distanceCapsuleTickY: number = 4;        // --reader-motion-distance-capsule-tick-y
  distanceRunningSpaceY: number = 10;      // --reader-motion-distance-running-space-y
  distanceOverlayY: number = 14;           // --reader-motion-distance-overlay-y
  distanceDropdownY: number = 6;           // --app-motion-distance-dropdown-y
  distanceFirstOpenY: number = 8;          // --app-motion-distance-first-open-y
  distanceOrientationPanelY: number = 0;   // --reader-motion-distance-orientation-panel-y

  // ─── Scale ───（5 个）
  scaleCapsuleEnter: number = 0.96;        // --reader-motion-scale-capsule-enter
  scaleCapsuleControlPress: number = 0.9;  // --reader-motion-scale-capsule-control-press
  scaleRunningSpaceDock: number = 0.92;    // --reader-motion-scale-running-space-dock
  scaleDialogEnter: number = 0.96;         // --reader-motion-scale-dialog-enter
  scaleVoicePulse: number = 1.06;          // --reader-motion-scale-voice-pulse

  // ─── Reduced motion ───
  static snapshot(reducedMotion: boolean): ReaderMotion {
    if (!reducedMotion) return new ReaderMotion();
    const m = new ReaderMotion();
    // duration 全部置 0，但保留 easing（颜色/check 仍要有 80ms 过渡）
    // distance / scale 置 0
    // durationInterruptSettle 保留 80（降级收尾）
    return m;
  }
}
```

### 3.5 ReaderTypography 完整字段表

**来源**：demo CSS 中所有 font-size / font-weight / line-height / font-family

```typescript
export class ReaderTypography {
  // ─── Font Family ───（3 个，含 fallback 链）
  sansFontFamily: string = '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  serifFontFamily: string = '"ReaderSerif", "Songti SC", "STSong", serif';
  monoFontFamily: string = '"SF Mono", "Menlo", monospace';

  // ─── Font Size ───（20 个）
  // TopBar
  topBarTitleFontSize: number = 17;
  topBarSubtitleFontSize: number = 12;
  topBarBackFontSize: number = 29;          // demo .fd-top-bar h1 = 29px

  // Tab
  tabLabelFontSize: number = 11;
  tabLabelActiveFontSize: number = 12;

  // Bookshelf
  bookshelfTitleFontSize: number = 22;
  bookshelfSectionHeaderFontSize: number = 14;
  bookCardTitleFontSize: number = 14;
  bookCardMetaFontSize: number = 12;
  continueCardTitleFontSize: number = 16;
  continueCardMetaFontSize: number = 12;

  // Reader
  readerBodyFontSize: number = 17;
  readerBodyLineHeight: number = 28;
  readerTitleFontSize: number = 20;
  readerChapterTitleFontSize: number = 15;
  immersiveInfoFontSize: number = 12;

  // Search
  searchInputFontSize: number = 16;
  searchResultTitleFontSize: number = 14;
  searchResultMetaFontSize: number = 12;

  // Settings
  settingsTitleFontSize: number = 16;
  settingsValueFontSize: number = 14;

  // ─── Font Weight ───（10 个，新增）
  weightRegular: number = 400;
  weightMedium: number = 500;
  weightSemibold: number = 600;
  weightBold: number = 700;
  weightHeavy: number = 800;
  weightBlack: number = 900;
  weightTopBarTitle: number = 700;
  weightTabLabelActive: number = 800;
  weightCardTitle: number = 700;
  weightSectionHeader: number = 800;

  // ─── Line Height ───（10 个）
  readerBodyLineHeightValue: number = 28;
  readerTitleLineHeight: number = 24;
  bookCardTitleLineHeight: number = 18;
  bookCardMetaLineHeight: number = 16;
  searchResultTitleLineHeight: number = 18;
  immersiveInfoLineHeight: number = 16;
  // ... 其他

  // ─── Metrics ───
  immersiveInfoHorizontal: number = 16;
  immersiveInfoTop: number = 12;
  immersiveInfoBottom: number = 12;
  bodyTopInset: number = 24;
  bodySideInset: number = 16;
}
```

### 3.6 ReaderSpacing 完整字段表（新增）

**来源**：`tokens.css` 的 `--reader-ds-space-*`

```typescript
export class ReaderSpacing {
  xs: number = 8;          // --reader-ds-space-xs
  sm: number = 12;         // --reader-ds-space-sm
  md: number = 16;         // --reader-ds-space-md
  lg: number = 24;         // --reader-ds-space-lg
  xl: number = 48;         // --reader-ds-space-xl
  screenPadding: number = 16;   // --reader-ds-space-screen-padding
  cardPadding: number = 16;     // --reader-ds-space-card-padding
  keyboardGap: number = 12;      // --reader-ds-space-keyboard-gap
  navRailWidth: number = 80;     // --reader-ds-size-nav-rail-width
  bottomNavHeight: number = 64;  // --reader-ds-size-bottom-nav-height
}
```

### 3.7 ReaderSize / ReaderRadius / ReaderShadow

```typescript
export class ReaderSize {
  phoneWidth: number = 390;
  phoneHeight: number = 844;
  stackPhoneHeight: number = 720;
  flowWidth: number = 720;
  topBarHeight: number = 56;
  bottomSheetMinHeight: number = 240;
  bottomSheetMaxHeight: number = 720;
  capsuleHeight: number = 24;
  capsuleWidth: number = 96;
}

export class ReaderRadius {
  xs: number = 4;          // --fd-radius-xs
  sm: number = 6;          // --fd-radius-sm
  md: number = 8;          // --fd-radius-md
  lg: number = 12;         // --fd-radius-lg
  xl: number = 24;         // --fd-radius-xl
  device: number = 34;      // --fd-radius-device
  pill: number = 999;       // --fd-radius-pill
  circle: number = 50;     // --fd-radius-circle（百分比）
}

export class ReaderShadow {
  // 来源：00-foundation.css --fd-shadow / --fd-soft-shadow
  elevated: string = '0 22px 48px rgba(0,0,0,0.36)';
  soft: string = '0 10px 26px rgba(0,0,0,0.24)';
  // ArkUI 等价（radius, color, offsetX, offsetY）
  elevatedRadius: number = 48;
  elevatedColor: string = '#5C000000';
  elevatedOffsetY: number = 22;
  softRadius: number = 26;
  softColor: string = '#3D000000';
  softOffsetY: number = 10;
}
```

### 3.8 L1 覆盖度检查清单

- [ ] ReaderThemeState 包含 ~50 个颜色字段，值来源于 fixture.js + render-runtime.js
- [ ] ReaderThemeState.night() 的 alpha 值独立核算（不复制 day）
- [ ] ReaderMotion 包含 20 duration + 5 easing + 8 distance + 5 scale
- [ ] ReaderMotion.snapshot(reducedMotion) 降级规则完整
- [ ] ReaderTypography 包含 20 fontSize + 10 fontWeight + 10 lineHeight + 3 fontFamily（含 fallback）
- [ ] ReaderSpacing / ReaderSize / ReaderRadius / ReaderShadow 已建立
- [ ] 所有 L2+ 层无硬编码颜色/字号/间距字面量（通过 grep 验证）

---

## 4. L2 状态契约层

### 4.1 职责定义

集中管理应用状态 + reducer + action。是单一事件源。L3 动效运行时层消费 state 的 MotionState 字段驱动动画。

### 4.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/ReaderUiState.ets` | UI 状态中心 | 需扩展 |
| `entry/src/main/ets/ui/ReaderUiReducer.ets` | reducer + action | 需扩展 |

### 4.3 ReaderUiState 完整字段表

```typescript
@ObservedV2
export class ReaderUiState {
  // ─── 主题 ───
  readerTheme: ReaderThemeState;
  themeScheme: 'day' | 'night' = 'day';
  themeTransitionProgress: number = 1;  // 0→1，主题切换 crossfade
  previousTheme: ReaderThemeState | null = null;

  // ─── 路由 ───
  routeStack: string[] = ['bookshelf'];   // 字符串栈（将迁移到 NavPathStack）
  currentRoute: string = 'bookshelf';
  routePhase: 'idle' | 'entering' | 'leaving' | 'settled' = 'settled';

  // ─── Tab ───
  activeTab: 'bookshelf' | 'rss' | 'discover' | 'settings' = 'bookshelf';
  tabSwitchPhase: 'idle' | 'pressed' | 'switching' | 'settled' = 'settled';

  // ─── 阅读上下文 ───
  readerContext: ReaderContext;
  readerPagination: ReaderPagination;
  readerContentLoaded: boolean = false;
  readerAsyncResult: ReaderAsyncResult;

  // ─── 阅读模式 ───
  readerMode: ReaderMode = ReaderMode.normal;

  // ─── 控制层 ───
  controlSpaceVisible: boolean = false;
  controlSpacePhase: 'idle' | 'entering' | 'settled' | 'leaving' = 'idle';
  controlHandlePhase: 'idle' | 'pressed' | 'dragging' = 'idle';
  controlHandleDragOffset: number = 0;
  controlDockPhase: 'idle' | 'longPressing' | 'dragging' = 'idle';
  controlDockOffset: number = 0;

  // ─── 会话 ───
  activeSession: ReaderActiveSession;
  capsuleMorphPhase: 'idle' | 'snapshot' | 'transferring' | 'settled' = 'idle';

  // ─── 文本选择 ───
  readerTextSelectionOpen: boolean = false;
  readerSelectedText: string = '';
  selectionRange: {
    start: number;
    end: number;
    startHandle: { x: number; y: number };
    endHandle: { x: number; y: number };
    toolbarAnchor: { x: number; y: number };
  } | null = null;

  // ─── Module Nav ───
  readerTtsExpandedOption: string | null = null;
  readerSettingsExpandedOption: string | null = null;

  // ─── 亮度 ───
  brightnessAuto: boolean = false;
  brightnessValue: number = 0.8;
  brightnessDragPhase: 'idle' | 'dragging' = 'idle';

  // ─── Motion State（新增）───
  motion: MotionState;

  // ─── Viewport（新增）───
  viewport: ViewportState;

  // ─── Overlay ───
  overlayState: 'hidden' | 'opening' | 'open' | 'closing' = 'hidden';
  overlayType: 'dialog' | 'sheet' | 'keyboard' | null = null;

  // ─── Dropdown ───
  dropdownOpen: string | null = null;
  dropdownPhase: 'idle' | 'entering' | 'expanded' | 'collapsed' = 'idle';

  // ─── 自适应 ───
  adaptive: ReaderAdaptive;

  // ─── 无障碍 ───
  reducedMotion: boolean = false;
}

export class MotionState {
  phase: 'idle' | 'entering' | 'leaving' | 'settled' | 'interrupted' = 'idle';
  activeMotionId: string | null = null;
  transaction: MotionTransaction | null = null;
  interruptReason: 'cancel' | 'redirect' | 'completeThenReplace' | null = null;
  lastSettledMotionId: string | null = null;
}

export class MotionTransaction {
  id: string;
  motionId: string;
  from: object;
  to: object;
  startTime: number;
  duration: number;
  reducedMotion: boolean;
}

export class ViewportState {
  widthClass: 'compact' | 'standard' | 'expanded' | 'tablet-expanded' = 'standard';
  heightClass: 'compact' | 'standard' | 'expanded' = 'standard';
  orientation: 'portrait' | 'landscape' = 'portrait';
  foldPosture: 'folded' | 'expanded' | 'unknown' = 'unknown';
  viewportPhase: 'settled' | 'preparing' | 'reshaping' | 'settling' = 'settled';
  previousSnapshot: ViewportSnapshot | null = null;
}

export class ReaderAsyncResult {
  status: 'idle' | 'pending' | 'completed' | 'cancelled' | 'discarded' | 'superseded' = 'idle';
  requestId: string = '';
  result: any = null;
}
```

### 4.4 ReaderUiReducer action 清单

**已有 action**（保留）：
- `pushReaderEntry(bookId)`
- `setReaderContentLoaded(...)`
- `setReaderTheme(...)`
- `setReaderMode(...)`
- `toggleControlSpace(...)`
- `startReaderSession(kind)` / `toggleSession()` / `stopSession()`
- `setProgress(percent)`
- `jumpChapter(delta)`
- `turnPage(direction)`
- `selectSourceSwitchSource(source)`
- `toggleTtsOption(key)` / `selectTtsOption(key, value)`
- `toggleSettingsOption(key)` / `selectSettingsOption(key, value)` / `toggleSettingsSwitch(key)`
- `setBrightness(value)` / `toggleBrightnessAuto()`
- `pushRoute(route)` / `popRoute()` / `replaceTopRoute(route)` / `goTab(route)`

**新增 action**（v2 必须补齐）：

```
// Motion transaction
startMotion(motionId, from, to, duration)
updateMotion(patch)
interruptMotion(reason: 'cancel' | 'redirect' | 'completeThenReplace')
settleMotion(reason)

// Async result guard
startAsyncRequest(requestId)
completeAsyncRequest(requestId, result)
cancelAsyncRequest(requestId)
discardAsyncRequest(requestId)

// Phase tracking
setRoutePhase(phase)
setTabSwitchPhase(phase)
setControlSpacePhase(phase)
setCapsuleMorphPhase(phase)
setOverlayPhase(phase)
setDropdownPhase(phase)

// Viewport
setViewportClass(widthClass, heightClass, orientation, foldPosture)
startViewportReshape(previousSnapshot)
setViewportPhase(phase)

// Theme transition
startThemeTransition(toScheme)
completeThemeTransition()

// Selection
setSelectionRange(range)
clearSelection()

// Gesture
setControlHandlePhase(phase, dragOffset?)
setControlDockPhase(phase, offset?)
setBrightnessDragPhase(phase)
```

### 4.5 L2 覆盖度检查清单

- [ ] ReaderUiState 包含上述所有字段
- [ ] MotionState 有 phase 跟踪（不是只有布尔 isVisible）
- [ ] ViewportState 有三段式 phase（preparing/reshaping/settling）
- [ ] ReaderAsyncResult 有五态（pending/completed/cancelled/discarded/superseded）
- [ ] selectionRange 有完整字段（start/end/startHandle/endHandle/toolbarAnchor）
- [ ] 所有新增 action 已实现
- [ ] reducer 是单一事件源，无散落 state 修改

---

## 5. L3 动效运行时层（核心新增层）

### 5.1 职责定义

等价于 demo `motion-controller.js` 的运行时层。是 v2 最关键的新增架构层。负责：
1. 接收 L2 reducer 的 motion action，启动 transaction
2. 查询 ContractRegistry 获取 47 个 Motion ID 的精确状态机
3. 驱动 L4 原生动画 API（`keyframeAnimateTo` / `transition` / `@Animator`）
4. 管理 INTERRUPT 三态（cancel/redirect/completeThenReplace）
5. 管理 AsyncResultGuard（防旧 fetchResult 覆盖新 route）
6. 管理 ReducedMotionProvider（系统无障碍配置）
7. 管理 ViewportClassAdapter（旋转/折叠/窗口变化的三段式 motion）

### 5.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/motion/ReaderMotionReducer.ets` | 动效运行时单例 | 新增 |
| `entry/src/main/ets/ui/motion/ReaderMotionContract.ets` | 47 个 Motion ID 状态机 + 32 条 family rule | 新增 |
| `entry/src/main/ets/ui/motion/ReaderMotionTokens.ets` | token adapter（duration/easing/distance/scale） | 新增 |
| `entry/src/main/ets/ui/motion/ReaderAsyncResultGuard.ets` | requestId-scoped 防覆盖 | 新增 |
| `entry/src/main/ets/ui/motion/ReaderReducedMotionProvider.ets` | 系统无障碍监听 | 新增 |
| `entry/src/main/ets/ui/motion/ReaderViewportAdapter.ets` | 旋转/折叠/窗口变化适配 | 新增 |
| `entry/src/main/ets/ui/motion/ReaderMotionRegistry.ets` | keyframe 等价实现注册表（18 个） | 新增 |

### 5.3 ReaderMotionReducer 设计

```typescript
// 单例，应用启动时初始化
export class ReaderMotionReducer {
  private static instance: ReaderMotionReducer;
  static shared(): ReaderMotionReducer { /* singleton */ }

  // ─── 状态 ───
  private activeTransaction: MotionTransaction | null = null;
  private eventBuffer: MotionEvent[] = [];      // 最多 120 条
  private listeners: MotionEventListener[] = [];

  // ─── 依赖 ───
  private contract: ReaderMotionContract = ReaderMotionContract.shared();
  private tokens: ReaderMotionTokens = ReaderMotionTokens.shared();
  private reduced: ReaderReducedMotionProvider = ReaderReducedMotionProvider.shared();
  private viewport: ReaderViewportAdapter = ReaderViewportAdapter.shared();

  // ─── Transaction 生命周期 ───
  start(options: {
    motionId: string;
    from?: object;
    to: object;
    target?: object;
    duration?: number;
    reducedMotion?: boolean;
  }): string {
    // 1. 如果已有 active transaction，先 interrupt('superseded')
    // 2. 查询 contract.contractFor(motionId) 获取状态机
    // 3. 解析 duration（优先 options，否则 contract DEFAULT_DURATIONS）
    // 4. 解析 reducedMotion（优先 options，否则 reduced.isReduced()）
    // 5. 如果 duration === 0 或 reducedMotion → 立即 settle
    // 6. 否则启动 L4 keyframeAnimateTo
    // 7. dispatch 'start' 事件
  }

  update(patch: object): void {
    // 修改 active transaction 的 to
    // dispatch 'update' 事件
  }

  interrupt(reason: 'cancel' | 'redirect' | 'completeThenReplace'): void {
    // 1. 清理 L4 动画（keyframeAnimateTo 的 onCancel）
    // 2. 清理临时状态（pressed/dragging/dropdown pressed/handle dragging/dock dragging）
    // 3. 标记 phase = 'interrupted'
    // 4. 启动 80ms fd-motion-interrupt-settle 收尾
    // 5. dispatch 'interrupt' 事件
  }

  settle(reason: string): void {
    // 1. 清理 timer
    // 2. phase = 'settled'
    // 3. lastSettledMotionId = activeTransaction.motionId
    // 4. activeTransaction = null
    // 5. dispatch 'settle' 事件
  }

  destroy(): void {
    // 清理所有 listener + timer
  }

  // ─── 事件订阅 ───
  addListener(listener: MotionEventListener): void { /* ... */ }
  removeListener(listener: MotionEventListener): void { /* ... */ }
  getSnapshot(): MotionSnapshot { /* 返回当前 transaction 状态 */ }

  // ─── Reduced motion ───
  setReducedMotion(enabled: boolean): void {
    // 立即应用到 active transaction
  }
}
```

### 5.4 ReaderMotionContract — 47 个 Motion ID 状态机

**数据来源**：`/Users/minliny/Documents/Reader UI/frontend-demo/motion-controller.js` 的 `MOTION_ID_STATE_MACHINES` + `FAMILY_STATE_MACHINES` + `DEFAULT_STATE_MACHINE`

```typescript
export class ReaderMotionContract {
  static shared(): ReaderMotionContract { /* singleton */ }

  // 32 条 family rule（按 prefix 匹配）
  private rules: ContractRule[] = CONTRACT_RULES;

  // 47 个精确状态机
  private stateMachines: Map<string, MotionStateMachine> = MOTION_ID_STATE_MACHINES;

  // 38 个 Motion ID 的默认时长
  private defaultDurations: Map<string, number> = DEFAULT_DURATIONS;

  contractFor(motionId: string): MotionContract {
    // 1. 精确匹配 MOTION_ID_STATE_MACHINES
    // 2. 否则按 prefix 匹配 FAMILY_STATE_MACHINES
    // 3. 否则 fallback DEFAULT_STATE_MACHINE
    // 返回 { id, family, tokens, stateFields, stateMachine, platformComponents }
  }

  familyOf(motionId: string): string { /* 按 prefix 匹配 */ }
  tokensFor(motionId: string): string[] { /* 返回关联 token */ }
  stateFieldsFor(motionId: string): string[] { /* 返回关联 state 字段 */ }
}

interface MotionStateMachine {
  from: object;
  to: object;
  interrupt: { reason: string; target: string }[];
  finalState: string;
  reducedMotion: { duration: number; preserveColorTransitions: boolean };
}
```

### 5.5 47 个 Motion ID 清单（必须实现的状态机）

**P0 必做**（不实现应用不可用）：

| Motion ID | 场景 | from→to | interrupt | finalState |
|---|---|---|---|---|
| `app.firstOpen.enter` | 冷启动首屏 | coldStart → entryRouteVisible | deepLinkRedirect / resumeInsteadOfColdStart / reducedMotion | entryRouteVisibleOnce |
| `app.route.push.forward` | 路由前进 | route.current → route.targetOnStack | backBeforeSettle / replaceBeforeSettle / newPush | targetRouteVisibleAndStackUpdated |
| `app.route.pop.backward` | 路由返回 | route.current → route.previousOnStack | newPush / emptyBackStack | previousRouteVisible |
| `app.route.replace` | 路由替换 | route.current → route.replacedTarget | newPush | targetRouteVisibleWithoutNewBackEntry |
| `tab.item.switch` | Tab 切换 | activeTab.previous → activeTab.next | switchTargetAgain / routeChange / pointerCancel | activeTabUpdated |
| `reader.entry.coverToImmersive` | 封面→沉浸 | bookshelf → immersiveReading | backBeforeSettle | immersiveRouteVisible |
| `reader.page.turn.next` | 翻下一页 | page.current → page.next | newTurn / dragStart / routeChange | nextPageSettled |
| `reader.page.turn.prev` | 翻上一页 | page.current → page.prev | newTurn / dragStart / routeChange | prevPageSettled |
| `reader.control.handle.press` | 小横条按下 | handleIdle → handlePressed | pointerCancel | handlePressed |
| `reader.control.handle.drag` | 小横条拖动 | handlePressed → handleDragging | pointerCancel | handleDragging |
| `reader.control.handle.release` | 小横条释放 | handleDragging → snapBack/expand/collapse | pointerCancel | handleReleased |
| `reader.session.capsule.enter` | 胶囊进入 | capsuleHidden → capsuleVisible | sessionExit / routeChange | capsuleVisible |
| `reader.session.capsule.countdownTick` | 倒计时滴答 | tick.previous → tick.next | sessionExit | tickSettled |
| `reader.session.capsule.voiceIcon.active` | TTS 图标脉冲 | static → pulse | sessionPause / sessionExit | pulsing |
| `reader.session.controlSpace.enter` | 运行空间进入 | controlSpaceHidden → controlSpaceVisible | routeChange / sessionExit | controlSpaceVisible |
| `motion.interrupt.cancel` | 打断取消 | motion.running → motion.cancelled | - | transientMotionCleared |
| `motion.interrupt.redirect` | 打断重定向 | motion.running.toward.oldTarget → motion.running.toward.newTarget | - | newTargetOwnsMotion |
| `motion.interrupt.completeThenReplace` | 打断替换 | loading.pending → result.replacement | userBack / userClose | replacementVisibleOnlyIfStillCurrent |
| `viewport.orientation.prepare` | 旋转准备 | viewportStable → viewportFrozen | - | viewportFrozen |
| `viewport.orientation.reshape` | 旋转重排 | viewportFrozen → viewportReshaped | - | viewportReshaped |
| `viewport.orientation.settle` | 旋转收尾 | viewportReshaped → viewportStable | - | viewportStable |

**P1 建议**（不实现体验破碎但不崩溃）：

| Motion ID | 场景 |
|---|---|
| `tab.item.press` / `tab.item.select` | Tab 按下/选中 |
| `segment.item.switch` | segmented 切换 |
| `dropdown.trigger.press` / `dropdown.menu.expand` / `dropdown.menu.collapse` / `dropdown.menu.reposition` | 下拉栏 |
| `dropdown.option.press` / `dropdown.option.select` | 下拉选项 |
| `button.activate` | 按钮激活 |
| `toggle.switch` | 开关切换 |
| `reader.entry.actionToImmersive` | 章节行→沉浸 |
| `reader.control.dock.longPress` / `drag` / `release` / `rebound` | 宽屏 dock |
| `reader.session.autoPage.start` / `tts.start` | 会话启动 |
| `reader.session.capsule.update` / `switch` / `exit` | 胶囊更新/切换/退出 |
| `reader.session.controlSpace.update` / `exit` | 运行空间更新/退出 |
| `reader.module.switch` | 阅读模块切换 |
| `reader.chapter.jump` | 章节跳转 |

### 5.6 ReaderAsyncResultGuard 设计

```typescript
export class ReaderAsyncResultGuard {
  private pendingRequests: Map<string, AsyncRequest> = new Map();

  startRequest(requestId: string, route: string, context: object): void {
    // 取消所有同 route 的 pending request
    // 标记当前 requestId 为 pending
  }

  completeRequest(requestId: string, result: any, currentRoute: string): {
    accept: boolean;
    reason: 'completed' | 'cancelled' | 'discarded' | 'superseded';
  } {
    // 1. 检查 requestId 是否仍 pending
    // 2. 检查 route 是否仍匹配
    // 3. 若不匹配 → discarded（旧结果丢弃）
    // 4. 若已有新 requestId pending → superseded（旧结果被新覆盖）
    // 5. 若匹配 → accept result，标记 completed
  }

  cancelRequest(requestId: string): void { /* 标记 cancelled */ }
}
```

### 5.7 ReaderReducedMotionProvider 设计

```typescript
export class ReaderReducedMotionProvider {
  static shared(): ReaderReducedMotionProvider { /* singleton */ }
  private isReduced: boolean = false;

  init(): void {
    // HarmonyOS: 监听系统参数 'persist.accessibility.reducemotion'
    // 配置变化时更新 isReduced，通知所有 listener
  }

  isReducedMotion(): boolean { return this.isReduced; }

  // reduced motion 降级规则（不是"无动画"而是"降级动画"）
  // - duration 全部置 0
  // - distance / scale 置 0
  // - 保留 80ms 颜色/check/outline 过渡
  // - spinner 替换为静态状态点
  // - voice pulse 停止
  // - capsule tick 即时替换
  applyReduction(motion: ReaderMotion): ReaderMotion {
    return ReaderMotion.snapshot(true);
  }
}
```

### 5.8 ReaderViewportAdapter 设计

```typescript
export class ReaderViewportAdapter {
  static shared(): ReaderViewportAdapter { /* singleton */ }

  init(entryAbility: EntryAbility): void {
    // 1. 注册 windowSizeChange callback
    // 2. 注册 display orientation callback
    // 3. 注册 foldStatus callback
    // 4. 初始计算 widthClass / heightClass / orientation / foldPosture
  }

  // 三段式 motion（核心）
  onViewportChange(newSnapshot: ViewportSnapshot): void {
    // 1. phase = 'preparing' (80ms)
    //    - 冻结所有非必要动画
    //    - 释放 pointer capture
    //    - 提交拖动到最近安全状态
    //    - dispatch 'viewport.orientation.prepare'
    //
    // 2. phase = 'reshaping' (240ms)
    //    - Shell 容器切到新 viewport class
    //    - 阅读正文按章节进度/字符锚点重新分页
    //    - 控制层/overlay/胶囊/dock 重新锚定
    //    - dispatch 'viewport.orientation.reshape'
    //
    // 3. phase = 'settling' (240ms)
    //    - 恢复 focus/pointer/semantics
    //    - 恢复运行胶囊倒计时/朗读图标微动效
    //    - dispatch 'viewport.orientation.settle'
  }

  // 折叠屏 hinge / pane 约束
  clampDockOffset(offset: number, viewportClass: string): number {
    // 按 viewport class 计算 dock 可移动范围
  }

  // 旋转后 dropdown placement
  recalculateDropdownPlacement(): void { /* ... */ }
}
```

### 5.9 ReaderMotionRegistry — 18 个 keyframe 等价实现

```typescript
export class ReaderMotionRegistry {
  // 注册 18 个 keyframe 的 ArkUI 等价实现
  // 每个 keyframe 用 keyframeAnimateTo 或 @Animator 实现

  static register(keyframeId: string, implementation: KeyframeImplementation): void { /* ... */ }
  static get(keyframeId: string): KeyframeImplementation { /* ... */ }
}

// 18 个 keyframe 清单
// 1. fd-app-first-open-enter          — 280ms opacity 0→1 + translateY 8→0
// 2. fd-viewport-orientation-reshape  — 240ms opacity 0.94→1 + saturate 0.98→1
// 3. fd-viewport-orientation-anchor-settle — 240ms opacity 0.92→1
// 4. fd-motion-interrupt-settle       — 80ms opacity 0.96→1
// 5. fd-motion-async-complete         — 80ms opacity 0.96→1
// 6. fd-motion-overlay-dialog-enter   — 240ms opacity 0→1 + translateY -44%→-50% + scale 0.96→1
// 7. fd-motion-overlay-sheet-enter    — 160ms opacity 0.72→1 + translateY 14→0
// 8. fd-reader-session-capsule-enter  — 160ms opacity 0→1 + translateY 6→0 + scale 0.96→1
// 9. fd-reader-session-capsule-switch — 120ms opacity 0.72→1 + scale 0.98→1
// 10. fd-reader-session-capsule-tick  — 120ms opacity 0→1 + translateY 4→0
// 11. fd-reader-session-voice-pulse   — 960ms infinite opacity 0.82→1→0.82 + scale 1→1.06→1
// 12. fd-reader-control-space-enter   — 180ms opacity 0→1 + translateY -10→0 + scale 0.92→1
// 13. fd-reader-control-space-update  — 120ms scale 1→0.992→1
// 14. fd-motion-dropdown-switch-to    — 160ms opacity 0.72→1 + translateY 3→0
// 15. fd-reader-page-next             — 220ms opacity 0→1 + translateX 16→0
// 16. fd-reader-page-prev             — 220ms opacity 0→1 + translateX -16→0
// 17. fd-reader-tts-cursor-pulse      — 1400ms infinite
// 18. fd-reader-loading-spin          — 800ms infinite rotate 360
```

### 5.10 L3 覆盖度检查清单

- [ ] ReaderMotionReducer 单例已建立，有 transaction 生命周期（start/update/interrupt/settle/destroy）
- [ ] ReaderMotionContract 加载 demo 的 47 个 Motion ID 状态机
- [ ] INTERRUPT 三态统一入口已实现
- [ ] 80ms 收尾动画（fd-motion-interrupt-settle）已实现
- [ ] ReaderAsyncResultGuard 有五态（pending/completed/cancelled/discarded/superseded）
- [ ] 快速切换 route 时旧 fetchResult 不会覆盖新 route
- [ ] ReaderReducedMotionProvider 监听系统配置
- [ ] reduced motion 下保留 80ms 颜色/check/outline 过渡
- [ ] ReaderViewportAdapter 监听窗口/旋转/折叠
- [ ] 三段式 motion（prepare 80ms + reshape 240ms + settle 240ms）已实现
- [ ] 18 个 keyframe 的 ArkUI 等价实现已注册
- [ ] MotionReducer 与 L2 ReaderUiReducer 集成（reducer 写 motion state，MotionReducer 消费）

---

## 6. L4 原生能力适配层（新增）

### 6.1 职责定义

封装 ArkUI 原生 API，为 L3/L5/L7 提供统一接口。避免上层直接调用 ArkUI API 导致的平台耦合。

### 6.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/native/ReaderNavigationAdapter.ets` | Navigation + NavPathStack + NavDestination 封装 | 新增 |
| `entry/src/main/ets/ui/native/ReaderGestureAdapter.ets` | SwipeGesture/PinchGesture/PanGesture/LongPressGesture 封装 | 新增 |
| `entry/src/main/ets/ui/native/ReaderTransitionAdapter.ets` | transition(TransitionEffect) + sharedTransition 封装 | 新增 |
| `entry/src/main/ets/ui/native/ReaderAnimatorAdapter.ets` | @Animator + keyframeAnimateTo 封装 | 新增 |
| `entry/src/main/ets/ui/native/ReaderAnimatableProperty.ets` | @AnimatableExtend 自定义可动画属性 | 新增 |

### 6.3 ReaderNavigationAdapter 设计

**取代 v1 的 routeStack 字符串数组手动管理**。

```typescript
@Component
export struct ReaderNavigationAdapter {
  private navPathStack: NavPathStack = new NavPathStack();

  // ─── 路由操作 ───
  push(route: string, params?: object): void {
    // 1. ReaderMotionReducer.start({ motionId: 'app.route.push.forward', ... })
    // 2. navPathStack.pushPath({ name: route, param: params })
    // 3. NavDestination 的 .transition() 自动播放 160ms 横向位移 + 淡入
  }

  pop(): void {
    // 1. ReaderMotionReducer.start({ motionId: 'app.route.pop.backward', ... })
    // 2. navPathStack.pop()
  }

  replace(route: string, params?: object): void {
    // 1. ReaderMotionReducer.start({ motionId: 'app.route.replace', ... })
    // 2. navPathStack.replacePath({ name: route, param: params })
  }

  goTab(route: string): void {
    // 1. ReaderMotionReducer.start({ motionId: 'tab.item.switch', ... })
    // 2. 切换 activeTab（不 push 栈）
  }

  // ─── NavDestination 注册 ───
  @Builder
  navDestination(name: string, param: object): void {
    // 131 个路由的 NavDestination 注册
    // 通过 ReaderRouteMapping 查找对应组件
  }

  build() {
    Navigation(this.navPathStack) {
      // 主 Tab 内容
    }
    .navDestination(this.navDestination)
    .mode(NavigationMode.Stack)
    .hideTitleBar(true)
    .hideToolBar(true)
  }
}
```

### 6.4 ReaderGestureAdapter 设计

```typescript
// 翻页 swipe 手势
export function bindSwipePageTurn(onNext: () => void, onPrev: () => void): Gesture {
  return SwipeGesture({ fingers: 1, speed: 200, direction: SwipeDirection.Horizontal })
    .onAction((event: GestureEvent) => {
      if (event.angle > -90 && event.angle < 90) onNext();
      else onPrev();
    });
}

// 字号 pinch 手势
export function bindPinchFontSize(onScale: (scale: number) => void): Gesture {
  return PinchGesture({ fingers: 2 })
    .onUpdate((event: GestureEvent) => onScale(event.scale));
}

// 控制层小横条 drag 手势（带 phase 跟踪）
export function bindControlHandleDrag(
  onPress: () => void,
  onDrag: (offsetY: number) => void,
  onRelease: (offsetY: number) => void
): Gesture {
  return ParallelGesture(
    LongPressGesture({ duration: 80 })
      .onAction(() => onPress()),
    PanGesture()
      .onUpdate((event) => onDrag(event.offsetY))
      .onEnd((event) => onRelease(event.offsetY))
  );
}

// 亮度/进度 slider drag 手势（无 easing 跟手）
export function bindSliderDrag(
  onStart: () => void,
  onUpdate: (percent: number) => void,
  onEnd: (percent: number) => void
): Gesture {
  return PanGesture()
    .onActionStart(() => onStart())
    .onUpdate((event) => onUpdate(/* 计算 percent */))
    .onActionEnd((event) => onEnd(/* 计算 percent */));
}

// 文本选择 handle drag 手势
export function bindSelectionHandleDrag(
  handle: 'start' | 'end',
  onDrag: (x: number, y: number) => void,
  onEnd: (x: number, y: number) => void
): Gesture { /* ... */ }

// 宽屏 dock longPress + drag 手势
export function bindControlDockDrag(
  onLongPress: () => void,
  onDrag: (offsetX: number) => void,
  onRelease: (offsetX: number) => void
): Gesture { /* ... */ }
```

### 6.5 ReaderTransitionAdapter 设计

```typescript
// 组件挂载/卸载转场
export function routePushTransition(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 160, curve: Curve.EaseOut })
    .combine(TransitionEffect.translate({ x: 16 }).animation({ duration: 160, curve: Curve.EaseOut }));
}

export function routePopTransition(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 160, curve: Curve.EaseIn })
    .combine(TransitionEffect.translate({ x: -16 }).animation({ duration: 160, curve: Curve.EaseIn }));
}

export function overlayDialogEnter(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 240, curve: Curve.EaseOut })
    .combine(TransitionEffect.scale({ x: 0.96, y: 0.96 }).animation({ duration: 240, curve: Curve.EaseOut }))
    .combine(TransitionEffect.translate({ y: -44 }).animation({ duration: 240, curve: Curve.EaseOut }));
}

export function overlaySheetEnter(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 160, curve: Curve.EaseOut })
    .combine(TransitionEffect.translate({ y: 14 }).animation({ duration: 160, curve: Curve.EaseOut }));
}

export function dropdownExpandTransition(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 160, curve: Curve.EaseOut })
    .combine(TransitionEffect.translate({ y: 6 }).animation({ duration: 160, curve: Curve.EaseOut }));
}

export function capsuleEnterTransition(): TransitionEffect {
  return TransitionEffect.OPACITY.animation({ duration: 160, curve: Curve.EaseOut })
    .combine(TransitionEffect.translate({ y: 6 }).animation({ duration: 160, curve: Curve.EaseOut }))
    .combine(TransitionEffect.scale({ x: 0.96, y: 0.96 }).animation({ duration: 160, curve: Curve.EaseOut }));
}

// 共享元素转场（封面 → 沉浸阅读）
export function bookCoverSharedTransition(bookId: string): TransitionEffect {
  return TransitionEffect.asymmetric(
    TransitionEffect.scale({ x: 0.96, y: 0.96 }).animation({ duration: 240, curve: Curve.EaseOut }),
    TransitionEffect.identity()
  );
  // 配合 .sharedTransition(bookId) 使用
}
```

### 6.6 ReaderAnimatorAdapter — 循环动画

```typescript
// voice pulse（960ms infinite）
@AnimatableExtend(Image)
function voicePulseAnimation(active: boolean) {
  if (active) {
    .scale({ x: active ? 1.06 : 1, y: active ? 1.06 : 1 })
    .opacity(active ? 1 : 0.82)
    .animation({
      duration: 960,
      iterations: -1,
      curve: Curve.EaseInOut,
      playMode: PlayMode.Alternate
    });
  }
}

// loading spin（800ms infinite rotate）
@AnimatableExtend(Image)
function loadingSpinAnimation() {
  .rotate({ angle: 360 })
  .animation({
    duration: 800,
    iterations: -1,
    curve: Curve.Linear
  });
}

// TTS cursor pulse（1400ms infinite）
@AnimatableExtend(Column)
function ttsCursorPulseAnimation(active: boolean) {
  if (active) {
    .opacity(0.46)
    .animation({
      duration: 1400,
      iterations: -1,
      curve: Curve.EaseInOut,
      playMode: PlayMode.Alternate
    });
  }
}
```

### 6.7 ReaderAnimatableProperty — 自定义可动画属性

```typescript
// capsuleDockProgress（0→1，控制 capsule 从底部迁移到控制层运行空间）
@AnimatableExtend(Row)
function capsuleDockProgress(progress: number) {
  .position({ x: lerp(capsuleStartX, capsuleEndX, progress) })
  .scale({ x: lerp(1, 0.92, progress), y: lerp(1, 0.92, progress) })
  .opacity(lerp(1, 0.72, progress))
}

// themeTransitionProgress（0→1，主题切换 crossfade）
@AnimatableExtend(Stack)
function themeTransitionProgress(progress: number) {
  // 同时渲染 previousTheme 和 currentTheme，按 progress crossfade
}
```

### 6.8 L4 覆盖度检查清单

- [ ] ReaderNavigationAdapter 用 NavPathStack 替代 routeStack 字符串数组
- [ ] push/pop/replace 三种路由操作有对应的 Motion ID 触发
- [ ] NavDestination 有 .transition() 160ms 横向位移 + 淡入
- [ ] SwipeGesture 绑定翻页（next/prev 方向）
- [ ] PinchGesture 绑定字号缩放
- [ ] PanGesture 绑定 slider drag（无 easing 跟手）
- [ ] LongPressGesture + PanGesture 绑定控制层小横条
- [ ] LongPressGesture + PanGesture 绑定宽屏 dock
- [ ] PanGesture 绑定文本选择 handle drag
- [ ] transition() 覆盖所有 if/else 挂载/卸载
- [ ] sharedTransition 用于封面 → 沉浸阅读
- [ ] @Animator 实现 voice pulse / loading spin / TTS cursor pulse 循环动画
- [ ] @AnimatableExtend 实现 capsuleDockProgress / themeTransitionProgress
- [ ] 18 个 keyframe 全部通过 ReaderAnimatorAdapter 实现等价

---

## 7. L5 应用基础设施层（新增）

### 7.1 职责定义

提供数据/性能/错误处理基础设施。是 v1 完全缺失的层。

### 7.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/viewmodel/ReaderViewModelRegistry.ets` | ViewModel 注册表 | 新增 |
| `entry/src/main/ets/ui/viewmodel/BookshelfViewModel.ets` | 书架 VM | 新增 |
| `entry/src/main/ets/ui/viewmodel/ReaderViewModel.ets` | 阅读 VM | 新增 |
| `entry/src/main/ets/ui/viewmodel/SearchViewModel.ets` | 搜索 VM | 新增 |
| `entry/src/main/ets/ui/viewmodel/SettingsViewModel.ets` | 设置 VM | 新增 |
| `entry/src/main/ets/ui/viewmodel/RssViewModel.ets` | RSS VM | 新增 |
| `entry/src/main/ets/ui/components/StateCard.ets` | loading/error/empty/success 四态组件 | 新增 |
| `entry/src/main/ets/ui/performance/PerformanceMonitor.ets` | 帧率/内存监控 | 新增 |
| `entry/src/main/ets/ui/performance/ImageCache.ets` | 图片缓存 | 新增 |
| `entry/src/main/ets/ui/performance/LazyListHelper.ets` | LazyForEach 辅助 | 新增 |

### 7.3 ViewModel 设计

```typescript
export abstract class ReaderViewModel<TState> {
  state: TState;
  statePhase: 'idle' | 'loading' | 'error' | 'success' | 'empty' = 'idle';
  requestId: string = '';

  abstract load(params?: object): Promise<void>;
  abstract reload(): Promise<void>;

  protected async executeRequest(
    requestId: string,
    operation: () => Promise<any>,
    route: string
  ): Promise<{ accepted: boolean; result: any }> {
    // 1. 调用 ReaderAsyncResultGuard.startRequest
    // 2. statePhase = 'loading'
    // 3. 执行 operation
    // 4. 调用 ReaderAsyncResultGuard.completeRequest
    // 5. 若 accepted → statePhase = 'success' 或 'empty'（按数据）
    // 6. 若 not accepted → 不更新 state（旧结果被丢弃）
    // 7. 异常 → statePhase = 'error'
  }
}

export class BookshelfViewModel extends ReaderViewModel<BookshelfState> {
  async load(params?: object): Promise<void> {
    await this.executeRequest(
      generateRequestId(),
      async () => await BookRepository.listBooks(),
      'bookshelf'
    );
  }
}
```

### 7.4 StateCard 组件

```typescript
@Component
export struct StateCard {
  @Prop phase: 'loading' | 'error' | 'empty' | 'success';
  @Prop errorMessage: string = '';
  @Prop emptyTitle: string = '';
  @Prop emptyDescription: string = '';
  onRetry: () => void = () => {};

  build() {
    if (this.phase === 'loading') {
      // 800ms 旋转 spinner（fd-reader-loading-spin）
      Image($r('app.media.reader_icon_loading'))
        .width(24).height(24)
        .loadingSpinAnimation(true)
      Text('加载中...')
    } else if (this.phase === 'error') {
      // 错误状态：插图 + 文案 + 重试按钮
      Image($r('app.media.reader_icon_error'))
      Text(this.errorMessage)
      Button('重试').onClick(() => this.onRetry())
    } else if (this.phase === 'empty') {
      // 空状态：插图 + 引导文案
      Image($r('app.media.reader_icon_empty'))
      Text(this.emptyTitle)
      Text(this.emptyDescription)
    }
    // success 态不渲染 StateCard，由业务组件渲染
  }
}
```

### 7.5 PerformanceMonitor

```typescript
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  static shared(): PerformanceMonitor { /* singleton */ }

  private fps: number = 60;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;

  start(): void {
    // 绑定 ArkUI Inspector 的 frame callback
  }

  // 动画属性白名单校验
  validateAnimationProperty(property: string): boolean {
    const GPU_FRIENDLY = ['opacity', 'translate', 'scale', 'rotate', 'matrix'];
    const LAYOUT_PROPERTIES = ['width', 'height', 'top', 'left', 'padding', 'margin'];
    return GPU_FRIENDLY.includes(property);
    // 警告：发现 LAYOUT_PROPERTIES 中的属性做动画 → 报警
  }

  // 低端设备降级
  shouldReduceAnimations(): boolean {
    // 根据 device profile 判断
  }
}
```

### 7.6 LazyListHelper + ImageCache

```typescript
export class LazyListHelper<T> {
  private dataSource: LazyListDataSource<T> = new LazyListDataSource();

  update(items: T[]): void { /* diff 更新 */ }
  item(index: number): T { /* 返回 index 处数据 */ }
  totalCount(): number { /* ... */ }
}

export class ImageCache {
  static shared(): ImageCache { /* singleton */ }

  load(url: string, fallback: Resource): PixelMap | Resource {
    // 1. 检查内存缓存
    // 2. 检查磁盘缓存
    // 3. 网络下载（若需要）
    // 4. 返回 fallback 若失败
  }
}
```

### 7.7 L5 覆盖度检查清单

- [ ] ReaderViewModelRegistry 已建立
- [ ] 5 个 ViewModel（Bookshelf/Reader/Search/Settings/Rss）已实现
- [ ] 所有数据加载通过 ViewModel.executeRequest，不再直接 mock
- [ ] statePhase 有 5 态（idle/loading/error/success/empty）
- [ ] StateCard 组件支持 4 态（loading/error/empty/success）
- [ ] loading 态有 800ms 旋转 spinner
- [ ] error 态有重试按钮
- [ ] empty 态有插图和引导文案
- [ ] PerformanceMonitor 监控帧率
- [ ] 动画属性白名单校验已启用
- [ ] 所有列表使用 LazyForEach
- [ ] 图片使用 ImageCache 懒加载
- [ ] 快速切换 ViewModel 时旧 result 不会覆盖新 state

---

## 8. L6 Shell 层

### 8.1 职责定义

5 个 Shell，每个按 `shared-shell-kit/kit.js` 实现 5-slot 结构。

### 8.2 文件清单

| 文件 | Shell | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/shells/MainTabShell.ets` | 主 Tab（bookshelf/rss/discover/settings） | 需重构 |
| `entry/src/main/ets/ui/shells/ReaderShell.ets` | 阅读 | 需重构 |
| `entry/src/main/ets/ui/shells/LibraryShell.ets` | RSS 详情/搜索/书详情 | 新增 |
| `entry/src/main/ets/ui/shells/SettingsShell.ets` | 设置/WebDAV/来源管理 | 新增 |
| `entry/src/main/ets/ui/shells/FlowShell.ets` | source-switch | 新增 |

### 8.3 5-Slot 契约（对照 kit.js）

```typescript
// 所有 Shell 必须实现这 5 个 slot
interface ShellSlots {
  appTopBarSlot: () => void;       // 顶栏（标题 + 返回 + 操作按钮）
  contentRegionSlot: () => void;    // 内容区（路由内容）
  stateHostSlot: () => void;        // 状态卡（loading/error/empty）
  mainNavSlot: () => void;          // 主导航（Tab Bar 或 Module Nav）
  bottomSheetHostSlot: () => void;  // 底表/弹窗/键盘 overlay
}

// 错误信号
// ❌ appTopBarSlot 留空（应渲染而未渲染）
// ❌ mainNavSlot 嵌套在 contentRegionSlot 内（应与 contentRegion 同级）
// ❌ bottomSheetHostSlot 由各 Tab 自己渲染（应由 shell 统一管理）
```

### 8.4 MainTabShell 结构

```
Stack
├─ Column
│  ├─ AppTopBarSlot（顶栏，含 MainTabTitleBar）
│  ├─ ContentRegionSlot（Tab 内容，4 个 Tab 切换）
│  ├─ StateHostSlot（StateCard，按 activeTab 的 statePhase 显示）
│  └─ MainNavSlot（底部 Tab Bar）
└─ BottomSheetHostSlot（全局 overlay）
```

### 8.5 ReaderShell 结构

```
Stack
├─ ReadingSurfaceSlot（阅读正文，ReaderSharedSurface）
├─ ReaderOverlayHostSlot（ImmersiveReaderSurface + ReaderControlLayer）
├─ BottomSheetHostSlot（TTS/Settings/SourceSwitch 面板）
├─ ReaderModuleNavSlot（目录/朗读/界面/设置 4 模块切换）
└─ ReaderStateHostSlot（StateCard）
```

### 8.6 L6 覆盖度检查清单

- [ ] 5 个 Shell 文件已建立
- [ ] 所有 Shell 实现 5-slot 契约
- [ ] appTopBarSlot 不留空
- [ ] mainNavSlot 与 contentRegionSlot 同级
- [ ] bottomSheetHostSlot 由 shell 统一管理
- [ ] MainTabShell 支持横竖屏切换（NavigationRail vs BottomNav）
- [ ] ReaderShell 支持沉浸式 ↔ 控制层切换

---

## 9. L7 组件层

### 9.1 职责定义

实现 148 个交互入口对应的 ArkUI 组件。每个组件必须：
1. 通过 L1 token 引用颜色/字号/间距
2. 通过 L3 MotionReducer 驱动动画（不直接 .animation()）
3. 通过 L4 gesture/transition 适配原生能力
4. 通过 L5 ViewModel 获取数据

### 9.2 文件清单

| 文件 | 内容 | 状态 |
|---|---|---|
| `entry/src/main/ets/ui/components/BookshelfTab.ets` | 书架 Tab | 需重构 |
| `entry/src/main/ets/ui/components/RssTab.ets` | RSS Tab | 需重构 |
| `entry/src/main/ets/ui/components/DiscoverTab.ets` | 发现 Tab | 需重构 |
| `entry/src/main/ets/ui/components/SettingsTab.ets` | 设置 Tab | 需重构 |
| `entry/src/main/ets/ui/components/ReaderControlLayer.ets` | 阅读控制层 | 需重构 |
| `entry/src/main/ets/ui/components/ReaderSurface.ets` | 沉浸式 surface | 需重构 |
| `entry/src/main/ets/ui/components/ReaderSharedSurface.ets` | 阅读正文 + PaperTexture | 需重构 |
| `entry/src/main/ets/ui/components/SharedComponents.ets` | 通用组件 | 需扩展 |
| `entry/src/main/ets/ui/components/ReaderSessionCapsule.ets` | 运行胶囊 | 新增 |
| `entry/src/main/ets/ui/components/ReaderControlHandle.ets` | 控制层小横条 | 新增 |
| `entry/src/main/ets/ui/components/ReaderControlDock.ets` | 宽屏 dock | 新增 |
| `entry/src/main/ets/ui/components/ReaderTextSelection.ets` | 文本选择层 | 新增 |
| `entry/src/main/ets/ui/components/ReaderPaperTexture.ets` | 纸面纹理（repeating-linear-gradient 等价） | 新增 |
| `entry/src/main/ets/ui/components/ReaderDropdown.ets` | 通用下拉组件 | 新增 |
| `entry/src/main/ets/ui/components/ReaderOverlay.ets` | 通用 overlay（dialog/sheet/keyboard） | 新增 |
| `entry/src/main/ets/ui/components/ReaderSlider.ets` | 跟手 slider | 新增 |
| `entry/src/main/ets/ui/components/ReaderToggle.ets` | 开关组件 | 新增 |
| `entry/src/main/ets/ui/components/ReaderTabNav.ets` | Tab Bar / NavigationRail | 新增 |
| `entry/src/main/ets/ui/components/ReaderBookCard.ets` | 书籍卡片 | 新增 |
| `entry/src/main/ets/ui/components/ReaderListRow.ets` | 列表行 | 新增 |

### 9.3 组件实现契约（按组件族）

#### 9.3.1 通用组件族（来自 MOTION_INTERACTION_COMPONENT_AUDIT.md）

| 组件族 | 交互 | 动画反馈 | 实现要点 |
|---|---|---|---|
| Button | press / activate | 80ms scale 1→0.98 + 120ms 状态切换 | @State pressed + scale animation |
| IconButton | 同上 | 同上 | 同上 |
| DestructiveButton | press / activate | 80ms scale + 120ms 状态切换 + danger 色 | 同上 + readerTheme.danger |
| Toggle | press / switch / revert | 140ms thumb/check/背景同步 | @State + animate thumb position |
| Chip | press / select | 80ms / 120ms | 同 Button |
| Filter | toggle / apply.commit | 120ms toggle + 160ms commit | 同 Button + commit animation |
| Segment | switch | 160ms 选中态迁移 | indicator 位移，不重建 |
| Dropdown | trigger.press / expand / collapse / option.select | 80/160/120/120ms | 见 ReaderDropdown |
| Overlay | dialog.enter / sheet.enter / keyboard.enter | 240ms scale / 160ms 滑入 / 160ms 滑入 | 见 ReaderOverlay |
| Input | focus / blur / clear / submit | 120ms focus ring + 160ms 结果淡换 | focus ring border animation |
| Search | state.replace | 160ms 短淡换 | 交叉淡入淡出 |
| Feedback | toast.enter / update / exit | 180ms 8px 位移 | translateY + opacity |
| State | content.replace | 160ms 容器稳定内容淡换 | 见 StateCard |
| Selection | range.show / drag / release + toolbar.* | 160ms 6px 位移 | 见 ReaderTextSelection |
| Slider | drag.start / update / release / commit | 拖动无 easing + release 120ms snap | 见 ReaderSlider |
| Stepper | press / value.change | 80ms press + 即时值更新 | 同 Button |
| Progress | meter.update | 120ms fill | progress animation |
| ListRow | press / select / route | 80ms scale + 120ms 选中态 | 见 ReaderListRow |
| Card | press / select / route | 80ms scale + 120ms 选中态 | 见 ReaderBookCard |
| Bookshelf | view.switch (grid↔list) | 容器淡换，不逐项飞入 | opacity crossfade |

#### 9.3.2 Reader 专属组件

| 组件 | Motion ID | 实现要点 |
|---|---|---|
| ReaderSessionCapsule | capsule.enter / update / switch / exit / countdownTick / voiceIcon.active | keyframeAnimateTo + @Animator pulse |
| ReaderControlHandle | handle.press / drag / release | LongPressGesture + PanGesture + phase 跟踪 |
| ReaderControlDock | dock.longPress / drag / release / rebound | 同上 + bounds clamp |
| ReaderTextSelection | range.show / drag / release + toolbar.* | PanGesture + selectionRange state |
| ReaderPaperTexture | （静态纹理） | Stack + Divider 模拟 repeating-linear-gradient |
| ReaderDropdown | trigger.press / expand / collapse / option.select | Popup + transition + A→B redirect |
| ReaderOverlay | dialog/sheet/keyboard.enter/exit | transition + focus restore |
| ReaderSlider | drag.start / update / release / commit | PanGesture + 跟手 + snap |

### 9.4 PaperTexture 重新实现（关键修复）

```typescript
// v1 用纯色 + opacity 近似，丢失横向细纹
// v2 用 Stack + Divider 模拟 repeating-linear-gradient(0deg, ...)

@Component
export struct ReaderPaperTexture {
  @Prop paperStart: string;
  @Prop paperEnd: string;

  build() {
    Stack() {
      // 底层：linear-gradient 背景
      Column()
        .width('100%').height('100%')
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [[this.paperStart, 0], [this.paperEnd, 1]]
        })

      // 上层：横向细纹（repeating-linear-gradient 等价）
      // 用多个 Divider 模拟 1px 横向纹理
      Column() {
        ForEach([0, 4, 8, 12, 16, 20, /* ... 每 4vp 一条 */], (y: number) => {
          Divider()
            .color('#0D000000')  // alpha 0.05
            .strokeWidth(1)
            .position({ x: 0, y: y })
        })
      }
      .width('100%').height('100%')
      .hitTestBehavior(HitTestMode.None)
    }
  }
}
```

### 9.5 L7 覆盖度检查清单

- [ ] 所有 Tab 组件无硬编码颜色字面量（grep 验证）
- [ ] ReaderControlLayer 主 struct 用 token 引用，子 struct 用正确 token 字面量值
- [ ] ReaderSessionCapsule 实现 enter/update/switch/exit + countdownTick + voiceIcon pulse
- [ ] ReaderControlHandle 实现 press/drag/release 三态
- [ ] ReaderControlDock 实现 longPress/drag/release/rebound
- [ ] ReaderTextSelection 实现完整 selectionRange 状态 + toolbar
- [ ] ReaderPaperTexture 用 Stack + Divider 模拟横向细纹
- [ ] ReaderDropdown 实现 A→B redirect（中断 + 重定向）
- [ ] ReaderOverlay 实现 dialog/sheet/keyboard 三种类型 + focus restore
- [ ] ReaderSlider 实现跟手 drag + release snap
- [ ] 通用组件族（Button/Toggle/Chip/Filter/Segment）实现 80/120/160ms 动画反馈
- [ ] 所有 if/else 挂载/卸载有 transition

---

## 10. L8 页面层

### 10.1 职责定义

实现 131 个路由的 NavDestination。每个页面由 Shell + 组件组合而成。

### 10.2 路由清单（来源：route-contract.js）

| Shell | 路由数 | 主要路由 |
|---|---:|---|
| MainTabShell | 35 | bookshelf / discover / rss / settings / bookshelf-empty / sort-filter |
| LibraryShell | 52 | rss-all / rss-starred / rss-source-* / book-search / book-detail / book-directory / group-management / local-import |
| SettingsShell | 28 | settings-general / sync-backup / webdav-config / restore-* / source-management / source-import-* / source-rule-edit / source-debug |
| ReaderShell | 15 | immersive-reading / reader / toc-bookmarks / reader-appearance / tts / reader-settings / auto-page / content-search |
| FlowShell | 1 | source-switch |

### 10.3 实现优先级

**P0 必做**（应用不可用如果缺失）：
- bookshelf / discover / rss / settings（主 Tab）
- immersive-reading（阅读入口）
- book-detail / book-directory（书籍详情/目录）
- source-switch（换源）
- settings-general（设置入口）

**P1 建议**：
- book-search / rss-source-* / toc-bookmarks / reader-appearance / tts / reader-settings
- source-management / source-import / sync-backup / webdav-config

**P2 可选**：
- restore-* / source-debug-* / source-rule-edit / source-code-view / source-logs

### 10.4 L8 覆盖度检查清单

- [ ] Index.ets 用 Navigation + NavPathStack 替代 routeStack
- [ ] P0 路由（5 个）已实现
- [ ] P1 路由（~15 个）已实现
- [ ] 所有 NavDestination 有 .transition() 路由动画
- [ ] 跨路由状态（ReaderContext/session/dock offset）通过 ViewModel 保留

---

## 11. 关键路径实现

### 11.1 路径 1：应用冷启动首屏

```
EntryAbility.onCreate()
  → 初始化 L0 资源（color.json/string.json）
  → 初始化 L1 token（ReaderThemeState.day()）
  → 初始化 L3 MotionReducer / ReducedMotionProvider
  → 初始化 L3 ViewportAdapter（监听窗口/旋转/折叠）
  → 初始化 L5 ViewModelRegistry
  → 加载 pages/Index
    → Index.build()
      → ReaderNavigationAdapter.build()
      → MotionReducer.start({ motionId: 'app.firstOpen.enter' })
      → fd-app-first-open-enter 280ms 淡入 + 8px 位移
      → BookshelfViewModel.load()
      → StateCard（loading）→ 数据到达 → StateCard（success）
```

### 11.2 路径 2：路由 push

```
用户点击书籍卡片
  → ReaderBookCard.onClick()
  → ReaderNavigationAdapter.push('book-detail', { bookId })
    → MotionReducer.start({ motionId: 'app.route.push.forward', from: 'bookshelf', to: 'book-detail' })
    → NavPathStack.pushPath
    → NavDestination .transition(routePushTransition) 播放 160ms 横向位移 + 淡入
    → routePhase = 'entering' → 'settled'
  → BookDetailViewModel.load()
```

### 11.3 路径 3：封面 → 沉浸阅读

```
用户点击 ContinueReadingCard 的封面
  → ReaderBookCover.onClick()
  → MotionReducer.start({ motionId: 'reader.entry.coverToImmersive' })
  → ReaderNavigationAdapter.push('immersive-reading', { bookId })
  → .sharedTransition(bookId) 播放 240ms 共享元素转场
  → fd-reader-entry-snapshot 240ms 封面 snapshot + 阅读纸面 12px 位移
  → ReaderViewModel.load()
  → 阅读正文渲染 + 主题应用
```

### 11.4 路径 4：翻页

```
用户 swipe 或点击 tap zone
  → ReaderGestureAdapter.bindSwipePageTurn() 触发
  → Reducer dispatch turnPage('next' | 'prev')
  → MotionReducer.start({ motionId: 'reader.page.turn.next' })
  → fd-reader-page-next 220ms opacity 0→1 + translateX 16→0
  → 阅读正文层切换
  → routePhase = 'settled'
```

### 11.5 路径 5：控制层显隐

```
用户点击阅读正文中部
  → onToggleControls()
  → MotionReducer.start({ motionId: 'reader.control.show' })
  → 三层差异化动画：
    - 顶栏从 -8px 进入（200ms EaseOut）
    - 底部面板从 12px 进入（200ms EaseOut，晚 20ms）
    - 模块导航从 8px 进入（200ms EaseOut，晚 40ms）
  → controlSpacePhase = 'entering' → 'settled'
```

### 11.6 路径 6：TTS 会话

```
用户点击 TTS 模块
  → onSelectTtsOption('start')
  → Reducer dispatch startReaderSession('tts')
  → MotionReducer.start({ motionId: 'reader.session.tts.start' })
  → MotionReducer.start({ motionId: 'reader.session.capsule.enter' })
  → fd-reader-session-capsule-enter 160ms scale 0.96→1 + 6px 位移
  → capsuleMorphPhase = 'snapshot' → 'transferring' → 'settled'
  → 若 controlSpaceVisible：MotionReducer.start({ motionId: 'reader.session.controlSpace.enter' })
  → fd-reader-control-space-enter 180ms scale 0.92→1
  → TTS 朗读开始 → voiceIcon.active 960ms pulse
  → 每句朗读完成 → MotionReducer.start({ motionId: 'reader.session.capsule.countdownTick' })
  → fd-reader-session-capsule-tick 120ms 数字替换
```

### 11.7 路径 7：横竖屏旋转

```
系统检测到 orientation 变化
  → ReaderViewportAdapter.onViewportChange(newSnapshot)
  → MotionReducer.start({ motionId: 'viewport.orientation.prepare' })
  → phase = 'preparing' (80ms)
    - 冻结所有非必要动画
    - 释放 pointer capture
    - 提交拖动到最近安全状态
  → MotionReducer.start({ motionId: 'viewport.orientation.reshape' })
  → phase = 'reshaping' (240ms)
    - Shell 容器切到新 viewport class
    - 阅读正文按章节进度/字符锚点重新分页
    - 控制层/overlay/胶囊/dock 重新锚定
  → MotionReducer.start({ motionId: 'viewport.orientation.settle' })
  → phase = 'settling' (240ms)
    - 恢复 focus/pointer/semantics
    - 恢复运行胶囊倒计时/朗读图标微动效
```

### 11.8 路径 8：打断重定向（Dropdown A → B）

```
用户打开 Dropdown A，A 进入中又点击 Dropdown B
  → MotionReducer.interrupt('redirect')
  → fd-motion-interrupt-settle 80ms 收尾
  → MotionReducer.start({ motionId: 'dropdown.menu.expand', target: B })
  → fd-motion-dropdown-switch-to 160ms opacity 0.72→1 + translateY 3→0
  → dropdownPhase = 'entering' → 'expanded'
```

### 11.9 路径 9：异步结果防覆盖

```
用户在 bookshelf 快速点击 Book A → Book B → Book C
  → BookshelfViewModel.load('A') → requestId = 'req-1'
  → 在 'req-1' 完成前，点击 Book B
  → BookshelfViewModel.load('B') → requestId = 'req-2'
  → AsyncResultGuard.startRequest('req-2', 'book-detail')
    → 'req-1' 被标记为 'superseded'
  → 'req-1' 完成 → AsyncResultGuard.completeRequest('req-1', resultA, 'book-detail')
    → accept = false（已被 superseded）
    → 不更新 state（旧结果丢弃）
  → 'req-2' 完成 → AsyncResultGuard.completeRequest('req-2', resultB, 'book-detail')
    → accept = true → state 更新为 Book B 数据
```

---

## 12. 实现优先级与验收标准

### 12.1 P0 — 视觉对齐 + L0-L1 完整化

**目标**：颜色/排版/间距/尺寸 token 100% 对齐 demo

**任务**：
1. 修正 color.json base/dark 的 paper/ink/annotation/selection 系列（来源：fixture.js + render-runtime.js）
2. 补齐缺失 control token（controlAction/controlIcon/controlActiveBg/controlActiveStrong/controlDisabledBg/controlHandle）
3. 补齐 7 个 selection token
4. 扩展 ReaderTypography（补 30+ 字号 + 10 字重 + fallback 字体链）
5. 新增 ReaderSpacing/ReaderSize/ReaderRadius/ReaderShadow
6. 修正夜间 alpha（独立核算，不复制 day）
7. 全量 token 化 4 个 Tab 组件
8. 重写 ReaderPaperTexture（Stack + Divider 模拟横向细纹）
9. 重写 ReaderTextSelection（深色工具栏 + 暖棕高亮 + handle 颜色）

**验收标准**：
- grep 验证所有组件无硬编码颜色字面量
- color.json base/dark 包含 ~80 个 entry
- ReaderThemeState 包含 ~50 个字段
- ReaderMotion 包含 20 duration + 5 easing + 8 distance + 5 scale
- ReaderTypography 包含 20 fontSize + 10 fontWeight + 10 lineHeight + 3 fontFamily（含 fallback）

### 12.2 P1 — 动效运行时层（L3 新增）

**目标**：建立 MotionReducer 单例 + 47 个 Motion ID 状态机 + INTERRUPT 三态 + AsyncResultGuard

**任务**：
1. 新增 `entry/src/main/ets/ui/motion/` 目录
2. 实现 ReaderMotionReducer（transaction 生命周期）
3. 加载 demo 47 个 Motion ID 状态机到 ReaderMotionContract
4. 实现 INTERRUPT 三态统一入口 + 80ms 收尾
5. 实现 ReaderAsyncResultGuard（五态 + requestId-scoped）
6. 实现 ReaderReducedMotionProvider（监听系统配置）
7. 实现 ReaderMotionRegistry（18 个 keyframe 等价）

**验收标准**：
- MotionReducer 单例可启动 transaction
- 47 个 Motion ID 可通过 contractFor 查询
- INTERRUPT 三态统一入口可取消正在播放的动画
- AsyncResultGuard 五态完整
- reduced motion 下保留 80ms 颜色过渡

### 12.3 P2 — 原生能力接入（L4 新增 + L6 重构）

**目标**：迁移到 Navigation + 接入 gesture/transition/Animator

**任务**：
1. 新增 `entry/src/main/ets/ui/native/` 目录
2. 实现 ReaderNavigationAdapter（NavPathStack + NavDestination）
3. 迁移 Index.ets 从 routeStack 字符串数组到 NavPathStack
4. 实现 ReaderGestureAdapter（Swipe/Pinch/Pan/LongPress 5 类手势）
5. 实现 ReaderTransitionAdapter（routePush/overlayDialog/overlaySheet/dropdownExpand/capsuleEnter transition + sharedTransition）
6. 实现 ReaderAnimatorAdapter（voice pulse / loading spin / TTS cursor pulse）
7. 实现 ReaderAnimatableProperty（capsuleDockProgress / themeTransitionProgress）
8. 重构 5 个 Shell 实现 5-slot 契约
9. 修正 mainNavSlot 与 contentRegionSlot 同级
10. 实现 appTopBarSlot 不留空

**验收标准**：
- Index.ets 用 Navigation + NavPathStack
- 5 类手势已绑定
- 所有 if/else 挂载/卸载有 transition
- 封面 → 沉浸阅读有 sharedTransition
- 5 个 Shell 实现 5-slot 契约

### 12.4 P3 — 应用基础设施层（L5 新增）

**目标**：ViewModel + StateCard + Performance + 真实数据接入

**任务**：
1. 新增 `entry/src/main/ets/ui/viewmodel/` 目录
2. 实现 5 个 ViewModel（Bookshelf/Reader/Search/Settings/Rss）
3. 实现 StateCard 组件（4 态 + 重试按钮）
4. 实现 PerformanceMonitor（帧率 + 动画属性白名单）
5. 实现 ImageCache
6. 所有列表迁移到 LazyForEach
7. 替换所有 mock 数据为 ViewModel 调用

**验收标准**：
- 5 个 ViewModel 已实现
- 所有数据加载通过 executeRequest
- StateCard 支持 4 态
- 快速切换 ViewModel 旧 result 不覆盖新 state
- 所有列表虚拟化

### 12.5 P4 — 动效消费层（L7 重构）

**目标**：组件层接入 L3 MotionReducer + L4 原生能力

**任务**：
1. 新增 ReaderSessionCapsule（实现 enter/update/switch/exit + tick + pulse）
2. 新增 ReaderControlHandle（press/drag/release 三态）
3. 新增 ReaderControlDock（longPress/drag/release/rebound）
4. 新增 ReaderDropdown（A→B redirect）
5. 新增 ReaderOverlay（dialog/sheet/keyboard + focus restore）
6. 新增 ReaderSlider（跟手 drag + snap）
7. 重构 ReaderControlLayer 接入 MotionReducer（替换所有 .animation() 调用）
8. 重构 ReaderSurface 接入 gesture + transition
9. 实现通用组件族 normalized adapter（Button/Toggle/Chip/Filter/Segment）

**验收标准**：
- 所有组件无 .animation() 直接调用（通过 MotionReducer）
- ReaderSessionCapsule 有 enter/update/switch/exit + tick + pulse
- ReaderControlHandle 有 press/drag/release 三态
- Dropdown 有 A→B redirect
- Overlay 有 focus restore
- Slider 有跟手 drag
- 18 个 keyframe 全部可触发

---

## 13. 完整覆盖度检查清单（开发前必查）

### 13.1 启动 P0 前的检查

- [ ] 已读取 fixture.js 确认 paper/ink 真实值
- [ ] 已读取 render-runtime.js 确认 day/night control 对象
- [ ] 已读取 motion-tokens.css 确认 38+ token 值
- [ ] 已读取 motion-controller.js 确认 47 个 Motion ID
- [ ] 已读取 route-contract.js 确认 131 个路由
- [ ] 已读取 shared-shell-kit/kit.js 确认 5-slot 契约

### 13.2 启动 P1 前的检查

- [ ] P0 全部验收通过
- [ ] ReaderThemeState 字段完整（~50）
- [ ] ReaderMotion 字段完整（38+）
- [ ] ReaderTypography 字段完整（40+）
- [ ] color.json base/dark entry 完整（~80）
- [ ] 无硬编码颜色字面量（grep 验证）

### 13.3 启动 P2 前的检查

- [ ] P1 全部验收通过
- [ ] MotionReducer 单例工作
- [ ] 47 个 Motion ID 可查询
- [ ] INTERRUPT 三态统一入口工作
- [ ] AsyncResultGuard 五态完整
- [ ] reduced motion 降级规则完整

### 13.4 启动 P3 前的检查

- [ ] P2 全部验收通过
- [ ] Navigation + NavPathStack 已迁移
- [ ] 5 类手势已绑定
- [ ] transition 覆盖所有 if/else
- [ ] sharedTransition 用于封面 → 沉浸阅读
- [ ] 5 个 Shell 实现 5-slot 契约

### 13.5 启动 P4 前的检查

- [ ] P3 全部验收通过
- [ ] 5 个 ViewModel 已实现
- [ ] StateCard 支持 4 态
- [ ] PerformanceMonitor 工作
- [ ] 所有列表虚拟化
- [ ] 真实数据接入

### 13.6 完成全部后的最终验收

- [ ] 9 条关键路径全部可走通（首启/路由/封面进入/翻页/控制层/TTS/旋转/打断/异步防覆盖）
- [ ] 18 个 keyframe 全部可触发
- [ ] 47 个 Motion ID 全部可查询
- [ ] 5 个 Shell 实现 5-slot 契约
- [ ] 131 个路由至少 P0+P1 子集（~20 个）已实现
- [ ] 所有 BLOCKER 级问题已解决
- [ ] reduced motion 完整降级
- [ ] 折叠屏/旋转/窗口变化三段式 motion 工作
- [ ] 快速操作不崩溃（打断重定向工作）
- [ ] 快速切换 ViewModel 不覆盖新 state

---

## 14. 文档维护规则

1. **任何层规划变更**：先更新本文档对应章节，再改代码
2. **发现规划缺失**：先更新本文档补齐字段/契约/检查清单，再补代码
3. **新增组件**：必须在 9.2 文件清单登记，并在 9.3 组件实现契约补充条目
4. **新增路由**：必须在 10.2 路由清单登记
5. **新增 Motion ID**：必须在 5.5 Motion ID 清单登记
6. **每次阶段验收**：对照 13.x 检查清单逐项确认

---

**文档版本**：v2.0
**创建日期**：2026-07-04
**适用项目**：Reader for HarmonyOS
**前置文档**：所有 v1 阶段的架构文档（HARMONYOS_READER_SHELL_SKELETON.md 等）仅作历史参考，不作开发依据
