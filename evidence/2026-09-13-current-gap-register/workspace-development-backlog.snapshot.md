# Reader 唯一待开发清单

> 生效日期：2026-09-01  
> 权威范围：Reader 产品与跨仓开发待办的唯一入口。  
> 其他 `AUDIT_*`、设计说明、实施切片、状态账本和 `LEGACY_ISSUES.md` 只保留时点证据、专项合同或历史决策，
> 其中出现的 `OPEN`、`TODO`、缺口、实施顺序和“下一步”均不得直接作为当前任务；必须先按当前源码重新核验，再写入本文件。

## 1. 维护规则

1. 当前待开发内容只写在本文件，不再新建第二份 TODO、Backlog、Roadmap、阶段计划或遗留问题清单。
2. 审计文档可以记录当时发现，但只能链接本文件中的任务 ID，不能自行维护另一套当前状态。
3. 每项任务区分产品决定、当前源码、待开发内容和验收条件；不得把设计建议写成用户决定。
4. 源码测试、HAP 构建、VM、真机和用户验收分别记录，不互相替代。
5. 当前工作树已有并行未提交修改。任务状态必须绑定实际提交或明确工作树，不从旧审计自动继承。
6. 旧文档中的待办必须迁入本文件后才能冻结旧文档；不能因为尚未完成现场复核就从总表删除。

状态定义：

- `CONFIRMED`：用户已确认产品口径，可以进入设计或实现。
- `ACTIVE-WORKTREE`：当前工作树已有进行中的实现或合同，但尚未完成全部证据。
- `ACTIVE`：实现或修复任务进行中；源码可以已提交，不能据此视为验收完成。
- `REVERIFY`：历史审计确认过缺口，尚未按 2026-09-01 当前源码、构建或设备重新核验；保留待办，不视为完成。
- `EVIDENCE`：功能可能已接线，但仍缺指定构建、VM、真机或用户验收。
- `LATER`：明确保留的后期能力。
- `DECISION`：进入开发前仍需产品确认范围。
- `NO-GO`：仅用于候选库选型，表示本次采用试验已经退出；不表示所属产品能力完成或被取消。

## 2. 已确认产品口径

### 2.1 搜索

- 全应用只保留一个书籍搜索入口，对应一套完整搜索系统。
- 默认搜索`全部`，一次搜索覆盖本地导入书籍和在线书籍。
- 搜索结果使用`全部`、`本地`、`在线`标签筛选；标签只过滤同一次搜索结果，不切换搜索系统。
- `本地`专指用户本地导入的书籍，不等同于“已加入书架”。
- 在线结果需要标注是否`已在书架`。
- 搜索离开前台按 Legado 语义暂停新书源派发，保留本次结果、游标、分类与列表位置；已派发请求完成，返回后继续原会话。逻辑退出或停止释放尚未开始的查询工作。
- 已启动的详情、目录和正文获取由独立任务持有，页面切换不取消；搜索结果按受限并发提前准备目录与首个可读章节，阅读请求优先。
- 搜索、详情、换源和阅读共用 Core 按“书源＋书籍”保存的候选与获取事实；完整规则版本隔离缓存。明确区分已发现、目录就绪、指定章节可读、失败与过期，打开换源页不重新全源搜索。

### 2.2 书架顶栏与工具栏

- 顶栏保留统一搜索入口和更多入口。
- 更多入口使用**竖向三点**图标。三点只是图标语义，不代表弹出菜单必须有三项。
- “我的书架”工具栏固定保留四个图标：宫格模式、列表模式、筛选、书架整理。
- 工具栏不再出现第二个搜索图标。

### 2.3 分组第一版

- 第一版只实现系统分组`默认`，不提供自定义分组的新建、重命名、排序、显示/隐藏或删除入口。
- 每本书第一版均归属`默认`；分组选择是单选语义。
- 书架整理按钮只弹出一个分组选择栏，不进入独立的“书架数据管理”页面。
- 当前第一版选择栏只显示`默认`；点击后只展示所选分组内的书籍。
- 书籍详情页在书源信息下方增加一行分组信息，第一版显示`分组：默认`。
- 长按书籍卡片弹出的选项栏增加`编辑分组`，并复用同一个分组选择栏。

### 2.4 后期分组扩展

- 自定义分组属于后期开发项，第一版不显示任何相关控件。
- 后期一本书仍只属于一个分组。
- 后期删除自定义分组时，其中书籍自动移入系统分组`默认`。
- Core 已存在的自定义分组 CRUD、显示开关和顺序字段仅作为技术储备；第一版产品不能因为底层已有能力而暴露入口。

### 2.5 弹出栏文案

- 弹出栏动作文字保持简短，原则上不超过五个汉字，例如`检查更新`、`导入书籍`。
- 该限制针对弹出操作文案，不限制书名、作者、来源名或其他用户内容。

## 3. 当前源码基线与差异

以下为 2026-09-01 对 `Reader-for-HarmonyOS` 当前工作树的只读核对；它描述差异，不表示任务已经实现。

| ID | 当前源码 | 与已确认口径的差异 |
|---|---|---|
| `SHF-001` | `bookshelf_more.svg` 为横向三点 | 需要替换为与现有图标体系一致的竖向三点资源，并复核 Phone/Tablet 命中区与无障碍名称 |
| `SHF-002` | `BookshelfMoreMenu.ets` 当前有`批量管理／分组管理／本地导入／书架设置`四项 | 图标数量与菜单项数量必须解耦；菜单最终内容尚未确认，不能以“三点”推导“三个按钮” |
| `SHF-003` | 书架工具栏当前有宫格、列表、筛选、搜索、设置五个图标 | 删除工具栏搜索，只保留已确认的四个图标 |
| `SHF-004` | 筛选行从书籍现有 `group` 动态投影，并混入`检查更新`动作 | 第一版分组来源固定为系统`默认`；书架整理单独打开分组选择栏，更新动作不得伪装成分组选项 |
| `SHF-005` | 书架整理当前路由到 `BookshelfManagementPage`，页面暴露分组 CRUD、显示开关、顺序、阅读统计和原始实体信息 | 第一版取消该产品入口，改为单一分组选择栏；底层扩展能力保留但不展示 |
| `SHF-006` | `ShelfBook.group` 为空时 UI 使用“未分组”或空字符串 | 第一版产品统一投影为系统分组`默认`，选择`默认`时筛选这些书籍 |
| `SHF-007` | `LocalBookDetail.ets` 的详情 Hero 只有书源行 | 在书源行下方增加`分组：默认` |
| `SHF-008` | `BookshelfBookActionSheet.ets` 只有`多选／书籍信息／移除书架` | 新增`编辑分组`，打开与书架整理相同的分组选择栏 |
| `SEA-001` | 当前搜索页以在线书源范围选择为主，未形成“全部／本地／在线”的统一结果分类 | 按 §2.1 改为单入口、默认全部和结果标签筛选，并接入本地导入书籍结果 |

## 4. 当前开发任务

### P0：书架第一版分组收口

#### `SHF-001` 竖向更多图标

- 使用真实图标资源，不旋转现有横向资源制造近似图。
- 保持现有 44vp 交互区域和清晰的`更多`无障碍名称。

#### `SHF-002` 更多菜单内容冻结

- **待产品确认**：竖向三点弹出后究竟保留哪些动作。
- 当前四项不能因已有源码而自动视为正确；此前提到的“菜单三个具体按钮”只是在询问菜单行动项，
  不是指三点图标必须对应三个按钮。
- 内容确认前不修改菜单业务路由。

#### `SHF-003` 工具栏四图标

- 保留宫格、列表、筛选、书架整理。
- 删除该区域的搜索图标及其重复入口。
- 宫格与列表保留各自选中状态；筛选保留展开状态；书架整理不再跳转管理页。

#### `SHF-004` 单一分组选择栏

- 书架整理点击后弹出轻量选择栏，第一版只有`默认`一项。
- 选择`默认`后，书架仅展示归属`默认`的书籍。
- 不显示新建、重命名、排序、删除、显示开关、阅读统计或 Core 实体 ID。

#### `SHF-005` 取消完整管理页入口

- 书架整理不再路由到 `BookshelfManagementPage`。
- 第一版不展示分组 CRUD、显示开关、排序、阅读统计或原始实体信息。
- 现有页面与 Core 能力可以保留为后期技术储备，但不得从第一版书架界面进入。

#### `SHF-006` 默认分组投影

- UI 和产品投影将空、缺失或旧的未分组值统一解释为`默认`。
- 新导入本地书籍或新加入书架的在线书籍自动归入`默认`。
- 不在第一版调用或暴露 `book-group.create/update/delete`。
- 不破坏 Core 现有字段，为后期自定义分组迁移保留兼容性。

#### `SHF-007` 详情页分组信息

- 在书源信息下一行显示`分组：默认`。

#### `SHF-008` 长按书籍卡片编辑分组

- 长按书籍卡片后，在现有选项栏增加`编辑分组`。
- 点击后关闭书籍操作栏，再打开统一分组选择栏。
- 第一版只能选择`默认`，但回调与状态结构不得写死为无法扩展的布尔值。

### P1：统一搜索系统

#### `SEA-001` 默认全部搜索与结果标签

- 一个搜索请求会话同时得到本地导入和在线结果。
- 默认选中`全部`；`本地`、`在线`只过滤该会话结果。
- 在线结果展示`已在书架`状态。
- 不实现“先搜书架、无结果再搜网络”或两套搜索页面。

### LATER：自定义分组

#### `SHF-L01` 自定义分组扩展

- 后期再设计新建、重命名、排序和删除能力；第一版不得出现灰色占位按钮。
- 一本书只能属于一个分组。
- 删除自定义分组后，成员书籍自动迁移到`默认`，迁移与删除必须是同一可靠事务或具有可恢复边界。
- 启用前必须补产品交互、Core/Host 合同、迁移测试和设备验收，不能仅接通已有 CRUD 页面。

## 5. 验收条件

### 书架静态与交互

- 顶栏只有一个书籍搜索入口和一个竖向更多入口。
- “我的书架”工具栏原生树稳定为四个操作节点：宫格、列表、筛选、书架整理。
- 书架整理不再进入`书架数据管理`页，只弹出包含`默认`的分组选择栏。
- 选择`默认`后，列表只显示该分组书籍。
- 详情页书源信息下方可见`分组：默认`。
- 宫格卡片和列表卡片长按均出现`编辑分组`，并打开同一选择栏。
- 第一版产品界面不存在自定义分组新建、编辑、删除、排序、显示开关或技术实体信息。

### 证据分层

- 源码：定向合同覆盖图标数量、路由、默认分组投影、详情行和长按动作。
- 构建：类型检查及无增量 HAP 通过。
- VM：Phone 完整操作旅程；Tablet 至少验证布局、选择栏和长按入口。
- 真机：触控、长按、返回、弹层互斥与状态保持。
- 用户验收：由用户确认菜单内容、筛选语义和详情信息密度。

## 6. 其余待开发内容

本节恢复此前散落在阶段审计、专项设计、实施合同和遗留清单中的待办。旧文档继续保留细节和证据，
但任务状态只在本文件维护。`REVERIFY` 表示“仍在总表内、开工前复核”，不表示删除、关闭或降级。

### 6.1 当前 Figma 与产品设计

| ID | 状态 | 待开发内容 | 边界与来源 |
|---|---|---|---|
| `FIG-001` | `CONFIRMED` | 修改书架右上角“更多”弹窗的 Figma 样式 | 已建立样式参考节点 `4572:1796`：采用用户 2026-09-01 提供图片的锚点、尖角、圆角、分隔线、阴影和行布局；待用户视觉确认后关闭。图片中的动作名称和三行数量不自动成为产品决定，菜单内容仍由 `SHF-002` 单独确认 |
| `FIG-002` | `REVERIFY` | 书架顶栏与工具栏图标整体复核 | 以最终 Figma 节点核对竖向更多、统一搜索、宫格、列表、筛选和整理的资源、状态色、尺寸及命中区，不能只改单个齿轮或 SVG |
| `FIG-003` | `LATER` | Figma Final 页重接共享 Shell | `Shell/MainTabShell`、`Shell/ReaderShell`、`Shell/SettingsShell` 仍是零实例；待本地应用结构稳定后，以当前应用为模板重排，视觉不得回退 |
| `FIG-004` | `EVIDENCE` | 换源窗口六态视觉验证 | 在可用在线书环境验证 discovering、candidate、switching、success、failure、rollback 等状态，不用本地书或静态组件替代 |
| `FIG-005` | `EVIDENCE` | Phone、Compact Landscape、中间宽度、Tablet 四视口验证 | 覆盖安全区、侧轨、底栏、弹层宽度与横向溢出；旧 Phone 竖屏和 Tablet 横屏证据不足以关闭四视口 |
| `FIG-006` | `LATER` | 目录与全局布局/排版体系复用 | 目录共享组件、全局响应式宽度上下文、Typography 角色迁移，以及 100/1000/5000 章性能基准 |

### 6.2 交付、产物与验收尾项

| ID | 状态 | 待开发内容 | 关闭条件 |
|---|---|---|---|
| `REL-001` | `EVIDENCE` | 健康在线源物理机主旅程复测 | 同一签名 HAP 在物理机连续通过搜索、详情、入架、阅读、中心控制、翻页、目录、系统返回和恢复，并绑定 HAP SHA 与轨迹 |
| `REL-002` | `EVIDENCE` | 单一候选连续完整旅程归档 | 在一个明确候选上完成连续 12 步录像、布局/状态证据和脱敏日志，不能拼接不同构建的局部证据 |
| `REL-003` | `EVIDENCE` | 干净来源与产物身份闭环 | schema v2 manifest、内容 fingerprint、隔离无增量构建、签名/Native/HAP 自校验和 immutable run 已实现；当前两仓 dirty，只完成 iteration 实包验证，仍需 clean Core/Harmony acceptance 构建关闭 |
| `REL-004` | `DECISION` | Reader-Core 与 Reader-Core-Native 双仓关系 | 明确 consolidated Core 的变更如何进入当前 NAPI 基线，禁止两套 Core 状态并行宣称权威 |
| `REL-005` | `EVIDENCE` | 用户验收 D7 | VM、真机和用户体验验收分别记录；没有用户验收不得写“可交付完成” |
| `REL-006` | `REVERIFY` | 发布范围与 HAP 可见范围一致 | RSS、Discover、Sync、规则订阅扩展等非当前产品范围页面要么获得独立准入与验收，要么在发布构建隐藏，不能只因已编译就视为发布能力 |
| `REL-007` | `DECISION` | 历史签名材料轮换与 Git 历史处置 | 当前跟踪文件已改为无密钥基线；确认历史字段是否仍有效并完成外部轮换，再决定是否在协调所有分支/远端后改写历史，日常流水线不得自动执行 |

### 6.3 搜索、书源与内容获取

| ID | 状态 | 待开发内容 | 主要缺口 |
|---|---|---|---|
| `ACQ-001` | `CONFIRMED` | 统一搜索系统 | 按 `SEA-001` 实现默认全部、本地/在线标签筛选和在线结果入架标记；旧范围 chips 和多入口不得形成第二套搜索 |
| `ACQ-002` | `REVERIFY` | 无可用书源引导与返回搜索事务 | 区分无来源、全禁用、列表失败、全请求失败和离线；可进入书源管理，导入/启用后恢复原关键词和搜索意图 |
| `ACQ-003` | `REVERIFY` | 多源可靠性与会话 | 至少覆盖两个正常源、一个失败源和一个需登录源；验证取消、部分失败、Cookie/session 重启保持和失败隔离 |
| `ACQ-004` | `EVIDENCE` | 搜索会话保留与全页面书籍获取同步 | 已实现 Legado 前台派发规则、会话续接、共享目录/正文准备、版本隔离与缓存迁移。当前签名包 `20260910T115401Z-35f2f99a-0c294e4c` 通过 Host 174 组、ArkTS、非增量构建及独立校验，保数据安装；同 VM 搜索/换源首次打开/等待/返回均为 73 源，简介正常，停止进度 36/190、失败 6、全部分类保持，无新增故障。旧 `105602Z` 的 73/61 差异已由共享传递别名索引修复；真实缓存回放 73 源/74 URL 精确一致，3059 原始身份全部保留，7 项并发发布断言通过。VM 总分组306→273与别名归并机制一致，但缺两帧原始身份轨迹，不标逐条守恒实测通过。旧 `013945Z` 主旅程覆盖190源结束、远程正文和前后台恢复；新包沿用该 Native，并行 Core 迁移/后续翻页改动不在包内。仍 OPEN：独立请求/身份轨迹、长时低内存、真机及 clean acceptance。见 `evidence/search-session-repair/identity-repair-verification.json`、`group-count-conservation-review.json` 与主 `verification.json` |
| `SRC-001` | `REVERIFY` | 结构化书源编辑与规则工具 | 当前不能只依赖原始 JSON；结构化编辑、校验、调试和必要的规则辅助需单独设计，不能照搬全部 Legado 字段 |
| `SRC-002` | `REVERIFY` | 主路径死控件清理 | 搜索历史更多、来源 chips、无登录动作的更多图标等必须接真实意图或明确隐藏/禁用 |
| `SRC-003` | `CONFIRMED` | 书源规则订阅与定期分发 | 作为书源管理扩展维护远程书源包；按周期检查版本差异，支持新增书源、更新已有书源、人工确认/静默更新、保留本地分组与启停状态、失败重试和不破坏现有源；不扩展 RSS 文章阅读模型 |

### 6.4 书架、详情与书籍生命周期

- `SHF-001..008` 与 `SHF-L01` 按第 4 节执行，不因恢复其他待办而改变。
- `SHF-009`（`REVERIFY`）：批量目录更新、新章状态和前台更新队列按当前源码复核；“检查更新”不能混入分组筛选标签。
- `SHF-010`（`REVERIFY`）：书籍元数据、封面搜索/更换、书籍信息编辑与缓存管理入口。
- `SHF-011`（`REVERIFY`）：书架进度显示为 `0%` 的显示层缺陷，先确认计算、格式化和旧数据迁移边界。
- `SHF-012`（`LATER`）：全局书签与阅读记录管理；阅读内书签不等于跨书管理页。

### 6.5 阅读、离线与本地书

| ID | 状态 | 待开发内容 | 关闭条件或边界 |
|---|---|---|---|
| `RDR-001` | `EVIDENCE` | 离线阅读、换源、书内搜索与书签设备级闭环 | 下载→断网→跨章→清除；换源提交/回滚/杀进程恢复；搜索跳转；书签重启保持 |
| `RDR-002` | `REVERIFY` | 四类阅读错误恢复 | 无源、网络、解析、无缓存分别提供真实文案、重试或返回动作，不锁死输入 |
| `RDR-003` | `REVERIFY` | 连续滚动中央轻点控制层 | 旧 VM 自动化曾出现连续轻点无法唤出、真机未复现；只在真机复现后进入修复 |
| `RDR-004` | `ACTIVE-WORKTREE` | 仿真翻页与全模式跟手修复 | 原52项完整保留，当前保数据安装 `20260911T120809Z-35f2f99a-a11ccc84`；181组及Native235/538/373/199通过。补齐统一输入/固定槽/Native图片/滚动规范锚点/多指仲裁，新增控制栏浮点误差吞MOVE与异常UP时间戳修复；九次停指采样0px误差。全部证据和未验边界见 Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md，不标全验收 |
| `RDR-005` | `ACTIVE-WORKTREE` | 五模式快速翻页动态净目标 | 四分页效果800不同页跨章往返；4a09 Native无中途UI读的40+40各精确40提交，首事务至末完成7.075/7.053s即5.654/5.671pps，不含事务前准备或实际送显。四效果双向移动后按住、稀疏UP、多指/音量章尾、AutoPage按住到期已验；真实CANCEL/强制Surface丢失/故障写入/物理120Hz仍分开保留 |
| `RDR-006` | `EVIDENCE` | 文本选择、长按与翻页输入所有权 | 快速翻页、控制层、长按选择和退出之间不冲突；VM 只证明功能，真机节奏和手感另验 |
| `RDR-007` | `EVIDENCE` | 段落首行缩进修复的 VM 验证 | 段落、CRLF、共享设置、旧字体回调和复制前缀已修复；Host 171／Core 3609、SDK 39、NAPI及签名包通过。用户授权后完成原 VM Reader 重装恢复，10个持久文件与31表原数据一致；最终同签名 run `20260910T013945Z-35f2f99a-9821e2a2` 保数据安装启动。TXT／EPUB／在线三档缩进、跨页续段、换书重进、原生复制与后台恢复共21项VM断言通过；190源搜索完成1283条、详情往返及56缓存换源候选可用，同进程无新故障。R-01极端测量未证实，真机／用户验收及长期压力仍OPEN。证据：`evidence/paragraph-indent-audit/REPAIR_STATUS.md` |
| `LOC-001` | `EVIDENCE` | TXT/EPUB 正文完整性、目录修复与设备复验 | 重审确认spine/数字标题修复有效，但首次提交后中断会缺书架（根审计§10.10）。新增XHTML属性含大于号、大写SCRIPT及实体字符3类失败，必须用现有scraper/html5ever替换手写扫描核心，保留段落/图片/位置适配（根审计§10.11）；目录基准、链接/排版与交付仍开放 |
| `LOC-002` | `ACTIVE-WORKTREE` | MOBI/KF8 开源解码移植、共享原文件和资源链路 | 本轮13文件/12身份重放具备成功读取证据；一次大书提交30秒超时，单独重试通过，保留稳定性未决。重审确认MOBI图片同步重建全书、成功日志累积、划线位置未迁移与中断恢复缺口；资源读取已接入异步 Native 桥接，但选择器仍为 deferred-partial；UMD、真实语料及设备准入未验收（根审计 §10.10） |
| `LOC-003` | `DECISION` | HTML、Archive、WebDAV 远程书与文件关联 | 有真实导入/分发需求后再按 Harmony Want、分享和安全模型设计；PDF 继续排除 |
| `LOC-004` | `ACTIVE-WORKTREE` | 所有本地格式统一书名、作者与名称候选规则 | 共用规则与用户示例本轮复验通过；公开API复现重导入丢失手动书名、作者、简介和封面，需优先持久化来源/手动覆盖并统一合并。进度/书签迁移通过，划线跨章节迁移保护性拒绝并保留旧记录；完整字段来源/版本、真实语料及交付验证未关闭（根审计 §10.10） |
| `OFF-001` | `REVERIFY` | 离线 Path 2 启动参数失败注入 | 补可复现的 Host 启动失败路径，不能用填满模拟器磁盘或非同层故障代替 |

#### 本地格式补全工作包（LOC-001 / LOC-002 / LOC-004）

范围依据：用户要求所有本地格式使用同一套名称解析，并要求详细分析和补全能力缺口。
本节把目标从后期保留转为可执行工作包；没有把尚未实现的 MOBI/AZW3 宣称为产品已支持。
当前源码和原始证据见 [根审计 §10](AUDIT_2026-08-12.md#10-本地书格式能力与完整性审计2026-09-10)。
实施证据更新见 [根审计 §10.8](AUDIT_2026-08-12.md#108-本地书链路修复与真实样本重放2026-09-10)。
HTML、压缩包、WebDAV 和 PDF 的独立范围决定仍归 LOC-003。

| 工作包 | 归属 | 交付内容 | 依赖与关闭条件 |
|---|---|---|---|
| A. 完整性与错误合同 | LOC-001/002 | 区分元数据探测、完整可读、可恢复警告、无法读取；禁止将文本预览、二进制碎片和诊断占位语作为正常正文入库；结构化报告缺正文、损坏索引、未支持压缩/版本、受保护文件、资源缺失 | 第一优先；覆盖 `import.parse → import.persist` 和旧 `local_book.import` 两条入口；失败不留下可读假书，警告必须有“正文仍完整”的依据 |
| B. TXT/EPUB 基线修复 | LOC-001 | EPUB 以 spine 保证完整阅读顺序，nav/NCX 单独用于目录定位；正确区分 toc/landmarks/page-list、导航文件相对路径、锚点范围；在正文完整可验证时修复损坏目录；TXT 支持数字点号标题并防正文误判 | 与 A 紧邻；现有两个正文文件的合成书不得漏掉末段或重复首段；《终宋》损坏目录的处理需验证全部 spine 正文；《湛蓝权杖》需人工标注少量目录基准 |
| C. 共享原文件、资源和缓存生命周期 | LOC-002 | 将 EPUB 专用原文件保存/恢复/删除和图片读取扩为通用机制；接入并收敛已有 catalog、chapter/resource index、parserVersion 与缓存状态，不另造平行模型 | 保留 Core 业务事实与 Host 文件所有权；导入中断、重启、删除、重新导入和孤儿资源回收均可恢复；图片按需读取；不破坏 TXT/EPUB |
| D. 旧版 MOBI 完整读取 | LOC-002 | 校正 PalmDOC/MOBI 头字段位置和宽度、正文记录范围与编码；完整处理无压缩/PalmDOC 文本、记录尾附加数据、目录、章节、链接、封面和正文图片 | A/C；以真实 MOBI v6/v7 语料和独立生成的完整长书验证首/中/尾，去掉预览上限的同时限制解压与内存，不能只提高常量 |
| E. KF8/AZW3 与 HUFF/CDIC | LOC-002 | 内部版本检测、纯 KF8 与混合容器选择、正文片段/骨架重建、流/资源映射、目录锚点；HUFF/CDIC 作为共享压缩能力单独验收 | 不从 `.mobi` 后缀推断旧版格式：《从红月开始》样本内为 v8；《问道红尘》为真实 AZW3 v8。解码器路线先做小规模正确性、跨编译与内存试验 |
| F. UMD 格式合同与真实语料 | LOC-002 | 独立验证历史格式、压缩块、编码、章节偏移和封面；纠正“样本只按当前解析器生成”的测试闭环 | 当前没有本轮用户目录里的真实 UMD；不能从自制 fixture 通过推导可用，也不能把 fixture 文档的格式描述当成已验证规范 |
| G. 元数据与旧数据迁移 | LOC-004/002 | 书名/作者共用规则；保留原始名称和候选来源，版本/章节范围不混入标题；保留手动修改；按原文件身份和解析版本重建缓存 | 文件内容 hash 身份继续稳定；从旧单章预览升级为全书时，不直接套用旧章节索引/百分比，需用文本位置证据映射并保留无法映射的原记录 |
| H. 分格式准入与设备验收 | LOC-001/002 | 准入矩阵区分格式家族、内部版本、压缩、保护状态和资源能力；同步文件选择器、说明文案、合同测试 | A–G 对应部分完成后按能力开放；至少验证导入、末章、目录/图片、搜索末段、进度/书签、冷启动、低空间和中断恢复；Core/HAP/VM/真机证据分开 |

当前按仓库执行的状态如下，工作包不以测试数量自动关闭：

| 工作包 | 当前落地 | 剩余关闭条件 |
|---|---|---|
| A | Core `LocalBookIntegrity`、解析/提交准入、旧入口原子事务、Host 检查；预览/占位/损坏文件不再正常入架 | 解码错误进一步细分为稳定产品错误；可恢复警告的 UI 呈现和设备失败旅程 |
| B | spine 全覆盖、导航与正文独立、子目录/重复/坏锚点处理；TXT 连续数字标题规则；真实 EPUB/TXT 冷进程读取/末段搜索通过 | TXT 人工标注误判率；链接/脚注与完整样式范围；设备目录定位 |
| C | Host 全格式 `.source` 保留/恢复/删除兼容旧 `.epub`；MOBI 图片共享有界资源读取；同进程复用一次解析，大书回滚正文留在 Core 事务日志中；回滚及删除书籍同步清理相应日志，日志 hash/预算检查改为流式 | catalog/index 持久链收敛；成功导入日志/孤儿资源回收；MOBI 图片请求目前会重新解码原文件，缓存和取消延迟未关闭 |
| D/E | 原错误字段/预览解析器已替换为原样 vendored libmobi 0.12；真实 MOBI、内部 v8 `.mobi`、AZW3 全文以及上游 HUFF/CDIC fixture 通过；CMake/zlib 已接线；OHOS原生构建和3119项Core输入绑定通过；统一交付的 signed iteration HAP `20260910T013945Z-35f2f99a-9821e2a2` 已保数据安装及恢复 | 混合容器、HUFF/CDIC 真实长书与图片/链接的设备证据；LGPL 发布材料需绑定实际源码和二进制；签名问题已解决，现有 VM 交互证据不覆盖完整格式矩阵；新位置迁移代码尚未进入 HAP |
| F | 截断/无正文拒绝，未验证 UMD 输出不进入正常书架；已查看本地/iCloud 下载目录及小说压缩包，未找到真实 UMD | 取得独立真实 UMD，按历史块结构/压缩/编码验证移植；all2epub 候选仅评估，未引入其静默修补损坏数据的路径 |
| G | 同一原文件的唯一原文锚点已接入进度/旧版进度/书签迁移，正文、位置、既有书架元数据和目录摘要原子提交和回滚；保留批注、原文、时间和设备；歧义/缺失/身份不明继续保护性拒绝。真实旧解析器产生的 TXT/EPUB/MOBI/KF8/AZW3 冷位置、书签、书架及回滚5/5通过；最终Core门禁3616/3616及210项conformance通过（审计 §10.9） | 无法映射记录的恢复入口；手动元数据、候选来源/版本与其他位置记录的完整迁移；HAP/设备验证。本批不等同于全部旧数据迁移完成 |
| H | 13 文件/12 内容和8个合成场景已记录输入大小、正文量、章节、耗时、峰值RSS、冷读/搜索/回滚；未扩大选择器 | 同一 manifest HAP 的 picker、图片、末段、书签/进度、低空间/杀进程/取消，VM 与物理机分别验收后才能开放 |

常见无保护文字书为本轮基线；固定版式、词典、多媒体和解密能力不自动纳入。
libmobi 的来源、许可证、编译选项和替换重建说明保留在 Core 的
`third_party/libmobi-0.12/READER_INTEGRATION.md`，Host 包内带 LGPL/GPL/NOTICE 文本。
当前 64 MiB 输入和 256 MiB 解码预算未扩大；本机 CLI 真实样本解析峰值约190 MiB、
冷进程提交峰值约227 MiB。该测量包含进程启动且不是手机预算；按章物化、解码取消和资源缓存
仍需继续压实，不能把解除8192字符预览等同于大书性能验收。

**2026-09-12重新审计更新。** 上表历史构建和性能数字仍绑定当时输入，不作为当前dirty源码的交付证明。
当前源码证据见根审计 **§10.10** 和
[`verification.json`](evidence/local-format-capability-audit/recheck-20260912/verification.json)。
本轮288个去重Core专项用例和3个Host脚本通过；真实旧位置/书签迁移5/5通过，新增划线起止点同事务迁移并确认跨章节保护性拒绝。
当前13文件第一次直接重放12条完整链成功，1次30秒提交超时，独立重试通过；原失败保留。
本轮RSS测量受环境权限限制，没有当前峰值结论，也没有新HAP/设备验收。
工作顺序收敛为：G保护手动元数据并盘点完整位置实体 → C协调Core/文件/书架中断恢复与成功日志收尾 →
C/D/E把MOBI资源重建移出同步调用并补缓存、取消、预算 → A补错误/警告 → F独立UMD语料 → H按能力准入。
其中数据保护和恢复问题同样影响已开放的TXT/EPUB，不能只当作开放MOBI的附加条件。

### 6.6 主题、设置、TTS 与质量

| ID | 状态 | 待开发内容 | 主要边界 |
|---|---|---|---|
| `THM-001` | `REVERIFY` | 阅读域 8 主题浮层配色矩阵 | 核对 21 个面板/浮层和 5 个既有消费者是否已完全接入主题 palette；SourceSwitchWindow/CandidateRow/LatencyBar 不得保留日间硬编码 |
| `THM-002` | `EVIDENCE` | 8 主题 VM 与真机截图验收 | 正文、控制层、界面、设置、目录和换源窗逐主题截图，暗色主题不得残留浅色块 |
| `SET-001` | `REVERIFY` | 设置页无效项与空回调 | App 主题、语言、启动页、动画偏好、书架/搜索设置、关于反馈、权限跳转等要么真实持久并生效，要么移除入口 |
| `TTS-001` | `ACTIVE-WORKTREE` | 系统 TTS 与 HTTP TTS 产品闭环 | 已完成本批 Core 配置扩展、schema18 兼容迁移、请求描述与 Harmony 严格合同；运行时4项、存储262项及两组 Gateway 回归通过。按全量漏洞主任务协调已释放本任务写入；五字段 UI、Host 凭据/POST/PCM 接线、精确速率会话、章节定时、试听、后台/常亮、主题/排版/视觉与首击仍待主任务继续。范围绑定 Reader-for-HarmonyOS/evidence/2026-09-12-make-full-audit/REPAIR_PLAN.md 与 MATRIX.md；未构建/安装本批 HAP，不声明全量完成 |
| `AUT-001` | `REVERIFY` | 自动翻页 | 与手动快速翻页保持独立会话，验证跨章、控制层接管、TTS 互斥和生命周期恢复 |
| `QLT-001` | `REVERIFY` | 挂账显示/解析问题批次 | `[object Object]` 吞 message、qimao 超时、书架进度 `0%`、yqxz 解析逐项复现、归因和回归；简介标签/实体子项已由 ACQ-004 完成共享显示修复、Host 回归及 `115401Z` 同包 VM 可见文字复测，其他子项保持待复验 |
| `QLT-002` | `LATER` | 无障碍、低端机性能和安全硬化 | TalkBack/系统手势、长会话、低端机量化、凭据与日志脱敏、迁移恢复 |

### 6.7 高级阅读与资料管理

| ID | 状态 | 待开发内容 | 准入原则 |
|---|---|---|---|
| `LIB-001` | `LATER` | 稳定文本锚点、划线、笔记和高亮规则 | 先解决选区锚点、章节变更与迁移，再接持久化和全局管理 |
| `LIB-002` | `LATER` | 全局书签与阅读记录 | 补跨书列表、编辑/删除、统计和数据一致性，不以阅读页局部能力代替 |
| `LIB-003` | `LATER` | 字典查询、正文编辑、段评/章评 | 从明确用户价值出发接 Core 能力；不得因 Core 已有命令就自动暴露所有入口 |
| `LIB-004` | `LATER` | 替换、字典与规则包 | 完成产品工作流、导入导出、失败恢复和真实规则验证，不只做 CRUD 页面；书源规则订阅归入 `SRC-003` |

### 6.8 同步、RSS 与独立扩展产品线

| ID | 状态 | 待开发内容 | 进入条件 |
|---|---|---|---|
| `SYN-001` | `DECISION` | 本地备份、WebDAV、进度同步与冲突恢复 | 数据模型稳定后冻结版本、加密、范围、冲突、回滚、保留策略和迁移语义，再独立验收 |
| `RSS-001` | `LATER` | RSS 管理、Feed、收藏、刷新和原文闭环 | 作为后续独立能力规划；真实 feed 的分页、去重、失败、收藏持久化和原文打开需独立里程碑，不进入当前书源管理验收 |
| `EXT-001` | `DECISION` | 漫画阅读 | 页面提取、专用阅读器、图片缓存/下载、手势、内存和真机验收独立立项 |
| `EXT-002` | `DECISION` | 网络音频书与视频 | 不与系统/HTTP TTS 混为一类；明确版权、后台、缓存和媒体控制成本 |
| `EXT-003` | `DECISION` | Web/MCP 服务、自动任务和后台调度 | 明确安全、维护与平台限制后独立立项 |
| `EXT-004` | `DECISION` | 二维码、深链、分享与在线关联导入 | 有真实分发需求后按 Harmony 平台入口与安全模型实现 |

## 7. 迁移来源与删除规则

本总表已恢复下列文档中的开放项：

- `AUDIT_READER_PRODUCT_CAPABILITY_STAGE_2026-08-29.md` 与 2026-08-30 刷新；
- `AUDIT_REAL_BOOK_SOURCE_P0_GAPS_2026-08-29.md`；
- `AUDIT_LEGADO_HARMONY_CAPABILITY_GAP_2026-08-26.md`；
- `AUDIT_NIGHT_THEME_SURFACE_COVERAGE_2026-08-30.md` 与主题配色矩阵；
- `AUDIT_VISUAL_ACCEPTANCE_WORKTREE_GAPS_2026-08-29.md`；
- HarmonyOS `LEGACY_ISSUES.md`、翻页 V2 合同与快速翻页合同。

旧文档不删除，因为它们仍承载设计合同和证据；但不再维护任务状态。任务只能在满足以下任一条件后从本文件移除：

1. 当前源码与所需证据证明已经关闭，并记录对应提交/产物/设备；
2. 用户明确取消或排除该能力；
3. 与另一任务合并，并保留可追溯映射。


## 8. Demo 修复现场更新（2026-09-09）

本节用当前源码覆盖第 3 节的历史差异及相关旧状态；第 2 节产品决定不变。Core 修复提交
`6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`；Harmony 为 `35f2f99a` 上明确包含并行动效工作的共享工作树。
修复从隔离副本经逐文件前置哈希核对同步，控制层由原任务负责。
时点证据见 [根审计记录](AUDIT_2026-08-12.md#9-2026-09-09-demo-修复时点证据) 与
[evidence/demo-repair-20260909/verification.json](evidence/demo-repair-20260909/verification.json)。

| 既有任务 | 当前状态 | 当前实现及仍需关闭的证据 |
|---|---|---|
| `SHF-004..008` | `EVIDENCE` | 第一版固定投影默认分组；整理/长按编辑分组、详情分组、更新按钮独立成行已有 VM 定点证据。封面命中问题由动效负责人补修，中心点击/长按、标题长按、列表/宫格端点通过；保留旧 Core 字段。证据按候选绑定见根审计 §9.6，连续视觉及真机未关闭 |
| `SEA-001` / `ACQ-001` | `EVIDENCE` | 一次会话并行本地导入书与在线检索，最小失败降级已有回归。设备暴露的 Builder 状态及 Repeat 旧行问题已改为直接状态读取与显式通知的懒加载数据源。最终 VM 验证全部354→本地0且无旧行→在线354、停止状态保持、已入架标记、在线详情与返回通过；本地书命中和导入旅程尚待设备证据 |
| `ACQ-002` / `ACQ-003` | `EVIDENCE` | 请求取消和绝对期限贯穿 JS/Host/continuation；主搜索、详情、目录、正文和书源检测冻结规则并串行化版本校验/发布；详情缓存保留同一个后台刷新请求。多源、登录及离线设备旅程未由单测替代 |
| `RDR-001` / `SHF-009` | `EVIDENCE` | 统一新旧 TOC 缓存解码；自然 49/50/51 页完整，超出预算明确失败；SQLite 持久逻辑序号与条件更新阻止旧正文覆盖新缓存。前台、预取、下载路径已有回归，需同包离线/换源复验 |
| `LOC-001` | `EVIDENCE` | EPUB 必需章节失败拒绝导入；Host/Core 64 MiB 输入上限、16 MiB 磁盘余量、stage 恢复和完成 EPUB 资源保留；失败展示大小/空间/损坏/恢复待处理原因。需设备文件选择器、低空间与杀进程恢复证据 |
| `REL-002` / `REL-003` | `ACTIVE-WORKTREE` | Core 3588 项通过，fmt/clippy/conformance/FFI/Native 通过；最终 signed iteration HAP `20260909T144521Z-35f2f99a-cb6bfc9f` 通过165项合同、ArkTS、无增量构建与独立包复验，并在原VM保数据安装/启动及部分业务定点通过。源码479输入与包一致；Harmony仍为共享未提交工作树，acceptanceEligible=false；完整设备矩阵、真机及用户验收仍开放 |
| `QLT-002` / `ACQ-003` | `ACTIVE-WORKTREE` | Cookie 分代提交与清除墓碑、迟到 HTTP/WebView 写回的会话代校验已实现；DNS 纳入 25 秒期限、经验证地址绑定连接、HTTP 显式 64 MiB、GZIP 32 MiB 已接入。平台 DNS pin 和 HTTP maxLimit 尚缺实际设备故障注入 |
| `QLT-002` | `ACTIVE-WORKTREE` | ArkWeb 主文档 DNS 检查/绑定及导航、资源的字面私网拒绝已接入；新子请求/重定向域名的 DNS、WebSocket/ServiceWorker/WebRTC 全引擎限制仍未证明，不关闭此项 |
| `QLT-002` | `EVIDENCE` | UI/Host/阅读页日志中的字符串改为私密字段，纯业务 gateway/TTS 的 console 只输出固定错误分类，诊断 URL 继续去掉 query/userinfo。该修复依赖系统隐私字段机制，未声称在关闭隐私遮蔽的特权日志中删除所有原文 |
| `SRC-001` | `ACTIVE-WORKTREE` | 已补最小结构与类型校验，兼容旧规则 JSON 字符串/空数组并保留未知字段；内置 1951 条导入合同通过。结构化编辑器仍未实现，不以最小校验替代原任务 |
| `ACQ-003` / `REL-001` | `EVIDENCE` | CLI 恢复正常 TLS 证书/主机名验证、字节限制与读取错误传播；流水线明示 CLI 诊断不等同 Harmony Host。最终VM已验证一次部分在线搜索与详情，34/190源后主动停止、失败4，不证明全源可用；登录/正文/ArkWeb完整纵切和物理机仍待验证 |

原审计 HTTP“平台响应无上限”的表述已修正：本地 API 23 SDK 默认 `maxLimit` 为 5 MiB，上限为
100 MiB；本轮使应用显式采用 64 MiB 并保留解码前检查。默认值存在不能证明所有资源路径均受控。

升级/回退边界：SQLite schema 从 15 自动升级到 16；旧二进制不保证读取升级后的数据库。
不得用卸载、清数据或降级旧 HAP 充当回滚。设备覆盖安装仍保留全部用户数据；需要数据回退时先取得
当前备份并单独验证迁移路径。完整 EPUB stage 恢复优先保资源；崩溃前尚未入库的完整资源可能保留，
后续清理必须结合 Core 引用核对，不能只按时间删除。


## 9. 字体选中态修复现场（2026-09-10）

正常阅读页 Quick/Full 的选中字体填充呈直角块已复现并修复，字体格圆角绘制与动效路径裁剪已分层，
原运动/输入协议保留。最终 signed iteration `20260910T105602Z-35f2f99a-6964e6db` 通过172组检查、
ArkTS、无增量构建和独立包复验；492项输入吻合，原VM同签名保数据安装及启动通过。
本轮字体 VM 端点验收通过：Quick 宋体/黑体、Full 8个内置字体唯一圆角选中、关闭重开后宋体保留；
原设置已恢复，锁正常释放。历史9568332失败已被新部署回执替代，真机、自定义字体、连续动效与用户验收仍开放。
后续 signed iteration `20260910T115401Z-35f2f99a-0c294e4c` 通过174组完整检查、ArkTS及独立包复验，
同一VM保数据安装/启动通过；搜索与换源同包均73源，Quick/Full宋体→黑体→恢复宋体端点通过。
搜索总分组306→273的条目守恒审查仍归ACQ-004，不计为字体通过范围；后续并行翻页源码不在该包中。
详细证据见 [字体修复记录](Reader-for-HarmonyOS/docs/qa/FONT_SELECTION_REPAIR_2026-09-10.md)。


## 10. 开源能力复用实施方案

> 用户已授权“方案全量完成”。首轮密码/编码与 EPUB XML 替换保留；首屏与顶层返回缺陷已在各自绑定的 VM 包验证修复。第二轮三个库已追加对照并退出本次默认迁移；正文引擎已形成 Core 文本/图片投影样例、foliate/Readium 桌面对照及独立调试 HAP。**方案整体尚未完成设备和正式验收**：共享 VM 被另一活动测试占用，真机离线，两仓仍含并行未提交工作。最新执行证据及恢复入口见 §10.13；不得把旧 VM 包的交互结果继承给本轮新包。
> 既有 LOC、ACQ、RDR 等任务状态按其自身证据维护；源码、交付与设备状态分别记录。
> 评估依据：[能力盘点与开源评估](/Users/minliny/Documents/Reader/evidence/opensource-assessment/REPORT.md)。
> 该报告的完整测试属于其记录的早期工作树；执行时重新生成基线，不继承其测试数字。

### 10.1 目标与路线

目标：在不损失书源兼容、正文完整性、用户位置和原生交互的前提下，删除可以由成熟库承担的通用实现，降低后续维护量。

**确定的首轮路线：RustCrypto/base64 收敛 + 使用现有 sxd-document 修复 EPUB XML 解析 + 同包回归。**
这一轮不改变数据库结构、备份协议、Core/Host 所有权或正文显示引擎。

其后按证据决定两类工作：

- 格式与规则：rbook、serde_json_path、chardetng 逐项限时验证；通过才迁移。
- 正文渲染：foliate-js 优先做单书验证，Readium Web 作为对照；设备结果支持时才提出替换正文的实施切片。

RSS、WebDAV 扩展与离线语音继续依附 RSS-001、SYN-001、TTS-001 的后续范围。书源规则订阅按 `SRC-003` 作为书源管理扩展推进，不与 RSS 文章消费混合。PDF/OCR 不进入本方案。当前 libmobi 工作继续归 LOC-002，不新增第二套 MOBI 实现。

首轮选 sxd-document 是利用当前已经存在且在小样本对照中有效的依赖，不同时加入 quick-xml/roxmltree。如果后续 rbook 胜出，让 rbook 内部选择其 XML 依赖；如果现有 DOM 方案经资源测试不合格，再在 OSS-002 内比较 quick-xml，不能无理由叠加解析器。
依据：[sxd-document](https://github.com/shepmaster/sxd-document)、[RustCrypto](https://github.com/RustCrypto/block-ciphers)。

### 10.2 工作包、依赖与交付物

人日为一名熟悉项目工程师的粗估，包含该包实现与定向测试，不是承诺。角色是职责分工，可由同一人承担；本方案没有实际启动并行人员或子任务。

| ID | 状态 | 工作包 / 责任 | 前置 | 交付物 | 估算 |
|---|---|---|---|---|---|
| OSS-000 | EVIDENCE | 基线与对照语料 / 集成、验证 | 当前相关改动可固定为明确输入 | 两仓输入清单、门禁结果、代表语料及预期、资源基线 | 1–2 人日 |
| OSS-001 | EVIDENCE | JS 密码/编码收敛 / Core | OSS-000 | 分批删除算法本体；保留兼容入口；标准向量与实际调用回归 | 4–7 人日 |
| OSS-002 | EVIDENCE | EPUB XML 收敛 / Core；关联 LOC-001 | OSS-000；与本地格式在途修改对齐 | container/OPF/nav/NCX 标准解析；位置/正文无回归 | 4–6 人日 |
| OSS-003 | EVIDENCE | 首轮依赖与交付验收 / 集成、Host、验证；关联 REL-001/002/003 | OSS-001、OSS-002 | 依赖来源、删除清单、全量检查、同版 HAP/设备回归、回退验证 | 2–3 人日 |
| OSS-004 | REASSESS | EPUB 结构库选型 / Core；关联 LOC-001/002/004 | 当前XML接口与语料可固定 | 2026-09-12按强制开源复用原则重新评估rbook；历史差分见§10.13，当前条件见§10.14。只以容错/资源/位置的具体未通过项暂缓，不能以已有自研可用或迁移收益不明显作为退出理由 | 沿用原试点预算，实际迁移范围需复评 |
| OSS-005 | NO-GO | JSONPath 方言选型 / Core；关联 SRC-001、ACQ-003 | OSS-000 的规则语料 | 已追加离线响应差分；本次不默认迁移，见 §10.13 | 3–5 人日试点；采用后约 1–3 人周 |
| OSS-006 | NO-GO | 编码识别补强 / Core；关联 LOC-001、ACQ-003 | 已标注真实编码语料 | 已追加已知编码片段，重点组仍回归；本次不引入，见 §10.13 | 1–2 人日试点；采用后 2–4 人日 |
| OSS-007 | EVIDENCE | 正文渲染路线试点 / Host、Core、验证；关联 RDR-001/004/005/006、TTS-001 | 位置/资源接口稳定，首轮交付完成 | 文本/图片样例、桌面对照和签名调试包已形成；设备比较及正式 Go/No-Go 仍开放 | 最多 10 人日；通过后另估迁移，初估 4–8 人周以上 |

**首轮预算：约 12–20 人日，包含小幅集成余量。** 对单人约 3–4 个工作周，设备不可用和既有并行缺陷修复不包含在内。第二轮只预留试点额度，不预先承诺所有候选都迁移。

同一批文件由一个集成负责人合入。密码、XML 可以各自研究，但共享工作区的写入、Cargo.lock、测试基线与 HAP 验收串行整合。不得从旧 HEAD 建一个缺少当前未提交改动的基线，然后直接覆盖回主工作区。

### 10.3 OSS-000：先固定可比较的输入

1. 记录 Core/Harmony 的 branch、HEAD、dirty 与构建输入 SHA-256；隔离副本必须包括本轮需要的未提交修改。
2. 阅读 LOC-001/002/004 和 ACQ-004 的实际改动及证据；记录已经实现的部分，避免重复修复。当前 libmobi 构建/桥接和来源说明已存在，但不因台账中的测试数字直接宣布新基线通过。
3. 在该输入上执行 Core 与 Harmony 的现有检查，记录失败所属。无关失败不妨碍隔离试点；它们会阻止最终候选验收，不能删除断言或把失败默认为通过。
4. 建立最小对照语料，优先复用现有资产：
   - 原创 XML 四变体探针及目录/正文完整性夹具；
   - 已授权且有首/中/尾与章节基准的真实 TXT/EPUB；
   - 当前 crypto/Java 编码测试、旧备份样本、脱敏 Host replay；
   - JSONPath 实际调用与已有 conformance；选定重点书源，固定其离线响应。
5. 记录每个样本来源、许可、内容 hash、预期及判定方式。标准格式不能只以旧实现输出作为正确答案。
6. 先测同设备的导入/打开耗时、峰值内存、包体与关键阅读位置。后续使用同一输入和工具重复比较。

**完成条件：** 有可复现基线、语料及预期；已知失败分类明确；每个首轮工作包有独立验证入口。不是必须先修完全项目所有历史问题。

### 10.4 OSS-001：密码算法与 Base64 分三批收敛

当前主要入口：[reader-js/src/lib.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-js/src/lib.rs)；已复用依赖见 [Core Cargo.toml](/Users/minliny/Documents/Reader/Reader-Core-Native/Cargo.toml) 和 [aes_backup.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-runtime/src/aes_backup.rs)。

**实施切片：**

1. Base64：改用现有 base64 依赖系列。保留 Android/Legado flags、URL-safe、padding、换行、空输入、非法字符以及返回值行为。
2. 哈希/HMAC：先迁移现有 sha2 可以承载的 SHA-2，再分别核对 SHA-1、MD5、SM3、HMAC 的 crate 及版本。统一字节输入、编码输出、算法别名与异常映射。
3. AES/DES/3DES 及实际暴露的其他算法：逐个替换原语与模式，冻结 key/IV、填充、模式、空值和错误语义。兼容算法只用于现有兼容场景，不借本轮升级备份协议。

可建立一个私有兼容模块承载现有接口，但不在这一轮大规模重排整个 lib.rs。每批独立可审查，依赖只新增真实使用的算法；不能因为 RustCrypto 包含某算法就全量引入。不同 crate 的审计状态分别记录，不概括成“全部安全审计通过”。

**必须通过：**

- 全部既有相关用例、公开标准向量、JS 入口端到端调用；
- 中文/emoji/非法参数、多字节编码、长输入、Base64 flags；
- 旧备份解密和新旧实现交叉读取结果；
- reader-js、相关 runtime、conformance 与后续全量检查。

**交付判定：** 每个迁移算法只剩一个生产实现；被替换的轮函数、S-box、手写编码表等从生产路径移除。确需保留的特殊编码行为列为小型适配，不允许默默回退整套旧引擎。

**回退：** 回退当前算法切片的代码/依赖，数据与备份格式不变。算法输出发生差异时先判断协议/标准，不能一律迁就旧错误，也不能未经兼容设计破坏实际书源。

### 10.5 OSS-002：XML 第一批只动标准读取层

主要入口：[epub.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-local-book/src/epub.rs)，并复用当前 sxd-document 锁定版本。此包关联 LOC-001，不重新实现刚修好的 spine/锚点业务。

**实施顺序：**

1. container.xml：先替换 rootfile 的字符串查找，按元素的命名空间 URI/local name 与属性读取，不依赖前缀字面量、引号或自闭合写法。
2. OPF：替换 metadata/manifest/spine 的 XML 读取，保持业务模型、路径解析、完整性诊断和元数据优先级。
3. NCX/nav：NCX 按 XML 结构读取；规范 XHTML nav 使用相同结构方式。对于历史损坏 XHTML，先记录当前容错承诺，再选择明确的兼容路径，不能因为新库更严格就静默丢目录。
4. 删除该范围失去用途的通用标签/属性字符串解析。正文 HTML 的清洗与规则解析不在此包顺手重写。
5. 保留 ZIP 单项/总量、输入、资源、错误与路径限制；XML 外部资源不允许引发网络读取。对 DTD/实体扩张/深层嵌套等资源风险用样本核查所选库实际行为。

**必须通过：**

- 四个 XML 等价变体都能导入并读到相同正文；
- 前缀变化、单/双引号、不同空元素写法不改变书目与资源定位；
- 已修复的 spine 全覆盖、导航重复/遗漏、相对路径和片段锚点继续成立；
- 旧书架身份、章节位置、书签、搜索和 TTS 投影保持；损坏文件仍给出有意义的错误；
- 长书、资源预算、目录缺失与坏 XML 的行为有对照。

如果格式规范允许而旧版失败，新版正确接受属于明确收益；如果旧版容错而新版拒绝，必须逐例给产品结论，不能只写“标准库行为如此”。

**Go/No-Go：** 正确性通过且资源预算可控，采用 sxd；如果 DOM 导致不可接受资源开销，在本包内用同样接口比较 quick-xml，最终只保留一个选定路径。

### 10.6 OSS-003：首轮完成的统一条件

以下是本方案提出的验收标准，不是当前已经测得的结果：

- **正确性：** 选定兼容语料无未解释差异；书源关键请求/解码、正文首中尾、目录和位置无新增丢失。
- **数据：** 本轮不改 schema、备份协议或永久位置定义。书架、书签、进度和手动元数据保持；若候选迫使这些变化，应拆出迁移方案，不能混进底层替换。
- **维护量：** 每项列出实际删除的旧算法/解析函数及保留适配；不得新增长期双实现。
- **依赖：** 固定具体版本和启用特性，保存源码来源/许可/NOTICE；现有依赖可继续使用时不做无关大版本升级。可接入 cargo-deny 检查新增依赖，既有问题单独登记，不用忽略项掩盖本次新增问题。
- **资源：** 同设备、同配置、同输入成组重复测量。建议相对基线的 p95 导入/打开耗时和峰值内存回归超过 10% 时阻止默认采用，必须复核噪声并给出明确收益交换；10% 是拟定判定线，不是性能承诺。小于测量分辨率的差异不按比例夸大。包体增量逐项解释。
- **产品回归：** TXT/EPUB 导入→书架→阅读→目录→书签→重开；在线搜索→详情→入架→正文→换源→离线；系统/HTTP TTS 至少验证正常播放、暂停和跨章。密码/XML 的改动不为现有控制形变重新定义验收口径。
- **交付：** Core/Host 检查、NAPI/HAP、保数据安装、VM、真机分层记录。出现无关控制层门禁失败时交还其实现负责人核对，不能直接弱化断言以通过包构建。

执行入口如下，以仓库脚本和 [HAP_BUILD_SYSTEM.md](/Users/minliny/Documents/Reader/HAP_BUILD_SYSTEM.md) 为准。本轮 Core、iteration 构建、安装与设备失败的实际结果见 §10.10：

1. 在 Core 仓库对每个切片运行相关 crate 测试，再运行 scripts/check-local.sh。
2. 在 Harmony 仓库运行 scripts/check-local.sh；它只负责非服务端源码合同。
3. 在 Harmony 仓库由统一入口运行 node scripts/hap-pipeline.mjs build --class iteration，再用该次 manifest 复验。
4. 设备交付只由统一负责人对本轮确认的目标与 manifest 执行预检、保数据安装和旅程；使用现有目标，安装默认保留数据。
5. 要形成正式验收候选，两仓代码必须进入可追溯的 clean 状态，再使用根级 scripts/check-development.sh --hap；不能靠隐藏 dirty 或用旧 HAP 获得“通过”。

**回退边界：** 研发期按独立切片回退代码，并以当前可读的数据格式重新构建兼容候选。只有确认签名和数据兼容后才部署回退包；不使用卸载/清数据或无法读取新 schema 的历史 HAP。

### 10.7 第二轮：限时验证与明确退出

#### OSS-004：rbook

优先比较 [rbook](https://github.com/DevinSterling/rbook) 与“本轮修正后的现有 EPUB 管线”，不是与旧缺陷版本比较。

- 最多 5 人日完成包结构/目录/资源映射样例和同语料结果。
- 先验证 parser 输入输出接缝，保留 Core metadata、integrity、catalog、位置与事务；不让 rbook 自成第二套书架或进度。
- 必须覆盖当前 TXT/EPUB 基线、特殊路径/导航与 libmobi 重构后包，因为该库替换可能影响 LOC-002。
- 采用条件：能以开源实现及有限适配完整覆盖所需结构行为，删除对应自写核心；兼容书库、异常处理、资源预算和位置保护通过。满足时必须采用，不额外要求超过现有功能的新增收益。
- 退出条件：为了适配而复制大量原逻辑、无法保住位置身份，或只是把现有问题换成新的不透明问题。退出后保留 OSS-002 成果，不迁移。

#### OSS-005：serde_json_path

- 最多 5 人日完成标准 JSONPath、Jayway 扩展、实际返回转换三类清单；运行全量既有离线用例和预选重点源响应。
- 明确 missing/null、数组/标量、顺序、递归、切片、过滤、聚合、正则和错误行为。
- 采用条件：实际所需方言可由有限适配覆盖，全部重点源无未解决语义回归。
- 退出条件：需要在标准库旁继续维护一套完整路径解释器。此时保留当前引擎，把可替换的小组件和覆盖缺口单独记录，不宣称完成替换。

#### OSS-006：chardetng

- 最多 2 人日比较已标注 TXT/响应编码。
- 顺序固定为书源/用户显式编码、BOM、已确认的 UTF-8、检测候选；保留用户纠错和记录实际使用编码。
- 采用条件：整体识别准确率有可复现提高，中文短输入等重点组不出现不可接受回归。
- 若不能完整覆盖重点编码语料，保留明确失败证据后暂缓；能够完整覆盖且满足资源约束时采用。不能仅凭“解码无错误”判为正确，也不能单以收益不明显为由永久保留可被替代的自研核心。

#### LOC-002：已有 libmobi 的剩余工作

不新建 OSS 编号或重跑已能绑定同一输入的检查。继续第 6.5 节的现有工作包，重点为：

- 反复图片读取引发重解码的成本、取消时延、内存和资源回收；
- 真实 MOBI/KF8、混合容器、HUFF/CDIC 长书的完整性及设备图片/链接；
- 旧位置/书签迁移、无法映射时的恢复入口；
- 精确绑定实际源码/二进制的许可与重建材料；
- 格式准入和完整设备矩阵。代码能够解码不自动开放选择器。

当前依据：[libmobi 集成说明](/Users/minliny/Documents/Reader/Reader-Core-Native/third_party/libmobi-0.12/READER_INTEGRATION.md)。本轮只对关联 MOBI/AZW3 做了替换前后的完整解析对照；LOC-002 的格式准入与设备验收仍按该任务维护。

### 10.8 OSS-007：正文引擎最多 10 人日试点

这个试点只决定是否值得迁移，交付物是可运行样例和对照结果，不是全应用改写。

- 第 1–2 日：用 Core 输出的同一书籍/正文/资源接口驱动原生和 Web 样例，锁定书籍身份与位置定义。
- 第 3–5 日：优先接 [foliate-js](https://github.com/johnfactotum/foliate-js) 的自定义 book interface；验证本地资源、分页/滚动和禁止书籍主动脚本的边界。
- 第 6–8 日：在同一 HarmonyOS 设备测字号/宽度重排、目录、书签、搜索、选区、TTS 高亮、跨章和前后台恢复。Readium Web 仅在同一接缝上作为有界对照，不再扩成第三条产品主线。
- 第 9–10 日：完成与原生的正确性、资源和连续交互比较，给出采用/退出结论及若采用需删除的排版职责。

**通过条件：** Core 仍为正文/目录/位置事实源；关键位置旅程全通过；排版收益明确；性能和原生控制层手势没有未解决阻塞。需真机判断手指跟随与选区手感，VM 通过不能代替。

**退出条件：** 第 5 日仍无法可靠映射规范化位置，或为接入需要重写控制面板/搜索/业务存储。到期停止扩大试点，保留原生主线和已验证底层复用成果。最终迁移规模仅在通过后确认。

### 10.9 每个工作包交付时必须回答

1. 哪个旧实现已被替换，具体删掉了什么？
2. 新库的版本、来源、特性和许可是什么？
3. 保留了哪些 Reader 兼容语义，为什么必须保留？
4. 哪份输入上的哪些检查通过；失败和未测项是什么？
5. 用户数据、正文和位置是否不变？变化如何迁移？
6. 相对基线的耗时、内存和包体结果是什么？
7. 如何回退，是否已经验证兼容？
8. 对应既有任务 ID 关闭了哪部分，哪些仍开放？

状态仍只在本文件维护；测试数据、差分和设备回执进入 evidence，不再复制一份并行 Roadmap。首轮首先启动 OSS-000，随后按 OSS-001 → OSS-002 → OSS-003 顺序串行集成；后续库只在各自 Go 条件成立时进入正式迁移。


### 10.10 授权执行结果（2026-09-10，首个交付快照）

> 本节保留首个交付包及其失败现场，以下“当前”均指该快照。首屏阻塞已在同日后续修复，最新结论与部署包见 §10.11；本节旧包不代表当前安装版本。

**已落地：OSS-001 密码/编码收敛、OSS-002 EPUB 结构 XML 收敛，已形成并安装同版 iteration HAP。设备阅读失败，OSS-003 整体验收未完成。**
首轮文件在包含当前未提交修改的隔离副本中实现，逐文件确认主工作区仍等于基线后同步；Core 的全部已捕获输入与测试候选一致。未提交、暂存或覆盖其他任务的修改。

输入与合入凭据：[基线清单](/Users/minliny/Documents/Reader/evidence/opensource-implementation/baseline-manifest.json)、[40 个文件的同步清单](/Users/minliny/Documents/Reader/evidence/opensource-implementation/integration-manifest.json)、[执行校验汇总](/Users/minliny/Documents/Reader/evidence/opensource-implementation/verification.json)。Core 基于 `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2` 的 dirty main；Harmony 基于 `35f2f99a8d635615475fde75120bf8629f944565` 的 dirty 工作树。HEAD 不单独代表本轮输入。

#### A. 首轮实现与保留边界

| 工作包 | 本轮实际改动 | 兼容与维护结果 |
|---|---|---|
| OSS-001 | JS Base64 改用 base64；MD5/SHA-1/SHA-2/SM3/HMAC 与 AES/DES/2-key、3-key 3DES/SM4 改用库；CBC/ECB 和填充复用库；备份 MD5 统一到 md-5 | 删除 JS 大文件中 1,746 行手写编码/密码实现；新私有兼容模块 264 行生产代码、123 行标准/边界测试。包括测试计该部分净减少 1,359 行；没有保留整套旧算法回退 |
| OSS-002 | container/OPF/nav/NCX 按 XML 结构和命名空间 URI 读取；损坏导航复用现有 scraper；删除该范围的通用标签枚举与属性字符串提取 | 四种等价 container 写法、不同前缀、引号、嵌套 NCX、实体、CDATA、损坏导航与资源边界已覆盖。原章节锚点、spine 覆盖、正文清洗保留；此项增加兼容/结构检查，**不宣称代码量下降** |
| OSS-003 | 锁定依赖，保存来源、校验和与原始许可证；Harmony 增加打包通知文本；生成并实际验证逆向补丁 | 源码许可、代码回退、39 项 SDK 检查、179 项 Harmony 合同、NAPI/HAP 及 VM 保数据升级通过；包内许可与原生身份已核对。同包 TXT/EPUB 首屏准备超时，设备旅程及性能仍未通过 |

生产入口：
- [crypto_compat.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-js/src/crypto_compat.rs)、[JS 兼容夹具](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-js/tests/fixtures/crypto_compat.provenance.json)、[aes_backup.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-runtime/src/aes_backup.rs)。
- [epub.rs](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-local-book/src/epub.rs)、[结构 XML 适配](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-local-book/src/epub/xml.rs)、[结构回归](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-local-book/src/epub/structural_tests.rs)。

保留的协议细节是有测试的 Reader 兼容行为：Base64 各 flags 的现有无换行输出、混合字母表与非规范尾部的返回值；ZeroPadding 跨块去尾零；算法别名、key/IV 校验与错误映射。MD5 与 ECB 仅延续既有兼容协议，本轮没有新设加密协议。

XML 采用 sxd-document 0.3.2 后，真实 NCX 暴露了其只支持 `SYSTEM`、不支持 `PUBLIC` 声明的缺口。适配仅在库返回相应错误的位置保留 system identifier、去掉 public identifier，再交回库解析；不读取外部 DTD。已有缺失 `dc/opf/epub/ncx` 常用前缀声明的简单片段在受限外层命名空间中重试；任意未知前缀、坏结构及实体扩张仍失败。历史导航的 HTML 容错只用于 nav，不把损坏 OPF 当普通 HTML 接受。属性在 XML/HTML 层解码一次，避免文件路径和片段二次解码。

#### B. 本轮证据

| 检查 | 实际结果 | 凭据/范围 |
|---|---|---|
| 新鲜基线 Core | 3,616/3,616；协议 210；C/C++ smoke 通过 | [基线日志](/Users/minliny/Documents/Reader/evidence/opensource-implementation/baseline-core-unrestricted.log)；不是继承旧报告测试数 |
| 最终 Core | **3,632/3,632，0 skipped**；fmt、clippy、210 协议检查、严格合同漂移、C/C++ smoke 通过 | [最终门禁](/Users/minliny/Documents/Reader/evidence/opensource-implementation/candidate-core-final.log)；本轮新增 16 个测试入口 |
| JS 算法入口 | **1,015/1,015** 新旧结果一致；另有 AES FIPS 197、HMAC RFC 4231 独立向量 | [迁移夹具](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-js/tests/fixtures/crypto_compat.json)；包含加解密、key/IV、填充、异常参数及编码 |
| 旧备份 | 28 组原始合成备份密码/明文组合，新旧密文相同，新实现可读旧密文 | [对照输出](/Users/minliny/Documents/Reader/evidence/opensource-implementation/backup-candidate.json)、[永久回归夹具](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-runtime/tests/fixtures/aes_backup_legacy.json)；不含用户秘密 |
| 真实书籍 | **7 本、6,444 章、22,652,811 字符**；整个 LocalBook 输出逐项一致，包括书目、目录、正文、偏移及完整性信息 | [完整对照](/Users/minliny/Documents/Reader/evidence/opensource-implementation/corpus-comparison.json)；2 TXT、2 EPUB、2 MOBI、1 AZW3；仅保存 hash/统计，不分发用户书籍 |
| 旧书架数据跨实现 | TXT、EPUB、MOBI 三本由旧 CLI 导入/保存进度和书签；新 CLI 冷读、重新导入后保持 | [跨版本重放](/Users/minliny/Documents/Reader/evidence/opensource-implementation/positions-cross-version.json)；全部使用临时数据库 |
| 资源初测 | 每书新旧交替各 5 次；中位耗时变化约 −3.4%～+5.6%，最大 RSS 变化约 +0.7%～+7.6% | [原始采样](/Users/minliny/Documents/Reader/evidence/opensource-implementation/corpus-comparison.json)；macOS debug 探针，只有描述性比较，不代表设备 p95 或包体验收 |
| 源码回退 | 在临时副本中实际逆向应用两仓补丁，40 个文件恢复为基线原始字节或删除本轮新增项 | [回退验证](/Users/minliny/Documents/Reader/evidence/opensource-implementation/rollback-verification.json)；主工作区和用户数据库未回退 |
| OHOS NAPI / SDK | release 编译通过，39 项 SDK 测试通过；3,406 个 Core 输入文件已绑定 | [原生集成记录](/Users/minliny/Documents/Reader/evidence/opensource-implementation/native-integration.json)、[原生构建日志](/Users/minliny/Documents/Reader/evidence/opensource-implementation/napi-build.log)。SDK 与 Host vendor 一致 |
| HAP iteration | **179 项 Harmony 合同、ArkTS、无增量构建、签名及独立复验通过** | [最终构建](/Users/minliny/Documents/Reader/evidence/opensource-implementation/hap-build-final.log)、[包交付记录](/Users/minliny/Documents/Reader/evidence/opensource-implementation/hap-delivery.json)；run `20260910T131400Z-35f2f99a-0982c893`，dirty，acceptanceEligible=false |
| VM 升级 / 启动 | **原 Mate 80 Pro 同身份签名、保数据安装与启动通过**；运行时 BuildId 对上本轮 Core | [部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T131400Z-35f2f99a-0982c893/deploy-vm-6460677a198b-20260910T132049Z.json)、[运行身份](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/runtime-identity.log) |
| 同包设备阅读 | **FAIL：已有 EPUB、TXT 均约 30 秒后报 PAGINATION_FIRST_PAGE_READY_TIMEOUT** | [设备结果](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm-regression.json)、[错误日志](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/reading-failures.log)、[EPUB 截图](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/reader-control-oss-epub-ready.png)、[TXT 截图](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/reader-control-oss-txt-settled.png)。尚未做同 Host 新旧 Core 因果对照，不归因为 XML，也不宣称与本轮无关 |
| 冷重开 / 搜索抽查 | 杀进程后正常启动，两本原有测试书和 TXT 已读 9% 仍显示；在线搜索返回可见结果 | [冷重开书架](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/reader-control-oss-cold-shelf.png)、[搜索过程](/Users/minliny/Documents/Reader/evidence/opensource-implementation/vm/reader-control-oss-search-results.png)；搜索采样时为 26/190 源、181 条、4 源失败，随后主动停止，不计为全部书源或完整在线旅程通过 |

首次 sandbox 内 Core 检查因已有 WebDAV 本机监听测试受限而失败；最终门禁在可监听本机端口的环境重跑全套并通过。原始失败日志保留，不合并成一个“全通过”的虚构过程。

构建过程保留三次记录：第一次因现有 architecture snapshot ID 合同失败；后续重跑合同已随共享工作树更新通过，但构建期间输入变化，流水线拒绝发布；在重新编译并同步本轮 NAPI 后，第三次统一流水线固定输入并成功发布 manifest。本轮未修改翻页代码或断言。最早 native T10b 和中途 architecture 失败属于各自快照，不能继续表述为当前构建阻塞；**当前阻塞是最终包中的设备首屏准备超时**。

#### C. 依赖与发行材料

新增锁定包：cbc 0.1.2、des 0.8.1、hmac 0.12.1、md-5 0.10.6、sha1 0.10.6、sm3 0.4.2、sm4 0.5.1；移除旧 md5 0.7.0。净增 6 个包节点。
继续使用 aes 0.8.4、ecb 0.1.2、sha2 0.10.9、base64 0.22.1、sxd-document 0.3.2、scraper 0.19.1；没有在产品依赖中叠加 rbook、quick-xml、serde_json_path 或 chardetng。

[版本/来源/许可证清单](/Users/minliny/Documents/Reader/Reader-Core-Native/third_party/oss-reuse-licenses/manifest.json)、[启用特性展开](/Users/minliny/Documents/Reader/evidence/opensource-implementation/dependency-features.txt)、[Harmony 完整通知文本](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/resources/rawfile/licenses/oss-reuse-NOTICE.txt)。RustCrypto 包按 MIT 选项使用；scraper 为 ISC；sxd-document 为 MIT。现有 ecb 0.1.2 来自 magic-akari，MIT，不误归为“全套 RustCrypto 已审计”。本轮未运行独立漏洞数据库审计，不宣称全部依赖经过安全审计。通知文本已在本轮 signed HAP 中找到唯一对应项，字节 hash 与源码相同；这次包是 iteration，不是正式发行验收。

#### D. 第二轮阻断性试验结论

以下属于**默认替换的首轮筛选**，不是完整书源/全部格式认证。试验 Cargo 项目与产品依赖隔离，退出后不把两套实现留在生产中。[可重跑试验](/Users/minliny/Documents/Reader/evidence/opensource-implementation/trials/Cargo.toml)、[原始结果汇总](/Users/minliny/Documents/Reader/evidence/opensource-implementation/trials/selection-results.json)。

| 工作包 | 实測结果 | 本轮决策及重新进入条件 |
|---|---|---|
| OSS-004 / rbook 0.7.10 | 四种标准 container 夹具和两本真实 EPUB 的 spine 资源顺序、路径和原始字节 hash 均一致。历史无 media-type rootfile 夹具被拒绝；33 MiB OPF 被现有 Reader 预算拒绝，但直接 rbook::Epub::open 接受 | **本轮保留修正后的 sxd 管线**。候选标准结构能力已获证实；若再进入，须先提供有界 ZIP/资源策略、历史容错接缝及 libmobi 重建 EPUB 的完整比较，不能直接替换或额外维护一套书架/位置 |
| OSS-005 / serde_json_path 0.7.2 | 33 个对照中 14 相同；16 个标准例中 14 相同，另两项是候选对逆序切片、根节点过滤引用的标准支持收益；17 个当前支持的方言例均被候选原生语法拒绝 | **直接默认替换 No-Go**。保留现有路径引擎。重新进入必须证明聚合/正则/集合/组合/模板等由有限适配覆盖，并跑实际重点源。当前结果没有证明需永久保留两套引擎，也没有证明一个小适配层已经足够 |
| OSS-006 / chardetng 1.0.0 | 71 个可编码原创样本：旧策略 34 正确，候选 55 正确；31 项改善，同时 10 个原本正确的短 GBK 中文样本退化 | **默认检测 No-Go**，触发中文短输入准入条件。保留显式/BOM/UTF-8/现有 GBK 路径。若重新进入，需真实标注语料、短输入保护和实际编码标签/纠错方案；不能用 55/71 总分掩盖回归 |
| OSS-007 / 正文渲染 | 未开始设备试点 | 其前置“首轮交付完成”尚未成立。HAP/安装已通过，但同包阅读失败、设备资源对照未完成；通过后再按 §10.8 进入，不把网页静态样例称为 HarmonyOS 正文能力 |

上游版本依据：[rbook 文档](https://docs.rs/rbook/0.7.10/rbook/)、[serde_json_path 文档](https://docs.rs/serde_json_path/0.7.2/serde_json_path/)、[chardetng 文档](https://docs.rs/chardetng/1.0.0/chardetng/)。rbook 试验关闭 write、prelude，仅保留 threadsafe；其 zip 8 / quick-xml 0.41 是隔离试验的依赖，未进入 Reader Cargo.lock。

#### E. 交付开放层与恢复执行入口

本轮 signed HAP：[不可变 manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T131400Z-35f2f99a-0982c893/manifest.json)。包长 148,562,698 字节，SHA-256 `22f0bd34e061d890668bcda5699c23a47d710ba9f9719acbc0f4144a52355249`。未剥离 NAPI 为 18,640,160 字节，相较此前 Host vendor 库增加 417,672 字节；旧库可能未包含本轮基线中的其他 Core 在途修改，**不能把约 408 KiB 全归因为此次开源替换**。包内剥离后 Core 库为 14,182,944 字节；原始库、包内库分别记录 hash，运行时 BuildId 为 `51968019523ac59b181802eb548dbcdd8405f07b668d316856d75634ff0f8c56`。HAP 总体没有同 Host 输入的有效对照包，不能声称已通过包体增量准入。

1. **OSS-003 / 首屏阻塞：** 固定上述 manifest、当前数据及两本测试书，串行定位 `Index → ReaderShell → LocalReadingExperience` 首屏准备阶段。下一诊断切片只记录章节读取完成、metrics 校验、viewport 接纳、measurement generation、首屏持久化和 ready 回调的阶段码，不记录正文；先确定停在哪一段。若需判定本轮 Core 因果，应以同 Host 和兼容数据格式构建隔离新旧 Core 对照，不能直接部署来源不清的历史库。不能放宽超时、跳过首屏检查或用“TXT 也失败”直接排除 Core。主工作区相关 Host 文件仍有其他在途修改，本轮没有覆盖其实现。
2. **恢复验收顺序：** 首屏修复的新包先完成 TXT/EPUB 从书架进入，再做目录、书签、退出/冷重开位置、在线详情/入架/正文/换源/离线、系统/HTTP TTS 播放暂停跨章，最后补同设备成组资源对照。首屏阻塞之前不把这些旅程勾选通过。
3. **设备现状：** 既有 VM `Mate 80 Pro`、实例 `/Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro`、HDC `127.0.0.1:5555` 经启动完成、稳定 SceneBoard 与共享锁预检后安装。应用已冷重开停在书架；本任务的搜索已停止，目标锁已释放。未卸载、清数据、重启或更换 VM。物理设备 Offline，真机及用户体验验收仍 OPEN。
4. **正式验收：** 两仓仍有大量其他未提交修改；必须形成真实 clean 候选后再用根级 acceptance 门禁，不能隐藏 dirty。源码通过、安装启动通过、设备阅读失败是三个独立结论。
5. **代码回退：** [Core 逆向补丁](/Users/minliny/Documents/Reader/evidence/opensource-implementation/Reader-Core-Native-reuse.patch)、[Harmony 逆向补丁](/Users/minliny/Documents/Reader/evidence/opensource-implementation/Reader-for-HarmonyOS-reuse.patch)已经在副本实际验证 40 个源码/许可文件。使用前仍需 reverse check，拒绝覆盖后来修改；本次 NAPI 同步另有记录，设备回退须从兼容当前数据的源码重新构建同签名包，不把备份旧库直接装回、不卸载、不清数据。

以上没有关闭 LOC-002、RDR 或 REL 的设备验收；本轮完成的是首轮通用实现替换、源码与离线回归、NAPI/HAP 及保数据安装部分；OSS-003 整体仍保持 EVIDENCE。后续候选的迁移仍受各自 Go/No-Go 条件约束。

### 10.11 首屏与书架进入阅读页修复（2026-09-10 23:32）

**§10.10 E.1 的首屏定位与修复已完成。原 VM 上已有 TXT/EPUB 均可从书架直接打开正文，EPUB 翻页、返回书架，以及两本书应用冷重开后的进度恢复通过。OSS-003 整体仍为 EVIDENCE。**

根因：`ReadingExperience` 的 7 个 getter、4 个 setter 被当前实际 ArkUI V1 编译器在 `@Component struct` 成员转换时丢弃。诊断包显示章节已读取、真实视口已到达，但测量 epoch 为 0；读取测量章节得到 undefined，使首屏准备提前退出，书架一直等不到 ready。实际 SDK 转换的生产方法回归在修复前失败、修复后通过。

修复将上述访问器转为普通方法，更新 43 处生产访问，并增加实际 SDK 回归。保留章节/视口准入、过期请求隔离、相邻章节上下文与原首屏条件。没有回退 Core 密码/XML 成果；修复包与诊断包内 Core NAPI hash 完全一致。本次共改 1 个生产文件、3 个测试文件，未修改其他在途实现。

- **源码与构建：** 180 项 Harmony 合同、ArkTS、无增量构建、签名及包复验通过；修复文件再次核对与构建输入一致。
- **当前安装包：** run `20260910T151829Z-35f2f99a-711c8da0`；[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T151829Z-35f2f99a-711c8da0/manifest.json)，signed SHA-256 `dbaf05e12af972f1459081f9e4ec9f52a0dfeb71345b1c9def1d2e8e3762be84`。
- **设备与数据：** 原 Mate 80 Pro 同签名保数据安装；应用进程冷重开后 EPUB 恢复第 2/10 页、9%，TXT 恢复原正文位置、9%。最终停在书架，两本原有书籍保留，目标锁已释放。
- **完整材料：** [根因/改动/设备报告](/Users/minliny/Documents/Reader/evidence/reading-entry-repair/REPORT.md)、[设备操作与截图记录](/Users/minliny/Documents/Reader/evidence/reading-entry-repair/vm-regression.json)、[本次修复补丁](/Users/minliny/Documents/Reader/evidence/reading-entry-repair/reading-entry-fix.patch)。

**仍开放：** TXT/EPUB 目录、书签等完整旅程；在线详情/入架/正文/换源/离线；系统与 HTTP TTS；同设备成组性能对照；真机与视觉验收。物理设备本次不可用。此次包仍是 dirty iteration，acceptanceEligible=false；正式验收须形成真实 clean 候选。§10.10 的首屏失败不再作为当前阻塞，其他未测项不因此自动关闭。

### 10.12 控制栏顶层返回语义修复（2026-09-10）

用户明确顶层返回按钮应退出阅读、回到上一页。已将其从系统返回的层级处理分离，接到现有保存进度并退出流程；无障碍提示同步为“退出阅读，返回上一页”。系统返回键、面板内返回与关闭控制栏行为保留。

180 项 Harmony 合同、ArkTS、构建与签名通过；修复包已保数据安装到原 Mate 80 Pro。实际点击验证：书架进入→顶层返回→书架，重新打开保留同正文和 9% 位置；详情进入→顶层返回→详情。应用最终停在书架，目标锁已释放。

本轮安装版本为 `20260910T155226Z-35f2f99a-4d55b276`，取代 §10.11 的上一安装快照。详情、manifest、部署回执与截图见 [修复报告](/Users/minliny/Documents/Reader/evidence/control-top-back-repair/REPORT.md)。本轮仍为 dirty iteration，真机/原生屏幕朗读器未测，不关闭 OSS-003 整体或其他设备验收项。

### 10.13 全量执行续作（2026-09-11，设备条件仍阻塞）

本轮完成的是剩余选型的补充取证、正文试点的实现和打包，**没有宣布方案全量验收完成**。执行快照见 [续作报告](/Users/minliny/Documents/Reader/evidence/opensource-completion/REPORT.md)，可运行样例见 [试点说明](/Users/minliny/Documents/Reader/evidence/opensource-completion/renderer-pilot/README.md)。

**OSS-000/001/002/003：** 前次捕获的 3,406 个 Core 输入逐文件与当前字节一致，未发现新的源文件；另有 1,253 个既有 evidence/reports/samples/tooling 路径属于原捕获排除项。前次 3,632 项 Core 门禁可按同输入复用，但不是本轮新跑的数字。本轮没有再次修改生产 Core 算法或解析代码。从固定的替换前源码重建 OHOS NAPI 后，采用与当前 HAP 实际匹配的 strip-all 比较，原生载荷增加 60,240 字节（0.427%）；原始库增加 72,016 字节。该结果替代此前不可归因的约 408 KiB 数字，仍不是整包或设备 p95 验收，构建身份元数据差异也已注明。

**OSS-004：本次退出默认迁移，保留 sxd。** 新增 4 个现有 EPUB 夹具均被 rbook 打开，spine 资源字节与原 ZIP 对上；其中历史不完整 XML 的 3 个夹具没有返回目录，仍需要 Reader 的容错/兜底。实际调用当前 libmobi 重构函数得到的 3 个包均被原生 rbook 拒绝，但只规范化 container 声明即可读到所有 spine 资源，因此这不是不可修复的能力缺陷。结合先前真实 EPUB/标准变体、33 MiB OPF 预算试验，本轮没有证明足以补偿迁移、容错和资源预算适配的新增收益；不引入长期双解析管线。保留全部输入 hash 与结果，未来重选须重新满足 §10.7 采用条件。

**OSS-005：本次默认替换 No-Go。** 在先前 33 个标准/方言试验之外，新提取 23 条实际离线响应规则：18 条成功结果一致；4 条现有引擎成功、候选语法拒绝（模板、组合和变量写入）；另 1 条正文清理后缀必须走完整规则链，两者直接 JSONPath 调用均报错，不能算成候选新增回归。候选仍未通过既有方言准入，不增加生产依赖，不把这组差分写成全书源认证。

**OSS-006：本次默认检测 No-Go。** 新增 88 个可编码的原文片段对照：原策略 82 个正确，候选 80 个正确，3 个改善、5 个退化。它们是原创正文/既有中文夹具经已知编码器转码的样本，不冒充自然编码书库准确率。结合先前短 GBK 回归，已足够触发重点组退出条件；保留显式编码、BOM、UTF-8 与当前回退链，不增加生产依赖。

**OSS-007：试点已实现，采用决定等待设备比较。** foliate 固定 `78914aef4466eb960965702401634c2cb348e9b1`，MIT；Readium 对照锁定 navigator 2.10.0/shared 2.5.0，BSD-3-Clause。复用 Core 导出的原创三章正文以及 Core 的 U+FFFC 图片投影和有界资源读取。新增 Reader 适配层处理 Unicode/DOM 偏移、资源投影、章节空文档过渡、布局准入和图片边界定位，没有修改上游 foliate 文件。最终桌面验证分组记录为 31 项纯文字、9 项图片、15 项 Readium 有界对照、16 项 HAP 同资源自动检查；它们有重叠，不合并成设备测试总数。图片可见性最终按真实屏幕窗口验证，弃用把整条分页 iframe 宽度当作视口的早期检查。搜索/书签/TTS 为位置投影验证，不代替业务持久化或实际发声。

最终 HAP run：`20260910T182124Z-35f2f99a-74ac9927`，签名 SHA-256 `21899d8e8798f5d01e99cc0fdb46d201645d5c2b9880ac59b163ba9b53114c9d`；[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T182124Z-35f2f99a-74ac9927/manifest.json)。180 项 Harmony 合同、ArkTS、构建与签名及独立复验通过。它只在 debug 冷启动布尔参数 `readerOpenSourcePilot=true` 时打开独立试点页，正常入口保持原生阅读。最后复核 504 个已捕获构建输入均与当前字节一致。该包无部署回执，不能沿用 §10.12 的 VM 交互结果。共享 VM 曾在 02:19 释放，本轮据此重建；准备验收时另一测试于 02:24 重新持锁，02:27 复核仍活跃。

**仍须在原工作包内完成：**

1. OSS-000/003：共享 VM 释放后，以本轮 manifest 重新做保数据预检、安装，以及 §10.6 的 TXT/EPUB 完整旅程、在线搜索/详情/入架/正文/换源/离线、系统和 HTTP TTS 播放/暂停/跨章。再固定同 Host 新旧 Core，成组测设备 p95、内存和整包增量。
2. OSS-007：在同设备进行原生与 Web 的字号/宽度重排、位置恢复、跨章、前后台、连续翻页、控制层手势和选区对照；补真机触控与 TTS/选区体验后给正式采用或退出结论。桌面技术接缝可行不自动触发正文迁移。
3. REL/OSS-003：真机连接并允许调试后补对应交互；当前 USB 目标 Offline。共享 VM 正由另一活动进程持锁，本轮没有抢占、杀停或改动该测试。
4. REL/OSS-003：与并行工作完成集成，形成真实 clean 候选，再运行根级 `scripts/check-development.sh --hap`。两仓仍为 dirty iteration，`acceptanceEligible=false`；未通过隐藏改动、旧包或临时新 Git 历史制造验收状态。

### 10.14 强制开源复用原则下的补齐路线（2026-09-12）

执行根[`AGENTS.md`](AGENTS.md)的新原则：能以开源完整实现的必须采用，不以已有自研或收益不明显退出。
本节更新既有LOC/OSS工作包，不新增平行项目。完整评估与数量口径见根审计 **§10.11**：
本地书16个已落地分项中，6项开源核心、6项开源加Reader规则、3项Reader自有实现、1项系统文件适配。
这是实现机制分类，不是16项产品已验收；直接/组合复用12项也不代表全项目75%完成。

| 既有工作包 | 本轮决定 | 下一具体交付及退出条件 |
|---|---|---|
| LOC-004 / G | 保留已复用的regex/格式元数据引擎，补业务保护 | 逐字段来源/手动覆盖，统一预览→提交→书架合并；重导入/冷重启/回滚保留书名、作者、简介、封面 |
| LOC-002、004 / G | 复用现有RegexSet及SQLite迁移，不重写匹配引擎 | 划线首尾及其他位置实体盘点、同事务迁移；无法唯一匹配保留记录。Readium Locator仅作为格式模型/后续渲染接缝，不能冒充历史迁移实现 |
| LOC-001、002 / C | 复用SQLite与Host文件能力，补完整导入协调 | 持久阶段/回执，协调源文件和书架发布；逐中断点恢复；成功finalize及按引用清理日志/孤儿文件。不得为此重写数据库或引入第二套业务账本 |
| LOC-001 / B，关联OSS-002 | **采用已有scraper/html5ever替换XHTML扫描核心** | 当前5个原创对照2/5正确、候选5/5；接DOM段落/实体/图片和Unicode位置，跑真实EPUB/MOBI输出及旧位置差分后删除手工扫描分支；不另建HTML引擎 |
| LOC-002 / C、D、E | 保留libmobi，补资源访问与后台执行 | 利用现有资源索引、单次重建及共享结果，Native异步桥接。若需新内存缓存，优先验证Moka的权重/同键初始化，不自写淘汰算法；库容量不是进程峰值保证 |
| OSS-004 | **REASSESS**，替代此前以收益为主的退出结论 | rbook已有标准spine及有限container适配证据；补畸形导航、解析前预算和Reader投影。能完整覆盖时必须迁移；实际失败和需复制完整旧解析器才是可记录的暂缓理由 |
| LOC-002 / F | UMD优先开源Importer评估，禁止无证据继续自研解码器 | all2epub仍是候选；本轮上游直接取证失败且缺真实UMD，先固定可得源码/许可/损坏策略和独立语料，再映射公共链。不把检索缓存当作采用验证 |
| LOC-001、002 / A、H | 补稳定错误/警告并按能力准入 | 不扩选择器冒充实现；可恢复成功也保留告警。Core/Host/当前产物/设备分别验证 |

当前已落地能力中，明确应替换解析机制1项（XHTML），需继续完整替代评估1项（EPUB结构）。
新增缓存、UMD、历史数据保护和恢复工程不与这两个替换计数混加。
全项目补充：WebDAV multistatus XML提取优先收敛到已有sxd；标准RSS/Atom/JSON Feed优先差分feed-rs，
沿用SYN/RSS范围，不因库存在而扩产品。OSS-005/006保留当前实际方言/中文短输入回归作为暂缓依据，
不能再写成抽象收益不足；OSS-007仍是试点，满足完整行为和产物条件后按同一原则作采用决定。

本轮来源清单、隔离探针和结果见
[`inventory.json`](evidence/local-format-capability-audit/oss-assessment-20260912/inventory.json)、
[`dom-results.json`](evidence/local-format-capability-audit/oss-assessment-20260912/dom-results.json)。
未修改生产实现；当前未决的数据保护和恢复问题已从代码定位，先补实现与本地回归，不以重复真机测试替代。

**执行进展（本节评估后的实现）：** LOC-004/G 的手动字段保护已进入生产代码。
`bookshelf.book.update` 将逐字段 `manual` 标记随 Book 持久化；公共本地解析与提交均合并这些字段，
包括清空作者/简介/封面，预览后再次编辑会拒绝旧预览。继续复用 rusqlite 0.31.0、libsqlite3-sys 0.28.0
和既有 SQLite 事务/回滚，未增加新依赖。实际复用及 Reader 适配边界见
[`开源来源说明`](Reader-Core-Native/third_party/oss-reuse-licenses/README.md#local-book-metadata-ownership)。
导入链 20 项本地回归已通过（包含新增冷重启/重导入/回滚/并发编辑场景）。
书名和作者已记录 `explicit`、`embedded`、`filename`、`default` 来源，简介、封面、类型和末章等字段仍待补齐；历史无标记手动值不能追溯判定。MOBI后台资源的真实语料和设备验收、
导入恢复的跨进程/交付证据及其他候选评估仍待执行，不能将本步写成全方案完成。
共享文件的全量修复任务请求接管；本任务完成该原子修改和测试后交出生产文件，
原始测试/交接数据归档于 `evidence/local-book-oss-implementation/`，不覆盖其他任务的改动。

**继续执行：XHTML DOM 替换。** EPUB正文文本投影已切换到已锁定的 `scraper 0.19.1` / `html5ever 0.27.0`，
复用其DOM边界、实体解码和属性解析；Reader只保留spine/body选择、段落/换行、图片定位和Unicode偏移适配。
旧标签/实体扫描不再进入正文投影路径；同文档导航锚点也由同一DOM投影生成并映射到归一化Unicode偏移，不能再回退到原始标签扫描。
新增的DOM回归覆盖引号内 `>`、大小写 SCRIPT、命名/数字实体、段落/BR、图片定位，49项 EPUB 单元回归通过。
具体版本、许可证和适配边界见 `third_party/oss-reuse-licenses/README.md`；尚未进行 Native/HAP/VM/设备验收。

**继续执行：位置实体。** 位置迁移已把 `BookHighlight` 起止范围加入现有 `LocalBookPositionMigration`，
与进度、书签共用 `RegexSet` 锚点、存储冲突校验、SQLite/内存事务和回滚 journal；跨章节或终点不再唯一时保留原记录并返回可恢复错误。
新增划线迁移与回滚回归通过，未引入第二套匹配器或数据库账本。Readium Locator 仍只作为未来格式模型参考，当前历史坐标迁移不是由它直接完成。

**本轮闭环补充（2026-09-12）：** 同文档 EPUB 导航锚点已改为由同一 html5ever DOM 投影生成，锚点使用归一化后的 Unicode 字符偏移，删除原始 XHTML 标签扫描器；引号内 `>`、`xml:id` 和实体值均由 DOM 处理。位置迁移明确拒绝跨章节范围，返回 `highlight_range_crossed_chapter` 并保留原记录，禁止自动截断或跨章合并。
MOBI/AZW3 资源读取新增 `readEpubEntryAsync` Native N-API 桥接，Core 仍只读取有上限的单一归档条目，Host 在异步完成后再次检查取消代次，再交给统一图片适配器；同步 API 暂留兼容。HarmonyOS 结构回归已通过，但 Native 编译、真实 MOBI/KF8/AZW3 语料、HAP、VM、真机和用户验收仍未闭环。
文件名统一解析回归已补充 `绍宋 作者：榴弹怕水`、`从红月开始 作者：黑山老鬼 第1卷`、`覆汉（作者：榴弹怕水）精校版`，标题和作者均按同一解析模式保留。完整字段来源标记（尤其历史无标记记录）仍是开放项，不以猜测覆盖旧值。

**开源源码拉取复核（2026-09-12）：** 已从 GitHub 拉取 `DevinSterling/rbook` 到隔离证据目录，固定提交 `d440c7cf35db2fd31e938c0555448dbaec5437d0`，许可证为 Apache-2.0，源码归档 SHA-256 为 `ebbb3f213507073dc42522960df19690dc06636b4fe00db24ce1c329b3d2de21`；上游自身测试通过 35 个单元、54 个集成和 345 个文档测试。该源码未进入生产 Cargo.lock，rbook 仍受 Reader 兼容适配条件约束。
`zbf1009/all2epub` 当前 GitHub clone 返回 `Repository not found`，工作区没有源码、提交或许可证副本；搜索索引中的项目说明不能作为可采用的固定上游。错误原文和候选清单见 `evidence/oss-source-cache/source-manifest.json`，在重新获得可访问源码前不得引入或扩展 UMD 自研核心。

**MOBI/AZW3 方案补充结论（2026-09-12）：** UMD 是格式/缺口场景，不是候选仓库。上一轮只筛 Rust 库，范围不够完整；补查后确认 `libmobi 0.12` 仍是当前 Core 直接解析主方案，`KindleUnpack` 和 Calibre 更适合独立的非 DRM 转换兜底，`foliate-js`（MIT）可作为 ArkWeb 侧 MOBI/KF8 阅读试点。完整覆盖方案和许可证/运行时边界见 [`expanded-mobi-azw3-options.md`](evidence/oss-candidate-screening/expanded-mobi-azw3-options.md)。

**用户选型确认（2026-09-12）：** 用户明确选择 `libmobi 0.12` 作为应用内 MOBI/AZW3 主解析引擎。当前生产 Core 已通过固定版本 `bfabiszewski/libmobi` v0.12（commit `906274205c11944b628da1c553b255acb1af7c55`）接线；保留现有 Reader 适配层、资源上限、完整性准入和异步 Host 资源桥，不引入第二套生产 MOBI 解码器。后续闭环只补真实混合 MOBI/KF8/AZW3 语料、资源生命周期、性能和 HAP/设备证据，不改变解析器选型。

**大而全候选筛选复核（2026-09-12）：** 按固定提交、许可证、上游测试、Reader 现有 EPUB/MOBI 夹具和 `aarch64-unknown-linux-ohos` 编译分别验证了 `rbook`、`ebook-rs`、`eruditio`、`mobi-rs`、`epub-parser` 和 `bokai`。结果不是“候选存在即替代”：

- `rbook`（Apache-2.0）OHOS `no-default-features + threadsafe` 检查通过，适合继续做 EPUB 包结构差分；仍缺旧式导航、资源预算、Reader 锚点/图片/完整性适配。
- `ebook-rs`（MIT）默认 81 项测试、核心 11 项测试和 OHOS 核心检查通过；标准 EPUB/MOBI 可读，但 HUFF/CDIC 与两个 Reader 部分 MOBI 夹具失败，且默认特性在当前 OHOS sysroot 下会触发 `zstd-sys`。保留为强备用，不替换 `libmobi`。
- `eruditio`（Apache-2.0）1045 单元、15 个 CJK 集成和 1 个文档测试通过；真实转换暴露 EPUB `<script>` 内容进入正文、TXT 默认标题/作者丢失，OHOS 检查被 `zstd-sys`、`libmimalloc-sys`、`unrar_sys` 原生依赖阻塞。只能作为候选试点。
- `mobi-rs`（MIT）自身测试通过，但 3 个 Reader MOBI 夹具全部拒绝，不能替代 `libmobi`。
- `epub-parser`（MIT）4 个 EPUB 夹具可读，但 EPUB3 NAV 夹具目录为 0；6 个文档测试失败，不能替代当前 EPUB DOM/导航路径。
- `bokai`（GPL-3.0-or-later）即使格式覆盖较宽，也不满足当前产品默认许可证条件，退出生产候选。

完整记录见 [`screening-summary.json`](evidence/oss-candidate-screening/screening-summary.json)、[`ebook-rs.json`](evidence/oss-candidate-screening/ebook-rs.json)、[`eruditio.json`](evidence/oss-candidate-screening/eruditio.json)。当前决策：继续保留 `scraper/html5ever` 和 `libmobi 0.12` 生产实现；优先对 `ebook-rs` 做隔离 EPUB/MOBI 差分适配，`eruditio` 先解决 OHOS 依赖图；UMD 仍等待可获得源码的 importer，不扩展无证据自研解码器。

## 11. 阅读与页面反馈统一收口（2026-09-13）

当前授权：审计、冻结完整实施规格、按修改内容整理提交；**本轮未获重新执行新方案的授权，也没有新HAP/VM/真机验收**。完整专项合同：[READER_REPAIR_SPEC.md](Reader-for-HarmonyOS/docs/READER_REPAIR_SPEC.md)。该文件记录实施约束和审计快照；实时任务状态仍只在本节维护。与此前THM/SHF条目冲突时，本节的最新用户决定与现证据优先；不改写旧证据。

### 11.1 已确认的约束

- 两套应用日夜色+八套阅读色，统一可扩展配置；胶囊/控制/应用页面用App，正文/顶部信息/系统栏用Reader。现有alpha层级保留，旧“控制全部不透明”判断作废；单书75%实色菜单独立有效。
- 同scheme选择阅读主题保留system，异scheme才取消system；应用改变切对应默认reader；同步选择ID/类别元数据和模式，不同步颜色；冲突手动选。
- 一个刘海开关，控制唤起始终显示系统状态栏；自绘顶信息与真实状态栏高度/区域互斥，颜色跟阅读主题。
- 四行列表不改字体：书名/作者/最新章节/来源+进度；实际源名称左齐、进度居中。书架模式未显式修改/恢复默认就保留。
- 书架工具栏四动作，整理仅默认单选分组栏；详情分组行和单书编辑分组复用同一语义，不开放CRUD。顶More与单书菜单分开；顶More动作名单不能仅由style-only图推断。
- 胶囊四入口完整3500ms帧轴、pause提前出现、文案/壳/页码同轴均已取得，不再列为需要用户补设计。超高导入结果滚动已定。

### 11.2 原反馈映射及当前待完成范围

用户编号重复8，实际21项；U为合同编号，避免与历史52项混淆。

| 合同 / 原号 | 关联原任务 | 当前状态 | 尚需完成 |
|---|---|---|---|
| U01/1、U07/7 | RDR/SET | ACTIVE | 统一单开关迁移、controlsPresented整个生命周期、系统栏/top info/metrics所有权 |
| U02/2、U03/3 | SHF/ACQ | ACTIVE | 去sourceId显示回退，普通/批量统一四行和进度锚点 |
| U04/4 | FIG-002/SHF-004 | ACTIVE | 筛选点击后状态完整对照，检查更新可见尺寸与命中区分离 |
| U05/5 | RDR/TTS | ACTIVE | 已定位十类胶囊偏差；按真实actor/3500ms轨道、即时呈现/异步业务、异常交接重构 |
| U06/6 | THM-001/002/SET-001 | CONFIRMED | 生产未接统一主题；Figma已有88项App双模式值，复用37差异项，补剩余浅表面候选，迁移/联动/全部消费者 |
| U08/8a | RDR/SET | ACTIVE | 所有full模块实际内容+键盘/安全区预算和固定操作，不能覆盖topBar |
| U09/8b | RDR | DECISION | 已有More→书签是无依据的中间实现；规格§5.3给完整菜单提案，不能当历史用户决定 |
| U10/9 | LOC/SHF | ACTIVE | 摘要状态图标、完整SVG、真实行高/安全高度；完成按钮318内宽已由Figma现场定位 |
| U11/10 | LOC/SHF | ACTIVE | picker顺序已改；补防重、各await后attempt/route复验、离页晚结果保护 |
| U12/11 | LOC/FIG | CONFIRMED | 静态导入缺motion；规格给明确候选时序；此导入树未返回motion，不能借搜索Make假定导入时值 |
| U13/12 | SHF-002/004/005/007/008 | ACTIVE + DECISION | 整理/分组已定，撤销错误CRUD入口；顶More最终名单和书架设置分区有具体提案但非旧已定 |
| U14/13 | SEA/SRC-002 | ACTIVE | 已有展开/收起，补按实际宽度排折叠行与固定操作槽 |
| U15/14 | ACQ/SEA | ACTIVE | 复用标准实体解码、受限损坏输入修正，各展示入口同源 |
| U16/15 | SEA/FIG | ACTIVE | 搜索Make完整源码已取得，1s linear spinner已定；稳定屏幕锚点、caption间距、批次不重启 |
| U17/16、U18/17 | ACQ-004/RDR-001 | ACTIVE | 2个生产缺陷已复现：bookUrl上下文与旧acquisition绕缓存；补分型恢复/诊断/目录行合同 |
| U19/18 | RDR/FIG | CONFIRMED | 32/44.44旧下限确诊；新24自适应公式属具体提案，先统一测量/渲染/纹理宽度与锚保护 |
| U20/19、U21/20 | RDR/SET | ACTIVE | 亮度lookup使中途写饿死已复现；Window唯一writer、latest pending、停指尾flush、自动状态和失败收敛 |
| 书架永久模式 | SHF/SYNC | ACTIVE | Preferences与Asset竞态已复现；本机配置单事实源、仅缺键旧数据迁移、凭据操作不重置 |
| 旧14项/Make7组/原52ID | RDR/TTS/QLT | EVIDENCE + ACTIVE | 规格§11完整映射，不把已实现再抓/UP/常驻槽/定时等重报缺代码；补unknown持久写、display fence、原生/性能/试听门禁 |
| 本地streaming新回归 | LOC-001/002/OSS | ACTIVE | 4个阈值探针全失败；复用标准HTML语义单路径，禁止WIP作为可交付Core |

### 11.3 执行门禁与剩余提案

实施按规格S0–S7：正确性→主题/窗口→胶囊→页面/动效→旧性能故障矩阵→稳定源码构建→同包VM→必要最小硬件与用户验收。已定位的代码问题不等设备来解决；UI菜单名单、Night补色对照、新正文默认和导入新时序按规格明确提案审阅，不把它们扩写成胶囊/TOC产品未定。

本轮已有生产改动按内容归档，WIP含已知缺陷，**提交干净不是产品完成**。当前Harmony既有198组本地合同通过，但部分旧胶囊/边距断言本身错误；两TOC+四surface生产探针与四parser阈值探针揭示了未覆盖缺陷。后续必须补失败转通过的行为回归，而非只调整正则。精确提交/来源/工作树状态见规格引用的workspace-commit-receipt。
