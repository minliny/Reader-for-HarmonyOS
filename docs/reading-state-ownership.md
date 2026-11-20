# 阅读页响应式状态归属（LocalReadingExperience）

测量基线：`entry/src/main/ets/features/reading/LocalReadingExperience.ets`，约 14,928 行、
635 个方法、124 个响应式状态声明。本文只做**归属盘点与拆分顺序**，不改变运行行为。

## 为什么不能"合并成一个对象"

ArkUI 中 `@State` 只在其**顶层赋值**时触发重建。把多个原始状态合并进一个普通对象后，
在同一个组件内改字段（`this.group.mode = x`）**不会触发更新**，除非该对象是 `@Observed`
并由子组件的 `@ObjectLink` 消费。因此安全归组只有两条路：

1. 抽成子组件 + `@Observed` 模型 + `@ObjectLink`（改变 UI 结构，需真机验证）。
2. 保留单对象 `@State`，但**每次写入整体重新赋值**（`this.group = { ...this.group, mode: x }`），
   读改为 `this.group.mode`。仍是机械改写，但需逐点核对所有写入。

两条路都不能靠"合并不改引用"完成，必须在可构建基线上验证。

## 归组与引用密度（按可拆分难度升序）

引用数为该组内 `this.<name>` 出现总次数；数字越小，改动面越小、越适合先做。

| 组 | 变量数 | 引用数 | 代表变量 |
|---|---:|---:|---|
| settings（中文转换） | 2 | 12 | chineseConversionOperationId(8), chineseConversionMode(4) |
| viewport（视口测量） | 5 | 59 | viewportWidth(22), viewportHeight(15), measurementEpoch(12) |
| recovery（恢复/错误视图） | 12 | 70 | failureCode(13), readerRecoveryView(10), ttsConfigurationRecovery(10) |
| bookmark（书签） | 8 | 78 | bookmarkPageOffsetY(15), bookmarkPreviewChanged(14), bookmarkPendingTarget(13) |
| phase/switch（阶段/换源） | 3 | 95 | phase(85) |
| tts（朗读） | 8 | 101 | ttsState(47), ttsPreferences(24) |
| sessionLaunch（开场） | 11 | 108 | sessionLaunch(67) |
| control（控制面板） | 12 | 118 | controlReplaceState(36), controlSession(29) |
| content（正文/目录） | 14 | 121 | visibleFragments(22), tocEntries(22) |
| misc（生命周期） | 4 | 161 | mounted(96), exitRequested(53) |
| appearance/theme（外观） | 4 | 187 | readerSettingsSnapshot(94), appearanceSnapshot(84) |
| pageTurn（翻页） | 12 | 198 | pageTurnRenderRevision(48), pageTurnSettlementActive(40) |

## 建议拆分顺序

1. **settings**（2 变量 / 12 引用）：最小闭环，作为模式验证的样板。
2. **viewport**（5 / 59）：纯测量数据，边界清晰。
3. **recovery**（12 / 70）：已是对象，适合收敛为统一 `ReaderRecoveryState`。
4. **bookmark → phase/switch → tts**：逐个推进，每次只动一组。
5. **control / content / appearance / pageTurn**：引用密集，最后处理，需分多次。

`misc`（mounted / exitRequested）是生命周期根状态，**不建议归组**，保持顶层。

## 每步的验证前提

- 需要**可构建基线**：当前工作树含 845 个删除的迁移中间态，全量编译不可信。
- 每次只改一组，改动后必须：`hvigorw` 编译通过 + 真机（或 VM）阅读主路径回归（打开、
  翻页、目录、书签、换源、朗读）。
- 单组改动不应混入业务行为变化；只做状态搬运与引用改写。

## 现状结论

- 124 个声明状态**无零引用死状态**，不存在"直接删代码"的捷径。
- 归组必须走子组件/模型抽取，属多轮、需设备验证的改造；在可构建基线建立前不宜盲改。
