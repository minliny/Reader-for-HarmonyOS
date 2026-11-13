# 合流代码开发与全页面排版独立审计

2026-11-13。用户要求完成合流范围的代码开发与独立验收，并由独立 agent 审计所有页面排版、修复发现、再次独立复核。本批使用 `.reader-isolated/framework-confluence-20261112` 的 HarmonyOS、Core、UI 三个检出，原工作区的并行修改保留。

## 当前阶段

生产开发、全页面排版的代码侧独立验收及统一手动检查入口发布均已完成。全部开发、审计、修复和独立验收 agent 已结束，本轮代码侧目标完成。

代码侧批次执行源码、调用链、有限业务方法探针、真实 SDK 声明式装配、真实 Core 精确 Rust 用例和捆绑字体的本地测量，该批次结束时设备、模拟器、Previewer、HAP 构建签装为 NOT_RUN。随后用户授权的 VM 安装已完成，结果见末节。前轮 b447 候选及11月12日设备证据继续绑定其原字节。

## 输入与职责

| 范围 | 本批事实 |
| --- | --- |
| HarmonyOS 起始提交 | `88ddd4063a9d03f75320965738b13309b0f12e20` |
| Core 代码提交 | `c0781263`，起始 `e689f2ae`，八个受控条件编辑修复文件 |
| UI 权威提交 | `0915086`，起始 `9bfc916`，目录动作44vp及两个标准生成物 |
| 生产修复作者 | `repair_source_edit_atomic`、`repair_shelf_detail_layout`、`repair_reading_layout`、`repair_secondary_layout`、`repair_source_row_budget` |
| 独立审计与验收 | `independent_confluence_acceptance`、`independent_ui_primary_audit`、`independent_ui_secondary_audit` |
| 入口发布 | `publish_selected_checks` 维护手动选择元数据，交独立验收者终核 |
| 证据与集成 | Root 维护契约、登记、portable 报告和交付记录 |

实际变更从当前工作树字节绑定。提交动作保持已审源码字节，产品版本维持既有值。Core 条件导入能力的配套 Native 与新签名包已在后续 VM 安装阶段生成。

## 页面及宿主覆盖

人工清单覆盖四个 manifest 根和20个业务路由，并追踪真实 composition、页内面板与覆盖层。主流程报告列14个页面及宿主族，二级报告列16族，交叉宿主按责任引用处理。模块闭包的173个发现项含模块级过近似，统计口径为组件模块。

- 生产页面包含书架、详情、阅读、目录、搜索、书架多选与设置、应用设置、规则、书源、工具和下载。
- Discover、RSS 系列、Sync 及保留管理/选择宿主按源码可达性分别标明。既有 L0 产品准入保持，审计覆盖保留实现。
- `Index`、启动恢复、RendererPilot 和页面结构验证四个 manifest 根分别标明生产或诊断用途。
- 每个宿主检查实际内容宽、安全区、固定区与正文预算、滚动所有权、行及尾区分配、短高度、大字号增长、输入与焦点、状态及迟到回调。

当前正式机器登记仍为四个页面族的21个实例，共253个唯一源码输入。全页面排版审计的清单与正式页面登记分别保留各自覆盖口径。

## 修复及独立验收

首轮发现21项，包含 A 三项、B 七项、C 十项和编辑并发一项。后续独立复核继续发现真实叶节点、父预算和剩余文字列问题，追加记录并交独立作者修复。初审遗漏的横向预算和真实控件影响面已在原报告中更正。

| 范围 | 已修复内容 | 独立代码侧结论 |
| --- | --- | --- |
| A 书架与详情 | 真实安全区网格、多选响应式页头、共享列表增长、窄文字列的标签/进度分层、父行高与投影步长、量字缓存与字体就绪刷新、详情目标、管理态外分配和内填充、筛选动作两轴目标 | 七项场景覆盖完成，其中 selection 按未变分支复用，其余六项当前执行通过；原 handoff 当前通过 |
| B 阅读控制与漫画 | compact/expanded 测量准入、当前代最小预算、外观/设置/搜索/替换/TTS/自动翻页/计时器真实目标、短窗口正文及动作可达、漫画 dock、页头与父容器预算、隐藏实例退输入 | 六项精确场景当前通过 |
| C 二级与共享装配 | Source 分组实际宿主边界、JSON 有界表单、Tools/Rules 自然行高、恢复消息冷测量与旧回执、登录 Web 工具栏避让、选择面板、保留页面、下载当前章节排版及目录规则编辑器 | 五项 C 场景、JSON、目录规则和 Source 安全区共八项当前通过；稳定子范围按原回执及语义复用 |
| 书源安全区 | 行尾按控件顺序换行、文字偏好夹到真实父宽、查询输入随字体增长、页脚横排/两行与无递归 fallback、内外真实填充 | 80行及20组实际宿主场景通过，四个旧实现负例均拒绝 |
| Library 共享消费者 | 搜索输入与清除/提交目标、history、筛选/任务 retry、窄安全区分行、当前 actor 1→2→1、真实 header 回调链、query/IME 与旧 key 拒绝 | `native-targets` 当前独立通过 |
| Source/Core | 完整 sourceVersion 条件导入、原 intent/receipt、SQLite/Memory 事务比较、opaque ID 与 URL 分离、canonical 规则保留和原文格式准入 | 三个 Host 精确 case 当前独立通过，真实 Core 准确 Rust 回执按当前八文件字节复用；原竞态反例已转为拒绝旧保存 |
| UI 权威 | 44vp 动作规格及标准生成配对 | 当前生成检查通过 |

表中 C 的 Rules 指现有规则页和目录规则实际消费者，业务规则继续由原 Gateway/Core 拥有。实际命名和逐项问题映射保留于原始审计报告。

### 已确认的适配决定

- 短窗口隐藏书籍页头及重复模块导航时，同一 owner 的 Source、More、Back 仍在 Home 动作区可达。内容采用有界纵向或横向滚动，隐藏的保留实例同时退出输入、命中和无障碍遍历。
- 书架128vp文字列在2倍字号下将标签和进度分层，正文及投影步长同步支付196vp。180vp多选文字列保留合法行内排版。有限标签量字按宽、字号、字体准备及修订缓存，热路径读取缓存。
- 书源320vp、左右安全区各40vp、2倍字号时，操作区两行113vp，查询框62vp，页脚两行138vp。正文、Native 输入与页脚实测/fallback 同时支付对应预算。
- 原始 JSON 编辑要求完整 raw BookSource。旧 canonical 来源缺少完整原文时返回明确限制，现有规则及已有草稿保留。conditional import 省略/null rules 保留同一前态的 canonical rules，显式空规则及普通导入继续原有语义。
- D1 保留重复入口、D2 移除未用 prop、D3 下载常态列表、D4 Tools 往返保留、B4 独立检测准入均沿已裁决行为。

## 当前证据及登记

| 检查 | 当前结果与范围 |
| --- | --- |
| Source 原矩阵 | 32行、40局部目标、24预算，通过；零左右安全区、320/366及四字号 |
| Source interaction | 34模板、19暴露点，200 SDK样本及48 recovery样本通过；Recovery 的重复字体上下文仅证明最低约束 |
| Canonical E2 SDK 报告 | 176目标、22引用、24预算及十类拒绝边界通过，E3为 NOT_RUN |
| portable 输入 | matrix 120项、interaction 127项仓库内真实 read/load 输入绑定完整，原始与portable逐字节相同；UI主题、SDK和登记自身上下文单独冻结 |
| schema 与引用 | `validate-model`、`check-contract-refs` 当前 PASS |
| 页面登记 | Source18、Directory11、Downloads9、Tools5；control14共115项；层和不变量结果前后未变 |
| register 诊断 | 保留39项，其中 E2 FAIL21、E3 FAIL5、B1 NOT_RUN2、G-03 NOT_RUN8、SCOPE NOT_RUN3；manual403 |
| 消息入口选定范围 | 12个实际变更消费者，47/47来源入口及 retained `SourceManagementPage.statusBanner` 校验通过 |
| 统一手动入口 | 26个 focused case 与原 handoff 共27条 QUALIFIED、3条 external EXACT_ENTRY，默认 OFF；30 ID、55条定义路径及九文件精确路由通过独立 metadata 校验 |

目录规则只补入 detail/reader 的 FullDirectory 宿主。其准入要求 local、有效 bookId、TXT 格式和 `reading.directory.view.v2`，并分别登记字段、动作、原操作、消息、焦点及当前书籍身份。

Source portable 的两个生产者显式补齐真实加载的生产和 probe 依赖。register 自身及 control 引用集合属于独立元数据上下文，按当前实际消费字段复核，避免 register/layoutEvidence 循环指纹。当前代码报表保持 SDK 属性、有限状态和本地预算的证明范围。

## 可复现入口

下列精确命令仅在选定相应风险后手动运行。当前已执行结果及复用映射保留于原始回执。

```sh
node tools/test-shelf-detail-layout-sdk.mjs --case shelf-selection-frame,shelf-projection-frame,detail-action-target,detail-notice-width,management-parent-frame,shelf-list-residual-lane,shelf-filter-action-target
node tools/test-bookshelf-view-handoff.mjs
node tools/test-reader-control-layout-budget.mjs --case admission-sdk,module-minimum-budget,native-targets-sdk,manga-tts-sdk,header-home-sdk,brightness-sdk
node tools/test-secondary-layout-repairs.mjs --case select-host,actions-tools-rules,recovery-overlays,retained-and-settings,download-chapter-width
node tools/test-directory-rules-targets.mjs --case directory-rules
node tools/test-json-import-dialog-real.mjs --case json-url-form-admission
node tools/test-source-management-safe-frame.mjs --case safe-frame
node tools/test-library-search-surface-binding.mjs --case native-targets
node tools/test-source-owner-retention.mjs --case check-identity,tools-retention,editor-conflict
node tools/test-source-management-layout.mjs --case matrix
node tools/page-structure/test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets
node tools/page-structure/test-source-e2-evidence.mjs --case complete-targets,rejection-boundaries --matrix=tools/page-structure/evidence/source-layout-matrix.json --interaction=tools/page-structure/evidence/source-interaction.json --report=tools/page-structure/source-layout-evidence.json
```

执行前按当前脚本的准确 case 定义选择。统一 selector 的新增资格只覆盖本轮审阅范围，默认关闭。Library 旧三个 case 保留 REVIEW_NEEDED 和历史资格原因，当前 `native-targets` 独立登记。位于 `tools/page-structure` 的 interaction 三个 external 条目记录 direct 命令，开发者按该准确命令手动运行。

secondary 的 ArkWeb、download-controls、renderer-pilot、title-scale 四个稳定子范围按独立报告复用已有证据，本批保持未发布。新资格与执行结果分别登记，未选范围保留自身审阅和执行状态。无关旧元数据对象保持原值，A六个 SDK 场景的前提仅包含其实际依赖，Python/Pillow 前提只属于调用该测量工具的 residual 场景。

## 保留的失败与证据边界

- Source 编辑旧读取回执覆盖停用/删除的原失败、canonical 规则丢失的原复现均保留，后续修复分别独立复核。
- Recovery probe 补真实挂载后暴露旧世代断言错误，按真实 Watch 折叠语义修正，原失败保留。
- A 最终验收中的投影浮点严格等值与 handoff 缺属性运行时两项均属于测试装配，修复后只补失败/未运行项，selection 未变分支复用，生产字节保持。
- 全部执行 trace 区分 test exit 与输入完整性，执行期间漂移为失败。原报告保留自己的输入和结果，后继快照分别保存。
- 本地 CoreText/FreeType 与真实字体可定位预算，SDK 可证明真实组件属性及当前回调。原生命中、像素、系统字号、IME/手势仲裁、平台 Back、读屏及用户验收保持各自开放状态。

原始证据位于本机 `.reader-artifacts/framework-confluence-20261112/code-side-audit`、`independent-code-acceptance-20261113`、`code-side-final` 和 `selector-publication`。本文件保存可跟踪的范围、职责、结果、限制与复现入口。

## VM 安装阶段补记

随后用户要求安装到现有 VM 供人工验收。`31536cfb` 的第一次完整 ArkTS 打包发现此前 SDK 探针漏掉的类型错误，具体为 TTS 重复或缺失 Typography 导入、Scroll 的 Axis 枚举、Flex 链式对齐属性及 Column 对齐枚举。原失败日志及11条具体诊断保留于 `.reader-artifacts/vm-manual-acceptance-20261113/hap-build-01.log`。

六个生产文件已集中修正，保留 TTS 横向滚动、Slider 方向、RSS/Sync 排版和原动作。三个准确回归通过，并增加从真实生产 AST 提取调用、对当前安装 SDK 声明进行语义检查的负例。独立复核另审本批67个 ETS 的同类调用及 Typography 绑定，未发现同类残留。

这些结果分别证明方法/SDK 预算和合法 API 绑定。完整 ArkTS 编译与对应 HAP 仍由安装阶段的规范流水线实际执行。前述代码侧及原生结果继续按各自候选、实际输入和证明范围记录。此轮登记仅重绑受影响输入，原层和不变量结果保留。

修复提交为 `6547e23a`。第二次规范构建的完整 ArkTS 编译、打包及指定证书验签均 PASS，已保数据覆盖安装到用户指定的现有远程 x86_64 VM。

| 安装交付 | 实际结果 |
| --- | --- |
| 候选源码 | HarmonyOS `6547e23a`、Core `c0781263`、UI `0915086`，构建时均 clean |
| immutable run | `20261113T021008Z-6547e23a-236974ed` |
| App 构建身份 | `0.2.0.DEV.1645c70bd605`，versionCode `1000000` |
| signed HAP SHA-256 | `1684cd89cc42b44726ccb1a816cf2879bef4fbe6a341f307666018d24962d2dc` |
| 签名 | `minliny_HarmonyOS`、debug Profile，验签 PASS |
| Native | x86_64，SHA-256 `a3ac9563a615cfc69391ee272744b36ab1f3feb8b13ea177da6fc46a65b84d8d` |
| VM | remote，targetRef `6460677a198b`，准确目标和 guest readiness 已核对 |
| 保数据 | 原始停止态 DB/WAL 私有备份、三个真实 Core 执行映射五项兼容性证明、安装前复核及安装后 UID 一致，PASS |
| 安装后版本 | 系统版本、模块完整构建身份与候选一致，PASS |
| 启动与人工验收 | 新包 `launch=NOT_RUN`，交互及用户验收 OPEN |

首次部署在文件传输与替换前因官方调试沙箱 E003001 拒绝，保持原 FAIL 回执。按此前已授权的启动范围短暂启动旧 Reader 后，官方沙箱路径建立，随即停止并取得新鲜备份，第二次部署成功。新包留给用户手动打开。本次安装没有改写 E2/E3 的完整原生验收结论。

本机 manifest 位于 `.reader-artifacts/hap/20261113T021008Z-6547e23a-236974ed/manifest.json`，部署回执为同目录 `deploy-vm-6460677a198b-20261113T022219Z.json`。本节文字归档沿用该不可变候选，后续文档提交不触发重建。
