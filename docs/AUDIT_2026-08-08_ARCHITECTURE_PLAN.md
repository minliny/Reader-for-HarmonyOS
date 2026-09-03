# 架构方案全量审计报告 — 2026-08-08（含同日复核）

> **历史架构审计，不是当前待开发清单。** 本文保留当时缺陷、偏差和验证边界；其中建议和 OPEN 项
> 不得直接作为当前任务。唯一待开发清单见
> [`../../DEVELOPMENT_BACKLOG.md`](../../DEVELOPMENT_BACKLOG.md)，禁止在本文追加当前待办。

上游: `Reader-UI/docs/FIGMA_NATIVE_UI_ARCHITECTURE_PLAN.md`（四层架构方案）
对照: `Reader-UI/docs/FIGMA_NATIVE_UI_EXECUTION_PLAN.md`（执行方案）
对象: `Reader-for-HarmonyOS/entry/src/main/ets`（代码）+ Figma 文件 `klhs2jMM4MncaJFqZMfqEK`（设计）
方法: 代码 grep/静态核对 + Figma devmode MCP 逐节点读取（不凭旧文档）。本版为 2026-08-08 同日复核更新，工作树较初版再前进（Batch 5/6 P 收敛 + 内容宽度已收敛）。

---

## 结论摘要

**总体判断: 架构方案已大比例落地，代码侧 Batch 0–4 已提交、Batch 5/6 收敛进行中（未提交），当前工作树编译通过（assembleHap `BUILD SUCCESSFUL`，覆盖最后改动）。** 初版记的"内容宽度页私有常数分歧"已被 Batch 5/6 收敛解决（8 页全部直引 Token）。仍存 **3 处真实缺陷（D1/D2/D3）**、**5 处文档化偏差**、**2 处验证缺口**。Figma 侧 F1 Shell 未接线 + ControlSheet 内部绝对定位 经复核仍成立，均已有 defer 决策。完整验收清单（§十七）尚未全绿。

| 维度 | 判定 | 关键证据 |
|---|---|---|
| 架构 | 🟡 达标 | 四层结构成立；Shell 接线；Index 已瘦身 |
| 参数 | 🟡 基本达标 | Token 分类+来源标记；无二次别名；内容宽已收敛；存 D1/D2 值漂移 |
| Figma | 🟠 部分达标 | 唯一源成立；ControlSheet 内部绝对定位；F1 Shell 未接线 |
| HarmonyOS | 🟡 达标 | 固定宽字段已移除；安全区归 Shell；生产文件全入版本控制；编译通过 |
| 视觉 | 🟡 未验证全 | 描边收敛中；D3 方向分隔线 ~10 处 0.5/1 混用；四视口未穷尽 |

---

## 一、代码侧（HarmonyOS）审计

### 1.1 架构（§一/§七/§十四/§十七·架构）— 🟡 达标

- **四层结构成立**。`features/common/`（Tokens/Shared）= Shared Components；`features/shell/`（MainTabShell/SettingsShell/ReaderShell）= Shell；`features/{bookshelf,discover,rss,settings,sync,source,search,reading}/` = Pages。
- **Shell 已接线**（§七验收"页面不复制公共骨架"）:
  - `MainTabShell` ← BookshelfPage:53 / DiscoverPage:62 / RssPage:119
  - `SettingsShell` ← SettingsPage:70
  - `ReaderShell` ← Index.ets:314
- **Index.ets 已瘦身**（原 1222 行单体 → 现 1191 行，其中 build() 为纯路由分发，逐页挂载 BookshelfPage/DiscoverPage/RssPage/SettingsPage/ReaderShell）。主页面不再自行实现 BottomNav。
- **页面独有内容未强制组件化**（§十二"不强制"）——selectRow/dangerRow 保留页私有，符合。

**复核更新（2026-08-08）**: 该残差已由 Batch 5/6 P 收敛解决。8 页已删页私有内容宽 const，统一直引 `TOK_CONTENT_MAX_W_PHONE=352` / `TOK_CONTENT_MAX_W_TABLET=720` / `TOK_CONTENT_RAIL_W_TABLET=620`（ledger P 有记录）。**唯一例外**: `SearchPage.ets:672` 手机档返回硬编码 `390`（Search 手机全宽保留特例，ledger 已记录），非 bug，但为裸数字、无具名 Token，可溯性弱，建议命名。

### 1.2 参数（§四/§十三/§十七·参数）— 🟡 基本达标（存在 D1/D2）

- **ReaderTokens.ets 已 13 分类 + 来源标记**（`// Figma: collection/name` 或 `// HarmonyOS calibration`），符合 §十三。
- **页面二次别名大幅清除**。Batch 1（H3）已清 29 处；执行方案 §3 目标"grep 无页面级 TOK 二次别名"已达成（本次 grep 未发现 `const X = TOK_Y` 页面别名）。
- **残留页私有视觉直接值**（H3 政策保留，非 Token 二次 alias）:
  - RssPage 15 / SyncPage 10 / SourceManagementPage 8 / DiscoverPage 5 / SearchPage 2 个页级 `const X = '#...'` 色常量。
  - 此类"页面独有叶子色"方案 §四允许。**但其中两类超出"页面独有"边界，本次复核判为真实缺陷**:
    - **D1 · RssPage 分隔线值漂移**: `ROW_DIVIDER='#33B4A697'`（alpha 0.2）≠ 共享 `TOK_ROW_DIVIDER='#38B4A697'`（alpha 0.22）。页面复制"公共分割线"（§四禁止）且值不一致。
    - **D2 · SyncPage 重复共享 Token 值**: `ICON_BG='#172379A4'` **完全等于** `TOK_SETTING_ICON_BG`（应直引，token 注释明言用于去重却漏此一处）；`EXPAND_BG='#A3EEE7DB'` 与 `TOK_SURFACE_PANEL_SOFT='#A3EEE6DB'` 仅 1 值漂移（E7 vs E6）。

### 1.3 HarmonyOS 布局（§三/§八/§十七·HarmonyOS）— 🟡 达标

- **ReaderControlPanel 固定画布宽字段已移除**。`ReaderControlGeometry` 现为 `dockMaxW/topBarMaxW`（constraintSize 上限）+ `sheetH/sheetRadius*`，无 `dockW/sheetW/mainW/progressW/chapterRowW/sliderW`。控制面板 `position` 调用 === 0（§八验收达成）。
- **全局 `position` 残量全部合法**（§三"仅叠放层允许"）:
  - `LocalReadingExperience.ets:435` 手势分栏 tap 层（阅读手势捕获层）
  - `LocalReadingExperience.ets:498` 离屏文本测量段落
  - `ReaderFullDirectory.ets:141` 目录 TopBar 锚定
  - `LocalBookDetail.ets:316` contentWidth 派生的徽标装饰
  - `NoCoverCover.ets` / `BookshelfEmptyCard.ets` 封面比例装饰 / 空态插画
  - `ReaderToggle.ets:23` 开关滑块位移
- **MainTabBar width('100%') + layoutWeight(1)**（§九，原 `.width(360)` 已改）。
- **安全区归 Shell**（§十七·HarmonyOS"Safe Area 由 Shell 管理"）: ReaderShell 独立管理阅读区安全区；Index.ets:366 明示"阅读路由的顶部 inset 由 ReaderShell 处理"。

### 1.4 版本控制（§十七·HarmonyOS"生产文件全进版本控制"）— ✅ 达标

- 42+ 个生产 ets 文件全部 tracked；`entry/src/main/ets` 下 **0 untracked**。
- 当前 **18 个文件未提交**（Batch 5/6 描边 Token 收敛 + 内容宽收敛 + 2 个 docs），分支 `feat/reader-module-directory-a2`。这是**进行中的未提交工作**，非版本控制缺漏，但按执行方案 §2 应尽快固化为基线 commit。

### 1.5 描边 Token 收敛（Batch 5/6，未提交）— 🟡 进行中

- 当前工作树编译通过（`BUILD SUCCESSFUL`×4, 02:12–02:19, 产 signed+unsigned HAP, 0 error），覆盖最后改动。
- `TOK_BORDER_W = 1`（HarmonyOS calibration）已定义并应用到 11 文件四周 `border({width:1})`。无页面级 `TOK` 二次别名（§十三达成）。
- **发现 D3: 方向分隔线未统一（~10 处，较初版记录的 4 处增多）**，宽度 0.5/1 **混用**:
  - `{top:1}`: SettingsPage:202 / CategoryRow:47 / LocalBookDetail:349（后者还内联色 `#47B4A697`，非 Token）
  - `{bottom:1}`: CandidateRow:82
  - `{top:0.5}`: DiscoverPage:373 / SourceManagementPage:282 / RssPage:488·589
  - `{bottom:0.5}`: SearchPage:191·206·371·504
  - 这些 `{top}/{bottom}` 方向分隔线与已收敛的四周 `TOK_BORDER_W` 不同维度，P 收敛未覆盖。若方案要求"描边/分割线统一 Token"，此为遗漏（宽度 0.5 vs 1 有实视觉差）；若视为分隔线私有，需在 ledger 明示政策。
- **共享组件级内联色**: `SourceSwitchWindow.ets`（Batch 4 共享组件）内联 `#FFFCF8`/`#8D8378`/`#6BEEE6DB`/`#1A9B8466`/`#0D9B8466`/`#C8BFB5`，未用 Token — 共享组件应走 Token，建议核查。

---

## 二、Figma 侧审计

### 2.1 唯一组件源（§六/§十七·Figma）— 🟢 达标

逐节点核对（devmode MCP 实读）:

- **主导航**（§九）: `Navigation/MainTabItem`(342:175) 单源，8 变体（Viewport×State×Interaction）；`Navigation/BottomNav`(344:379) 单源，8 变体（Viewport×ActiveTab），全部由 MainTabItem 实例装配。**无 Phone/Tablet 复制整页。**
- **阅读控制层**（§八）: `Reader/Responsive/ControlSheet`(1023:18713) COMPONENT_SET（Phone/TabletExpanded 两变体），由 `ControlMain`(1023:18704) + `BrightnessRail`(1023:18605) instance 装配；ControlMain 又由 QuickActionPanel + ChapterProgress instance 装配。**唯一源成立**，无整窗复制。
- **换源**（§十一）: `SourceSwitch/Window`(568:134) COMPONENT_SET，7 态共享 WindowHeader/CandidateList/ColumnHeader/FooterMeta instance，仅 StateBody 逐态不同。**唯一源成立。**

### 2.2 变量/Token（§五/§十七·Figma）— 🟢 达标

- 设计上下文显示组件均绑定 `var(--reader-control-*)`、`var(--fd-*)` 语义变量，未发现脱离变量的硬编码公共视觉。
- 12 变量集 505 变量此前已核对；F2 记录 11 Final 实例 SOLID 填充绑定率 67–86%，未绑为透明/白/页面特定棕。

### 2.3 关键缺口 — ControlSheet 内部绝对定位（§八/§十五）

- `Viewport=Phone / Reader/Responsive/ControlSheet`(1023:18714) **内部为绝对定位**:
  - `ControlMain` → `absolute left-[12.44px] top-[28.44px] w-[286px]`
  - `BrightnessRail` → `absolute left-[312.44px] top-[28.44px] w-[38px]`
  - `ControlSheet` 本体 `w-[364px]` 固定宽（非 Fill）
- 方案 §八 明确: ControlDock Width=Fill / max width / Height=Hug / Bottom center；ControlSheet Width=Fill；ControlContent Main=Fill + BrightnessRail 语义固定宽 + Gap Token。**均未兑现**。
- 方案 §三 禁止"固定 x/y 表达普通内容布局"——ControlSheet 正属此类。
- **影响**: 仅 Figma 文件内部架构卫生；HarmonyOS 侧控制层已由 H1 实现自适应（40→0 position），运行不受影响。F2 已记录"转换 auto-layout 为高风险 polish，故不改"——**这是方案与 Figma 落地的明确分歧**。

### 2.4 关键缺口 — F1 Shell 未接线（§七/§十五）

- `Shell/MainTabShell`(277:6) / `Shell/ReaderShell`(277:34) / `Shell/SettingsShell`(277:49) 均 VERTICAL auto-layout，**但全文件 0 实例**（本次核对 277:6 为 isolated symbol，无任何 Final 引用）。
- `Page/Bookshelf`(941:3) **手绘整个 shell 结构**: 手绘状态栏(940:4) + `AppTopBar/Phone` instance + 手写 Container + `BottomNav/Phone` instance，**不走 Shell/MainTabShell**。
- 方案 §十五要求 Final 页"使用正式 Shell"——**未满足**。
- **影响**: 仅 Figma 内部架构；HarmonyOS 自有 Shell 为真实消费方且已与 Final 视觉对齐。L1 已记录 2026-08-08 用户决策 = **暂不重接，待本地完成后以本地为模板修 Figma**。

### 2.5 其他 Figma 观察

- 书架封面网格（941:3 内 BookItem ×11）用**绝对 x/y 坐标**排布（x=0/126.656/253.328, y=0/206.296/430.875...），非 Auto Layout（§十五"页面独有内容使用 Auto Layout"）。书架网格为动态列表，代码侧用 List 呈现，Figma 静态装配网格数字坐标属演示性质，但严格对照 §十五未达标。

---

## 三、对照 §十七 验收清单逐项

| 验收项 | 状态 | 说明 |
|---|---|---|
| 全部生产页面根布局自适应 | ✅ | 控制层/导航/页面均无固定画布宽字段 |
| 普通内容不依赖绝对坐标 | ✅ | 残量均为合法叠放/装饰/测量层 |
| 公共结构单一语义源 | ✅ | MainTabItem/BottomNav/ControlSheet/SourceSwitch 均单源 |
| 页面不复制公共骨架 | ✅ | 三 Shell 已接线 |
| Phone/Tablet 共享语义体系 | ✅ | Figma 变体 + 代码 isTablet 分支共享组件 |
| Reference-only 不进入生产 | ✅ | 无引用（本次未发现） |
| 共享可调参数集中管理 | ✅ | Token 分类完成；内容宽度已收敛（8 页直引 Token），仅 Search 390 特例 |
| 页面无共享视觉直接值 | 🟡 | 页私有叶子色保留（H3 政策）；**D1 分隔线漂移 + D2 SyncPage 重复 Token 值** |
| 组件私有参数只在唯一源 | ✅ | |
| 平台校准与设计参数分离 | ✅ | TOK_BORDER_W 标记 calibration |
| 未定义模式保持 UNSPECIFIED | ✅ | 未发现复制默认值冒充完成 |
| 改共享组件更新全部生产实例 | 🟠 | **Figma: F1 Shell 0 实例未兑现**；代码侧成立 |
| 改共享变量更新全部合法消费者 | 🟡 | 绑定率非 100%（67–86%） |
| Final 不阻断继承 / 无 detach | ✅ | 实例化装配为主 |
| 无公共视觉 override | 🟠 | 书架封面网格绝对坐标 |
| 视口变化不依赖复制整页 | ✅ | 变体制 |
| 修改共享组件/Token 更新全部本地消费者 | ✅ | |
| 页面宽度变化不溢出 / 动态文本不破坏布局 | 🟡 | Phone+Tablet 已验证；Compact/中间宽度未验证 |
| Safe Area 由 Shell 管理 | ✅ | |
| 页面不重复实现 BottomNav/TopBar/ControlSheet | ✅ | |
| 生产文件全进版本控制 | ✅ | 42 tracked, 0 untracked（18 个进行中未提交） |
| 共享表面颜色/描边/间距/图标/字体一致 | 🟡 | 描边收敛中；**D3 方向分隔线 ~10 处 0.5/1 混用** |
| 响应式重排符合设计 | 🟡 | 仅 2 离散宽度验证 |
| 平台差异有局部校准 | ✅ | TOK_BORDER_W |

---

## 四、审计发现清单（按严重度）

### 代码侧 — 真实缺陷（本次复核新增）
1. **🟡 D1 · RssPage 分隔线值漂移**（§四"公共分割线"禁止 + 漂移）: `ROW_DIVIDER='#33B4A697'`（alpha 0.2）≠ 共享 `TOK_ROW_DIVIDER='#38B4A697'`（alpha 0.22）。页面复制共享分隔线且值不一致。
2. **🟡 D2 · SyncPage 重复共享 Token 值**（§十三）: `ICON_BG='#172379A4'` 完全等于 `TOK_SETTING_ICON_BG`（应直引）；`EXPAND_BG='#A3EEE7DB'` 与 `TOK_SURFACE_PANEL_SOFT='#A3EEE6DB'` 1 值漂移。
3. **🟡 D3 · 方向分隔线未统一（~10 处，初版记 4 处）**: `{top:1}`/`{bottom:1}`/`{top:0.5}`/`{bottom:0.5}` 硬编码宽 0.5/1 混用；`LocalBookDetail:349` 内联色 `#47B4A697`。需政策决策（归 Token 或标记私有）。
4. **🟡 共享组件内联色**: `SourceSwitchWindow.ets`（Batch 4 共享组件）内联 `#FFFCF8`/`#8D8378`/`#6BEEE6DB`/`#1A9B8466`/`#0D9B8466`/`#C8BFB5`，未走 Token。

### 代码侧 — 文档化偏差（H3 政策 / Search 特例）
5. **🟡 页私有色常量**（H3 政策保留）: Rss(15)/Sync(10)/SourceMgmt(8)/Discover(5)/Search(2)。对"页面独有叶子色"符合 §四，但 D1/D2 超出该边界。
6. **🟢 SearchPage:672 硬编码 `390`**: 文档化特例（"Search 手机 390 全宽保留"），非 bug；裸数字无具名 Token，建议命名。

### 代码侧 — 流程
7. **🟡 18 个文件未提交**: 进行中的 Batch 5/6 工作 + 2 docs，分支 `feat/reader-module-directory-a2`。按执行方案 §2 应固化为基线 commit。

### Figma 侧（复核仍成立，已 defer）
8. **🟠 F1 Shell 未接线**（§七/§十五）: 三 Shell master auto-layout 但 0 实例，Final 页手绘 shell。已记录用户决策 defer。**方案"Final 使用正式 Shell"未兑现。**
9. **🟠 ControlSheet 内部绝对定位**（§八/§三）: MCP 复核确认 ControlMain/BrightnessRail 用 `absolute left/top`，ControlSheet `w-[364px]` 固定宽非 Fill。已记录 F2 决策不改。**方案 §八 Figma 布局参数未兑现。**
10. **🟠 书架封面网格绝对坐标**（§十五）: 演示性静态网格排布非 Auto Layout。

### 验证缺口（BLOCKED）
11. **🟠 四视口未穷尽**（§十七·视觉）: 仅 Phone(Pura 90 竖) + Tablet(横) 两离散宽度；Compact Landscape / 中间宽度未验证。L3。
12. **🟠 H4 换源 6 态视觉未真机核验**（§十一）: 模拟器无在线书源，换源入口被设计性阻断。L2。

---

## 五、建议

1. **立即**: 将 18 个未提交文件固化为基线 commit（执行方案 §2 Batch 0 门禁）。
2. **决策点 A（D1/D2）**: RssPage `ROW_DIVIDER`、SyncPage `ICON_BG`/`EXPAND_BG` → 改直引共享 Token（消漂移），§四/§十三 硬性要求。
3. **决策点 B（D3）**: 方向分隔线宽度统一 — 归 `TOK_BORDER_W` 或新增方向分隔线 Token，并定义 0.5（hairline）是否合法。
4. **决策点 C（页私有色）**: 正式声明为"一次性结构"并在 ledger 明示（H3 已有），补 ROW_DIVIDER 除外项。
5. **Figma（已 defer）**: 按用户 2026-08-08 决策，本地开发完成后以本地为模板重接 Shell + 修 ControlSheet auto-layout。当前不作为阻断。
6. **验证**: 待在线书源环境解锁 H4 6 态；待多尺寸设备集解锁四视口。

---

*审计基于 2026-08-08 工作树（编译 BUILD SUCCESSFUL 覆盖）+ Figma 实读。Figma 结论见于 ledger F1/F2 决策一致。*
