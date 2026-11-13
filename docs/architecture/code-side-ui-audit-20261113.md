# 合流代码开发与全页面排版独立审计

2026-11-13。用户要求完成合流范围的代码开发与独立验收，并由独立 agent 审计所有页面排版、修复发现、再次独立复核。本批使用 `.reader-isolated/framework-confluence-20261112` 的 HarmonyOS、Core、UI 三个检出，原工作区的并行修改保留。

## 当前阶段

恢复消息与书签写准入补修已完成代码开发、独立精确复核及受影响登记核对。后续候选需绑定本轮新字节。`6df7044e` 候选已保数据安装，目录实屏暴露本轮新增的恢复提示前缀占满列表问题。该安排已撤回，同时修复代码复查发现的书签删除按钮及跨书籍写准入事实缺口。前轮以有限属性、预算和状态探针宣布全页面代码侧完成，遗漏了真实宿主装配、入口差异、图标角色、浮层归属及保留控件闭包。本轮结论以实际宿主覆盖、原始错误位置、根因和独立证据逐项对账。

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

以 `687c798e` 为本轮源码基线，当前逐项确认106处原有错误代码位置，分布在49个生产文件。原冻结批次为100处，包含主流程38处、阅读与漫画22处、二级与消息29处、交叉审查11处。本次追加书签写准入6处，五个UI表达式和一个初始authority装配位置均已与原始Git字节核对，修复与最终独立复核见末节。位置以原始错误表达式、分支或报告列明的方法边界计数，重复行、选项、新增helper和传参包装不计入。该数字描述源码位置，页面数量与实际可见故障次数分别记录。

267个ETS发现模块逐项对账，缺失0。主流程记录12个宿主族及其状态变体，阅读与漫画记录85个模块，二级域记录49个指定模块和8个委托入口，Root补齐装配、平台适配、支持规格与诊断夹具处置。诊断夹具的发现处置只证明审查范围。

完整位置、当前文件指纹与统计规则保存在私有 `vm-ui-feedback-20261113/universal-audit/audit-ledger.json`。各域覆盖表保存真实挂载链、变体、支持模块和发现引用。修复过程中出现的时序与装配遗漏另行列账，包括最低预算延期后的旧输入窗口、RSS新列表几何订阅断链、短窗列表切换缺位置交接、临时层缺响应式投影，以及恢复表面首次重新激活的通知触发。

### 为什么会错

| 共因 | 已确认的代码行为 | 当前处理 |
| --- | --- | --- |
| 绘制与触控共用尺寸 | 44vp目标被用作亮度圆、紧凑按钮背景或动作行高度；完整目录采用standard默认recipe；收起按钮沿用旧顶部偏移 | 字形、背景、文字行盒与原生carrier分别消费既有规格，父容器支付完整命中空间 |
| 父子预算缺口 | 固定行盒、父最小高度和虚拟列表extent没有共同随实际字体增长；短窗固定chrome使列表高度归0 | 使用当前量字结果，文字、行高、extent与定位同步；短窗chrome进入唯一List前缀并保留实体锚点 |
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
| 完整目录进入阅读 | 目录按钮直连完整目录宿主。已确认并修复两个上游自动阅读出口，分别为换源读取失败及旧pending恢复。仅点击目录的当次实屏触发尚未关联，继续OPEN |
| 所有书出现未决书签并挤正文 | 已修读取失败伪造原写、外书投影、消息类别和触摸冒泡；恢复层独立悬浮。本轮目录前缀回归已撤回，控制栏关闭后的真实显隐订阅、所有写actor与全局写准入已独立复核 |
| 换源先切页再弹出 | 已修opening推进导航/entry，以及失败、回滚恢复的宿主丢失；原候选重试、原pending回执和成功目标交接保留 |
| 管理页图标大小与按钮比例异常 | 已拆分source按钮及共享labeled/icon动作的字形、背景与目标，逐recipe验证；其他导航图形按原资源角色核查 |
| 小说/漫画标签错版 | source分类恢复32vp绘制、自然文字居中与44vp原生目标，当前父预算及32行组合/40目标/24预算独立通过 |
| 书架详情封面和标题偏下 | 已修hero补偿、旧类型入口和prepared媒体混用。搜索与书架的相反实屏偏移尚未对应到当次类型、原生inset与scroll事实，继续OPEN |

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
