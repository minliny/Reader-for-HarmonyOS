# Full Auto 定时选择器越界：代码定位与修复证据

## 发现与范围

- 触发：二包 `a91af09f`（`b17f29a4` 仅为采集文件命名前缀，不是安装源码） 在 VM 展开完整自动翻页；控制栏已到稳定态。
- 原始证据：`implementation-vm-followup-20260913/reader-control-b17f29a4-20260913-auto-full.png` 和同名 `.json`。
- 定时卡 `bounds/origBounds=[148,1112][1134,1595]`；分钟轮 `[551,1154][817,1553]`；秒轮 `[901,1154][1167,1553]`；分秒组合 `[551,1154][1167,1553]`。秒轮分隔线右端超出卡片 33px。密度 3.5 时约 9.43vp。
- 仅修当前 `ReaderControlAutoPageContent` 的 Full timer 宽度预算及其共享 `ReaderControlTimerWheel` 入参；不动设备、时长逻辑、主题、其它布局和 HAP。

## 归因与设计依据

- 归档 Figma `evidence/2026-09-12-new-ui-audit/1764-10223.yaml`：定时卡 `1764:10282/layout_9H2EYT` 横向 fill、圆角 10；标签 `1764:10283/layout_2BCXZ4` x15/y54、图标30、间隔8；picker `1764:10292/layout_DEQ8X6` x115/y12、高114、横向 fill。
- 当前控制栏基准 Full 内容宽314、内卡306；分钟/秒数76、两轮间隔24（8+冒号8+8）、picker176，在306vp卡片内留下15vp右边距，原设计基准本身未越界。
- VM 实际卡片只有281.714vp。卡片已按 `sectionInnerWidth()` 随视口缩放，但 picker176 / wheel76 / secondX100 / colonX84 全部硬编码；内容总右边界115+176=291，不随卡片改变。
- 单独左移不能解决：固定176向左挪到卡右侧15vp位置，会与标签 x15..99 发生重叠。正确适配是保留标签、左/右间距，剩余横向空间由两列等分；字体、行高、数字、交互和色彩不缩放。
- 当前 TTS 的生产 `ReaderControlTtsContent.timer()` 使用 Make 的 preset/stepper，不使用这个 `ReaderControlTimerWheel`；同名旧 FullPanel 不属于当前生产路径。本次不扩大改动。

## 实施与验证

- 状态：已做最小修复。`ReaderControlAutoPageContent.timerWheelWidth()` 用 `(cardWidth - 115 - 15 - 24) / 2` 给两列分配宽度；minute/second组件入参、second位置、冒号位置、group宽度全部消费同一个值。基准306vp仍是原76/176/100/84，VM宽度281.714vp对应63.857vp列宽、151.714vp组合宽、15vp右边距。没有只缩容器或把越界隐藏。
- 验证层：原 VM 失败已确认；本地 Builder 检查实际 SDK 输出的父层尺寸、子组件 Prop 更新、原始 wheel 数字/分隔线/单位宽度、事件回调和前后向动作不重挂。此检查不是 ArkUI native 画面验收。
- 后续 VM 问题：新包稳定 Full timer 的分隔线应全部在卡内，右边距15vp，并无文字重叠。由 root 统一产物和设备验证。

### 本地证据

- 新增 `tools/test-reader-auto-timer-native-layout.mjs`。实际 SDK Builder 初次失败明确为 `291 > 281.714285714`，原始输出保存在 `auto-full-timer-builder-before.json`；修复后输出在 `auto-full-timer-builder-after.json`。
- 新回归通过：42个前进/反向/宽度/日夜组合状态，父组件实际发出的子组件Prop、两个轮自身数字/单位/分隔线宽度、306vp基准不变、原回调仍有效；变异恢复原固定宽度后准确失败。
- 受影响回归通过：reader-auto-page-full、reader-control-playback-content、reader-control-morph-scroll、reader-render-work、reader-session-launch-recovery。
- 本地实现通过，不声称新包 native 画面或用户验收通过。统一 ArkTS/HAP/VM 后续由 root 执行。
