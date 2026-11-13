# 合流代码开发与全页面排版独立审计

2026-11-13。用户要求完成合流范围的代码开发与独立验收，并由独立 agent 审计所有页面排版、修复发现、再次独立复核。本批使用 `.reader-isolated/framework-confluence-20261112` 的 HarmonyOS、Core、UI 三个检出，原工作区的并行修改保留。

## 当前阶段

本轮最新范围已扩展到全部267个ETS模块的覆盖层装配与目录工具栏。原 `e81a9b33` 截图暴露了前轮叶节点验证未覆盖的父级页头测量和有效编辑宽度问题。当前代码修复、独立复验和最终消息/页面登记核对已完成，`f7851658` 已完成目录原生帧、收起边缘和一次授权原核对验证，后继 `6f879684` 已保数据安装并完成最终恢复文案断行验证。原始问题账本经独立去重及后续断行补审累计135个代码位置、57个生产文件。各批历史结论保留，最新结果见文末。

恢复消息与书签写准入的 `2cd1560f` 候选已完成代码开发、独立精确复核、登记核对及保数据安装，首次回执投影、浮动提示、快速/展开目录和只读章节选择均已在VM观察。原书签核对按钮只点一次，日志确认业务进入，结果仍未确认。全部72个真实Scroll构造点已完成代码审修和独立验收。`2b25343a` 的原生对照确认短详情额外293px位移完全消除，完整目录实际按钮进入独立目录，Back返回同一详情。目录轮廓及字号补修的 `b08aa6dd` 候选已保数据安装。用户随后反馈恢复按钮全闪且无可见效果，Root立即暂停VM，新增UI、业务owner、共享准入与元数据并行组完成代码修复和独立精确复核。当前登记与后续候选分别追加证据。前轮检查遗漏了真实宿主装配、入口差异、图标角色、浮层归属、保留控件闭包及短内容容器对齐。本轮结论以实际宿主覆盖、原始错误位置、根因和独立证据逐项对账。

当前发现库存为267个ETS模块、175个struct声明、41个页面或表面命名文件。旧静态组件闭包为173项。267个发现模块均已在生产宿主、支持模块、保留实现或诊断夹具中记录处置，缺失0。实际页面与变体由独立作者逐宿主记录。当前源码的HAP与VM证据在交付阶段另行追加。

代码侧批次执行源码、调用链、有限业务方法探针、真实 SDK 声明式装配、真实 Core 精确 Rust 用例和捆绑字体的本地测量，该批次结束时设备、模拟器、Previewer、HAP 构建签装为 NOT_RUN。随后用户授权的 VM 安装已完成，结果见末节。前轮 b447 候选及11月12日设备证据继续绑定其原字节。

以下至“VM 人工反馈后的定向修复”的记录保留各批原时点结论。其有限探针与已安装旧候选的证据不能覆盖本轮扩展修复。当前全域复查见文末。

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

## VM 人工反馈后的定向修复

用户在 `0.2.0.DEV.1645c70bd605` 手工检查时发现亮度 A 按钮变形、书签等待核对按钮无反馈、阅读控制内完整目录图标过大，以及收起按钮下方空白。该安装对应 H `6547e23a`、Core `c0781263`，HAP SHA-256 为 `1684cd89cc42b44726ccb1a816cf2879bef4fbe6a341f307666018d24962d2dc`。此前代码侧通过的范围漏掉了下列实际布局与触摸组合，本节追加其修复和验证范围。

| 现象 | 当前代码原因 | 修复 |
| --- | --- | --- |
| 亮度 A 圆几乎贴满轨道 | 44vp 命中预算同时成为内部标记的绘制尺寸；track 全额扣除 carrier 增长造成 cap 中心偏移 | 外层保持44vp目标，内部按20vp起的字盒增长并保持正方形；按端点中心支付对应轨道预算 |
| 完整目录工具栏图标过大 | `ReaderControlDirectoryContent` 漏传变体，默认 standard 使用24vp图标 | 两个实际目录工具栏宿主传已有 full-directory 角色，图标16vp、内部底板32vp，native目标保持44vp；自然量字预算同步传递 |
| 收起按钮大量下留白 | native按钮由旧26vp增长后，内部文字仍绝对y6/7挂在顶部 | 保留44vp命中，内部26vp起的自然字盒胶囊居中，标题与16vp模块图标按实测页头高度居中 |
| 书签提示点击干扰控制栏 | 恢复区触摸向阅读器父级外点关闭识别器冒泡 | 恢复Scroll负责自身触摸传播边界，保留实体子按钮和原owner的生命周期/代次/忙碌准入 |
| 书签等待核对丢掉原因 | 独立canonical列表读取成功后，未知原操作的原因被公共投影缩成等待核对 | 保留原owner提供的核对原因，核对期间由owner发布reading事实 |
| 无已知原操作时读取错误变成未知写 | intent读取失败的外层catch捏造createPosition/unknown | 作为加载失败向现有调用方传播；已有真实原操作及其精确回执继续保留 |
| VM日志出现render内修改State | 子Prop Watch发布最低预算provider时，父同步写`controlMinimumReady` | 响应式提交经当前代postFrame；同步provider/generation失效继续约束当前输入 |

当前 VM 截图、树、应用身份与既有日志保存在私有 `vm-ui-feedback-20261113`。向上拖动可展开目录，恢复区实测高度参与共享正文/控制预算，因此目录展开的上界落在提示下方。原操作的未知回执不承担目录阅读准入。该场景的“点击提示后关闭控制栏”由代码和本地触摸路径覆盖，当前VM未实际点击该恢复动作。

现存书签 intent 为460字节，mtime为2026-11-08，官方shell和文件接收均拒绝读取其内容。此结果只记录调试读取的权限边界。当前App已投影可继续原操作，具体原记录内容尚未取得。恢复核对不派发新`bookmark.create/delete`，会在合格原回执下保存、结算或清理同一intent的元数据。自动审批因此拒绝本轮核对点击，未执行“继续原操作”，原文件保持。

本轮三个分支分别修复，由其它作者交叉审计，Root独立复核书签分支。只选择亮度/测量准入、目录图标/页头间距、书签Host/实体恢复表面的准确用例。旧源码反例、实际输入追踪与独立复验分别留存。Core Native、既有存储语义、产品版本和签名身份沿用当前候选。

三个分支的当前源码已冻结。亮度作者与目录作者交叉审计，Root独立审阅书签Host/投影/触摸链并复跑`node-protocol`、`host-retry`和新版`recovery-surface-sdk`。恢复表面新用例使用实际父`onControlBackdropTouch`及生产外点policy，旧传播路径产生一次关闭，修复后同一组事件保持父pointer未取得，实体重试按钮仍调用原owner。当前输入追踪完整且稳定。亮度独立审计还发现同帧provider失效与旧Panel key的两个窗口，已通过当前generation和精确candidate key约束收口，恢复入口继续使用独立会话准入。

交叉作者在最终组合源码下复验`admission-sdk`、`brightness-sdk`、`header-spacing`和`icon-roles`均通过。目录报告为26组样本，亮度分支保留初次旧实现负例和后续动态准入回归。三组修复的证据均保持代码/SDK范围。

用户随后明确授权在修复版执行一次原回执核对，允许合格回执下结算同一条记录。初次自动审批拒绝及所有原始失败保留。修复候选及VM复验结果将在本节后续追加。

## 人工反馈触发的全域代码复查

### 数量与统计边界

以 `687c798e` 为本轮源码基线，当前逐项确认125处原有错误代码位置，分布在56个生产文件。原冻结批次为100处，包含主流程38处、阅读与漫画22处、二级与消息29处、交叉审查11处。后续追加书签写准入6处、Scroll内容对齐6处、独立目录轮廓和字号5处，以及恢复交互和共享准入8处。全部新增位置均与原始Git字节核对，新增回调、helper及修复过程遗漏单列。位置以原始错误表达式、分支或报告列明的方法边界计数，重复行、选项和传参包装不计入。该数字描述源码位置，页面数量与实际可见故障次数分别记录。

267个ETS发现模块逐项对账，缺失0。主流程记录12个宿主族及其状态变体，阅读与漫画记录85个模块，二级域记录49个指定模块和8个委托入口，Root补齐装配、平台适配、支持规格与诊断夹具处置。诊断夹具的发现处置只证明审查范围。

完整位置、当前文件指纹与统计规则保存在私有 `vm-ui-feedback-20261113/universal-audit/audit-ledger.json`。各域覆盖表保存真实挂载链、变体、支持模块和发现引用。修复过程中出现的时序与装配遗漏另行列账，包括最低预算延期后的旧输入窗口、RSS新列表几何订阅断链、短窗列表切换缺位置交接、临时层缺响应式投影，以及恢复表面首次重新激活的通知触发。

### 为什么会错

| 共因 | 已确认的代码行为 | 当前处理 |
| --- | --- | --- |
| 绘制与触控共用尺寸 | 44vp目标被用作亮度圆、紧凑按钮背景或动作行高度；完整目录采用standard默认recipe；收起按钮沿用旧顶部偏移 | 字形、背景、文字行盒与原生carrier分别消费既有规格，父容器支付完整命中空间 |
| 父子预算缺口 | 固定行盒、父最小高度和虚拟列表extent没有共同随实际字体增长；短窗固定chrome使列表高度归0 | 使用当前量字结果，文字、行高、extent与定位同步；短窗chrome进入唯一List前缀并保留实体锚点 |
| 短内容默认居中 | Scroll默认Center令短详情整体下移293px，内容较长时该偏移归0；仅检查子Column的alignItems和header inset漏掉容器对齐 | 72个真实Scroll逐宿主分类，六个生产文档位置显式采用Top，保留水平居中与原滚动偏移 |
| 保留节点捕获旧事实 | 相同key保留的Dialog动作、导航选中态、菜单分隔线继续读取首次构造的快照 | 同一原生节点读取当前事实，真实回调再次核对当前准入 |
| 通知跨过正在渲染的View | 子Prop Watch或生命周期直接通知正在render的父State；原有限probe人工replay掩盖跨View订阅断链 | 核对真实SDK逐View语义，子身份即时失效，父发布延期并核原身份；Native List几何归持有geometry的同一View |
| 业务事实与展示所有权混淆 | 意图文件读取失败生成虚构unknown写入；A书原操作常驻B书；已知结果沿用未决外框；恢复层参与正文分页 | 原实体和原回执限定投影，读失败、已知结果、未知原写分流；阅读恢复独立悬浮，控制栏关闭后恢复原书核对入口，写准入由原owner独立发布 |
| 临时覆盖复用阅读转场 | 打开换源推进导航和重绑entry；读取失败或旧pending回滚恢复启动非活动reader | 打开保留原宿主；已知失败留在原picker重试同候选；恢复只为原活动reader恢复session，成功选定目标仍明确交接 |
| 入口与缓存缺媒体资格 | 精确书架身份被搜索category过滤；旧DTO缺类型先画标准hero；旧prepared/job可把canonical text换成manga；shelf seed漏kind | 精确身份优先，既有exact GET确认durable类型后进入原流程；Host、prepared复用、共享job和body投影核同型；缺类型显示当前准备或错误状态 |
| 旧回执借用新宿主 | 下载Area、胶囊测量和封面失败回调缺少原展示、布局、类型或资源世代 | sender捕获原身份，接纳与延期交付核当前身份；两种外部目录与阅读恢复均传当前活动投影和即时lease |

历史追溯可确认，`31536cfb` 的自然高度补修把紧凑recipe内层直接提升为44并增加上下padding。更早的hero补偿和换源流程也有独立来源。本轮按当前错误机制逐项修复，各位置的历史来源保留于私有审计材料。

上一轮检查偏重最低触控尺寸、有限预算与状态方法，缺少实际宿主组合、保留节点更新、原生属性订阅归属、异步补型和原始业务身份的联合核查。逐页清单和组件发现数量无法覆盖这些执行路径。本轮补充的契约要求已进入 `PAGE_STRUCTURE_CONTRACT.md`，并由非作者独立审读。

### 用户八项反馈的当前对应

| 反馈 | 代码侧结论 |
| --- | --- |
| 搜索入口详情封面偏上 | 文本hero封面underlap与标题额外24vp补偿不一致，已共同采用header clearance |
| 详情换源图标偏大 | 文字动作的44vp命中被绘成同高背景，已恢复紧凑绘制和独立carrier |
| 完整目录进入阅读 | 目录按钮直连完整目录宿主。两个上游自动阅读出口已修，分别为换源读取失败及旧pending恢复。当前2b候选实际点击进入独立详情目录，Back返回同一详情；旧故障的当次触发链仍未关联 |
| 所有书出现未决书签并挤正文 | 已修读取失败伪造原写、外书投影、消息类别和触摸冒泡；恢复层独立悬浮。本轮目录前缀回归已撤回，控制栏关闭后的真实显隐订阅、所有写actor与全局写准入已独立复核 |
| 换源先切页再弹出 | 已修opening推进导航/entry，以及失败、回滚恢复的宿主丢失；原候选重试、原pending回执和成功目标交接保留 |
| 管理页图标大小与按钮比例异常 | 已拆分source按钮及共享labeled/icon动作的字形、背景与目标，逐recipe验证；其他导航图形按原资源角色核查 |
| 小说/漫画标签错版 | source分类恢复32vp绘制、自然文字居中与44vp原生目标，当前父预算及32行组合/40目标/24预算独立通过 |
| 书架详情封面和标题偏下 | 已确切关联短Scroll默认Center，旧候选额外下移293px。2b原生帧在内容高2246px和startInset402px均相同的条件下，Column起点由293px变为0；短/长/类型/字号代码侧回归独立通过 |

### 独立证据和采用决定

Root独立执行阅读9项同进程精确场景、主流程6项、后续canonical/cache3项、source失败/恢复/成功交接3项、目录glyph、两目录恢复消费者和当前Source矩阵。非作者分别核对胶囊测量、共享恢复显隐、RSS真实跨View订阅和下载6个Area回执。精准trace固定实际源码、SDK和所选case，历史失败与过期证据保留。

最终元数据采用Control revision16，21个正式实例同步引用。新增45个手动case，刷新12个既有精确case，默认全部OFF。14个未运行兄弟case和9个尚无精确复用证明的旧case保留 `REVIEW_NEEDED`，原PASS另存历史证据。更新指纹与执行测试分别记账。

阅读页为胶囊采用统一44vp通道。1×胶囊绘制仍为原24vp，常态正文相应减少19/20vp，胶囊上移10vp。这是本轮采用的可逆布局取舍，固定正文通道使用非IME安全边，键盘仍由原局部或RESIZE owner处理。

当前代码的真实字形、像素、原生命中、平台返回、焦点与用户验收保持各自证据边界。候选构建与VM复验在所有作者和独立审查完成之后进行。书签核对只处理已授权的同一条原记录，合格回执才结算，未知结果继续保留原intent。

最终静态核对的 `validate-model` 通过，消息全树165/165通过。首次引用核对发现下载六个变体仍指向旧range recovery入口，已逐项改为现用PageState入口，原六项FAIL留档，单独复验 `check-contract-refs` 通过。`check-register` 继续保留39项原诊断，分别为E2 FAIL21、E3 FAIL5、G-03 NOT_RUN8、SCOPE NOT_RUN3、B1 NOT_RUN2。层与不变量的原判定保留。

### 首次完整编译的补遗

`a2eafa15` 的完整候选构建在CompileArkTS失败，签名和安装尚未执行。具体诊断为两份ETS中三处本轮新增对象展开，以及LRE两处已删除 `scheduleReaderRecoveryMeasurement` 的遗留调用。此前有限方法lowering漏掉了这两类问题，原始失败保留在工具输出和私有 `build-attempt-01.json`。

对象转换移入已有 `ReadingEntryDto.ts` 薄工厂，两份ETS转交调用。当前实际SDK AST确认旧三处SpreadAssignment降为0，14个请求字段、13个seed字段的值、引用和缺省语义有准确断言。Root独立kind/dto/prepared三case通过，203个实际输入稳定。两处失效测量调用已清除，恢复表面继续直接消费当前viewport/control几何，准确 `recovery-floating` 通过，非作者只读复核完成。上述五处属于本轮修复遗漏，单列于修复补遗，原有100处定位口径保留。

### 6df7044e 候选及重新打开的代码补修

第二次完整构建通过，候选 `20261113T045429Z-6df7044e-6fd8b655` 已用指定证书签名并保数据覆盖安装到原远程x86_64 VM。App身份为 `0.2.0.DEV.1a569bff4b64`，signed HAP SHA-256为 `99498ac14f3cd21feafc19bf8513af7a3f5a4662190c51b43d381922a9d7a58a`。Core仍为 `c0781263`。部署首次在本机证明材料组装时因准备文件路径失效停止，原FAIL保留。修正路径后核对原停止态及已完成证明字节，复用同一备份与三次真实Core执行，随后安装成功。

该候选实际亮度按钮保留44vp命中框，内部A圆为独立紧凑绘制。进入Sample EPUB的快速目录后，恢复提示占满并截断列表，首章不可见。私有原始帧为 `native-6df7044e/reader-control-fixed-directory-6df.png`。本次未执行原书签核对，也未继续原操作。发现后停止VM交互，回到代码定位。

| 补修项 | 代码根因与影响 | 处置及证据状态 |
| --- | --- | --- |
| 本轮恢复前缀回归 | `hasBookmarkRecovery` 将正常快速/完整目录的headerCount提升为1，恢复消息自然高度进入prefixHeight；提示变化还提升prefixRevealRevision，取消初始章节定位并滚向提示 | 已撤回恢复前缀，保留短窗chrome自身的前缀；章/书签读取与导航继续沿原owner执行。属于本轮修复后果，独立SDK复核通过 |
| 本轮恢复显隐订阅遗漏 | 浮动层准入只读取plain motion事实，原生绘制属性缺少同View的控制栏State订阅；手动replay有限probe掩盖关闭后的更新缺口 | 保留即时输入lease并补真实响应式投影，当前State及实际装配复核通过。属于本轮修复后果 |
| 原有书签删除准入缺口 | 创建开关不能约束已有书签的删除marker；叶节点、树列表、完整目录与漫画目录实际调用链存在独立写入口 | 同一业务owner的写准入已传到所有实际写actor。九个实际构造点明确绑定准入或只读角色，手势起始及最终派发同时核对 |
| 原有跨书籍写准入缺口 | 消息按当前书籍过滤后，Host仍受全局未决记录约束；冷启动先打开B书时，foreign intent读取后返回且operation为空，当前书读取成功也不能确认A书原写 | 现有Host发布独立只读写准入事实，保留全局mutex、intent及回执规则。首次目录读取接入原authority，沿既有first-page/deferred链完成资格交接，独立复核通过 |

前缀probe此前断言“有恢复消息便存在List前缀”，验证了已选实现。它缺少正常快速目录剩余视口、初始章节定位以及真实父显隐订阅的反证，因而未捕获这次回归。补修用例改为从实际父装配检查可见目录内容、读写资格分离及控制栏关闭后的浮动恢复入口。该用例的SDK结果仍限定于装配与属性，实际像素和触摸需绑定后续候选。

原100处保留全部旧ID，新增6处追加，汇总为106处、49个生产文件。新增位置分别为Row写资格、Tree写回调、Tree硬编码enabled、手势起始资格、手势最终派发和首次目录authority装配。foreign intent未独立发布全局写资格与原 `SEC-02-1` 属同一代码边界，补充根因并去重。Root已核五个UI文件原始SHA和表达式，以及初始装配在原基线中的同一漏项。修复后果单列，历史PASS、失败候选与原始实屏均保留。

两作者本次合计18个生产文件，独立审查已冻结。准确 `pending-prefix` 复核通过，137个稳定输入，覆盖quick/full/short与chapter/bookmark六种组合、实际首行和书签读取actor、Row/Tree读写节点、九个真实构造点、当前State显隐以及两个原缺口负例。准确 `global-write-admission` final04通过，90个稳定输入，覆盖九组owner情形和已进入读取后的退场拒绝。后者使用真实原子文件IO、Host/Gateway/intent qualifier及有限受控RPC，没有运行Core CLI或构建。首次缺CLI、夹具失配及断言失败均保留。

独立Observed诊断通过，120个稳定输入。实际Index的State、entry闭包、Entry.directoryScene、Operations.recovery及RetainedReaderScene的ObjectLink与Builder共同执行，false→true→false只通过SDK属性flush传到同一Shell子实例。没有手动回放observer或直接重赋Shell Prop。FullPanel和NavigationSurface的父转发口另经真实源码审读。Native列表clamping、像素和命中仍需后继候选。

本次登记为Control17，目录13个实例revision15。五个JSON实际变化，tiers字节及既有755权限保持。已删除恢复prefix消息入口，消息全树164/164通过。新增global准入case默认OFF，原node-protocol因实际load/recover路径改变降为当前 `REVIEW_NEEDED`，历史PASS保留，当前共34项待审。72个本批case按实际方法影响分别记录复用或当前资格，未刷新全树证明。

Root最终四项静态核对中 `validate-model`、`check-contract-refs` 通过。`check-register` 保留原39项诊断，E2 FAIL21、E3 FAIL5、B1 NOT_RUN2、G-03 NOT_RUN8、SCOPE NOT_RUN3，全部页面层结果及不变量保持原判定。可选的Source旧layoutEvidence当前引用已撤下，原样本和哈希保留，旧报告没有冒充本次字节。

### 首次读取的回执投影补遗

`9cab47ae` 候选完整构建、指定证书验签和保数据安装通过，run为 `20261113T055038Z-9cab47ae-d74e868d`，App身份 `0.2.0.DEV.536530c56082`，signed HAP SHA-256为 `9833a50b4c907dbd5245c19dd9aa6b6c1e7b203efcbdd352c13755c5c8ba87b0`。新鲜停止态DB/WAL、三次已有编译缓存的Core运行及五项兼容性证明均绑定该候选。启动后确认现有书架和Sample EPUB正文可用。

Root在后续代码审读中发现 `projectDirectory` 的初始Binding只交付entries和写准入，没有转交Host已经恢复出的原操作。Entry因此缺少该原回执，要等显式打开目录时由Operations发布snapshot才有核对入口。增强准确case在未改动的 `9cab47ae` 生产源码上实际失败，Entry.operation为undefined。该缺口属于本轮初始authority接通后的修复遗漏，原106处总数保持。

两个生产文件现沿既有Lease转交原operation，继续核当前Runtime、scope、Host及sourceId/bookId/title/author。Entry按原Operations模式复制顶层DTO，保证同一Host操作就地更新projection时，Observed页面能收到新发布。没有新增读取或新操作owner。初始同书unknown与confirmed、foreign隐藏、旧lease/替换Host及四个身份字段均有准确回归。

增强global准入case独立通过，90个稳定输入。首次同书恢复仅query1次、list1次、新写入0，分别产生pending或已确认的none投影。独立operation-only诊断通过，121个稳定输入，实际Lease回调经Observed Entry、Index闭包及Retained同一Shell自动收到pending→pending-busy→readback→none。没有手动回放observer。原UI137输入的目录及浮层State证据按未变方法复用，原失败及两次独立增量均保留。

本补遗当前字节的HAP与VM验证待后续绑定。原 `9cab47ae` 帧、安装结果和源代码侧失败各自保留。

### Scroll内容起点全量补审

`2cd1560f` 的实际短详情中，Scroll原始框高2832px，唯一Column高2246px，额外居中偏移恰为 `(2832-2246)/2=293px`，约83.7vp。Hero位于695px，等于Column顶293px加既有startInset402px。长内容超过视口时该额外偏移为0。子Column的 `alignItems(Start)` 只控制它内部的子节点，无法设置Scroll对唯一内容子节点的对齐。这将用户第8项反馈关联到实际容器原因。

官方实现先采用CENTER，再消费显式alignment，计算结果叠加原滚动偏移。本批采用原生 `Alignment.Top`，其水平方向仍居中。上游master提供算法参考，本机SDK声明与当前VM几何分别提供适用性证据，未把master源码当成当前VM引擎字节。[Scroll布局实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/pattern/scroll/scroll_layout_algorithm.cpp)

267个ETS中发现72个真实Scroll构造点，位于45个源文件，逐一核对母子链和高度分配，待定为0。分类为既有Top15、横向10、自然收高18、精确或下限预算13、明确居中6、子节点尾对齐1、按分支溢出或状态居中1、已修生产6及已修诊断2。普通方法名中的Scroll字符串没有计入构造点。

六个生产位置位于五个文件，分别为详情document、书架筛选动画视口、导入选择document、导入compact结果、漫画宽窗动作body和目录规则120vp预览。每处只增加原生Top，原尺寸、测量、手势、Scroller及业务身份继续由原owner负责。两个诊断位置单列。Root逐个确认六处原始modifier chain存在于 `687c798e`，与原106处表达式无重复，汇总为112处、53个生产文件。

五个准确case完成作者与非作者交叉验证。详情case覆盖16种短/长、text/manga/旧local/未知remote及1×/2×组合，203个稳定输入。document三宿主case为198个输入，导入实际有界组合为117个输入，阅读两case共同为120个输入。原commit源码缺Top负例已被拒绝，夹具缺枚举及相对import的历史失败保留。SDK证明原生属性及实际声明式装配，新增Top后的像素与真实滚动由下一候选单独观察。

登记只补五个默认OFF入口及实际源输入，Control17、Directory15、层结果、不变量和消息登记保持各自原判定。72项分类、各原始位置及精确冻结记录保存在私有 `scroll-origin-audit`，阅读域29项及交叉审查保存在 `reading-scroll-alignment`。

### 原书签核对与Scroll原生对照

`2cd1560f` 的保数据安装与启动通过。首次进入Sample EPUB即出现当前书籍的独立恢复提示，正文边界保持，打开Home后提示退场，关闭控制栏后原提示恢复。快速目录首章可见，已有书签的写marker禁用，章节选择仍可读取并返回正文，拖动可展开完整目录。亮度紧凑绘制和44vp目标、ReaderControlPanel的居中收起轮廓已有对应帧。

Root按授权只点击一次原记录的核对按钮。`14:07:59.449` 的Reader日志确认原业务核对已进入，返回“原操作结果尚未确认”。现有intent继续保留。两张先后帧均显示未决状态，busy过渡的实际像素保持未验证。此前调试读取460字节intent内容的权限失败保留。没有点击继续原操作。原帧、操作回执与日志分别冻结于私有 `native-2cd1560f`。

`2b25343a` 的候选run为 `20261113T063502Z-2b25343a-446ea723`，App身份为 `0.2.0.DEV.2dfebea37cd4`，signed HAP SHA-256为 `c3f7a93149b785aa5199e6eafa2e8fa05a2cd16d0a6fa9d097ea00fa3016274c`。指定证书验签、候选绑定的停止态DB/WAL兼容性证明及保数据安装通过，UID维持 `20020064`。

同一本书短详情的Column原始起点由293px变为0，内容高度2246px和startInset402px均保持，Hero顶由695px变为402px。实际点击当前详情的完整目录按钮后进入独立详情目录，正文未挂载，Back回到同一详情。该结果证明当前入口旅程，旧候选的当次错误触发链仍保留未关联结论。对应原帧和动作回执冻结于私有 `native-2b25343a`，后续仅目录按钮绘制与字号观察路径变化时复用上述准确旅程结果。

### 独立目录轮廓与字号通知补审

`2b25343a` 的独立目录仍有两个收起变体把44vp原生命中框全部涂色。历史实现的轮廓为40×26vp，扩大触控范围时绘制也被扩大。当前phone Native Button和expanded Stack均保留原动作与44vp下限，内部文字以自然尺寸加左右10vp、上下6vp内边距生成轮廓，40×26作为最小规格。标题使用现有弹性剩余区为动作增长让位。

真实挂载还确认两个字号通知漏项。FullDirectoryPanel原Watch及延期flush执行后，同一个原生页头actor仍停留44vp。ReaderFullDirectory原Watch、measurementKey和geometry都更新后，其子View内Back actor也仍停留44vp。两处静态metrics getter各消费既有StorageLink revision后，同一actor可取得2×所需64vp。26个字号getter逐项核对后，24处直接读取revision，一处经currentMetrics读取，一处在同一observer的既有caller链读取，后两种继续沿用原实现。

ReaderFullDirectory的共用换源文字另有24×15vp固定框，phone和expanded均消费该leaf。其Inter800/12fp角色继承系统字号，2×的CJK参考字形宽48vp、高22.59vp，SDK字体metrics高28.14vp，超过旧框。当前保留原字体角色、20vp图标、62vp动作宽及原准入，文字采用自然宽高和24×15×scale最小框。父列2×所需54.75vp由64vp页头支付。SDK字体预算与VM实际fallback字形分别保留证据范围。

上述5处均逐表达式核对 `687c798e` 原始字节，原行分别为FullDirectoryPanel的416、424、1298和ReaderFullDirectory的554、536，分布文件已在原53个文件内，累计117处。两个新增精确case由非作者分别独立执行，`full-directory-font-revision` 为130个稳定输入，`full-directory-source-caption` 为121个稳定输入、4个实际parent样本及2个旧框负例。`standalone-collapse` 的32组静态和2个实际挂载动态actor使用原129输入通过证据，未变方法按精确差异复用。getter纯换行和同义负例needle同步经静态复核，执行输入原SHA保留。

文案变更采用生产字形预算。最窄294vp面板的内宽268vp，2×标题及图标共80vp。四字“收起目录”动作宽100vp，六字“收起完整目录”宽140vp，均能容纳。九字“收起目录并返回阅读”宽200vp，合计超出12vp，须同步调整父行装配。当前生产短文案保持单行。契约6.9已补充自然轮廓、父长文案边界及实际原生观察节点的字号订阅要求，非作者完成静态审读。

本批只选择三条准确新入口，默认关闭。新增字体依赖、Pillow预算与SDK装配均在实际调用范围显式记录。旧负例、probe装配失败及trace路径拒绝保持原判定。模型、引用及消息事实沿用未变结果，登记核对仅检查更新后的真实输入与原有层判定。本批候选及新轮廓实屏在全部作者和独立审查结束后单独追加。

### 恢复按钮全闪的代码复核

`b08aa6dd` 的候选run为 `20261113T072056Z-b08aa6dd-fd431b5f`，App身份 `0.2.0.DEV.690194df3c4f`，signed HAP SHA-256为 `7e81ca7770207a193734e45dd4081ff4559943d0575a67c3382b516ae4476940`。构建、指定证书验签、三项实际兼容性执行及保数据安装通过。Root仅启动并沿既有入口到达详情，尚未取得新轮廓帧，随后收到用户的新问题并停止VM操作。

本批按UI状态、原业务owner、Gateway协议和元数据拆分并行处理，具体根因如下。

| 代码根因 | 普遍影响与修复 |
| --- | --- |
| 已确认读回失败转为读取中时，DTO的两处kind分支遗漏显式重读，先得到none并令visible=false，读取再次失败后重新挂载 | 书签、离线两家均修。原owner的显式recoveryAction延续同一代读回表面，成功与失败继续消费原确认事实 |
| 共用读回动作行只在failed且canRetry时绘制 | 显式重读期间保留同一行并禁重复，覆盖部分完成与离线物理整理失败变体 |
| 核对与继续的busy全部绑定主按钮 | 两个原业务Host发布只读recoveryAction，原Operation、Entry与三个实际Surface消费者完整传递，spinner归实际动作，同组准入保留 |
| 共享Notice的主按钮条件与测量宽度均遗漏secondaryBusy | 两处条件同步补齐，继续进行时原主按钮与父宽预算保持，其余默认secondaryBusy=false的调用点行为沿用 |
| 书签显式核对的返回结果只进入诊断，未决界面恢复原状 | 接纳的当前尝试结束后沿既有Index短反馈宿主说明原结果。早退、旧代、退场与被覆盖宿主保持静默，原未决事项继续保留 |
| 无精确回执时只拦流水号已越过，未检查下一序号恰相等 | 两个共享intent域统一核对Core既有head+1准入。不连续的原intent保留并阻断继续派发，当前VM原记录的序号仍未知 |

原125处中，本节追加6个原UI表达式、1个共享序号边界及1个书签结果交付边界，全部匹配 `687c798e` 原始字节。Owner只读字段、布尔接纳结果、helper和DTO转发属于修复实现。新浮层外Scroll从Transparent改为Default属于本轮修复后果，按实际边界排除同级正文手势，并保留祖先止冒泡及区域外阅读输入，原有错误计数独立保留。

当前构造库存为34个Notice、34个Action和3个DirectoryRecoverySurface，共71处、34文件，库存按真实宿主、flow继承与浮动边界分类。共享secondaryBusy的新条件仅影响实际传入该事实的DirectoryRecoverySurface，其他默认false消费者沿原分支。Gateway审计确认原operationId、冻结DTO及指纹从query、settle到continue保持同一原身份，transport requestId负责独立的RPC关联。当前查到的序号缺口按2域、7个构造点及4个消费文件登记范围，未推断私有原记录内容。

非作者独立执行UI两个精确case，120个实际输入稳定，覆盖已知读回、主次busy、部分完成、成功、失败、当前及退役动作和三个实际caller。五次spinner绘制分支按有限外部paint端口处理，SDK结论包含属性和回调，真实像素保持开放。两个业务case独立通过，65个稳定输入，使用临时AtomicIO及有限RPC，核对原ID、blocked、早退、旧代、退场、合格回执清理及离线整理失败，实际VM原记录未读取或操作。Root独立执行共享序号case，9个稳定输入，14个双域场景、4个显式不可能继续拒绝及2个旧guard反例通过，Core既有admit规则经源码交叉核对。

新浮层命中边界准确case的117输入独立证据按未变表达式复用，新增readonly转发由UI的真实caller AST核对。普通短反馈实际经Index的既有当前Runtime及前景准入，根Stack中的ReaderTransientToast位于保留阅读层之后且zIndex为1000，继续沿原host/key/generation生命周期。该源码结论保留实际像素边界。

`FRAMEWORK.md` 原空间合同仍要求noticeBottom推动正文和控制预算，与本轮用户指定的独立悬浮要求存在冲突。Root已仅更新该节四段，使长期规则与当前实现一致，并由UI作者静态复核。当前新修复的真实Native闪烁与触摸保持待验证，候选更新只在全部开发与独立审查结束后执行。

最终发布6个新手动case，均默认OFF且resources为空，3个新测试文件只进入显式integration目录，既有scope保持。QUALIFIED从2393增至2399，原34项REVIEW_NEEDED保留。Control17、Directory15和21个页面实例的版本、层结果及不变量保持。13个已有目录Host输入的实例补入共享ReadingOperationIntents依赖，另外8个实例继续沿原登记范围。

Root通过公共AST checker一次选择4个实际变更入口文件，当前33/33登记通过，完整164个消息ID集合保持。首次check-register出现45项，其中6个新增SOURCE_DRIFT来自消息登记说明更新后下载页仍引用旧清单SHA。Root仅修复这6个既有引用，原45项结果保存，再次准确核对恢复为原39项诊断，SOURCE_DRIFT为0。模型和引用核对结果按未变schema及事实ID复用，新增6入口的当前test SHA、默认OFF、空资源和tiers原755均核对通过。没有通过dispatcher重复运行已独立验收的精确用例。

## 全应用覆盖层与目录工具栏补审

### 实际原因与原生锚点

当前安装的 `e81a9b33` 原生目录帧中，topBar为193px，整个HeaderHost为550px。恢复卡多占357px，约102vp。手机目录将恢复内容放入自然页头后，该高度进入content.startInset和fullPanelTop，压缩剩余展开高度。Recovery的busy、文字与generation又经Watch重新失效页头measurementKey，目录输入随重新测量暂退，形成整个表面闪动。

同一帧的搜索外框约98vp，扣除16vp图标、5vp间距及两侧各9vp后，实际TextInput约59.4vp。原选型仅要求外框44vp，与四个44vp工具同排，触控尺寸通过仍会压缩编辑空间。共享工具栏的第二行固定50vp，控制目录又漏传实际可用宽度。旧空focusId分支还先于mounted返回true，允许退场后的旧输入转交。

前轮检查仅覆盖控件下限、局部header和Recovery actor。目录字体用例使用空恢复数据，busy用例停在共享表面，登记的overlay事实遗漏手机页头变体。由这些有限证据提前认定宿主装配完成，结论失准。当前增加真实父级Watch、HeaderHost、Scaffold和实际Builder链的复核。

### 当前实现与策略

独立文字目录的页头仅保留topBar，恢复消息不再参与其测量及失效链。独立文字和漫画目录作为当前前景，暂退原书签、离线恢复投影，原操作事实、写准入和回调身份保留。目录规则的恢复只在实际规则编辑器内提供。详情来源退出目录仍返回详情，沿现有阅读入口回到原可呈现宿主后恢复原事项。

工具栏复用一份纯预算，实际编辑列先支付39vp内部占用及按生产字形计算的有效文本宽度。窄窗分成查询行和动作行，搜索与导航组间12vp，导航组内4vp，宽窗预算充足时保持单行。各行随实际fieldHeight增长。列表起点、extent、短窗prefix和未测首帧fallback同步支付增长。完整目录/漫画16vp glyph、32vp内部绘制与至少44vp原生命中按角色保留，命中高度随fieldHeight增长，standard角色继续使用原规格。

全应用底页几何不变及前景规则已写入长期页面契约和消息框架。普通页面由现有Scaffold提供覆盖层，StandardPage提供无参boundedOverlayContent及可见事实，直接持有覆盖区域的测量、位置、宽度、限高和输入。最初尝试的三个scalar Builder参数在实际SDK消费者中保留首次值，该尝试已撤回并保留失败记录。现有单参数兼容转发继续保持原调用行为。

漫画恢复不再强制显示chrome或扣减dock，冷测量未就绪时退出绘制、命中和无障碍遍历。Settings恢复在选择面板占用前景时暂退。消息预览的notice/dialog/task场景保留底层示例及滚动位置，真正PageState示例继续按内容状态展示。RSS原恢复key仅使用稳定原操作与展示身份，busy和文案保持同一原身份actor，canRetry从当前事实决定动作资格及条件入退场。

### 数量与分类

独立账本新增8个原位置，两个目录页头装配/失效边界、五个工具栏预算/准入边界和一个RSS可变身份键表达式。Root核对八条原锚点及baseline文件SHA均一致，累计133处、57文件。旧SEC-02-3明确为实体范围资格边界，旧DIRECTORY-GLYPH明确为implicitVariant，避免重复计数。

独立目录前景退让、RSS编辑/管理及其他保留页面的无重排迁移按新通用策略登记。新bounded宿主、fallback同步、legacy embedded预算属于实现及修复后果。RssPage的feed原Recovery构造没有合法Gateway范围，删除属于不可达清理。书架notice-to-notice避让和SourceTools互斥条件核对后撤回疑点。构造点、页面变体和新helper不计入原错误数。

### 独立代码侧证据

| 范围 | 当前结果与范围 |
| --- | --- |
| 两独立目录父级 | 两case独立通过，121仓库输入与5SDK输入。helper后继只增加未执行的工具栏绑定，限定范围复用 |
| 目录工具栏 | Root两个case独立通过，122仓库输入、5SDK输入。32组预算、8个真实工具栏样本及2个漫画样本，另含旧embedded有限兼容 |
| 阅读快速/完整/短窗目录 | 六组章节/书签组合及11个原方法差异复核，原137输入证据按未变方法复用 |
| StandardPage及六消费者 | Root四case通过，139仓库输入、5SDK输入。冷态、同一actor几何更新及旧callback拒绝 |
| 漫画冷测量 | Root精确case通过，130仓库输入、5SDK输入。正常viewport既有18样本限定范围复用 |
| RSS追加范围 | Root原三个case通过，122仓库输入、5SDK输入。管理页新精确case独立通过，131仓库输入、5SDK输入，原三个case按范围复用 |
| Settings及预览 | Root最终四case通过，139仓库输入、5SDK输入。Shell兼容、四宿主、动作与预览 |
| 当前目录callback适配 | Root通过，150仓库输入、5SDK输入、9样本。有限原intent方法端口，RPC一律拒绝，未执行Core或原VM记录 |
| 手动装配检查工具 | Root最终delta两个case通过，23仓库输入、5SDK输入。几何规则case实现未变，限定复用原独立证据 |

所有执行trace均为exit0、integrity PASS且执行期间无输入漂移。RSS新增管理case导致原三个case定义文件后继变化时，按未变case与生产分支记录复用范围。有限SDK无法证明Native真实移除调度、焦点、读屏或触摸仲裁。旧Core业务断言、历史REVIEW_NEEDED和已保存失败保留原范围。

最终受控装配检查第一次实际覆盖267文件、91槽和39处分离宿主绑定，解析274个输入。检查发现RSS订阅管理页仍将原Recovery放在nativeListItems流，保留FAIL诊断并修复。修复后同一清单的最终检查通过，267文件、92槽、39处分离宿主绑定、274输入，diagnostics为空。原生分离宿主、动态Builder解析和显式几何读链分别记录，工具未接入构建/CI。

### 当前原生状态

本节以下续记前，当前新代码尚未构建或安装，VM仍显示 `e81a9b33`。原书签第二次核对曾被自动审批拒绝，原因是上次一次性授权已使用且动作可能结算或清理原持久记录。拒绝后未执行，也没有通过其他入口绕过。新一轮代码审修与独立验收完成后，才能生成一个新候选并进行本轮必要的目录视觉和只读交互核对。E2/E3、真实大字号、平台焦点、读屏及用户验收继续开放。

### 本批登记收口

Root核对15个实际变更消息文件的55组入口，55/55通过，完整消息集合165项。check-register保持原39项诊断，SOURCE_DRIFT为0，Control17、Directory15和21实例的层结果及不变量保留。引用检查首次发现control-registry仍指已删除的FullDirectoryPanel.queryStacked，已改为实际searchControlsHeight，并更正有效编辑宽度、12/4间距及toolLabel来源，第二次引用核对通过。原失败保留。

新发布26个精确ID，其中23项依据实际当前或明确范围复用证据获得资格，三个未选旧target sibling保持REVIEW_NEEDED。Root独立核对26个ID、232个去重定义输入、默认OFF、空资源和tiers的755权限。本次共享输入发生变化且分支影响尚未逐项界定，976个旧case的当前可执行资格转为REVIEW_NEEDED，历史执行结果保留。当前1447项QUALIFIED、1012项REVIEW_NEEDED、22项DIAGNOSTIC_ONLY、1项NEEDS_EVIDENCE。该资格开放记录与本轮已完成的产品代码独立验收分别保留。

### 当前候选及VM定向结果

所有生产作者与独立审阅完成后，Root提交 `f7851658` 并执行一次规范迭代构建。run为 `20261113T095920Z-f7851658-01a115ed`，App身份为 `0.2.0.DEV.b699af602a2e`，signed HAP SHA-256为 `3042cb4acdeee4d872a63e66d44ef3da6415cbdb720b1470cd7c7bcd868ded6a`。产品版本0.2.0和versionCode1000000保持。当前指定minliny证书验签通过，未嵌套合同套件。Core Native及其缓存按未变输入复用。

现有远程x86_64 VM按准确 `192.168.1.10:8710` / `127.0.0.1:5555` 租约使用。当前真实路由为en0，hdc16979的socket为 `192.168.1.29:64094→192.168.1.10:8710 ESTABLISHED`，整个调用清除代理变量。停止态DB/WAL备份、同一HAP绑定的三项已编译Core执行及五个validator case通过，规范保数据安装通过，UID前后维持20020064。

Root沿Sample EPUB原阅读、书籍信息及详情的完整目录入口到达实际独立目录。1280×2832原生帧确认恢复卡退出目录前景，HeaderHost从550px恢复193px，回收357px约102vp，面板顶部从805px上移到448px，底部2735px保持。输入外框343px增至1029px，实际TextInput从208px增至894px，约59.4vp增至255.4vp，placeholder完整可见。四个工具为实际154×154px命中区，内部32vp绘制与16vp图标按当前角色显示。

收起外框为 `[1041,472][1195,626]`，内部绘制为 `[1048,504][1189,595]`。实际点击轮廓外、目标内的 `(1118,480)` 成功返回同一本书籍详情，随后沿同一入口重新停在独立目录供人工查看。13个操作回执及其command均通过，全部会话退出释放租约。原书签再次核对仍未执行，当前修复版忙碌像素与原记录结算待追加授权。完整E2/E3、真实系统字号矩阵、焦点、读屏与用户验收继续开放。

原生截图、布局树、操作回执及精确边界保留于私有 `vm-ui-feedback-20261113/native-f7851658/result.json`，前后历史帧及失败不覆盖。

### 原记录一次核对及恢复文案断行补修

用户在上述代码与独立验收完成、候选安装后，另行明确授权一次原记录核对并可结算同一记录。Root按当前唯一可见的重新载入核对书签按钮执行一次sampledClick，未点击继续原操作。日志基线完整保留，新增唯一一条 `18:12:59.391` / PID5560 的业务unknown结果。实际短反馈为“书签原操作仍未确认，可重新核对或继续原操作”，原等待投影继续显示。磁盘intent内容未读取，未宣称字节未变或已经结算。

前后两动作原生ID1418/1424、bounds和hashcode保持，六个正文/页脚节点的内容、边界和hashcode保持。两帧实际采样触发约3.45ms与530.36ms，未捕获spinner或中间disabled瞬间。独立reviewer只读核对操作、日志、树和帧确认通过，对忙碌像素保留OPEN。

独立审图同时发现最后一个“作”被拖到第三行。代码原因是装饰NBSP动作占位与紧邻业务末字的GL绑定。两处原表达式分别用于full/folded测量和实际Span预留。现各加一个普通空格，明确可换行边界，完整业务文案、自然换行、颜色、字号、动作身份和业务代码保持。该修复只解除装饰占位的绑定，未加入任意文案不得自然孤字的新规则。两条原锚点均匹配687原文，累计135处、57文件。

作者和Root精确case分别通过。Root115仓库输入、5SDK输入、17样本，包含实际Span、同串测量、动作保持、长文展开和旧源负例。既有macOS系统ICU独立确认旧位置29不可换行，新普通空格后位置30可换行。有限高度及一个Blank移除端口明确记录，HarmonyOS实际字形断行另行看帧。

额外静态审查发现本批新增检查的definitionInputs混入了正常生产源码，会使dispatcher锁住普通开发。只从本批26个新case和9个新导航父项移除这些生产定义锁，实际test/harness/fixedfixture保持，真实执行trace继续保存生产指纹。随后新增一个Notice精确ID和导航父项，并只同步8个实际登记输入。旧976项当前资格与历史结果、消息集合及全部页面判定保持，当前QUALIFIED为1448。新case默认OFF。

### 最终断行候选与独立实屏复核

`6f879684` 的规范迭代run为 `20261113T102654Z-6f879684-85679f90`，App身份 `0.2.0.DEV.bdf328a7c276`，signed HAP SHA-256为 `e5177c3364d6e0fd1c9f0e3d45ea89b4904f34e2e8360d2de875f927c8408abd`。指定证书验签、当前HAP绑定的三项已编译Core执行和五个validator case、同一远程VM保数据安装均通过，UID仍20020064。当前产品版本0.2.0、versionCode1000000保持。

代码只在Notice两处表达式加普通空格。此前完整267文件/92槽装配检查的274输入中，仅Notice字节变化，将两处前缀移除后与f785原文精确相同。其Builder、Watch、业务、动作、所有权及底页几何表达式保持，相关装配与原核对证据按范围复用。8个实际登记输入和新增精确case已同步，27个本批新case及10个新导航父项均不含生产定义锁。Root复核引用PASS，register仍原39项，SOURCE_DRIFT为0。

首次把启动和dump放在同一批次时，树仅含系统状态栏。入口前提未满足，未派发点击。后续仅只读取得完成启动的树，并从已保存树定位真实clickable Column后正常进入阅读。两个本地解析/缺文件失败发生在点击或HDC子进程前，记录保留。最终仅一次正常启动、一次继续阅读及一帧排版采样，未追加手动核对或继续原操作。

当前1280×2832新帧中“或明确继续同一原操作”完整处于第二行，末“作”已脱离装饰占位。恢复表面 `[53,206][1228,584]`、两动作 `[565,395][944,549]` / `[944,395][1186,549]` 与f785一致，正文两段 `[78,522][1200,891]` / `[78,947][1200,1439]` 同样保持。跨安装的Native对象自然重建，本次仅比较相同角色和几何。非作者独立核对源码、SDK/ICU、前后帧及树通过，当前断行问题关闭。

最终VM停留Sample EPUB阅读页。当前原事项的业务结果仍为unknown，等待投影保留，磁盘intent字节未检验。busy瞬间、完整E2/E3、真实字号矩阵、焦点/读屏及用户验收保留各自开放范围。976个旧检查的当前资格待复审，历史执行证据保留。本轮产品代码、独立审修和上述有限Native验证已完成，当前证据分层结束于各自范围。
