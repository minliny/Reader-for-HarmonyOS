# Figma 应用日夜间颜色只读核查

日期：2026-09-13。Figma 文件：`klhs2jMM4MncaJFqZMfqEK`。没有改动任何 Figma 节点、变量、模式或生产代码。

## 结论和证据边界

**不能继续写“Figma 只有 Day / Night 不存在”。** `Reader · App Color`（`VariableCollectionId:245:3`）确有 Day `245:1` 和 Night `254:0` 两个模式，88 个颜色变量全部有双模式值。解析别名后，37 项日夜不同，51 项相同。

这也不代表新的应用主题模块已经具有全角色、可直接照搬的完整夜间语义表：23 项基础 `color/*` 色仍引用相同 primitive；`color/runtime/*` 才包含实际夜间基础色。其余同值有合理常量，也有明显日间浅色表面沿用，必须区分。不能仅因值相同就判错，也不能把 Night 模式名称当夜间视觉完成。

原始返回保存在 [theme-figma-app-colors-live.json](./theme-figma-app-colors-live.json)。`appColorsComplete` 是全 88 项、未截断的官方只读工具返回；前两次大全量原始尝试触发工具 20KB 截断，字段名明确标记 `Truncated`，不用于完整性计数。8位颜色采用 **#RRGGBBAA**；迁移 ArkUI 若使用 #AARRGGBB，必须显式重排，不能直接复制8位字符串。

## 直接复用

| 角色 | Figma Night 值（RRGGBBAA） |
|---|---|
| runtime/paper | #24211EFF |
| runtime/paper/bright | #2C2824FF |
| runtime/paper/solid | #1C1A18FF |
| runtime/surface | #2A2622E5 |
| runtime/ink | #EADFCEFF |
| runtime/muted | #BAAD9CFF |
| runtime/border | #E2D1B933 |
| runtime/primary | #D2BD96FF |
| runtime/primary/dark | #7A684FFF |
| runtime/accent | #D69B5FFF |

另外 27 项日夜不同的书架、设置、书源管理与换源角色按下方全量表直接复用。应用页、控制栏和胶囊使用统一 AppPalette 所属角色；正文、沉浸信息及状态栏继续使用 ReadingPalette。当前已有透明度不因此被强行取消。

## 同值的分类和补齐候选

以下所有“候选”均是**实施候选，未被 Figma 确认、未修改 Figma**。推导只使用已有 Night 基色和该角色原 alpha，不重新制定整套配色。实施前由主方案给出统一角色映射并在设计对照样张里核对；不得悄悄称为“照 Figma 实现”。

| 同值角色 | 当前 Day/Night | 分类 | Night 实施候选 | 推导/约束 |
|---|---|---|---|---|
| runtime/surface/panel | #FFFCF89E | 明确浅色表面，需补齐 | #2A26229E | Night surface 基色+原alpha |
| runtime/surface/panel/soft | #EEE6DBA3 | 明确浅色表面，需补齐 | #2C2824A3 | Night bright 基色+原alpha |
| runtime/surface/elevated | #FFFFFFC7 | 明确浅色表面，需补齐 | #2C2824C7 | Night bright 基色+原alpha |
| runtime/surface/solid | #FFFCF8EB | 明确浅色表面，需补齐 | #2A2622EB | 保留原alpha，不因名字solid强改不透明 |
| runtime/surface/translucent | #FFFCF86B | 明确浅色表面，需补齐 | #2A26226B | Night surface 基色+原alpha |
| runtime/surface/field | #FFF8EFC7 | 明确浅色表面，需补齐 | #2C2824C7 | Night bright 基色+原alpha |
| runtime/surface/disabled | #EEE6DBC2 | 明确浅色表面，需补齐 | #2C2824C2 | Night bright 基色+原alpha |
| settings/select/surface/top | #FAF7F2FF | 明确浅色表面，需补齐 | #2C2824FF | 复用 Night bright，不加新色 |
| settings/select/surface/bottom | #F5F0E8FF | 明确浅色表面，需补齐 | #24211EFF | 复用 Night paper，保留原渐变结构 |
| settings/select/card | #FFFCF8FF | 明确浅色表面，需补齐 | #2A2622FF | Night surface RGB，保留不透明 |
| runtime/line | #9B84662E | 同值待合成对比 | #E2D1B92E | 若改则用已有 Night border RGB+原alpha |
| runtime/line/strong | #B4A69757 | 同值待合成对比 | #E2D1B957 | 同上；非自动新增设计要求 |
| runtime/line/hard | #BEAE9C66 | 同值待合成对比 | #E2D1B966 | 同上 |
| runtime/primary/soft | #2D4A3E17 | 同值待角色确认 | #D2BD9617 | 若语义为primary派生则绑定 Night primary |
| runtime/primary/bg | #2D4A3E1F | 同值待角色确认 | #D2BD961F | 同上 |
| runtime/primary/strong | #2D4A3E47 | 同值待角色确认 | #D2BD9647 | 同上 |
| runtime/primary/border | #2D4A3E6B | 同值待角色确认 | #D2BD966B | 同上 |
| settings/select/chevron | #B0A99FFF | 同值待可辨识度核对 | #BAAD9CFF | 如需统一，复用 Night muted |
| settings/select/trigger/surface | #2D4A3E0F | 同值待状态合成核对 | #D2BD960F | primary派生角色+原alpha |
| settings/select/selected/surface/phone | #2D4A3E0E | 同值待状态合成核对 | #D2BD960E | 同上 |
| settings/select/selected/surface/tablet | #2D4A3E0F | 同值待状态合成核对 | #D2BD960F | 同上 |

保留相同的语义常量：`runtime/on/primary #FFFAF4FF`、`runtime/forest #367A4DFF`、`runtime/danger #D62222FF`、`runtime/shadow/soft/warm #5C47320D`、`runtime/shadow/dark #0000001F`、`library/action/on-primary #FFFFFFFF`、`settings/select/scrim #1F1B1752`。保留不等于跳过成对颜色校验：尤其亮色 Night primary 上的 on-primary、危险文字与 disabled 区分，需按实际前景/背景组合验证；若失败应记录具体组合，不以“Night同值”作为全局换色理由。

23项非runtime基础 `color/paper`、`color/text/ink` 等保留作为当前基础层事实，迁移时不能把这些变量当成模式化 AppPalette 的最终颜色。业务应引用显式语义角色，防止旧基础 Day 别名漏入 Night。

## 完整 88 项解析结果

| Figma 变量 | Day | Night | 模式差异 |
|---|---|---|---|
| color/paper | #FFF8F4FF | #FFF8F4FF | 同值 |
| color/paper/bright | #FFF8F1FF | #FFF8F1FF | 同值 |
| color/surface | #FFFFFFE0 | #FFFFFFE0 | 同值 |
| color/surface/soft | #FFFCF8B8 | #FFFCF8B8 | 同值 |
| color/text/ink | #1F1B17FF | #1F1B17FF | 同值 |
| color/control/ink | #41484CFF | #41484CFF | 同值 |
| color/text/muted | #756F69FF | #756F69FF | 同值 |
| color/border/default | #C1C7CDFF | #C1C7CDFF | 同值 |
| color/action/primary | #2D4A3EFF | #2D4A3EFF | 同值 |
| color/action/primary-dark | #1F3528FF | #1F3528FF | 同值 |
| color/accent | #F48B13FF | #F48B13FF | 同值 |
| color/navigation/bottom-bg | #FBF2EBFF | #FBF2EBFF | 同值 |
| color/control/floating-bg | #FBF2EBFF | #FBF2EBFF | 同值 |
| color/control/floating-bg-alt | #EAE1DAFF | #EAE1DAFF | 同值 |
| color/meta/bg | #F5ECE6FF | #F5ECE6FF | 同值 |
| color/control/field/surface | #FFF8EFD1 | #FFF8EFD1 | 同值 |
| color/control/field/border/default | #C1C7CDFF | #C1C7CDFF | 同值 |
| color/control/field/border/hover | #87928DFF | #87928DFF | 同值 |
| color/control/field/border/focus | #2D4A3EFF | #2D4A3EFF | 同值 |
| color/control/field/surface/disabled | #EAE1DA9E | #EAE1DA9E | 同值 |
| color/control/field/text/disabled | #928B84FF | #928B84FF | 同值 |
| color/control/field/border/error | #D7473EFF | #D7473EFF | 同值 |
| color/control/field/border/success | #338144FF | #338144FF | 同值 |
| color/runtime/paper | #FFF8F4FF | #24211EFF | 不同 |
| color/runtime/paper/bright | #FFF8F1FF | #2C2824FF | 不同 |
| color/runtime/paper/solid | #F8F4ECFF | #1C1A18FF | 不同 |
| color/runtime/surface | #FFFCF8E5 | #2A2622E5 | 不同 |
| color/runtime/ink | #1F1B17FF | #EADFCEFF | 不同 |
| color/runtime/muted | #756F69FF | #BAAD9CFF | 不同 |
| color/runtime/border | #C1C7CDFF | #E2D1B933 | 不同 |
| color/runtime/primary | #2D4A3EFF | #D2BD96FF | 不同 |
| color/runtime/primary/dark | #1F3528FF | #7A684FFF | 不同 |
| color/runtime/on/primary | #FFFAF4FF | #FFFAF4FF | 同值 |
| color/runtime/accent | #F48B13FF | #D69B5FFF | 不同 |
| color/runtime/forest | #367A4DFF | #367A4DFF | 同值 |
| color/runtime/danger | #D62222FF | #D62222FF | 同值 |
| color/runtime/surface/panel | #FFFCF89E | #FFFCF89E | 同值 |
| color/runtime/surface/panel/soft | #EEE6DBA3 | #EEE6DBA3 | 同值 |
| color/runtime/surface/elevated | #FFFFFFC7 | #FFFFFFC7 | 同值 |
| color/runtime/surface/solid | #FFFCF8EB | #FFFCF8EB | 同值 |
| color/runtime/surface/translucent | #FFFCF86B | #FFFCF86B | 同值 |
| color/runtime/surface/field | #FFF8EFC7 | #FFF8EFC7 | 同值 |
| color/runtime/surface/disabled | #EEE6DBC2 | #EEE6DBC2 | 同值 |
| color/runtime/line | #9B84662E | #9B84662E | 同值 |
| color/runtime/line/strong | #B4A69757 | #B4A69757 | 同值 |
| color/runtime/line/hard | #BEAE9C66 | #BEAE9C66 | 同值 |
| color/runtime/primary/soft | #2D4A3E17 | #2D4A3E17 | 同值 |
| color/runtime/primary/bg | #2D4A3E1F | #2D4A3E1F | 同值 |
| color/runtime/primary/strong | #2D4A3E47 | #2D4A3E47 | 同值 |
| color/runtime/primary/border | #2D4A3E6B | #2D4A3E6B | 同值 |
| color/runtime/shadow/soft/warm | #5C47320D | #5C47320D | 同值 |
| color/runtime/shadow/dark | #0000001F | #0000001F | 同值 |
| color/library/inline-route-bg | #FFFCF8A3 | #2A2622B8 | 不同 |
| color/library/source-action-bg | #2379A41A | #2379A42E | 不同 |
| color/library/detail/divider | #B4A69747 | #E2D1B933 | 不同 |
| color/library/action-border | #B4A6976B | #E2D1B947 | 不同 |
| color/library/action/on-primary | #FFFFFFFF | #FFFFFFFF | 同值 |
| color/settings/icon-bg | #2379A417 | #2379A429 | 不同 |
| color/settings/row-divider | #B4A69738 | #E2D1B92E | 不同 |
| color/settings/switch-off | #C1C7CDFF | #5C6065FF | 不同 |
| color/settings/switch-thumb | #FFFFFFE0 | #FFFCF8E0 | 不同 |
| color/settings/action-bg | #2379A41A | #2379A42E | 不同 |
| color/settings/status-good-bg | #2B895C21 | #2B895C38 | 不同 |
| color/settings/status-good | #28704EFF | #54B080FF | 不同 |
| color/settings/status-warn-bg | #B0661D24 | #B0661D3B | 不同 |
| color/settings/status-warn | #8C521DFF | #DC9E53FF | 不同 |
| color/settings/status-info-bg | #2379A421 | #2379A438 | 不同 |
| color/settings/status-info | #2D4A3EFF | #D2BD96FF | 不同 |
| color/settings/status-muted-bg | #8C82761F | #8C827633 | 不同 |
| color/settings/status-muted | #756F69FF | #BEB2A5FF | 不同 |
| color/source-management/elevated-border | #B4A69761 | #E2D1B942 | 不同 |
| color/source-switch/window | #FFFCF8FF | #221F1CFA | 不同 |
| color/source-switch/border | #9B84663D | #E2D1B933 | 不同 |
| color/source-switch/divider | #9B84662E | #E2D1B929 | 不同 |
| color/source-switch/selected | #2D4A3E14 | #86B49B1F | 不同 |
| color/source-switch/name | #2B241DFF | #E8DED1FF | 不同 |
| color/source-switch/chapter | #332C25FF | #E1D6C9FF | 不同 |
| color/source-switch/muted | #8D8378FF | #B9AEA2FF | 不同 |
| color/source-switch/header-meta | #5B5046FF | #C3B8ADFF | 不同 |
| color/source-switch/close-bg | #EEE6DB6B | #554D4580 | 不同 |
| color/settings/select/surface/top | #FAF7F2FF | #FAF7F2FF | 同值 |
| color/settings/select/surface/bottom | #F5F0E8FF | #F5F0E8FF | 同值 |
| color/settings/select/card | #FFFCF8FF | #FFFCF8FF | 同值 |
| color/settings/select/chevron | #B0A99FFF | #B0A99FFF | 同值 |
| color/settings/select/trigger/surface | #2D4A3E0F | #2D4A3E0F | 同值 |
| color/settings/select/selected/surface/phone | #2D4A3E0E | #2D4A3E0E | 同值 |
| color/settings/select/selected/surface/tablet | #2D4A3E0F | #2D4A3E0F | 同值 |
| color/settings/select/scrim | #1F1B1752 | #1F1B1752 | 同值 |

## 实施门禁

1. 导出/注册时记录Figma集合、变量ID、模式ID、版本时间与来源；直接复用值和补齐候选来源分开。
2. 全88项无缺失/别名环/未解析；AppPalette角色覆盖所有应用页面和控制层状态。不能只改TOK常量而漏硬编码、SVG固定色、渐变/描边/阴影/disabled/选中态。
3. 日夜截图矩阵至少包括书架主面、More、单书菜单、筛选、搜索、导入、设置、快捷/完整控制、胶囊，覆盖常态/选中/禁用/失败。
4. 应用/阅读主题关联规则按用户已定双向联动执行；同类型阅读选择不得取消跟随系统。
5. 表面alpha保留当前作用层，按实际叠层检查；阅读背景变化不应污染应用配色的色值定义。
6. 此记录证明当前Figma颜色事实及可实施候选，不代表代码、VM、设备或用户验收完成。

