# Reader HarmonyOS UI 框架实施方案

## 2026-11-18 撤销此前验收与测试入口纠正

此前 85 项页面层 PASS 和 37 项规则级 PASS 全部撤销。当前登记为 0 PASS、27 FAIL、309 NOT_RUN，整页 0/21。已逐项复核登记和 121 张原始画面。孤立组件、裁剪宿主、内存替代页面或模拟回执的所有历史验收均作废；历史日志与原图只作为追溯。以后在应用实际正常入口进入完整页面，开启应用开发者模式读取实际窗口与已挂载组件参数。任何必需参数异常、缺失或画面被裁切都不得通过。现有开发者边界图层和窗口参数所有者优先复用。以下旧时点数字与通过描述按原形成时间保存。 [复核、模式清点与耗时归因](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md) [当前验收状态](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.json)


## 2026-11-18 正常页面修复与复核

本节候选 `0.2.0.DEV.bf872d751793` 已签名并保数据覆盖至现有 VM。已从正常入口复核漫画完整目录的首屏、下层彩色框线、键盘与查询结果，以及书源工具批量按钮的 1× 布局。共享页头、短窗书签、近底部滚动容量、书源恢复及实时结果的代码修复已纳入候选。正式登记仍为 0 PASS、27 FAIL、309 NOT_RUN。真实大字号及极矮窗、原操作回执、读屏、独立整页视觉、G05/G10 等保留原关闭条件。 [修复与实际证据](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#正常页面修复与-vm-复核)

### 文字目录正常场景补证

已在现有 VM 的真实阅读页运行 1025 章本地书。快捷目录切换书签并展开后保留书签空态。返回章节，搜索第 1025 章后结果和当前位置卡均位于键盘上方。无匹配时按 Back 收键盘，查询和空态保留。旧候选 `0.2.0.DEV.bf872d751793` 的普通文字树目录在筛选空态漏接「清除搜索」。代码复用公共空态、清除动作及查询代际校验，`surface-admission` 和消息入口检查通过。新候选 `0.2.0.DEV.08ec80d34773` 编译签名、保数据覆盖安装及启动通过。正常完整栏实点一次清除后输入清空，章节列表恢复，第 2／1025 章位置和输入实例均保持。本次只关闭章节清除这一行为，正式 query 层和 B3 待补非空书签筛选、容量及排序。 [两次候选的原始证据](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#正常文字目录和证据准入复核)

撤销完成当时，页面层为 0 PASS、27 FAIL、309 NOT_RUN，规则层为 0 PASS、26 FAIL、436 NOT_RUN。新 PASS 要在现有登记中绑定签装版本、正常入口的完整实屏、同一窗口原生树及开发者参数。SDK 尺寸汇总只保留代码证据。 [当前登记及候选](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.json)

### 开发者描边与书签操作准入

正常文字目录复现完全透明的底部导航被开发者画布描边。正常阅读的「待处理事项」又复现退场控制栏剩余极低透明度时仍画出成组框线。共享扫描器现读取真实 FrameNode 透明度、跳过透明子树，并按父子继承后的透明度绘制。新候选 `0.2.0.DEV.661f134b5515` 已保数据覆盖。真实恢复覆盖层复验时，底层控制栏实测 opacity `0.000035` 仍保留原生节点，实屏不再出现其成组框线，原提示与两项动作完整显示。 [新旧样本与当前签名包](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#开发者描边与真实书签准入复核)

实际测试书的书签页为空，当前章标记按钮在两个候选均禁用。Sample EPUB 的正常待处理面板实测确认，已有书签原操作仍等待核对。该业务所有者禁止继续派发新书签写入。本次未创建临时书签，未点击核对或继续，真实非空筛选与恢复保留待验。 [当前结果和数据边界](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.json)

### 正常页面证据的采样时序

复用原页面登记和采样工具。后续登记把完整实屏、节点树和开发者参数绑定到同一读回区间。从第一条实际原生采样命令起核对操作和时间，明确场景的安全区、状态栏及 IME 矩形，并用树根校验应用和正常页面宿主。已有真实漫画整屏的离线重放通过，11 个错配或分属不同状态的输入被拒绝。无需重新编译或签装应用。 [回放结果与原始样本](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#正常页面证据时序和安全区核对)

### 开发者标记与采样日志一致性

同一真实返回场景里，原生树的开发者标记已显示「IME 关 · r5」，日志仍停在「IME 开 · r4」。旧准入在期望参数与日志相符时接纳了该样本。现核对同窗原生标记与日志的宽高、密度、系统字号、IME 和 revision。原始错配回放被拒绝，九组正常稳定样本仍通过。标记被裁出原生树的帧无法进行这项交叉核对。 [回放和原始证据](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#开发者标记与采样日志一致性)

### 书源工具编辑入口与输入法

`SourceToolsPage` 为共用的 `ReaderStandardPage` 提供原生列表控制器，复用布局回调。只对新编辑代际定位，计算时使用实际出现的批量进度、结果区和书源列表顺序，并拒绝已离开的宿主和旧编辑器。准确的 `editor-opening-scroll` 回归通过。已完成 x86_64 签装和 VM 正常入口验证。由旧行为「点编辑，手动向下寻找」改为点一次后完整编辑器直接出现。键盘开启时两个按钮经一次正常滚动可达，返回收键盘后取消有效，未提交写入。 [原页面及开发者参数](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#书源工具正常编辑入口)

编辑入口定位已关闭。其他焦点位置、字体和窗口组合仍待复验。正式层级与整页登记不改判。

### 固定页头的开发者描边

由共用 `ReaderPageScaffold` 把同页内容与不透明的实际页头关联。开发者画布读取原生祖先裁剪和页头位置，绘制原测量框的可见部分。透明或淡出页头以及其他宿主保留各自描边。已完成开发者扫描和页头页尾测量续接两项定向回归，并在现有 x86_64 VM 验证正常书源工具的打开编辑器及键盘状态。其余宿主及窗口组合依旧逐项按实际场景登记。 [代码与原始证据](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#固定页头开发者描边复验)

### 书源删除确认的正常返回

当前已安装候选复验通过单项删除确认的选择呈现、系统 Back 优先级和取消后选中项保留。仅当用户确认删除时，原有当前选择、页面和代际校验才允许消费选择。复验不触发该分支。旧 SDK 恢复探针已接入当前公共页头字体策略、标准页底部可用范围和原生布局回调，`page-eligibility` 恢复通过。删除确认的证据与下节的导出链路共用同一安装候选。 [本轮证据及回归边界](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#书源删除确认操作复验)

### 书源工具的系统返回与父页恢复

在 `0.2.0.DEV.b9061a3c55a5` 的正常书源工具复验。导出警告先消费 Back 并保留所选一项。再次打开并确认后，既有业务回调先消费选择，随后进入系统保存选择器。Back 关闭选择器并显示「已取消导出」。继续按 Back 返回书源管理，恢复查询 `101` 和原有两条结果。本次没有选择保存位置或执行删除。 [实屏与机器回执](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#书源工具系统返回与父页恢复)

当前书源工具的三个登记系统宿主均已复验，S7 为 `PASS`。路由层仍需父页滚动、草稿、检测状态及其他应用内覆盖层的当前证据。登记 S7 时计 1 项规则 PASS、26 FAIL、435 NOT_RUN，页面层为 0 PASS、27 FAIL、309 NOT_RUN，21 项整页尚未关闭。 [当前登记](../../tools/page-structure/register.json)

### 书源工具恢复进入时的父页

复用同一正常会话的五组样本，核对实际入口、返回前后的同序两条书源与开关状态，以及独立重开时的空查询。当前宿主在进入工具前复制父页状态，沿用已核对字节的一次 `journey-retention`。S6 更新为 `PASS`，S8 与完整路由层等待非零滚动位置、草稿、检测和其他应用覆盖层。规则层为 2 PASS、26 FAIL、434 NOT_RUN，页面层为 0 PASS、27 FAIL、309 NOT_RUN。 [原始材料与登记](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#书源工具恢复进入时的父页)

### 书源工具返回时的非零滚动复位

正常 VM 复验时，输入法开关后同一书源下移 1031px，临时草稿、检测模式和选择仍保留，取证后已恢复原状态。旧滚动键把临时窗口 revision 当作布局身份。修复后按父页实际内容宽、字号、列布局、窗口高度、密度和交互安全边比较。点名回归证实同布局恢复偏移，真实纯高度变化仍回退。S8 和路由层保留实际失败直到修后原生确认，S6、S7 原签装证据保留，正式通过等待新父页字节配对。 [失败实屏、修复和剩余验证](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#书源工具返回时的非零滚动复位)

### 退役局部页面的遗留跳转

页面清单与冷启动已移除局部结构页和旧正文试点。源文件里仍保留从试点到结构页的跳转按钮，旧点名检查还要求结构页注册一次。现移除按钮和路由回调，调整原 `admission` 点名检查，核对应用清单和试点均无该入口，同时保留原 Core/Host 导入边界断言。该检查只读源码和 SDK AST，未装配局部页面。历史局部测试结果继续作废。 [退役入口与本地回归](../../.reader-artifacts/app-ui-framework-audit-20261114/pass-screen-reaudit-20261118.md#局部页面遗留入口清理)

## 2026-11-17 P2-A / P2-B 补全回执

**此前“代码侧全部闭环”的结论已撤回；原 NOT_COMPLETE 审计保留其时点。本次已补齐该审计列出的 P2-A、P2-B，并完成对应定向回归和新的配套签名候选。** 下方五项回执保留为补全前历史，不能用其旧 PASS 覆盖这两个缺口。本次结论限已列问题、准确回归和候选层，不提升为全应用或原生验收。

| 缺口 | 本次修复 | 准确验证 |
| --- | --- | --- |
| P2-A 异常空响应被当作结束 | 复用 reader-rule 的现有模式、路径解析和选取，reader-content 将来源实际空集合证据与兼容空列表分开，Core 页回执只有经确认的空集合才 end。HTML 错误正文、空正文/undefined、缺字段/null/非数组、字段提取后无有效书籍、无法确认的 HTML 零匹配及复杂规则保持 unknown；不重复执行 JS。 | negotiated_empty_pages_require_response_extraction_evidence：实际 book.search→AnalyzeUrl→complete_remote_host HTTP200，generic 与 Legado JSON 空集合、异常正文、旧形状及过滤后空等断言 PASS；原页身份/旧 shape case PASS。两个选择器各实际执行 1 个测试。 |
| P2-B unknown 未贯穿页面与恢复 | owner 透传来源/版本/准确未完成页及原因；零结果 unknown 使用现有 PageState 的“搜索结果未确认”，operation.fact 为 partial；已有结果保留，通过既有任务面板分类说明和原 onRetry 恢复同一页。历史/共享事实刷新不丢未确认原因，旧 query/generation/隐藏页面动作拒绝。修正同一状态颜色分支误返回中文文案。 | Host unknown-zero、unknown-retained、orchestrator 三项 PASS，包含正常 Page→ReaderSearchTaskPanel 回调、实际 task retryAction、保留列表 notice 发布、同页恢复与已结束来源不重跑。两个所变消息入口文件的显式登记检查 PASS。 |

空集合证明采取保守边界：目前仅来源纯 JSON 选择能够证明存在且为空的集合可确认结束；普通 HTML 零匹配无法区分正常空页与登录/错误/模板变化，继续保持 unknown，并提供显式恢复。没有以解析数组长度、HTTP200 或规则模板本身推断结束，也没有新增结果总上限或另一套解析器。

最终候选为 **0.2.0.DEV.d5e6e8223d98**，run `20261117T094702Z-6a2f03ab-c790991c`，ABI `arm64-v8a`，iteration / contracts-scope none，acceptanceEligible=false。配套新 Core/Native/NAPI、实际 ArkTS、包内容与指定 minliny_HarmonyOS 证书及 debug Profile 核验 PASS。signed HAP SHA256 为 `f39a3633aa925dcffb20501c372da46351ac821e20a56a66fd808dfdfc2597a8`，产品版 `0.2.0`、versionCode `1000000`、包名 `io.reader.minliny` 保持。

[新候选不可变 manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261117T094702Z-6a2f03ab-c790991c/manifest.json) · [原 NOT_COMPLETE 审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/pagination-completion-audit-20261117.json) · [本次修复绑定记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/pagination-completion-repair-20261117.json) · [逐次实施记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-p2-completion/implementation.md) · [机器可读结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-p2-completion/results.json) · [相对补全开始态的补丁与回退](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-p2-completion/patches/README.md)

原 IME、P1/P3/Q1/R1 的 WIP 和准确局部证据保留，未改行为按影响范围复用，不说成新运行。未提交或合并。本轮没有安装、HDC、VM 或用户应用数据操作；真实书源网络、原生滚动/预取、焦点/IME、像素/读屏、设备内存和用户验收仍 OPEN/NOT_RUN。Native host-probe/sdk-smoke 与全量门禁未运行。

## 2026-11-17 P1/P2/P3/Q1/R1 实施回执（补全前历史，整体闭环结论已撤回）

用户在本次会话明确要求“设定目标，按方案全量实施”。本批已完成五项生产代码、正常入口接线、所选定向回归、配套 ARM64 Native/NAPI 及实际 ArkTS 签名候选。代码交付状态为 **IMPLEMENTED**；真实滚动、原生焦点/IME、像素、读屏、设备内存及用户验收仍为 **OPEN/NOT_RUN**，不据此关闭全应用审计。工作保留在本隔离配对树，未提交或合并；开始前已有的 IME WIP 原样留存其不受本批影响的内容，共享文件按起始 WIP 增量修改。

| ID | 本批已实施行为 | 本批准确证据 |
| --- | --- | --- |
| P1 | 当前书籍/查询/展示代次有效时，由实际列表布局、滚动及追加需求自动续取；Core 后续事实与失败重试分开。正常分页按钮、文案、44vp/footer 及测量扣款均移除；同一列表、结果身份和增量索引继续复用。 | 游标/错误边界、真实 SDK Publication/原生列表投影、自动需求/零正常占位与 1000 批次 10010 结果增量成本项 PASS；无设备滚动及时性结论。 |
| P2 | 新增显式协商的 book.search.page-receipt.v1，绑定来源版本/查询/页号与实际请求/响应/候选指纹；旧调用保持原 shape。普通搜书按浏览需求公平续页，换源继续查找后页同书；无推进转 unknown，失败同页重试，停止保留已有结果和未完成页，续取期间原搜索按钮可停止。 | Core 实际 AnalyzeUrl→Host continuation 受控响应 case、Host receipt/gateway/orchestrator/switch/assembly/continuation-stop 及原有三个准确兼容 case PASS；没有真实书源网络验收。 |
| P3 | 独立草稿预览快照复用 NavigationIndex/sidecar，首批 256 与全量 nodeCount、后续范围读取及 close 分开；原生懒加载列表可到末尾并返回。apply 绑定同一草稿与原书输入，原 durable mutation receipt 优先于已关闭的预览。 | Core 257/1025 完整数量/顺序/层级、只读预览、无关写入不误失效、输入变更拒绝及原 ACK 重放 PASS；Host gateway/lazy-ranges/lifecycle/sdk-list 和消息入口登记 PASS。 |
| Q1 | inlineEditor 与 modal 分开；搜索/目录内联编辑时四个原生导航按钮保持 enabled，点击先结束当前编辑再执行一次捕获的目标。原 modal、遮挡及未决限制保留，旧 blur 不清后继状态。 | 真实 Panel 准入/异步切换及 SDK 四按钮 enabled/原 opacity 项 PASS；真实 IME 和原生焦点未验证。 |
| R1 | provider 结果在 URI 解析/暂存/worker/导入之前校验；超过 50 或非法集合整批拒绝，由当前 opening 反馈重新选择。仅此已知派发前错误可认定未导入；其余异常仍遵守 ReaderWriteEvidence。 | provider 51/100000/非法集合解析、stage、persist 均零；0/1/50、退休 opening 与原已接纳选择释放准确项 PASS。 |

最终候选为 **0.2.0.DEV.22272bd012cc**，run `20261117T091211Z-6a2f03ab-ddb9a389`，ABI `arm64-v8a`，包名 `io.reader.minliny`，产品版 `0.2.0` / versionCode `1000000`。指定证书 SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`、debug Profile 与包身份验证 PASS。signed HAP SHA256 为 `cc6ccb61a58c2c67074c4ea63bdaa11c57d6611a00a0fd19800f9fdbeb6092a1`；Native 输入及打包后裁剪字节分别由 provenance 绑定，不混用其哈希。

- [最终不可变 manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261117T091211Z-6a2f03ab-ddb9a389/manifest.json) 及同目录 signed HAP/provenance 是本批候选；此前 b90a 与本批第一次成功包只保留为历史/中间证据。
- [逐次实施记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-continuous-results/implementation.md)登记选定入口、必要性、嵌套范围、失败定位及最小重跑；[机器可读结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-continuous-results/results.json)列准确日志。全部既往失败保留，后次通过不追溯改写。
- [相对起始 WIP 的变更清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-continuous-results/change-manifest.json)及[分项补丁/回退边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/evidence/2026-11-17-continuous-results/patches/README.md)保留 P1/P2/P3/Q1/R1 与共享接线依赖；不能整文件 reset 到 HEAD 覆盖 IME WIP。

本轮仅选择必要准确 case；HAP 使用 iteration / contracts-scope none，未隐式附带全量门禁，Native host-probe / sdk-smoke 未运行。Core 固定基线 c0781263 加本批差异，Host 为 6a2f03ab 加起始 IME WIP 与本批差异；没有修改其他平台、产品中大版本或新增数据库迁移。构建中的 CMake 缓存归属漂移和首次 ArkTS 可选坐标错误均已定位并修正，原日志与缓存备份保留。方案明确不授权安装或 VM，本轮未调用 HDC、未安装、未访问或清理用户应用数据。

## 2026-11-17 三个主问题及关联回归的完整修复方案（实施前基线）

本节保留用户授权实施前的完整代码方案及当时事实。方案撰写本身不构成执行授权；后续本次会话的明确“按方案全量实施”已授权上方回执所列代码、测试和候选动作，安装和VM仍不在本轮授权范围。P1/P2/P3固定对应本轮三个主问题；Q1是原Quick导航回归，R1是条件风险。历史审计、候选和已运行局部证据不追溯改写。本节替代此前关于这五项的零散建议；原统一IME工作继续保留，不能整文件回退覆盖。

### A. 基线、范围与统一结果

- Host基线为HEAD 6a2f03abce6f92371d9139d224ddf962473a8311及其当前未提交IME工作；Core为c078126376294faa3a611690fbe48e79f0f86cc4。当前已安装b90a仅作历史证据，未来修复后不能继续视为新源码候选。
- 本轮646个生产ETS/TS的检索定位59个候选文件，已沿18类数据链检查限量和后续入口；不等同逐文件语义、跨所有平台或原生验收。
- 后续方案允许内部限批、懒加载和现有资源上界；技术批次不得变为结果总上限、常驻分页按钮或没有说明的截取。不能通过一次取全、取消所有容量保护或提高常数掩盖缺口。
- 正常状态保持已有Quick/Full外框、字体、工具密度、亮度条和模块导航布局。按实际结果分配列表空间；无普通常驻“加载更多结果”按钮、加载条及永久预留高度。首次查询、真实失败及原操作未决仍按既有消息类别呈现。
- 书架48/144、正式目录256、正文/漫画窗口及已有完整读取循环不在本次重构范围；只用它们的准确既有证据复核受影响共享边界。正式目录数据、正文、原分章、书架、书签和进度不因本批改变存储格式。

| ID | 实施前代码事实 | 交付目标行为 |
| --- | --- | --- |
| P1 正文搜索 | 50条/批，结果区固定分页动作；hasMore还在失败状态中兼作retryable；正常分页动作参与minimum和视口扣款 | 单一连续结果列表，接近已读末尾前自动续取；无正常固定分页动作与占位；失败才出现局部恢复 |
| P2 普通搜书/换源远程后页 | SearchGateway省略page，Core默认1；SourceSwitchGateway显式page1；BookSearchData没有后续事实；Orchestrator单次回执就标来源completed | 普通搜书按浏览需求自动续页；换源继续查找当前书的后页；终止、暂停、失败和无法确认分别记录 |
| P3 TXT规则预览 | Core节点明细取前256，Host再slice；只有一次回执，没有草稿预览的后续读取身份 | 一个可连续滚动到末尾的完整预览；版本绑定；应用与预览相符；预览不修改正式导航 |
| Q1 Quick导航淡化 | inline query editing以temporaryLayer=true上报，与modal共用controlActionInputEnabled，原生导航Button被禁用 | inline编辑时导航保持正常可用；点击明确结束原编辑并执行一次目标导航；真正模态/未决操作保留原阻止规则 |
| R1 异常文件选择 | Picker声明最多50；异常provider返回更多时slice前50，超出仅日志；结果owner又限制最多50项 | 正常50限制保持；异常超限在暂存/导入前整批拒绝并明确反馈，不静默丢选择或部分导入 |

### B. P1：正文搜索连续显示

当前正常链：LocalReadingExperience.runQuickSearch → ReaderContentSearchPublication.run/more → ReadingSessionFlowGateway.searchContentPage → Core search.content；同一Publication通过普通引用＋searchRevision进入Panel/Content。Content现有List、DataSource、逻辑行锚点及SDK结果发布继续复用，不恢复结果数组@Prop深拷贝。

拟修改：
- entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets：增加准确的“需要后续结果”请求端口，保留book/source/lifecycle/control opening和现有请求有效性。当前50只作为内部每次读取量，不能作为查询总上限；不随启动自动发正文搜索。
- features/reading/presentation/ReaderContentSearchPublication.ets：继续作为唯一query/generation/cursor/request owner；区分Core成功回执的后续事实和本地失败重试准入。旧hasMore/错误字段迁移时只能有一个真实状态来源，展示兼容值由该状态派生。
- features/reading/application/ReadingSessionFlowGateway.ts：复用已协商cursor协议；不增大或绕过Core200单批上限；重放同一游标，不在失败后用offset拼接新快照。未协商cursor的旧端点只保留明确兼容行为，不声称可取得同一快照。
- features/reading/ui/ReaderControlPanel.ets：把自动续取端口接到当前Search实例，不直接拥有请求状态。
- features/reading/ui/ReaderControlSearchContent.ets：在原生列表布局就绪、滚动回执和结果追加后评估实际剩余可见行。预取阈值以真实视口覆盖行数及现有cache count计算，接近尾部即请求；首批不足一屏且仍有后续时自动补足。不只挂onReachEnd，避免不能滚动时没有触发来源。
- features/reading/ui/ReaderControlSearchMinimum.ets、ReaderControlSearchGeometry.ts和ReaderControlMinimumMeasurement.ets：删除正常hasMore/loadingMore带来的action label、44vp/footer扣款及无意义几何失效；仅失败/退休恢复所需的真实消息和动作参与minimum。
- features/reading/ui/ReaderContentSearchDataSource.ets及现有scroll/list projection：保留稳定身份、原生LazyForEach和追加通知。当前Publication每次slice/Set及DataSource全前缀扫描的成本需要在长序列追加中计量；复用既有SearchPublication增量发布模式和成员索引，不能把原生只add新行误报成全部JS工作O(新增条数)，也不能新增结果总量截断来避免增长。

请求条件：当前书/来源/查询/搜索代次/展示opening仍有效，列表已挂载、交互可用且位于Quick或Full稳定端点，具有正的实际结果视口，接近已读取尾部，确有可继续游标，没有在途请求、失败待处理、退休或版本失效。连续布局/滚动回调合并成同一待派发意图；重入只允许一个实际请求。非前景/中间morph暂停，重新有效时用当前回执重评，不复用过时offset。

状态处置：
1. 新查询：取消原请求并释放旧游标，原代回执不得改新查询。
2. 续取成功：去重后追加，保持当前行、native实例、焦点、文字与滚动锚点，不整表reload。
3. 明确结束：停止续取，不显示“加载更多”或“已全部加载”常驻块。
4. 可重试失败：保留关键词、已得结果和同一游标，只由用户的局部恢复动作重试；滚动/Watch不得自动重试失败请求。
5. 快照/来源版本失效、已退休：保留仍可用的结果，只提供明确重新搜索；不能背地重启并混入另一快照。
6. Back先按既有IME归属处理；整栏退出、换书和运行时关闭释放游标。已有query/result保留政策不随本次改变。

P1关闭：超过50和200处匹配均可连续到末尾；正常footer及其扣款为0；Quick/Full/IME/morph不改变结果身份或跳锚；失败无无限重试；所有已得到的结果可选择定位。前景首次查询反馈和真实失败不被“一律去加载提示”删除。

### C. P2：普通搜书与换源的来源后续页

当前普通链：SearchPage → LibrarySearchPresentation/SearchOrchestrator.performSearch → SearchGateway.searchBySource → Core book.search。当前换源链：SourceSwitchGateway.refreshCandidates → discoverCandidates → discoverFromSource → Core book.search。两条链共用Core书源执行，但有各自的查询/筛选与操作owner，不能共享成一个全局可变页号。

C1 Core事实契约：
- 修改Core crates/reader-contract/src/remote.rs、lib.rs，protocol/reader-command.schema.json和reader-event.schema.json，以及remote.rs的book_search、build_search_request_from_source、book_search_from_params_checked和对应Host continuation/SourceFetchMeta事实传递。
- 拟新增可协商能力book.search.page-receipt.v1；新Host按能力显式请求页回执。字段/能力名是本方案拟定接口，实施时加入权威contract/schema/fixture一致性校验；默认旧调用保持旧wire形状，不直接向deny_unknown_fields旧客户端强塞新字段。
- 回执绑定sourceId、捕获sourceVersion、查询身份/关键词摘要、requestedPage和实际请求/响应指纹，说明有效空页终止、存在可请求下一页或尚不能确认。返回非空不等于已证明下一页存在；能递增page也不等于该源支持分页。
- 复用现有Legado AnalyzeUrl、规则解析、source fetch冻结、HTTP及错误分类，不通过正则猜网页或另写分页解析器。模板不显式出现page不能认定不支持，JS同样可能生成分页请求。
- 有效空结果按既有来源语义结束当次来源；网络/鉴权/规则失败或无法证明有效空结果保留failed/unknown。相同请求、响应循环、完整候选序列反复相同等无推进情况停止调度并保留partial/unknown，不能标成来源已穷尽。
- 不新增“最多N页然后成功结束”的应用总上限。沿现有单请求超时、取消、worker并发和资源预算停止；停下不等于取得全集。手动prefetched response无法给出远程分页事实时如实返回unknown。

C2 普通搜书：
- 修改SearchGateway.ts：searchBySource接收当前来源页，解析页回执及该页的invalid/discarded结果，不能沿旧数组长度猜结束。
- 修改SearchOrchestrator.ets的SearchQueryRun、performSearch/retry/stop：按来源保存next/attempted/failed page、来源版本、请求指纹与已确认数据；分开“首轮请求已完成”和“该来源已穷尽”，现有completed计数不得继续混用。
- 修改LibrarySearchPresentation.ets及必要的SearchPresentation.ts：把当前列表尾部需求传给原owner；保留当前来源健康、冷却、启用范围和重试选择，不借续页扩大搜索范围。
- 修改SearchPage.ets及其正常装配（ReaderLibrarySearchSurface/对应Search场景、模型只按实际端口需要修改）：从现有onResultScrollIndex、可见组及空槽/不足一屏事实发需要更多结果的意图，不在Builder直接发RPC。先完成各来源首轮；后续复用runBookSourceWorkers和BookRequestScheduler公平调度，每源最多一页在途，不让单源无限占用。
- sourceResults从单次替换桶改成同来源的确认页集合/增量合并；去重用sourceId+bookId，保留admittedOrder、内容类别、作者证明、来源版本、已有SearchPublication差异通知和返回锚点。不能把后一页的缺席当作删除前页。
- 搜索数量只表达已取得/已找到的结果；只有确证全部来源终止才允许最终总数语义。初轮已完成但后页可按需读取，不持续占用“首次搜索中”阻止浏览，不新增长驻加载条。停止保留结果和未执行页；明确重试只恢复失败/未完成范围。

C3 换源重新搜索：
- 修改SourceSwitchGateway.ts中的refreshCandidates/discoverCandidates/discoverFromSource/decodeDiscoveryCandidates，以及实际调用它的SourceSwitchHost.ts和SourceSwitchPresentation.ets中需要表达部分结果/继续的端口。
- 每源从当前页按实际书名/作者/内容类别匹配，第一页没有合格同书不能宣布该源无候选；按既有查找目标继续该源后页。已找到候选可即时发布，未结束来源保留待续事实。
- 缓存的同书关系128条循环保留，不与远程页进度混用。沿原source/book/author proof和版本核验；失败不删除原候选，后页候选通过原详情/目录准入才能成为可切换目标。
- 页面关闭/取消/来源变更废弃当前调度，旧回执不新开页面、不替换当前书、不自动执行换源。Core原切换事务、幂等回执和正文位置CAS不改变。

P2关闭：真实page2+的候选在普通搜索及换源目标查找中可取得；只返回同一页的来源停止且不假称完整；暂停/重试/返回不重跑成功页；无跨来源串页或同书误合并；未知/失败与有效空结果分开。各来源并发与请求总量按当前需求可观察，不启动时爬完全部书源。

### D. P3：完整TXT目录规则预览

正常入口为ReaderDirectoryDestination文本分支 → ReaderFullDirectory顶部“本书目录层级规则” → ReaderDirectoryRules.run(false) → ReaderDirectoryRulesGateway.preview → Core rules_preview/run。仅本地TXT；普通目录列表、远程书源和漫画不受256预览截取影响。

拟修改：
- Core local_navigation/rules.rs：把整份derive_txt_navigation结果与当前草稿/原书输入绑定，复用现有NavigationIndex、Views/sidecar存储及有限缓存。预览只写可丢弃索引，不写正式navigation/rule/display proof，不修改正文/分章/进度。
- Core local_navigation.rs、local_navigation/v2.rs及sidecar.rs按最小需要抽取共用分页和释放逻辑；预览有独立种类/owner，不复用正式目录“当前已应用版本”等于草稿的假身份，也不能把未应用预览节点授予真实阅读跳转权。
- 拟定能力reading.directory.rules.preview-view.v1；preview.v2增加显式可协商的previewView请求，返回previewId、原书inputRevision、rulesRevision、navigationRevision、总节点/章节数、首批offset/nodes/nextOffset。新增preview.page.v2及preview.close.v2（完整前缀reading.directory.rules），参数绑定book/preview/revision/offset/limit。256保留内部单批值，不能变总量。
- apply.v2对新Host接收expectedPreview证明。新派发前在既有publication/原写入边界核验草稿和原书版本，保存与预览一致的完整结构。原书/草稿变化要求重新预览，不静默重算后应用另一结果。旧客户端默认行为不改变；更新Host必须协商能力，缺能力不能把旧前256回执当完整预览。
- 必须保留RulesMutationOwner的原意图、operationId、ACK、unknown/readback/cleanup语义。已派发原操作的核对/幂等重放按原durable receipt判定，不因进程重启后短命previewId消失而否认已提交写入；新apply与原操作核对分开。
- 修改ReaderDirectoryRulesGateway.ts：保存当前预览身份，提供范围读取/释放，校验准确页长、offset、总量、稳定nodeId、版本与有序范围；期望证明进入原owner意图。
- 修改ReaderDirectoryRules.ets：删除slice，preview数组替换为已有原生List/IDataSource的分页数据源；totalCount取完整可预览总数，按可见索引提前读取，维持stable nodeId和滚动锚点；不附加手动分页按钮。保留原编辑器和预览槽布局，不能把补数据变成扩大整栏。
- ReaderFullDirectory.ets仅补预览关闭/后台/换书/隐藏时的释放通知及必要容量回执；不得重写正式目录列表。新辅助数据源复用当前DirectoryPageWindow模式，属于本功能适配，不另写通用缓存/索引引擎。

生命周期：新草稿/换书/重新预览/关闭/owner退休释放旧preview。失败保留草稿和已读取预览页，局部重试当前范围；未知数据不可冒充末尾。内存/sidecar遵守当前有限view/LRU和节点/字节上界；到界明确失败，不返回截取成功。泄漏、跨owner访问、重复close、回执迟到均有明确处理。

P3关闭：257、1025节点均能看到末尾并返回首部；计数、层级、顺序与整份derive结果一致；预览不写正式数据；原书变化拒绝旧预览apply；正常应用正式导航与预览相同；未知ACK核对及回滚边界保持。

### E. Q1：Quick底部导航回归

现有证据：同四个Button在IME前enabled=true，图中enabled=false，Back后true；声明opacity始终1。原因链为Search.onQueryEditingChanged → onTemporaryLayerChange(true) → Panel.hasCurrentTemporaryInput → controlActionInputEnabled false → navigationInputEnabled false → ReaderActionAccessibility设置原生enabled。不是motion opacity变成低值。

拟在Panel的临时输入作用域加入明确类别（inlineEditor/modal），由实际模块上报；现有bool可在边界派生，不能成为另一套真实owner。Search和Directory query上报inlineEditor；TTS configuration、Replace manager/dialog等上报modal。枚举及接口放在现有control session/host状态文件中，具体业务归属不按键盘高度或模块名字猜。

修改ReaderControlPanel.ets的moduleTemporaryLayerHandler、navigationInputEnabled与模块切换处理，ReaderControlSearchContent.ets/ReaderControlDirectoryContent.ets/ReaderControlTtsContent.ets/ReaderControlReplaceContent.ets调用点，LocalReadingExperience.ets的onControlTemporaryLayerChanged及会话退休接线。ReaderActionAccessibility继续准确反映enabled，不全局取消disabled语义或覆盖其视觉。

规则：只有inlineEditor时导航保持可用及正常原有颜色；点击先按当前owner结束输入/隐藏其IME，再执行一次捕获的目标导航，派发前核验原opening/source/book/session仍当前。编辑文本已由原业务owner保留，不新增隐式保存/取消。新一代页面不能被旧stopEditing/blur回调清掉临时状态。真正modal、more menu、遮挡、拖动、隐身、失效receipt或原操作未决仍按既有规则拦截。Back顺序保留IME优先。Quick/Full motion期间原导航淡出轨迹保留，与禁用样式分开验证。

Q1关闭：inline query打开/收起IME均不把导航整体禁用；四个目标各仅切一次；真正modal不能穿透；迟到blur无效；非当前会话不可触发；不以更改全局Button opacity掩盖disabled。

### F. R1：文件provider异常超限

正常链：BookshelfOperationOwner.import → BookshelfFlowGateway → LocalBookImportGateway → ReaderRuntimeOwner → ReaderHostRegistry.selectLocalBookInputs。Host Picker上限50，Presentation.validBatch也限制50；不能只返回51个failed row来修，因为现有结果owner会拒绝该结果。

方案：在Picker返回后、URI文件名解析/暂存/worker创建之前，验证数组形状、数量和URI基本类型。超过已声明50时整批拒绝，抛可分类的“文件选择超过本次上限”错误；不擅自选择前50，不读取或暂存超出项，也不做部分导入。正常Picker50限制不提高。

修改ReaderHostRegistry.ts、本地导入既有typed failure边界，BookshelfOperationOwner.ts的已知“未派发选择失败”分支和原消息发布。必要UI只接已有ReaderTransientFeedback/当前选择页错误通道，说明重新选择；不能沿catch-all显示“已成功保存会保留”来暗示已发生导入。保留ReaderWriteEvidence，只有这个已知dispatch前错误可判未派发；其他异常不反推未写。LocalBookImportGateway与LocalImportPresentationOwner的正常≤50结果格式及持久恢复不扩容。

R1关闭：51/超大异常集合时没有任何stage/import.persist、临时文件或数据写入，不产生被截成50的成功批；反馈属于当前opening；0/1/50正常及取消路径保持。

### G. 实施依赖、文件边界和回退

1. 固定当前WIP及准确相关输入，不清理工作树。P1与Q1先在当前Host分支集中修复；P2/P3先确定可协商契约，再同步Core和Host，最后做正常装配集成；R1独立小批处理。
2. P2/P3新增协议能力的权威输入在Core contract/lib、remote类型和protocol schemas；其他平台/Reader-UI的合同副本只按规范派生同步，不未经授权扩展其界面。旧调用默认结果形状保留，新增字段只按能力显式请求。数据库、FFI二进制ABI和产品中/大版本不因新增JSON读取能力自动更改。
3. 变更后只运行下节所选回归；需要交付候选时才通过规范Native/NAPI重建及sync-native、不可变HAP编译签名流程。新Core与Host必须匹配，不能拿b90a旧Native证明新接口；指定签名身份、保数据安装按实际动作核验。本计划不授权执行安装或VM。
4. 按P1/P2/P3/Q1/R1拆分可审阅差异及内部记录，保留现有IME WIP。回退某项时用对应提交/补丁，不能整文件恢复到6a覆盖其它整改。P2/P3可回退Host新能力请求并配套回退Core，旧接口兼容留存；功能完整性随回退重新OPEN，不能宣称回退后问题仍关闭。
5. 不新增数据库迁移或清数据来处理失败。预览索引为可丢弃数据；业务规则/导航/源/书架/正文/阅读位置仅由既有授权操作写入。版本、commit、buildId与候选证据分层记录，不写发布说明。

### H. 最小回归和逐项关闭

下表保留实施前候选验证范围，不表示各父文件全部运行；实际选择、必要性和逐次结果以顶部回执及准确日志为准。复用现有生产方法/SDK录制/有限Core端口及现有开源工具，不写只断言常数/字符串或照抄算法的测试。既有大脚本有混合顶层断言时先拆case；拟增名称不得伪装成已登记可执行ID。查询gate index无匹配不自动改跑父文件/全量。

| 范围 | 现有候选入口与拟补精确case | 保护的实际风险 |
| --- | --- | --- |
| P1 owner | test-reader-content-search-cursor/publication/error-boundary：自动续取单飞、同cursor重放、明确结束、无推进、退休/取消/迟到、retry不被滚动自动触发 | 重复页、串查询、隐式重启快照、错误被隐藏 |
| P1显示/预算 | test-reader-content-search-native-list/open-cost/control-host-keyboard、test-reader-editing-hosts的search-result-lane：50→51→200+追加、正常footer0、失败局部恢复、短槽首批不足、Quick/Full/IME锚点、长序列成本与无Prop复制 | 不可滚动导致永不续取、挤占结果、跳锚、重新深拷贝/OOM |
| P2 Core | reader-runtime/tests/search_book_commands.rs + contract/schema准确测试：页号透传、page receipt能力协商、旧shape、disabled/blocked/empty/unknown、无推进指纹 | 假hasMore、假终止、旧客户端破坏 |
| P2 Host | test-search-gateway/orchestrator、test-source-switch-gateway及实际SearchPage/SourceSwitch装配：普通page2目标、换源目标只在page2、单页源、重复页、同页重试、stop/resume、来源换代、去重顺序/锚点、失败来源不拖垮其他 | 只修某一个入口、全源无限抓取、来源/作者/内容类别误合并 |
| P3 Core | local_navigation/rules.rs与v2.rs准确case、reader-storage/tests/directory_rules_lifecycle.rs、rules_mutation_commands.rs：256/257/1025、分页完整性、close/owner、版本改变、preview不落正式数据、原apply回执重放 | 仍只返回前缀、读错正式目录、预览即写、数据版本漂移 |
| P3 Host | test-reader-directory-rules/ directory-rules-targets及SDK列表case：第257与末尾可见、返回首部、跨256边界位置保持、草稿/换书/关闭、失败局部重试、preview/apply同版本 | 仅改Core仍slice、前端假total、旧草稿覆盖 |
| Q1 | test-reader-content-search-focus、目录focus、真实Panel/Host SDK：inline编辑四目标各一次，modal与unknown阻断，迟到blur、Back先IME、morph仍原导航opacity | 单改颜色、导航穿透modal、旧回调清新状态 |
| R1 | test-document-picker-system-file-handoff、test-bookshelf-picker-caller-admission、test-bounded-local-import-composition：0/50/51/超大/非法返回，stage与persist调用0，当前owner反馈，正常50批结果恢复 | 静默丢选择、未派发被说成unknown、扩大结果格式上限 |

选定检查执行前在原问题记录写入口、嵌套范围、时限及停止条件；本批不默认跑全量、类型覆盖全集、旧full、全部UI门禁或所有Core工作区测试。实际Core能力与schema测试只选本次新增/兼容字段。失败先复核本次日志与源码，形成新原因后再运行同一最小场景。

代码关闭必须同时具备：契约完整、正常入口接线、结果/末页可达、身份和异步生命周期、失败恢复、最小回归、实际编译及Core/Host配套。源码/SDK不能证明原生像素、真实滚动预取及时性、焦点、IME、读屏或设备内存达标；这类后续仅按另行明确的原生范围验证。方案编排时状态为PLANNED/NOT_RUN；本次实施后的分层状态以上方回执为准，不新增全应用审计轮次通过或原生总体完成声明。

---


**2026-11-17 用户纠正：Quick 呈现重新开放。** 用户明确指出，`reader-control-framework-ime-final-many-quick-results-1794898632519.png` 中的“加载更多结果”和淡化底部导航不是正常快捷控制栏。此前根据外框高度相同、整块避让和局部结果可见而作出的“呈现正常”结论撤销，当前 b90a 候选不能据此收尾。源码历史已追到：分页覆盖动作最早于 `d6966fc9`（2026-09-12）加入，`31536cfb1`（2026-11-13）将其最小高度从26改为44vp；`0b2de1c5`（2026-11-13）将底部原生Button的无障碍适配enabled从true改接navigationInputEnabled。当前同会话树中四个导航Button在输入法前为enabled=true、图中为false、Back后恢复true；分页在Back后仍存在。历史实现不等于批准基线，位移／裁切通过不等于Quick呈现验收。此次只追溯、撤销错误验收并登记，生产修复尚未完成，没有新增VM操作。

追溯补充（2026-11-17）：已从原始会话找到实际引入背景，而非只按Git日期推断。2026-09-12 01:07（北京时间）登记SEARCH-001：只请求／展示前50处正文匹配，第51处以后不可达；随后01:13“全量修复”、01:32“继续”。当时Codex于02:01:45加入固定112×26vp、9fp文字的loadMoreAction，02:02补状态与分页调用，之后分别归入Core02d0b4b0和Appd6966fc9。固定覆盖布局是实现选择；本次所查上下文没有独立确认该几何。368af7f7在10月20日又将普通加载更多文字接入MESSAGE_ACTION（当前13fp/20行高），31536cfb于11月13日将正常按钮及测量最小高度26提升44vp。10月确认C07仅覆盖后续结果失败的末尾提示／重试，不足以确认普通常驻大按钮。当前显示条件为results且hasMore／loadMoreError／paginationRetired之一成立，Quick与Full共用，不依赖IME，不要求滚到末尾。Core hasMore是同来源同书已缓存正文中的下一条匹配确实存在；每批50，并非目录章数或屏幕溢出。UI失败分支还把hasMore复用为当前游标能否重试，需区分其与Core成功回执的语义。原始节选及当前链条已写回原问题记录；历史安装可见性不由提交日期证明。

### 2026-11-17 分页来源与同类数据范围追溯

用户明确否认提出过正文搜索分页需求，并要求核查是否由启动优化擅自引入。当前可追溯的App4d6543a2（2026-08-10）在首次生产阅读接线中直接调用searchContent(...,50)，原调用只返回结果数组；它不属于启动调用。9月12日SEARCH-001将第51处以后不可达登记为静默截断，Codex随后选择offset/hasMore和固定手动按钮进行修补。9月15日Core801d1953才进一步优化搜索缓存扫描／共享发布，不能倒用这条性能提交解释更早的按钮。未找到将50或手动分页用于启动提速的记录；原8月会话路径虽在本机索引中，实际文件已缺失，不能补造当时选择50的理由。书架48条/144驻留及9月23日bounded projection是另一条真实首屏／内存机制。

本次全树检索覆盖当前646个生产ETS/TS，59个候选文件按18类数据链追到生产消费和Core生产端；这不是646文件逐语义或原生验收。另确认普通搜书／换源远程搜索只请求书源第1页，目录层级规则预览只给前256节点且无范围说明／后续入口。异常文件provider返回超过Picker上限50时，Host slice只保留前50，超出项仅日志，是独立条件遗漏。正式书架、目录、正文/漫画窗口有自动接续，本地搜索／同书缓存候选／后台准备／存储清理有完整循环；书签、阅读记录、分组、规则正常调用未加隐式limit。所有路径、阈值、历史、结论及界限见[分页影响清单](../../.reader-artifacts/app-ui-framework-audit-20261114/pagination-impact-investigation-20261117.json)。本次只调查与记账，未修改生产实现、运行测试／构建或操作VM；以上新增问题尚未修复。

## 2026-11-17 统一键盘编辑可见性修复：基于当前代码的实施方案

**2026-11-17 执行回执：代码与40项定向回归已完成；366章目录、筛选／清空／结果选择和键盘场景已有当前候选原生结果。Quick整块与分页裁切的最终对账仍在收口。** 开始实施时HEAD为干净提交 `6a2f03abce6f92371d9139d224ddf962473a8311`，上一生产提交为 `8da2c02d56ed24a6a2bfe41a8fe039475966804e`。本次修改47个生产文件，其中4个为新增共享适配；Core／Reader-UI pin、产品版本、数据格式、系统显示配置保持既有输入。下列1—8节的“当前事实”列保留修复前基线；执行规则已按模块任务与整块优先补齐；当前实际结果以本段及[同一问题实施记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ime-unified-implementation-20261117.json)为准。

| 批次 | 已实施结果 | 当前证据边界 |
| --- | --- | --- |
| A 窗口事实与共享几何 | 同一次TYPE_KEYBOARD采样保留available／visible／实际vp矩形；ReaderKeyboardGeometry统一宿主交集、floating矩形、已RESIZE／嵌套宿主、完整字段／caret行／零容量判定。 | 6个几何case通过；未知位置保留geometry-unknown。 |
| B 外框、环境与编辑容量 | 外框resolver去除IME扣减；结构测量与完整环境分开；Panel使用同一展示原点，整块可容纳时优先完整避让，不可容纳时保留模块任务与独立内容高度。 | 5个Host case通过；正常Full目录外框未变，Quick完整shell、查询／结果、Back恢复已有原生分项证据。 |
| C 公共输入及稳定编辑树 | 新增ReaderEditingVisibility／ReaderEditableTarget／ReaderEditingScrollBinding；公共有限输入分支及下载直接输入均接入。目录、Toolbar重排、替换、TTS、下载range不再因容量阈值更换编辑body；旧opening的事件、布局、卸载拒绝后继绑定。 | owner／native适配9个case、公共字段、编辑body、TTS修复及搜索结果裁切6个case、目录8个case及focus父链1个case通过；不据此声称真实组合文本、选区和原生实例已验收。 |
| D 消费接线与容量迁移 | 原16个业务消费文件＋诊断fixture逐项接线；RssPage为passive入口，无真实输入，RSS editor／Sync仍按L0关闭记录。原15类几何消费者迁移／保留边界已落实；短反馈及搜索历史使用实际已resize宿主，避免重复扣减。 | 当前生产范围646个ETS／TS（不含Native声明）；改动47文件。未开放关闭路由。 |
| E 定向检查及产物 | 40个唯一case分别通过；规范iteration、contracts=none构建及指定minliny_HarmonyOS证书验证通过。 | 当前候选`0.2.0.DEV.b90aaf06a33b`，[不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261117T064545Z-6a2f03ab-b979fa98/manifest.json)；最终结果裁切原生回执待写入，全量测试NOT_RUN。 |

旧TTS交互probe的过期路径、遗漏的真实helper／测量端口和旧直接键盘setter期待已修正；本次点名fields／manager-drafts／keyboard／overlay均通过，其他兄弟case未运行。原生中另定位并修复了TTS当前编辑器在普通最低容量准入变化时被错误关闭，以及content-cover根未随RESIZE缩小、Scroll没有实际滚动余量的问题；后者现按真实窗口矩形限制管理宿主。旧失败、输入框可见但结果被挡、结果可见但整块被截住的中间候选均保留，不计最终关闭。

**规则修正：任务类型决定必须保留的内容，实际容量决定采用哪种呈现。** 自定义阅读控制栏整体能放进键盘上方时，优先保持原尺寸并完整移到键盘上方；整体确实放不下时，才保留当前模块的任务最低区域并调整内部容量。Quick／Full是当前形态，不是两套硬编码避让政策。查询框露出不能单独证明搜索可用，最低任务区域露出也不能作为可完整呈现控制栏时的停止条件。原21变体×16层登记、G05／G10和未证明的极限原生条件继续按原边界保留。

本次按用户要求换用正常搜书入口中的《365天读点经典》（七猫小说），实际366个可读条目。旧候选067b在到底部后滚动发生真实ArkUI OutOfMemoryError，堆栈落在Content的entries @Prop递归拷贝，申请147,849,216字节时失败；原错误证据保留。当前复用已有目录值快照比较器和Search publication模式，将LRE→Panel→Content→NavigationSurface→NavigationList，以及完整目录／独立目录的六处正常装配改为普通publication引用＋数值revision，真实目录／书签变化才发布新快照。4096条×120次呈现保持同一快照，同数组内书签变化仍更新revision；八项目录SDK回归已改为真实publication装配并通过。b90a当前366章原生复验完成后段滚动、键盘锚点保持、论语四条筛选、清空恢复和实际章节选择，同一PID20289持续存活；不据此宣称无限目录、峰值JS堆或全应用性能验收通过。

### 1. 当前真实执行链和必须共同修改的边界

| 当前代码 | 当前事实 | 本次处理 |
| --- | --- | --- |
| [ReaderWindowCoordinator.refreshMetrics / avoidInsetsVp](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderWindowCoordinator.ts:548) | TYPE_KEYBOARD被压成四边insets，原始矩形和采样是否成功未保留；统一revision会随IME变化发布。唯一原生避让模式写边界仍是applyKeyboardAvoidance。 | 同一个owner增加键盘可见事实和实际矩形，保留现有insets与revision兼容；不增加第二个Window监听者或独立AppStorage发布者。 |
| [ReaderLayoutGeometry.resolveReaderControlLayout](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts:561) | keyboardOcclusion进入safeBottom、dockBottomGap和availablePanelHeight；Full／Quick外框尺寸与内容容量混为一体。 | 外框只使用真实窗口及非键盘安全区域；IME另算编辑可见区域和必要位移。不能仅删除扣减后让输入区被键盘覆盖。 |
| [LocalReadingExperience.onWindowMetricsRevisionChanged](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets:4540)、[controlLayout / controlMinimumEnvironmentKey](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets:7804) | 每次metrics变动都会换controlMinimumGeneration；原环境key含keyboardInsets；current receipt、候选和provider均有真实环境／代次校验。 | 将“尺寸测量依赖”和“完整当前环境”分开；保留完整环境拒绝迟到回执，不能只删keyboardInsets或重写旧revision冒充新测量。 |
| [ReaderControlPanel.acceptRuntime / controlContent](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets:700) | contentMotionHeight来自运动frame；正常装配直接传给各模块availableHeight。dock.translateY、手势原点、backdrop、morph裁切分别使用dock坐标。 | 保留原运动frame及端点；增加独立编辑viewport，向内容传可见容量；必要上移统一经同一个presentedDockTop计算，所有坐标消费者同步接入。 |
| [ReaderControlDirectoryContent.syncContentLayout](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderControlDirectoryContent.ets:554) | shortContent改变presentationKey及layoutPresentation；focusId带layoutPresentation。普通toolbar与shortHeader各建一个输入树，随后恢复焦点／键盘。 | 改为同一编辑字段、同一节点所有权和稳定挂载；容量变化不作为换字段的理由。保留正常业务换页／换tab／换owner时的失效边界。 |
| [ReaderControlSearchContent.focusQueryField / searchField](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderControlSearchContent.ets:244) | Quick／Full共用一个真实输入控制器，Quick也可编辑，并非只在Full输入。 | 当前Quick整块可容纳时完整置于键盘上方；确实不能整块容纳时才用模块任务最低区域，尺寸和形态语义不变。 |
| [ReaderControlReplaceContent.temporaryOverlay](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderControlReplaceContent.ets:753)、[ReaderTtsConfigOverlay.boundedContent](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderTtsConfigOverlay.ets:329) | 高度阈值决定完整滚动与局部滚动两套builder，包含真实表单输入。TTS manager另有windowModal RESIZE租约。 | 编辑body保持同一挂载路径；仅变可视约束／固定chrome预算，不在编辑中换树。TTS的系统RESIZE owner与退出恢复继续使用原边界。 |
| [ReaderFormField.build](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderFormField.ets:89)、[ReaderSearchField.revealBookInputCaret](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderSearchField.ets:361) | 公共表单分支还没有统一父宿主纵向揭示协议；bookPanel已有控件内部caret揭示。source-code是320vp的TextArea，属于必须覆盖的超高输入。 | 公共输入只报告编辑位置，业务owner继续拥有草稿；父宿主负责纵向可见性，原生控制器负责文本内部滚动。 |

对上一版口头方案作一项明确修正：**不能要求所有输入场景的外框位置绝对不动。统一保证是纯IME不改写自定义阅读控制栏外框宽高；整体放得下时优先整块避让，放不下时才按模块任务做内部滚动和必要的有界位移。** 当前正常Full目录整体高于键盘上方空间、输入已位于上部，因此只调整内部可见容量；当前Quick全文搜索整块可容纳，因此整块置于键盘上方。普通App页面继续尊重原系统模式及真实父视口，不将“保持自定义阅读外框”扩展成全应用冻结窗口。

### 2. 第一步：在现有窗口边界补齐可用事实，建立共享几何解析

修改 [ReaderWindowMetrics.ts](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts:43) 与 [ReaderWindowCoordinator.ts](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderWindowCoordinator.ts:548)。新增带默认值的键盘采样事实，例如 `keyboardArea.available / visible / rectsVp`，由refreshMetrics的一次TYPE_KEYBOARD采样同时生成旧insets与新矩形；不可为同一事件再次查询一套不同状态。矩形仅保存平台实际提供的非空区域；采样失败记未知，不能用零伪装“确认无键盘”。新事实参与snapshot相等判断；旧constructor调用保持兼容。已有Back判据的兼容迁移一并验证。

拟新增 `entry/src/main/ets/ui/layout/ReaderKeyboardGeometry.ts`，只做Reader布局适配，复用平台编辑／滚动能力，不实现新的滚动引擎。输入为当前宿主在窗口中的rect、非键盘安全边界、平台键盘rects、当前输入／caret编辑区、允许的scroll extent及panel平移范围。输出包括可见区域、容量状态、最小揭示距离和需要的有界panel上移；先计算矩形相交，不能用“keyboardHeight减inputHeight”。

坐标规则已核本机SDK：Area.globalPosition为当前窗口坐标，Area宽高为vp；CaretOffset.x／y为输入控件局部px；Window.Rect为px。所有平台px只在适配边界转为vp，caret加字段窗口原点后才与键盘相交；不得把globalRect的屏幕原点再加到已经是窗口坐标的Area上。变换中的输入位置优先复用 [readerMeasureSurfaceRect](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderSurfaceRectMeasurement.ets:9)；它已有变换位置读取和owner拒绝，不能假设onAreaChange一定随translate产生。

系统已RESIZE的页面以实际host rect与键盘rect求交，只扣真实剩余交集；不继续把windowHeight－viewportHeight一律解释为键盘已经消耗的高度，真实分屏／嵌套宿主也会产生差值。浮动／分离键盘只对平台提供的实际矩形处理；缺少位置时保留未知边界，不凭底部inset声称覆盖任意浮动形态。

### 3. 第二步：分离控制栏外框、编辑位移和内容容量

修改ReaderLayoutGeometry的resolver：从外框safeBottom去掉keyboardOcclusion；dockBottomGap、fullPanelHeight、quickPanelHeight和minimum fit只使用原窗口、非IME安全边界、当前真实最小profile。原作者宽高比例、顶部避让、字号和真实最小尺寸继续生效。纯IME关闭／打开／改变高度时，固定相同结构输入的外框宽高相等；真实旋转／窗口／字体变化仍会换代。

修改LocalReadingExperience的controlLayout、onWindowMetricsRevisionChanged、scheduleControlMinimum及admitControlMinimum；在现有完整environmentKey之外增加结构测量key，包含真实viewport、window几何、density、字体、非IME安全区域及内容测量依赖。纯IME改变只更新编辑事实；相同owner、结构key、候选宽度和facts几何依赖才允许复用已经同步确认的测量结果，并在当前请求／完整环境准入下形成新的展示回执。保留provider／generation／身份／真实输入前后检查，不能直接把旧异步回调或旧metricsRevision重标。同步核对ReaderControlMinimumMeasurement的profile，以及TTS／AutoPage播放profile和session launch对原metricsRevision的消费；不得因为尺寸可复用就放宽播放或转场的所有权。

修改ReaderControlPanel，增加独立 `editingViewport` 与 `editingOffsetY`，保留contentMotionHeight为原运动几何。按当前实际frame.content、原生宿主位置和键盘交集，得到各模块的可见编辑高度，传给内容布局和局部overlay；外框及运动端点不使用这个高度。拟设 `presentedDockTop()` 作为统一展示原点：build dock位置、acceptRuntime里的dockRect、controlTouchHandler手势原点、reportSessionMorphSource裁切及onSessionLaunchShellMeasured等使用同一结果，不只在外观加translate。

揭示顺序：当前输入所属的完整控制栏若能放入真实键盘上方的安全区域，由Panel把完整shell作为共享revealRegion，保持原宽高和内部布局，有界整体上移。完整shell确实放不下时，退回模块给出的任务区域；先使用已有内部滚动，必要时再有限位移。目录任务包含筛选结果／空态容量，正文搜索任务由已有ReaderSearchMinimumProfile提供查询、完整结果行或当前状态以及分页／恢复动作容量；搜索任务不得退化成caret可见。多行表单才允许整框放不下时使用caret行判据。位移使用当前原生回执增量修正，同一窗口／owner／字段至多合并一个在途布局请求；用户切换模块、关闭、背景或Back使旧请求失效。

### 4. 第三步：公共输入只接事实，宿主接动作

拟新增 `entry/src/main/ets/ui/layout/ReaderEditingVisibility.ts`，由每个当前编辑宿主持有实例，定义字段绑定、当前generation、等待布局／已可见／待揭示／仅编辑行可见／空间不足状态。它只调宿主提供的现有Scroller／文本controller适配，不持有书籍／规则草稿，不新增全局active field store。

公共ReaderSearchField、ReaderFormField新增可选的编辑可见性端口与稳定字段身份；已有正常业务调用逐项绑定。onFocus／onBlur、onEditChange、onAreaChange、onTextSelectionChange和文本内部scroll要在实际输入声明处组合现有回调，不能再加一个后置modifier覆盖原监听。ReaderFormField中所有有限分支及TextArea都要接，不能只补reader-content-search。现有reader-content-search外部controller继续复用；其他TextInput与source-code TextArea使用各自长期持有controller，不在build中new。

布局读取复用 [ReaderPostLayoutFrame](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderPostLayoutFrame.ets:22)，保留其idle／下一帧一次交付与失效保护；组件盒不变但键盘／选区变化时主动请求一次当前原生位置，不能只等Area。先让原生controller.scrollToVisible处理当前caret／活动选区端，再让父宿主根据实际位置最小揭示；不把索引强制裁到已提交字符串末尾。当前build-profile的compatible／target均为6.1.0(23)，本机SDK的scrollToVisible为since23，TextArea／TextInput的选区与编辑事件已经声明；方案不需要升级SDK或兼容版本。

### 5. 第四步：处理真实会换输入树的布局

**目录：** 修改ReaderControlDirectoryContent、ReaderControlDirectoryGeometry、ReaderDirectoryToolbar。普通directoryToolbar与shortHeader收敛为一个持续挂载的查询区域，shortContent只决定槽位约束和辅助chrome如何分配；不能再由short标志改变focusId或把同一查询从Toolbar树搬进另一个ListItem树。输入区使用从初始就挂载的局部Scroll，正常容量时零偏移，狭小容量时可滚到输入行；原章节／书签List和NavigationSurface保留自己的Scroller及语义锚点，不在全List外再套同向Scroll。Toolbar的queryStacked也必须让同一字段保持同一父链，只重排查询／工具槽。普通紧凑布局沿原稿；短高度下工具与信息进入可滚动内容，不通过缩字、缩行或扩大32vp工具改变容量问题。

目录同步修改syncContentLayout、directoryFocusId、queueLayoutRestore、queryInteractive：字段身份由session／tab／当前业务opening决定；布局／最小profile版本只更新布局ticket。输入框本身可见且当前owner可编辑时不因工具栏没有完整露出就一并禁用输入；未完整可见的动作按自己的可达区域处理。原leadingRow／fraction、prefix位置、NavigationList锚点和查询／排序保留；键盘显示意图仍以用户显式编辑和Back为依据。布局变化不再依靠先销毁输入、再showTextInput续接。

**全文搜索：** 修改ReaderControlSearchContent及其geometry容量入口，保留现有同一个inputController／queryInputId／结果Publication；分离正常运动frame与编辑结果viewport。Quick不被强制切Full。结果List接受剩余容量，不能改变查询或结果锚点来补位置。

**替换编辑器：** 修改ReaderControlReplaceContent的temporaryOverlay／temporaryFlow／temporaryBody。将editorFields保持在一个稳定编辑body中；普通容量下header／actions仍按既有固定视觉，容量不足时改变chrome预算和滚动范围，输入body不在两个ReaderBoundedSurface builder之间重建。其opening、mutation pending、取消和保存仍归原owner；本次不修改业务事务。

**TTS管理：** 修改ReaderTtsConfigOverlay的boundedContent／compactContent及窗口可见容量接入。configurationBody及其字段保留同一挂载路径，正常固定footer继续保留；不足时允许chrome进入同一可滚动容器，保持字段节点。原acquireReaderKeyboardResize／release同window／owner／install epoch边界保持，原生实际RESIZE已处理的部分不重复扣。

### 6. 第五步：模块任务、整块优先与高度不足的统一执行规则

| 任务类型／实际入口 | 必须保障的内容 | 容量处理责任 |
| --- | --- | --- |
| 目录／书签筛选：ReaderControlDirectoryContent、FullDirectoryPanel、BookDirectoryPage | 当前输入与筛选工具可达；至少一条完整结果行，或当前空态／失败及恢复入口 | 原Directory minimum／contentGeometry保留结果容量，非编辑前缀可局部滚动；不因IME改换输入树或自动改变Quick／Full。 |
| 正文搜索：ReaderControlSearchContent | 查询与搜索动作；至少一条章节标题＋摘要，或idle／loading／empty／error状态；当前分页／恢复动作 | 复用已有Search minimum的当前状态profile，经editingContext交给共享框架；状态或profile更新重新评估。 |
| 普通编辑表单：替换、TTS、下载范围、分组／规则等 | 当前字段、校验与后续确认／取消动作可达；多个字段允许在现有Scroll内连续访问 | 复用原Scroll和原业务提交／取消；不要求所有字段同时出现，不自动提交或关路由。 |
| 多行正文／JSON：SourceTools等 | 当前caret行及局部上下文；原文本内部滚动与选区控制 | 整个320vp输入盒确实放不下时才采用caret判据；维持原盒尺寸及同一native controller。 |
| 普通列表筛选与搜书：SourceManagement／SharedDownload／ReaderLibrarySearchSurface | 当前过滤／提交状态及其列表／历史／恢复内容能够通过原页面滚动访问 | 保留原live／submit业务区别与实际父宿主容量，不把普通页面强行变成阅读控制栏；未实测的结果命中不写成原生PASS。 |

| 实际容量 | 执行动作 | 结果边界 |
| --- | --- | --- |
| 完整控制栏能放入键盘上方 | 保持原宽高／形态，整体移入安全区域，连同底部导航和亮度栏一起呈现 | 不以最低任务刚露出为停止条件，不保留可避免的半截遮挡。 |
| 完整控制栏放不下，但当前模块任务能放下 | 保持外框宽高，由模块约束内部结果／状态／工具容量，已有Scroll最小滚动；必要时有界位移 | 输入框可见不能替代结果可读，完整Full不因此自动折叠。 |
| 多行字段高于可见区 | 原生文本内揭示当前caret行，再配合父Scroll | 只有多行编辑可用caret降级；搜索的任务最低区域不能降为一个光标。 |
| 非编辑chrome挤占全部空间，但真实窗口尚能放编辑行 | header／footer／工具转为原内容流的可滚动部分，当前编辑行优先 | 不换输入实例，不夹成0后继续报告ready。 |
| 经合法滚动／位移仍放不下当前任务或编辑行 | 明确space-insufficient；保留当前实例、草稿、组合文本及选区；停止自动纠正，系统Back收键盘 | 不自动提交／丢弃／关路由，不循环弹IME，不缩字体或改系统显示。 |
| 原生或模块任务几何尚未就绪 | geometry-unknown，等待下一次真实事件或有界布局回执 | 不用输入框单独可见冒充结果任务可用，不定时轮询。 |

Back继续复用LocalReadingExperience.requestExit和ReaderKeyboardBack的当前事实消费。无可用编辑空间时系统Back必须优先收键盘；已按Back退出的字段不因后续layout回执重新弹键盘。键盘收起后的恢复只修正本次框架引入的临时位移及越界scroll；用户已主动滚动的结果位置继续由原owner持有，不能无条件拉回旧坐标。

### 7. 第六步：按实际输入消费和原15类几何消费者接入

当前精确构造扫描得到**16个业务消费文件＋1个诊断fixture**；这不是16页，也不是原生已复现16项。公共原生TextInput／TextArea声明集中在ReaderSearchField、ReaderFormField和SharedDownloadPage三个生产文件。输入构造清单与原15个几何消费者是不同分母，需交叉登记。

| 消费文件／正常宿主 | 实施接线 |
| --- | --- |
| ReaderDirectoryToolbar、ReaderControlDirectoryContent、ReaderControlSearchContent、ReaderControlReplaceContent、ReaderTtsConfigOverlay | 按上面的专用内容／稳定输入修复，复用同一共享几何和编辑端口；不能另做五份IME状态机。 |
| ReaderDirectoryRules | 两个pattern／level字段绑定既有rule.id与原overlay Scroll；详情和阅读内两条来源都传同一个端口协议。 |
| ReaderLibrarySearchSurface | 使用model owner＋fieldIdentity，保留现有持续挂载搜索栏；historyLimit接共享可见容量，只有真实遮挡才揭示字段。 |
| SourceManagementPage | 搜索字段绑定当前page owner及输入身份；分组popup与恢复容量按现有独立槽位消费共享几何，不缩主页面外框。 |
| SourceToolsPage | JSON编辑320vp TextArea与debug字段分别绑定现有inputRevision／editor revision／busy owner；接当前页面List／表单宿主，不滚另一个卡片或已退休输入。 |
| RulesManagementPage | 每项规则的有限字段绑定原规则／草稿owner，父列表／表单接揭示动作。 |
| BookshelfManagementPage | groupName、groupOrder及assignment字段使用原分组／操作身份；输入区接可见性，原分组列表滚动继续独立。 |
| JsonImportDialog | 复用当前outer Scroll、urlInputRevision和弹层焦点scope；availableHeight使用共享宿主交集，保留自然Dialog及取消逻辑。 |
| SharedDownloadPage | searchField、rangeBoundInput两处原生声明接同一编辑适配；range start／end使用opening＋revision＋端点身份，不为保留当前下载视觉强行换成另一表单spec。 |
| RssPage、RssSubscriptionEditorPage、SyncPage | 当前L0关闭；记录实际构造点和同一接线契约，完成可编译接入不打开产品门，不计当前正常可达原生验收。 |
| ReaderFrameworkGeometryStructureFixture | 仅作为共享输入及几何诊断装配，不计生产页面验收。 |

普通表单优先接已有ReaderPageScrollHost或页面原生List／Scroll，不能假定所有字段都在ReaderPageScrollHost内。ReaderFormRow只传字段／宿主绑定，不创建独立键盘owner。ArkWebExecutionHost复用实际Web编辑和现有Back，只统一其host safeHeight交集；不注入JS扫描网页输入。独立漫画目录经ReaderDirectoryToolbar及其宿主接入，漫画正文的system／viewport策略保持。

原15个几何／位置消费者全部对账：ReaderLayoutGeometry、ReaderTtsConfigOverlay、ReaderLibrarySearchSurface、SourceSwitchWindow、SourceManagementPage、SettingsSelectOverlay、JsonImportDialog、BookshelfGroupDialog、LocalImportDialog、BookshelfShell、BookshelfPage、ReaderJourneyRecoveryNotices、ReaderInlineSelect、ArkWebExecutionHost、ReaderTransientToast。共享几何取代各处重复的host bottom／keyboard推算，但各自保留列表、恢复槽、下拉或短反馈的位置语义；不把这些15项全部登记成边框缺陷。ReaderInlineSelect仍覆盖下载6、书源工具2、目录规则1；短反馈只改定位事实，消息类别与生命周期不改变。

### 8. 实施顺序、准确回归与关闭条件

按依赖连续完成A（窗口事实＋共享几何）、B（外框／完整环境／内容viewport）、C（公共输入＋目录／搜索／替换／TTS稳定挂载）、D（实际消费接线＋其余容量消费者）、E（准确回归＋一次规范编译），不能每补一处都重复整包构建或再开全局审计轮。各批修改后先做本批明确需要的准确检查；方案制定时尚未执行；当前准确结果见本节顶部及实施记录。

| 准确入口／拟新增case | 本次必须证明的问题 | 执行边界 |
| --- | --- | --- |
| 拟新增tools/test-reader-keyboard-geometry.mjs：docked、native-resize、nested-host、floating-reported、unknown、no-space | 调真实共享解析器；窗口原点非0、density3.5、已resize／部分resize、未遮挡输入、过高输入、零容量、未知位置、实际矩形交集 | 纯方法，不运行App／SDK构建／设备；case拟议，尚不存在 |
| 修改tools/test-reader-control-host-keyboard.mjs并拆为明确选择项：outer-frame、editing-viewport、quick-reveal、back-owner | 删除414vp缩框与Quick上移数值作为产品正确性的旧判据；真实resolver／LRE／Panel绑定证明外框宽高不随IME变、Quick可编辑、Full已可见不移、旧回执拒绝和阅读不重分页 | 仅选定实际方法／共享纯几何；旧文件有顶层多领域断言，先拆可选择入口，不能直接整文件附带跑 |
| tools/test-control-directory-short-content.mjs：short-sdk、prefix-anchors、directory-focus、keyboard-transfer、keyboard-observation及拟新增stable-input、field-below-keyboard | 调实际Content／Toolbar／Field，检查普通／狭小容量的稳定字段和真实挂载树、owner、原动作和语义锚点；补组合文本保留的状态约束 | SDK lowering／有限原生端口只证明声明与方法；不能模拟一个focus就宣称真实IME组合文本通过；旧transfer断言随节点连续性改写 |
| tools/test-control-directory-focus-path.mjs：toolbar-focus-path | 新Scroll／编辑槽父链没有enabled／focusable／hit-test阻断，旧祖先负例仍被行为判据拒绝 | 实际SDK声明路径；不是实际触摸／焦点引擎 |
| 拟新增tools/test-reader-editing-visibility.mjs：field-events、caret-px-vp、retired-target、back-cancel、multiline、stable-editor-hosts | 调真实输入和owner方法，证明回调组合、不覆盖原submit/change、选区／caret坐标、旧字段失效；目录／替换／TTS过阈值保持同一编辑body | 方法＋SDK持续更新probe；无真实native mount/composition则明确未证明 |
| tools/test-reader-tts-config-interaction.mjs：fields、manager-drafts、keyboard、overlay | 修改TTS编辑body后，字段、原草稿、临时RESIZE取得／释放、取消与晚ACK仍正确 | 只列本批需审读的准确case，测试定义变化时先更新本项依据，不自动重拍索引或扩大兄弟项 |
| tools/test-post-layout-continuations.mjs：adapter-delivery、slot-delivery（仅共享adapter实际修改时） | 几何不变／Area不来时，一次布局后读取仍会到达且旧owner／零盒拒绝 | 若仅调用既有adapter且源码未变，复用原准确证据，不为使用它重跑 |
| HAP规范iteration build，contracts=none | ArkTS类型、组件接线及新SDK事件实际可编译；构建所需输入／Native配对／指定签名独立核验 | 代码及定向回归收口后只做一次必要构建，未授权阶段不安装，不附带全量 |

验收应分别记录：外框尺寸稳定、必要位移及命中一致、完整可容纳控制栏的边界与内部任务可见像素、超高TextArea的caret行、零容量退出、原生实例／组合文本／选区连续、Back不重弹、用户滚动及业务位置保持。代码／SDK只能关闭其实际可证明层；恢复目标及设备授权满足后，原生最小场景选择当前候选的Full目录、Quick全文搜索、超高JSON编辑、替换及TTS过阈值和实际高度不足。每项先列唯一待答问题，已有未受影响的输入／查询／返回证据记REUSED；不重跑无关主题、源导入、TTS播放或整页验收。

任何一项仍以不可编辑、输入节点重建、负容量、无限纠正或按Back再弹键盘结束，本family不得关闭。方案不要求修改数据schema、产品版本、Core／Reader-UI pin、分辨率、密度或系统字体。实施时按上述依赖提交原子变更；回退使用该批明确diff／提交，保留并行WIP及数据，不能reset工作树或卸载清数据。


## 2026-11-17 键盘外框策略专项：范围已查清，修正待实施

用户指出目录唤起IME后外框整体缩短。本次先扩大到642个当前应用ETS／TS、20路由及4个manifest页面根，追踪54个相关候选用法及父宿主，正式纵向容量／定位消费为15文件；完整分类、来源行、保留与诊断边界见[范围结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ime-geometry-impact-20261117.json)。当前生产与安装候选仍为8da2c02d／0.2.0.DEV.7b0f6137368c，未为此修改或重建。

原因已定位到普通手机文字阅读local／NONE策略下的 `ReaderLayoutGeometry`：键盘遮挡进入整个控制栏的bottom gap和可用外框高度，随后分配各模块内容。相同求解作用于目录、朗读、界面、设置、全文搜索、自动翻页、替换及主菜单的Quick／Full。已有原图输入的实际生产方法复算精确得到外框2346→1345px、顶边388px保持、底边2734→1733px；这是应用外框政策，不是VM分辨率或密度变更。[方法结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ime-control-layout-real-method-20261117.json)

后续代码处理先在共享控制栏边界分开作者外框与IME内容遮挡；保留实际焦点、Back、语义列表锚点及真正窗口变化。原 `test-reader-control-host-keyboard` 的414vp期待把缩框本身当正确结果，须随新契约修正，准确覆盖键盘开／关、Full／Quick、普通／短窗口和输入状态保持。必要的正常原生复验只在代码与准确本地证据完成后选择。单独TTS管理的RESIZE覆盖、9处公共下拉、表单／Web／恢复区容量和短反馈位置应按各自宿主评估，不能用全局关闭键盘避让代替。

此前“列表像素空白”是assistant误读，现已按用户附图与原PNG像素核对撤销；三张图的四个文字区计数完全相同。目录输入、查询、清空及Back行为可分别记准确原生结果，外框策略不能由这些PASS自动关闭。本次仅做代码范围与既有证据归因，生产修正尚未实施，VM操作暂不继续。


## 2026-11-17 VM续接：保数据安装、正常启动与主题保存已通过

用户“代码侧审核问题已解决且无新增问题，可解除”的条件已按干净代码提交`8da2c02d`、关闭队列、定向review及回归绑定核实，本次VM验收禁令已解除。第31轮及后续全局审计仍取消；历史0／3及第30轮FAIL原件保留。当前签名候选 **0.2.0.DEV.7b0f6137368c** 已通过规范入口保数据覆盖安装并启动；安装前真实DB／WAL已备份，因快照变化实际只补跑1个准确兼容用例，另2项REUSED，整批数据证明与安装用时52.286秒。实际Core身份与候选匹配，当前PID发布Runtime；正常书架4个source／book身份与安装前副本逐项相等，画面保留文字27%及漫画100%／第2页。

正常设置入口已完成真实主题“跟随→深色”、原生选中与像素变化、冷重开后深色仍选中，再恢复原“跟随”并返回书架。实际显示1280×2832，两项密度均3.5；系统字体、密度、分辨率及VM生命周期未改。首个通用文字定位器因Tab子Text主动合并语义而拒绝派发，原FAIL保留；随后依据当前原生Button边界与两Tab正常配置完成同一场景。未强造持久化失败，错误／重试／旧host路径仍保留9项本地准确方法与SDK证据边界。

此前可选UU窗口访问未核实与VM的对应关系，单次工具授权等待29890.3455秒后未获准；该8小时18分记FAIL及无验收产出，不计有效验证。窗口路径已结束。本节只关闭当前候选的安装、实际Native／Runtime、正常书架初始显示和主题成功保存冷读回；正式21变体／336层仍19 PASS／27 FAIL／290 NOT_RUN、整页0／21，剩余原生命中、焦点／读屏、支持的几何输入、独立整页视觉及G05／G10按原条件逐项处理。最终Figma／性能专项尚未启动，完整目标未完成。

[本批VM汇总](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-resume-summary-20261117.json) [正常启动与书架](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-resume-normal-post-install-result.json) [主题保存及恢复](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-resume-settings-theme-result.json) [8小时等待失败记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-resume-cua-wait-incident-20261117.json)

本次另对G05做了1次准确有界续证：请求前当前Reader PID5976／窗口96与WMS焦点96一致、正常书架可见；既有应用内录屏仍只到平台RequestUserPrivacyAuthority，未出现可见授权界面或STARTED，30.012秒后既有截止释放，准确新文件0字节。该尝试记FAIL，排除“缺少前景证明即可解释当前失败”的单一归因；当前平台权限阶段完成原因仍未建立，不能推广为所有VM录屏路径均不可用，也没有继续引入UU或权限绕过。[G05准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-resume-g05-foreground-capture-result.json)。

## 2026-11-17 正常书源弹层及漫画目录续证

当前候选从正常设置进入书源管理，原有838个书源／120个启用保持。新增书源JSON弹层打开时6个可见原生Toggle全部禁用，Back取消后同ID及勾选值保持、全部恢复可用，焦点回到原页脚入口。实际查询输入得到0／838的无匹配状态，清除筛选后恢复838／120；关闭IME并返回书架后原4本及进度不变。没有提交导入、检测、登录、启停或删除。[书源弹层正常原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-source-modal-native-result-20261117.json)

原临时漫画源进入失败，同书换源实际查找结束0项。按用户“切换书源／真不行就换书”，沿正常搜索另开包子漫画来源《一人之下》：第1章返回17页清单；正常目录按钮经过当前字体准备成功展开6个可见章节，原生焦点到关闭按钮；Back移除面板，焦点回到原目录按钮，章节与1／17页保持。该当前成功路径已通过，不重跑；图片仍出现不可用图标，不能计作健康正文，现有日志只建立request.dispatch内部错误2300999的端点事实。该书自身另一次换源结束0项，已关闭，没有替换原书。[漫画字体及目录原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-manga-font-native-result-20261117.json)

随后通过独立正常搜书另开腾讯漫画《非人哉》（`https://ac.qq.com/Comic/comicInfo/id/545320`），当前实屏已显示实际漫画正文、1／4页，经正常“加入书架”后确认书架5本：原4个source／book身份和文字27%／原漫画100%第2页均保留。新增健康漫画与此前目录PASS分别记账；原临时源及包子图失败均保留。[正常换书及健康图片结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/vm-manga-real-book-substitution-result-20261117.json)。以上未新增App构建、全局审计、显示修改或UU窗口访问；正式整页计数及G05／G10的原关闭条件保持。

## 2026-11-17 第30轮收尾：已确认代码问题闭环，取消后续全局轮

当前状态以本节及原账本 `implementation.currentState` 为准。用户明确要求停止新增全局审计；第31／32轮及后续重读全树均已取消。第30轮原FAIL、A／B及末验保持原样，历史连续全局PASS仍为0／3，没有改写为通过。**本次两个已确认family的代码修复、定向review、9个准确case及一次规范编译签名已完成；VM继续禁用，未安装或启动。** 下文旧节均保留形成时状态。[收尾提交与当前源码绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-repair-commit-binding.json)。全目标的原生验收及最终Figma／性能专项仍未完成，专项未启动。

| 已确认问题 | 本次实际修改及原业务边界 |
| --- | --- |
| 外观保存未确认后缺少恢复入口 | 原共享ReaderAppearanceStore发布只读保存事实、保留accepted快照及原ACK，按原revision重试同一个完整snapshot setter；原snapshot及新SaveState观察者异常均不阻断业务保存。LRE接入既有“更多→待处理事项”和有界RecoveryGroup，Settings接入既有bounded overlay。两端只退役订阅和投影，旧host／chapter／section／revision拒绝新派发，真实retry提供busy，最新保存ACK才清除。ThemeHost只包装已接受commit.saved的拒绝；前置拒绝仍普通短反馈。 |
| 漫画字体准备拒绝后静默／空栏 | 手机保留原取消面板流程，对当前真实失败补普通短反馈，原图片及触发按钮保留；宽屏原目录内容盒增加局部ReaderPageState加载、失败及显式重试。同实体复用在途字体任务，旧代／实体／卸载回执不得污染后继。正常成功标题、目录、焦点及动画分支保持原代码。NavSurface自身Blank的普通可达指控被父字体准入反证排除；BookDirectory及LocalBookDetail已有错误态和重试，没有修改它们。 |

[本批闭环汇总](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-repair-summary.json) [Appearance源码review](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-appearance-ui-source-review.json) [Store源码review](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-appearance-store-final-source-review-01.json) [Manga源码review](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-manga-font-source-review-01.json)

准确回归共9个case：Store4个、Appearance UI4个、Manga font-admission1个全部有通过回执。Store一次0.268秒；UI首批reading已PASS，Settings因测试probe缺少现有Preview组件声明而停止，补准确声明后仅运行其余3项，一次1.924秒；原PASS未重跑，首败原件保留。字体定义在执行前修正既有probe不支持非空分支移除的能力边界，只以同一原业务owner的真实方法和fresh实际Builder快照核分支，保留旧Native Button回调核首次派发，单case一次4.379秒通过。四次进程合计7.517秒，包含首个UI harness失败耗时；这不是全部人工编排耗时。[Store结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-appearance-store-attempt01.json) [UI首批](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-appearance-ui-attempt01.json) [UI余3项](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-appearance-ui-attempt02.json) [字体结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-manga-font-attempt01.json)

测试运行实际Store／State、Gateway／ThemeHost及选定正常LRE／Settings／Scene方法，公共Notice／Action和Builder／property采用已安装SDK降级。Persistence／字体ACK、Runtime及前景资格、几何和输入交付是明确有限端口；没有证明实际Preferences文件持久化、原生事件、非空branch原生移除或像素。字体准确手动入口按GATE_INDEX单项定义复审执行；原6条未审索引及其expected SHA、REVIEW_NEEDED／OFF／NOT_RUN保留，没有批量重拍127项或宣称indexed PASS。其他兄弟、未登记deferred-reduced及全量未执行。

一次规范隔离非增量ArkTS编译、Native配对、资源字节和指定minliny_HarmonyOS签名PASS，构建区间**26.483秒**。当前签名候选 **0.2.0.DEV.7b0f6137368c**，run `20261116T163010Z-3e492cf7-349fc2b4`，signed SHA `750a2333e941625e80c6a5b6d52cacb0dcb5bb3c81be759aab96cd9dc17a2a8a`。642个当前ETS／TS、184584行及13个Native支持源、4684行均与不可变快照匹配，漂移0。产品版本0.2.0／versionCode1000000／io.reader.minliny保持。contracts=none，全量NOT_RUN；manifest如实保留3e492cf7 dirty构建快照，后续提交另绑定，不改manifest。[不可变候选](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261116T163010Z-3e492cf7-349fc2b4/manifest.json) [源码与包绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-repair-production-build-binding.json)

三个改动UI文件的消息登记检查均PASS；仅增加漫画两处出口并补充已有外观Recovery类别和生命周期，无新增专用例外。正式登记只更新27个SHA字段、涉及LRE／Manga／消息登记3源，所有其他事实逐项相同，原37诊断复用；登记层结果仍19 PASS／27 FAIL／290 NOT_RUN，整页Native 0／21。该结果分别记录源码、方法、编译和原生证据。[三文件登记检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-message-registration-check-results.json) [正式登记精确更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round30-register-source-update-proof.json)

未决内容按原关闭条件保留：Toggle替换原生实例后的焦点／读屏连续性；移除确认的纯高度／字体／IME变化容量；完整页面的原生命中、字形、裁切与E2／E3；独立整页视觉依据、G05连续物理绘制及G10历史同期录像／trace。已批准紧凑Directory工具／行和TTS Quick布局保持，容量冲突照实登记，没有自行扩为44vp。此前四个未确认候选及旧Surface时序只保留准确重开条件，不计已确认待修代码、不新增VM前置、不要求用户替代码作决断。此前R29两项Slider指控与本轮NavSurface指控的反证均保留；没有据其误改正常分支。

本批VM／HDC／设备／CUA／远程操作全部0。**代码层已确认修复队列为空，后续只保留上述原验收证据边界，不再启动下一轮全局审计。**

## 2026-11-16 第29轮最终裁决及接口、测试准入修正

当前以本节及原账本 `implementation.currentState` 为准。VM继续禁用，连续完整全局PASS仍为 **0/3**，最终Figma／性能专项尚未启动。

第29轮完成642个生产ETS／TS、184302行的独立全文审阅，并由已知历史的root另补Native源码、声明及构建支持13文件、4684行；后者不冒充盲审，也不追溯增加旧轮覆盖。105历史ID、原5+2、既有8项修复、R27及R28、20路由／4根、49owner和21登记336层完成对账。1869个唯一冻结输入末尾实际校验漂移0，原A／B及其初始计数保持原字节。[完整R29](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-29-summary.json) [冻结释放](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-29-release.json)

两项Slider指控最终撤回。完整已安装SDK、华为API及OpenHarmony参考实现表明，普通轨道点击含Begin、Click、End；TTS缓存在新Begin重置，End-only业务会收到End。此前把五处位置报作新增缺陷是审计误判：根据枚举标签推断完整事件序列，且root在反证完成前过早确认。五处Slider与既有正常手势测试没有因此改动，不用直接注入一个不成立的普通事件序列证明缺陷。[独立记录与官方反证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-29-slider-contract-adjudication.json)

R29最终确认行为缺陷0、SDK约束违例0，另有P3原生接口注释1项，因此原冻结结论为FAIL，不累计全局PASS。释放后已按独立review把“confirmed composited”改为同generation的逻辑hold被处理释放，并明确物理呈现需另行证明。注释之外的声明字节完全相同，API／ABI、CPP和运行时逻辑不变；G05仍开放。[注释review](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round29-native-comment-proposal-review.json) [精确修改证明](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round29-native-comment-repair-proof.json)

另将此前记录的14个TTS索引入口指纹漂移集中闭环。完整定向复审当前测试定义、runner及控制入口后，仅修改3个受控JSON中的61个标量：当前测试SHA、runner SHA及资源声明摘要，并保留历史计划基线。14个ID、选择器、资源、QUALIFIED、默认OFF与NOT_RUN均不变。只通过真实索引运行transport-intents一个case，唯一PASS、106ms，runner110ms且进程树已结束；其余13项未运行。原外层记录器误从gate stdout寻找子用例JSON，初始判读失败保留，按runner原始结构化回执离线裁定PASS，没有重跑。[独立方案review](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round29-tts-index-patch-review-01.json) [61字段证明](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round29-tts-index-patch-proof.json) [真实准入结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round29-tts-index-admission-adjudication.json)

本批未重新构建、安装或操作VM／HDC／设备／CUA。已有候选a5eaa36a2504的原运行时代码和签名证据复用，manifest保持原样；当前声明注释和工具元数据已不同于其完整输入快照，所以不把它声称为当前全部源码的精确新候选。需要实际交付时再生成一次当前输入候选。19 PASS／27 FAIL／290 NOT_RUN、整页0／21及原37诊断保持。原四项候选、Surface生命周期，以及Toggle焦点、移除纯高度、E2／E3、独立整页视觉、G05连续像素、G10同期证据继续按原条件保留；本轮import／TTS顺序疑点尚无正常链证实，不新增用户决断或VM前置。

下一步以本批固定代码、测试与契约输入开展三轮完整全局审计。定向review、准确case与既有构建均不替代该条件。

## 2026-11-16 第28轮完整审计及 TTS 边界修复

当前以本节及原账本 `implementation.currentState` 为准。VM 继续禁用，连续完整全局审计 PASS 为 **0/3**，最终 Figma／性能专项审计尚未启动；下方各节保留形成时的历史状态。

第28轮在 `3458300f` 全文审阅642个生产文件、184299行，105个历史问题、原5项及2条件、既有8项修复、R27首次播放续接、20路由／4根、49个owner引用及21项登记336层完成对账；1841个唯一冻结输入末尾核验漂移0。结果为 **FAIL：1项行为缺陷、1项SDK约束违例**，原A／B和FAIL保持原字节。[完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-28-summary.json) [问题与证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-28-final-findings.json)

集中修复两处生产代码：首句“上一句”在退休请求、状态发布、watchdog清理和Host停音之前返回原越界拒绝，原播放／暂停及回调继续有效；凭据存储按实际UTF-8字节将单SECRET限制为1024，保留已有别名和精确清理。两条旧测试错误地从第一句触发“上一句”却要求停音，现改为合法第二句且保留立即停音断言；另补首句原请求／回调／进度／watchdog连续性与ASCII、多字节容量边界。[TTS独立复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-tts-review-01.json) [凭据独立复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-credential-review-01.json)

7个选定本地case一次PASS，进程合计0.481秒。测试运行实际Coordinator和实际转译Store；Core／Host／AssetStore及timer是明确的有限端口，不构成原生或Core二进制验收。凭据结果编排初次误用旧文本回执格式，原CHECK_RAW_RECEIPTS保留，按既有JSON回执离线核定2项PASS，没有重跑。14个旧索引叶子的定义指纹在本批前已经过期，本批没有自行刷新，不将手动准确回归写成索引门禁通过。[TTS准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-tts-regression-results.json) [凭据准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-credential-regression-adjudication.json)

一次规范隔离非增量编译及指定minliny_HarmonyOS签名PASS，候选 **0.2.0.DEV.a5eaa36a2504**，构建区间25.830秒；642个生产输入／184302行与不可变快照匹配。contracts=none，全量NOT_RUN，未安装。manifest如实保留3458300f的dirty构建身份，后续提交单独绑定。[不可变候选](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261116T140744Z-3458300f-6f03081a/manifest.json) [生产绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-production-build-binding.json)

两处生产路径及改动测试均没有登记SHA引用，register字节不变，复用原检查；19 PASS／27 FAIL／290 NOT_RUN、整页原生0／21与37个原诊断保留。原四个待证分支、旧Surface生命周期次序，以及焦点、读屏、容量、整页原稿、G05连续绘制、G10同期证据，仍按原条件开放。修后须另行取得固定输入连续三轮完整全局PASS；本批定向结果不计入。VM／HDC／设备／CUA动作均为0。[修复及剩余工作](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-summary.json) [登记和索引边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round28-repair-registration-and-test-admission-boundary.json)

## 2026-11-16 第27轮完整审计及首次启动集中修复

当前以本节及原账本 `implementation.currentState` 为准；下方说明保留各批次形成时的状态。VM继续禁用，连续完整全局PASS为0，最终Figma／性能专项审计尚未启动。

第27轮在 `adc5f40e` 完成642个生产文件、184250行的实际全文语义审阅，partial／unreviewed／重复均为0。105条历史canonical、原5项＋2项条件风险、最新8项修复、20路由、4manifest根、49个owner及21项登记336层完成当前对账，1834个唯一冻结输入终检漂移0。结论 **FAIL**：独立确认1项首次启动准入缺失family，包含自动翻页等待TTS停止回执后在后台进入running却无timer，以及TTS等待可用性／正文展开后首次后台派发语音两条普通成功链。原第24至26轮及本轮A／B封存保持原字节。[完整结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-27-summary.json) [正常链与反证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-27-final-findings.json) [正式释放](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-27-release.json)

本批只修改一个生产文件LRE：独立记录TTS是否仍待首次派发；实际输入退休、手动阅读或明确停止旧内容的导航会撤销未派发意图；AutoPage在消耗pending token之前、TTS在首次start之前复核live Root准入。只将同类型未派发的preparing胶囊按leave释放，避免等待不可见控制栏的handoff。原已派发start／stop／进度ACK、有意后台续播、desired=false及自有morph保留。此前修复和测试覆盖已到期turnPending，遗漏的是尚未启动的startPending；实际diff证明首次启动逻辑此前已经存在，没有据此指认上一批引入新回归。[独立源码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-27-reading-repair-source-review-01.json)

新增 `auto-start`、`tts-start`、`retirement` 三项准确回归一次PASS，进程2.013秒。使用当前真实LRE方法、实际AutoPage／TTS Coordinator，观察两个timer、音频激活、speech请求、原Host start／Core speaking回执；覆盖后台及返回、实时Root、遮挡、窗口／交互封锁、自有morph、准备期间暂停与已派发后台播放。图形、初始化外层、正文展开和Core／Host I/O为记录的有限端口，不构成实际native或Core二进制验收。定义复核在运行前补齐真实probe，并修正start fulfilled冒充onStart ACK的判据。[准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-regression-attempt01.json) [执行前范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-regression-plan.json) [定义复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-test-review-01.json)

一次规范隔离非增量ArkTS编译及指定minliny_HarmonyOS签名PASS。候选 **0.2.0.DEV.a0811f702fd1**，run `20261116T131131Z-adc5f40e-4a4494b1`，signed SHA `b4d4fab860474850ca5744c98ec1f486fb2ac060b2a4c33bf9d1d67d0f40afef`。manifest构建区间26.805秒，642个生产输入与本批准确修改配套，Core仍为干净c0781263；contracts=none，全量NOT_RUN，未安装。manifest如实保留adc5f40e的dirty构建快照，后续提交另记配套绑定。[不可变候选](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261116T131131Z-adc5f40e-4a4494b1/manifest.json) [生产绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-production-build-binding.json)

登记仅改13个LRE SHA字段，其他事实逐项相同：19 PASS／27 FAIL／290 NOT_RUN，整页原生0／21。37个原诊断完整保留，引用错误0、源码漂移0。首次登记编排把16个path引用误计为16个SHA字段（实际13个），并误读检查返回对象，两项失败在写入前已停止；保留原始失败，仅修正该入口后复核。[登记结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-registration-checks.json) [编排失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-registration-attempt01.json)

原四个候选仍有界未确认；另有漫画旧Surface晚释放是否能遇到后继Runtime同路径资源的原生时序条件，不能仅凭缺少同步dispose保证定案。Toggle焦点、移除纯高度、E2／E3、独立整页视觉、G05连续像素与G10同期证据保留原关闭条件。需在修后固定输入连续三轮完整全局通过，本批定向PASS不计全局PASS。本批VM／HDC／设备／CUA动作全部0。[修复及未决总账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round27-repair-summary.json)

## 2026-11-16 恢复代码实施后的当前结果

用户已明确恢复代码修复，VM 继续禁用。第24／25／26轮原始审计与三轮对比保持原样，本批集中修复其中7项行为缺陷和1项SDK约束违例，修改12个生产文件。当前结论为“本批定向代码、测试及编译通过”；修后完整全局审计尚未启动，连续全局PASS仍为0。[post-audit-repair-summary.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-summary.json)

| 问题 | 当前代码处理 | 准确回归 |
| --- | --- | --- |
| 漫画 Runtime 换代等待环 | At load admission capture retention and reserve, include both in current predicate and recheck actual cache miss before reserve. | `runtime-retirement-reserve` PASS |
| 字体 A/B/A 文件清理竞争 | Static file lane covers final file/native check/admission and retirement; cleanup after durable replacement rechecks live Store+Runtime and preserves rejected import assets. | `font-handoff` PASS |
| 书架分组动作捕获旧 DTO | Retained Grid/List action resolves current compound-key DTO before sheet admission, preserving render density/key. | `bookshelf-current-group` PASS |
| 漫画原图清理漏传保存的 TTL | One saved-policy cutoff reaches candidates and claims; unclaimed old TTL rejected, policy/scope changes cannot be swallowed by old coalesced task. | `configured-expiry-policy` PASS |
| 自动翻页待派发意图在暂停后失联 | Keep pending intent until actual dispatch; pause/active/ready guards, actual ACK isolation, control-close and own Window lock release wake current intent. | `autopage-paused-pending` PASS |
| JSON 弹层取消后书源控件未恢复 | Propagate scalar inputEnabled from normal root through Surface to Page native eligibility, retaining live callback rejection. | `source-modal-observer` PASS |
| 下载同 Host 换代丢进度续行 | Old inflight completion releases lane and schedules only currently bound continuation; retired generation result still rejected. | `download-progress-handoff` PASS |
| LazyForEach 同实例混用通知 API | Arbitrary reorder/key changes use onDatasetChange RELOAD, matching existing ADD/DELETE batch API; legacy fixtures adapted. | `bookshelf-batch-notify` PASS |

12个选定本地case均PASS，包括窗口设置成功／失败／后继generation与偏好回执、控制层关闭、真实分页ACK，以及字体大小／失败清理边界和保留书架行的批通知。Source运行实际SDK属性链，Root／Surface表达式经明确的Prop投递接入；Download运行完整Host，书架运行Page／Sheet／DataSource，资源运行真实Runtime公有生命周期／start／requestDirect和Body／Retention／Disk。Core响应、native open、解码与显示文件创建等有限端口的覆盖边界逐项写在执行前清单；这些结果没有建立原生渲染或实际Core二进制验收。[post-audit-repair-regression-results.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-regression-results.json) [post-audit-repair-regression-plan.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-regression-plan.json)

三组生产源码与三组测试定义的独立定向review通过。修复草稿中曾出现的字体过早清理分支已移除，Window解除等待后缺少唤醒的分支已补齐；两份源码FAIL与一份测试定义FAIL原件保留。测试初次顺序断言、清除字体入口、owner名称、资源扫描次数及前置batch端口错误的失败日志均保留；后续只修正相应fixture／断言并点名必要case，不改写失败记录。[post-audit-repair-font-auto-source-review-03.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-font-auto-source-review-03.json) [test-review-font-auto-02.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/test-review-font-auto-02.json) [test-review-resources-01.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/test-review-resources-01.json) [test-review-surfaces-compatibility-02.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/test-review-surfaces-compatibility-02.json)

本地候选为 **0.2.0.DEV.1731de8c7730**，run `20261116T121335Z-64e0272c-659f5212`。完整非增量ArkTS编译、HAP配套输入和指定minliny_HarmonyOS签名校验PASS，642个生产ETS／TS与不可变快照匹配，漂移0。构建基于64e0272c的dirty快照，Core仍为c0781263且clean；后续文档及登记更新不改变生产包字节。首次沙箱降优先级限制在编译前失败，保留回执后沿同一资源规则执行成功；构建contracts为none，全量NOT_RUN，未安装。[post-audit-repair-production-build-binding.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-production-build-binding.json)

正式登记仅更新50个SHA字段、涉及6个当前生产路径。21项登记的全部layers／invariants事实逐项不变，仍为19 PASS／27 FAIL／290 NOT_RUN，整页原生0／21；37项原诊断保持、引用错误0、源码漂移0。[post-audit-repair-registration-checks.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/post-audit-repair-registration-checks.json)

保留的四个候选仍未达到确认缺陷的证据条件：①换源普通行只有在真实系统字号低于0.88时才出现源码算术小于44vp，需要真实正常输入与有效原生命中；②More下载的正常ready页面缺远端session已有源码链，剩余为退休边界上的原生首次回调与首次实际效果；③下载范围输入仍缺原生post-change、资格变化和保留buffer的准确先后；④TTS同值语速与旧回滚只剩尚未建立的正常predispatch失败链，已dispatch失败的pendingReconciliation分支会跳过回滚。这四项不计已确认缺陷，也不需要用户替代码作决定。原独立整页视觉、连续绘制G05、历史Tab同期证据G10与当前原生层条件继续保留。[round-26-final-findings.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-26-final-findings.json)

本批VM／HDC／设备／CUA动作均为0。定向review不计第27轮或连续全局PASS。原全应用目标与最终Figma／性能专项审计的完成前提仍未满足。

## 2026-11-16 第二十三批集中实施与下一步条件

第23轮在47d8b98f完成全部642个生产ETS／TS文件、183884行的当前全文语义审阅，partial／unreviewed／遗漏／重复均为0；1776个审阅输入、16个额外登记引用和49个嵌套owner引用起止同字节。105个历史canonical ID、原5项＋2项条件风险、20路由、4页面根和21项登记336层完成对账。冻结结果仍为FAIL，重开UIF-70／72／105，未新增ID。该完整阅读属于修复前输入，不冒称本批新代码已经通过新的全局审查。[完整R23结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-23-summary.json) [正式释放](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-23-release.json)

本批把三组同因分支集中修入19个生产文件。UIF-70覆盖规则表单／首次持久写入、订阅fetch后的特殊链、阅读页头、章节加载Back、启动恢复显式操作和连续／分页COPY；首次输入先查实时归属，已dispatch的原ACK和固定订阅旅程继续由原owner处理。ReaderWriteEvidence用单调首次dispatch事实保留首项Core拒绝后仍应继续的固定步骤，原confirmation计数继续原语义。正常导入取消全程FG=true时，Root的普通getter不足以通知被rekey的禁用Field；现补Root helper→Surface @Prop→Page @Prop恢复边，原live getter继续拦住Prop交付前的迟到事件。UIF-72区分漫画普通Back与已接纳navigation，保留原save／close完成。

UIF-105按真实base与八字段处理延迟加载、独立native pending、累计accepted选择和实际文件写入。voice／mixing只有自身合格结果才接受；开始或失败的另一请求不退休已有accepted保存。正常配置入口允许A→pending B→重新选择A，实际Coordinator判断同值或pending。metadata声线同步到下一speech边界，不抢用户seek／pause；Host与下一slice消费最新voice／background字段。朗读亮屏仅在preparing／playing／resuming贡献，pause／stop等释放，独立ScreenAwakeLease保留。原已听进度、未知ACK、原操作重试和跨owner退休条件不放宽。

源码、测试定义与保存证据分别完成独立定向复核，17个准确范围已有通过证据。TTS初稿的三项源缺口、三项测试判据缺口以及Rules modal恢复边均在本批内补齐，没有为每个子项另开全局轮。17次回归进程有11次PASS、6次FAIL；失败过程与其中已过case分别保留。实际日志创建到末尾输出区间合计22.817秒，未把作者编辑和审查耗时计作机器执行。所需本地Core CLI原缺失，仅用既有缓存、c0781263干净源码离线构建reader-cli，Cargo报告23.85秒；实际Core typed ACK和首rejected后的固定计划回归通过。[执行前准确范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-regression-plan.json) [执行返工账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-execution-accounting.json) [输入测试复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-input-test-review-01.json) [TTS测试复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-tts-test-review-01.json) [preparation追加复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-tts-test-review-02.json)

代码提交b36cd438，另以0e343e11把一处不符合ArkTS的内联类型改为具名接口。首次规范编译FAIL保留；两处受影响成员的SDK转译JavaScript相同，独立类型源码复核通过。第二次规范隔离编译及指定minliny_HarmonyOS签名PASS，当前候选0.2.0.DEV.ea147476ce6c，run为20261116T080513Z-0e343e11-8d37f915。642个生产文件与不可变清单逐字节匹配，漂移0；manifest构建区间27.942秒，客户端日志区间约40.712秒。contracts=none，全量NOT_RUN，未安装。首败与准确复编不合并为“一次构建通过”。[类型适配与同字节行为](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-arkts-type-adaptation.json) [独立类型复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-arkts-type-review.json) [当前候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-repair-production-build-binding.json)

登记仅更新61个源码指纹单元，5个唯一源；全部原layer／invariant事实不变，仍为19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环0／21。原37项诊断保留，源码漂移0，引用错误0。定向通过、编译签名均不累计全局PASS，当前连续完整全局通过仍为0，VM禁令有效。VM／HDC／设备／CUA／远程新动作均为0。[登记当前核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round23-registration-checks.json)

接下来按已固定生产字节开展新的完整独立全局审计，每轮仍覆盖全部642生产文件及正常owner、路由、登记与历史问题。只有同一输入连续三轮完整通过，才满足用户解除VM禁令的条件。之后仅补原生独有问题与原验收范围；已认可紧凑原稿布局、缺失独立视觉原稿及历史G05／G10原始证据的既有关闭条件保持。全目标尚未完成，最终外观／性能两项专项agent审计尚未启动。

## 2026-11-16 第二十二轮全源码审计与集中修复

第22轮在 e5c88a7e 上完成全部642个生产ETS／TS文件、183745行的当前全文语义审阅，partial 0、unreviewed 0、文件遗漏和重复计数均为0。三个独立reviewer实际分工为198／203／241文件。101个历史canonical ID、原5项问题＋2项条件风险、20路由、4页面根、21项登记336层及16项额外引用均已对账，结论FAIL，确认UIF-102／103／104。原1773项审阅输入起止同字节。49项嵌套历史locator有5项旧SHA，另以纠正记录绑定当前源，冻结scope与错误历史均未改写，不能把该元数据错误说成生产源码漂移。[round-22.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-22.json) [round-22-release.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-22-release.json) [round22-root-scope-reference-correction.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-root-scope-reference-correction.json)

本批在重新启动全局审计前集中完成四项代码修复。UIF-102使已认可的离线漫画缓存会话在保存原位置后继续相邻章节准备，在线未验证与旧owner仍拒绝。UIF-103使合法空作者通过commit、rollback和两类精确query回执，字段类型、书籍／事务／章节身份继续校验。UIF-104把原已听事实、Core回执与持久进度同新UI／续播／跨章票据分开；新位置可按Core真实terminal状态恢复，旧回调不能借新控制意图，原跨章plan与identity按同一归属交接。voice／rate／mixing只提交或回滚自有字段。

UIF-105是在本批定向复核新增确认的后台朗读偏好接线问题：原LRE只更新Host，Coordinator下一slice仍用旧active input覆盖它。当前LRE经Coordinator同时更新最新字段与既有Host入口，异步voice／rate成功和回滚保留独立偏好。该问题没有追溯塞回已冻结的第22轮三个finding。实际后台租约结果继续是原生待验项。

四个生产源及测试定义的独立定向复核通过。9个准确case有通过证据，其中既有chapter-boundary／stop／replacement三项按未变化的实际调用路径复用02，same-value-policy在当前mixing改动后重新通过。新增回归检查真实缓存producer与Shell装配、四类换源public consumer和真实Host／intent恢复、严格Core状态约束、TTS各异步边界、最新偏好以及旧实现行为负对照。新后台夹具首次遗漏isMountedToken导致的失败保留，仅补齐实际方法后重跑该case；未为此改生产。两个旧偏好夹具只补新Coordinator端口，业务全文件未运行。[round22-repair-regression-plan.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-repair-regression-plan.json) [round22-repair-summary.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-repair-summary.json) [round22-repair-source-review.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-repair-source-review.json) [round22-repair-test-review.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-repair-test-review.json)

代码提交60b9fe91完成一次规范隔离ArkTS编译及指定证书签名，候选0.2.0.DEV.158a35726316，run为20261116T062346Z-60b9fe91-63f1c27d。642个生产输入与不可变清单匹配，源码漂移0，尚未安装。manifest构建区间28.295秒，客户端日志约42.187秒。只执行已列准确case，构建的contracts为none，全量NOT_RUN。[round22-repair-production-build-binding.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-repair-production-build-binding.json)

登记只更新21项源码引用指纹，全部原layer／invariant事实逐项相同，仍为19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环0／21；37项原诊断、源码漂移0、引用错误0。定向通过不计全局通过，当前连续完整全局PASS仍为0，VM禁令有效，VM／HDC／设备动作0。下一轮仍须全部642个当前生产文件完整审阅，同一冻结输入累计三轮完整通过才满足解除条件。[round22-registration-checks.json](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round22-registration-checks.json)

## 2026-11-16 第二十一轮完整审计与同因补修

第21轮在 c34c6c99 完成472个必审文件和26个范围外正常owner的当前全文语义，共498个唯一文件，partial／unreviewed均为0。99个历史问题、20个路由、4个manifest页面根、21项登记336层及16个额外引用完成对账，结果FAIL，连续通过为0。最终49引用源对账补出10个此前缺少本轮语义记录的application helper，补读6194行后，确认ReadingEntryHost仍有同因晚回执，UIF-97重新打开；本轮同时新增UIF-100和UIF-101。原472／498的真实覆盖保留。下一轮将全部642个生产ETS／TS设为必审全文，明确每个正常接线或纯数据／平台边界。[完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-21.json) [问题与反证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-21-findings.json)

当前10个生产源已集中修改。目录的三个fold Image直接订阅既有canonical减少动态效果投影，使用公共motion policy；树目录保留原定位意图，在真正滚动派发时读取当前偏好。设置当前Tab回顶、下载定位当前及开发者消息页的程序定位补齐相同策略。漫画面板在排帧后和新settle入口重新读取偏好，保留generation及原焦点续接；控制栏更新已持有手势的新UP时钟，保留原pointer和物理判据。Home进度Slider按完整Begin／Click／End仅在End进入原LRE seek。EntryHost下载回执只更新downloadState，保留同proof期间已更新的标题、四项独立显示字段、层级、可导航性和书签。定向复核另确认正常冷启动empty→full的集合覆盖，当前按最新目录集合迭代；仅未发布过的同一初始空集合可接纳首次完整投影，后续新增、删除和替换空集合都保留最新owner事实。

8个准确case已通过，覆盖三个保留Image的最终animation参数、四类程序滚动、七个模块持有手势的当前时钟、漫画排帧前偏好变化及既有生命周期／拖动、真实SDK Slider回调→正常LRE装配→实际seek／selection／reset，以及完整EntryHost的同proof显示刷新与旧下载回执并发。旧行为负对照按行为拒绝。首次装配失败日志保留，焦点排帧仍按原owner执行。10个生产源及8项测试结果的独立定向复核通过。规范完整ArkTS编译与指定证书签名一次通过，候选0.2.0.DEV.675a2f393395，run为20261116T053105Z-25df70b3-a62fe887，642个生产源码字节与不可变清单一致，尚未安装。[修复与准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round21-repair-summary.json) [执行前范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round21-repair-plan.json)

UIF-94原Click-only错误判据保持撤回。第18批“全部六个Slider接线核对无新增”的历史矩阵遗漏Home真实接收者在首次提交后仍保持准入，不能用来证明当前全部接线正确。文件覆盖、方法回归、编译、VM行为和用户验收分别记账。

当前登记仍为19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环0／21。原登记层事实与结果逐项相同，37项原诊断、源码漂移0、引用错误0。VM／HDC／设备动作0，VM禁令有效，当前连续完整全局通过0。[指纹与引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round21-registration-checks.json) [效率与遗漏复盘](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/audit-efficiency-20261116.md)

## 2026-11-16 第二十轮完整审计与数据投影修复

第二十轮完成全部 472 个当前 UI 合同、96 个历史问题、20 个路由、4 个 manifest 页面根及 21 项登记的当前代码复核，结论 FAIL，连续完整通过为 0。确认目录显示字段丢失 UIF-97、规则刷新失败后重试自锁 UIF-98、TTS 错误消息投影丢位置代次 UIF-99，并补出 UIF-96 在保留 RSS 管理页的隐式原生文字测量入口。[完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-20.json)

UIF-97 集中核查了 49 个同类型引用源文件、38 组复制／转换／有意窄投影，追到 10 个生产投影点及 1 个 DEBUG 候选投影点。书签、下载状态和标题投影按原事实归属保留当前目录的独立显示字段，远端目录和漫画换源继续传递已确认标题、付费事实、层级和可导航性。原内容／位置快照的书签排除边界保留。规则恢复入口按当前 opening、generation、query、sort、chapter、Runtime 和实时输入资格重读，原失效目录行继续由 awaiting 标记拦截。TTS 日志更新 errorMessage 时保留 positionGeneration 和 audioStarted，原异步续章不会被独立偏好失败误判退休。[完整复制点复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round20-toc-copy-family-review.json)

当前 10 个生产源已修复，独立定向源码复核通过。8 个准确 case 通过，覆盖正常书签 Host／Gateway／Entry 提交、目录各投影点、真实规则刷新与恢复按钮、TTS 续章等待期间的错误投影、RSS 页头两个本地订阅、换源直接目录装配及既有受影响恢复／observer 场景。各 case 保留必要旧行为负对照与装配失败历史。当前测试定义与8份保存结果的独立定向复核通过。规范完整 ArkTS 编译及指定证书签名一次通过，候选 0.2.0.DEV.cc0d2df2430c，run 为 20261116T044508Z-aeac709a-dc28616e，642 个生产 ETS／TS 字节与产物清单一致。[本批修复及准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round20-repair-summary.json)

登记仍为 19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环为 0／21。原层事实与验收结果逐项相同，当前引用检查为 37 项原诊断、0 源码漂移、0 引用错误。VM 禁令有效。

## 2026-11-16 第十九轮同因缺口修复与错误判据撤回

第十九轮完成 472／472 当前 UI 合同、95 个历史问题、20 个路由、4 个 manifest 页面根及 21 项登记的独立审阅。全局结论 FAIL，连续通过为 0。全量追到 80 个相关生产文件、242 处全局窗口指标读取，确认 UIF-96 的 15 个源文件、20 组原生消费者缺少有效本地 revision 依赖。15 个文件已集中修复，覆盖公共 Select／RSS 输入、书架、导入、搜索、换源、阅读正文与胶囊、目录、启动恢复及诊断夹具。[完整审查与问题记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-19-findings.json)

UIF-94 原判据已撤回。第十八轮只读 Slider enum 说明，以单独 Click 注入推导普通点击漏提交，遗漏同一本机 SDK slider.d.ts 1010–1015 的完整 onChange 说明。手势点击包含 Begin 与 End，因此该注入不能成立原问题。两个新增的 End／Click 条件已恢复为 End，准确测试改为完整点击和拖动序列，并分别计数派发及原 coordinator／seek 提交。原第十八轮失败、通过和构建记录保留历史归属。[判据纠正及回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round19-slider-terminals-01.log)

42 个准确 SDK observer 场景通过，逐项检查同节点的最终尺寸、安全区、阴影或同 child-id 的 Prop 回执，包含去除新增依赖的负对照。LRE 场景接入真实 StorageLink／Watch，覆盖 body key 相同的前后指标、保留的 frozen／settlement 布局和原输入代次。其余场景使用明确的本地 SDK property 投递边界。原生渲染、平台输入生成、完整 settlement join 与用户验收继续沿原证据层记录。17 个生产源及本批测试的独立定向复核通过。规范完整 ArkTS 编译及指定证书签名一次通过，候选 0.2.0.DEV.a3100cecd464，run 为 20261116T040409Z-547fcee8-88309fc5，642 个生产 ETS／TS 字节与产物清单一致。[定向源码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round19-repair-source-review.json) [本批修复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round19-repair-summary.json)

登记保留 19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环为 0／21。受影响当前源码指纹已同步，检查仍为 37 项原诊断、0 源码漂移、0 引用错误。VM 禁令有效，当前连续完整全局通过为 0。

## 2026-11-16 第十八轮发现与修复批次复核历史记录

第十八轮冻结 66217fe2，完成 472 个当前 UI 合同、92 个历史问题、20 个路由、4 个 manifest 页面根及 21 项登记复核。起止 1,770 项审阅输入、642 项生产输入与另 16 项登记引用均无漂移，结论 FAIL，确认 UIF-93、UIF-94、UIF-95，连续通过为 0。[完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-18.json)

第十八轮当时记录三项修复与六个准确 case，其中 UIF-94 已在第十九轮撤回并纠正。书架多选的原生操作和行无障碍谓词先读取本地前景，原后台 ready 回执继续由原 owner 接纳。该批当时增加的两个 Slider Click 提交条件已撤销，完整点击与拖动序列现在由 End 向原 coordinator／seek 归属提交。阅读内目录先求既有 currentInputEnabled，登记本地 interactionEnabled 依赖后沿原显式临时编辑判据返回，稳定 Full 父容器能恢复 enabled、AX 和 hitTest，已接纳编辑跨 minimum reflow 的合同通过准确回归。[修复及回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round18-repair-summary.json)

前几轮的问题在于文件审读覆盖没有充分落实到同类状态转换，首次拒绝检查遗漏同一控件恢复，Slider 检查采用了遗漏完整平台序列的单事件判据，过早的独立轮次增加了重复成本。第十四、十五轮还曾在首次发现后结束不完整审查，原记录保留。本批在开始新的三轮独立审计前，复用第十八轮已读合同，对 21 个输入 port 和全部 6 个原生 Slider 按实际入口、状态转换、最终属性、业务回调与回执归属集中核对。该批次复核的全局连续通过增量为 0。

本批 21 个输入入口及全部 6 个原生 Slider 已完成接线核对，部分与未审均为 0，新增同因发现为 0。本批次核对的全局连续通过增量为 0。规范完整 ArkTS 编译及指定证书签名一次通过，候选为 0.2.0.DEV.49dd940b7673，run 为 20261116T031524Z-55bf1497-c041f0cd，642 个生产 ETS／TS 字节与不可变产物清单一致。[27 项接线核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round18-repair-contract-matrix.json)五个修改脚本语法通过，13 项目录登记指纹已同步，当前仍为 37 项原诊断、0 源码漂移、0 引用错误。原生登记为 19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环为 0／21，VM 禁令有效。

## 2026-11-16 第十七轮完整接线复核与两项修复

第十七轮冻结 d89861c6，完成 472 个当前 UI 合同、90 个历史问题、20 个路由、4 个 manifest 页面根与 21 项正式登记复核。1,770 项审阅输入及另 16 项登记引用在结束时无漂移。结论 FAIL，确认 UIF-91 和 UIF-92，连续通过仍为 0。此前的通过记录遗漏了这两条首次输入和前景恢复路径。[本轮完整审查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-17.json)

UIF-91 已在静态胶囊和 launch 胶囊共用的 toggleSessionCapsule 入口增加既有 readerInputIsCurrent，先核当前输入归属再改变播放意图。UIF-92 已使 SettingsPage 的输入判据先读取现有本地 appForeground，后台合法回执更新后，同一控件能随前景送达恢复准入。当前设置页同 opening 的 ArkWeb 覆盖恢复链未建立，问题与修复采用已确认的前后台触发范围。[两项修复及准确证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round17-repair-summary.json)

六个准确 case 及主题写回专项通过。证据包括 36 组胶囊时期和业务状态组合、真实 Static／Stage 回调转发、原已接纳播放屏障、设置开关／主题／缓存三个保留控件的恢复、原生确认租约、未决恢复动作和主题写入丢失 ACK。胶囊旧准入负例及三个设置旧谓词负例均被拒绝。首轮暴露的四项测试装配失配已修正，失败日志保留。七个修改脚本语法通过，13 项目录登记指纹同步，原诊断仍为 37 项，源码漂移与引用错误均为 0。

本批规范完整 ArkTS 编译及指定证书签名一次通过，候选为 0.2.0.DEV.826b1c91562d，run 为 20261116T023823Z-096298cd-bbc44930。642 个生产 ETS／TS 输入与不可变产物清单逐字节一致。修复后仍需在同一冻结输入上重新完成三轮完整 review agent 审计，当前 VM 禁令有效。原生登记保持 19 PASS／27 FAIL／290 NOT_RUN，整页原生闭环仍为 0／21。

## 2026-11-16 第十六轮完整批次收口

第十六轮完成 472／472 当前 UI 合同及 87 个历史问题的当前代码对账，结论 FAIL，确认三项代码问题。UIF-88 已将文字正文、缓存刷新和漫画章节失败的 UI 重试接回原实时输入资格。UIF-89 保留字体失败 Promise，日志独立观察，既有启动恢复宿主接收失败。UIF-90 将两处下载行 Area 回执接回原呈现代次和当前书籍身份，覆盖期间更新实际高度映射。三个问题在本批集中修复。

四个准确用例及五个修改脚本语法通过，两个夹具遗漏和一次不支持分支移除的失败记录已保留。21 项登记同步受影响输入，37 项原诊断、0 漂移和 0 引用错误保持。本批一次规范完整 ArkTS 编译和指定证书签名通过，候选 0.2.0.DEV.ac04cdb32a64 对应修复提交 ab9ff545，HAP SHA-256 为 bf2be0ff6a5b583ea4ca70f878b0115bf4939edac6856465deb856a2d2cad732。全量测试为 NOT_RUN。接下来冻结实际候选，重新累计三轮完整全局通过。当前连续通过为 0，VM 禁令有效。后续整页原生、独立原稿、G05／G10 与全量完成后的外观／性能专项核对继续按原目标推进。[本批完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-16.json) [本批修复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round16-repair-summary.json)

## 2026-11-16 第十五轮目录菜单修复

UIF-87 将完整目录远程书籍 More 和离线菜单动作的首次状态修改接回原 directoryInputCurrent，动作捕获原临时身份与 bookId，实时失效时保留原菜单及代次，同一 owner 恢复后可继续。原生关闭及已接纳业务回执继续按原生命周期收口。一个准确用例覆盖手机／展开与前景／覆盖四种场景，并拒绝两个旧行为负例；13 项登记绑定已更新，原 37 诊断保留，漂移和引用错误均为 0。

第十五轮确认实质问题后按失败收口，不完整的语义覆盖继续明示，连续通过计数保持 0。下一轮在修复后的冻结输入上重新开始。最终完整编译尚未执行，VM 继续禁用。原稿一致性与性能两项专项子 agent 核对安排在全量实施完成后，当前尚未启动。[UIF-87 修复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round15-repair-summary.json)

## 2026-11-16 第十四轮修复后继续完整审计

第十四轮以 FAIL、覆盖 INCOMPLETE 收口，完整语义审查 121／472，另有部分 25 和未完成 326。UIF-85 沿 Panel 现有临时编辑准入递送到 TTS 管理器，在保存、删除及草稿首次修改前拒绝失效输入，保留已接纳操作和 Host ACK。UIF-86 为 SourceTools 原生属性补齐本地前景 StorageLink，继续以 AppStorage 拒绝尚未传递到本地字段的失效输入，Host 后台合法回执保持原生命周期。

四个准确用例通过，旧行为负例按真实首次写入与最终原生属性失败。TTS 保存在前景丢失前已经接纳的两类场景，分别在丢失前、丢失后派发，最终均得到 confirmedCurrent 并释放 busy。首次夹具把该事实写成 confirmed 的失败已保留并纠正。原登记结果保留，代码审计连续通过仍为 0；接下来冻结修改后的代码，重新进行完整全局审计，未审文件不能计作通过，VM 继续禁用。[修复与回归记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round14-repair-summary.json)

## 2026-11-16 UIF-84 代码修复与新一轮审计

正常开书的已保存证据中，正文已经显示，但原生正文输入宿主保持禁用。实际 SDK 依赖见证确认 ReaderShell 的实时回调先返回 false，跳过本地 inputAllowed 读取，导致开书完成后的 Prop 更新不能唤醒原生属性。当前调整为先读取本地响应式边界，再检查实时输入，保留原有前景、身份、覆盖和业务回执归属。

新增准确回归覆盖开书、隐藏、目录、文字换源覆盖和漫画换源覆盖五类恢复，逐项检查同一原生节点的 enabled、focusable、hitTestBehavior 和 accessibilityLevel，旧谓词按最终属性被拒绝。原 reader-live-input 准确用例通过，生产变化仅一个谓词；目录登记同步当前源码指纹，原原生结果保留。该修复使连续全局审计通过计数重新归零，VM 保持禁用，后续先完成三轮新的完整 review agent 审计。[准确回归计划](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/reader-input-recovery-plan.json)

此前三轮的漏审原因是回归和审阅覆盖了“已有可用节点失去实时输入后的拒绝”，没有覆盖“初始不可用节点在恢复后的原生属性依赖”。本批补齐这一判据，并要求全局审计同时检查拒绝与恢复。规范完整编译安排在代码修复和审计收敛后执行一次，避免对每个中间修复重复构建。

## 2026-11-16 三轮审计后原生续接

当前候选 0.2.0.DEV.d33f5b7933c2 已通过规范保数据覆盖与启动，原 Native／Core 配套输入复用。实际停止态数据与旧快照有变化，一项既有准确 FFI 用例在本地一次性副本运行通过，两项未变的合成 Core 用例复用。当前启动日志记录 runtime-published 与 shelf.model-ready，正常书架显示原有书籍。[本次原生续接记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/post-global-native-summary-20261116.json)

系统字号恢复为原第 2 档，实际三滑块为 2／1／1。当前 Reader 的 UIContext 实测字号为 1.0，显示密度与分辨率密度均为 3.5。最终页面为正常书架，所有本次原生会话已结束并释放租约。

当前 Source 内存夹具的真实 IME 使宿主底边从 2832px 缩到 1733px，再恢复 2832px，标题和 TextInput 的位置保持一致。分组选中纪实样本后菜单关闭，列表投影更新，原触发器重新取得焦点。当前场景覆盖默认字号的这些具体端点，高于 58vp 的页头、中间连续绘制和完整适配仍待原条件取证。[Source 场景记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/post-global-source-native.json)

Figma 官方接口当前读取通过，已核对页面目录、书架／搜索分组、上轮整理说明及目录同步前备份截图。整理说明 4976:1346 标注源码来源 HEAD d6c3213，多个状态画板明确标为当前源码控件，独立整页批准来源继续沿原条件核对。原 token-expired 结果保留其历史时点。[Figma 当前读取与来源](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-post-global-review.json)

当前 VM 的 MediaKit 录制对象创建与 startRecording 返回，30 秒内未收到 STARTED 状态或授权界面，应用按既定 deadline 收口，实际缓存文件为 0 字节。G05 连续帧未取得，平台未进入录制的底层原因仍待定位。当前 uitest 不支持 uiWindow 命令，准确纯高度原生场景继续开放。正式 21 项、336 层的 19 PASS／27 FAIL／290 NOT_RUN 按原关闭条件记账。[连续录制能力记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/post-global-capture-capability.json)

书架设置和开发者设置两个正常宿主新增纯读屏序列通过。书架开关按开／关／开更新，开发者组件边界按关／开／关更新，六个原生实例检查均保持键盘焦点关闭，并以实际绿色焦点框证明读屏焦点连续。重开页面核对书架原值为开、开发者原值为关，系统读屏恢复关闭。[两个纯读屏宿主记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/post-global-toggle-reader.json)

当前系统最大第 5 档实测 1.45 倍，Source 标题、输入与首行在真实 IME／Back 三个端点的位置一致。该场景页头仍为名义 58vp，标题行高 33fp × 1.45 为 47.85vp，小于基础高度，本次不能关闭高于 58vp 的原生条件。最初对此场景的预期已纠正。系统第 2 档和 Reader 实测 1.0 已恢复，最终为正常书架、两项密度 3.5。[最大字号与恢复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/post-global-maxfont-native.json)

本次工具修正包含读屏导航与首触摸改用原始 uinput 序列、实际最大字号 1.45 的准确断言，以及录制缓存查询改用 shell 命名空间下的精确应用路径。各次未进入目标或未满足断言的原始记录已保留，具体生产行为和工具前提分别记账。

## 2026-11-16 代码收口与连续三轮全局审计

第十一、十二、十三轮在同一代码候选 62c55a41 上连续完整通过，代码侧修复队列为 0，VM 禁令的三轮通过条件已满足。本代码收口与审计阶段的 VM、HDC、设备、远程和 CUA 操作均为 0。

每轮独立审阅 472 个必审 UI 文件，包含 93 个共享 UI、289 个功能 UI／presentation 和 90 个 App／root 文件。每轮核对 73 项输入与已接纳回执链、83 个历史问题 ID，新增代码问题为 0。642 个生产输入与 1,765 个审阅输入在三轮起止均同字节。[第十一轮](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-11.json)、[第十二轮](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-12.json)、[第十三轮](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-13.json)

本阶段修复 UIF-51 至 UIF-83，共 33 项新增确认代码问题。本地候选 0.2.0.DEV.d33f5b7933c2 完成规范完整 ArkTS 编译及指定证书签名，642 个生产 ETS／TS 文件与不可变产物逐字节一致，签名 HAP 字节哈希已读回匹配。全量测试状态为 NOT_RUN。[代码收口证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/code-closure.json)

正式登记共 21 项、336 层，当前结果为 19 PASS、27 FAIL、290 NOT_RUN，整页原生闭环为 0。37 项登记诊断开放，原生、原稿、G05／G10 的待补证据和关闭条件见原实施批次。只读 Sync 历史采用按顺序分配的呈现键，保留同分钟重复记录的独立行，该实现选择由本次代码整改作出。

### 各轮修复与审阅记录

第一轮绑定 aa015470，结论为 INCOMPLETE，确认五项 P2。UIF-51 至 UIF-55 已在 1b6b846a 修复，13 个准确用例及 6 个旧行为负例取得结果。第二轮复核这五项修复通过，并完成 472 个必审 UI 文件的合同审阅，包含 93 个共享 UI、289 个功能 UI/presentation 和 90 个 App/root 文件，剩余必审文件为 0。第二轮确认另外 12 项 P2，结论为 FAIL。[完整第二轮报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-02.json)

UIF-56 至 UIF-67 已完成当前代码修复，涵盖书架筛选导航准入、两个显示方式消费者和主题选择的异步写入准入、发现与 RSS 当前数据、同步历史重键、Full TTS picker 容量、TTS 选项文案、规则预览、普通文字目录节点、分页正文 recipe 和波形基高。未派发显示方式请求退休后恢复已确认投影，原 Host 继续保存已经派发的真实回执。Discover、RSS 和 Sync 保留原有 L0 准入条件。[第二轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round02-repair-summary.json)

新增 12 个准确局部用例和 9 个旧行为负例已有通过结果。22 个修改脚本完成语法核验。第二轮本地候选为 0.2.0.DEV.d1b2e9ce101d，完整 ArkTS 编译和原指定证书签名通过，642 个生产 ETS/TS 输入与产物清单逐字节一致。首次编译发现本次空筛选状态的 ForEach 需要单一 Column 子宿主，修正后第二次编译通过。13 项受影响登记的指纹已同步，引用检查 0 诊断，登记继续保留 37 项原有诊断。[生产字节绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round02-repair-production-build-binding.json)

第三轮绑定 8d6d8bdc，完成 472 个必审文件，结论为 FAIL，确认 4 项 P2。UIF-68 至 UIF-71 已修复，涵盖设置分区标题自然增长、多选书籍同身份当前字段、Root 至阅读页的实时输入准入和未接受指针退休，以及平面目录和书签旧动作的原模块准入。原有已接受翻页结算、业务回执及几何事实继续按各自归属处理。4 个新准确用例和 2 个投影旧行为负例通过，13 个修改脚本语法通过。[第三轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round03-repair-summary.json)

第三轮本地候选为 0.2.0.DEV.d9f70a1af08b，完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 输入与产物清单逐字节一致。局部夹具的两次遗漏已保留失败记录并修正。连续通过仍为 0，下一轮将由新的 review agent 做完整全局审计。[第三轮完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-03.json)

第四轮绑定 8c4bd963，完成 472 个必审文件，结论为 FAIL，确认 4 项 P2。UIF-72 至 UIF-75 已成批修复。漫画设置、页码、亮度和边界手势接入同一 Root 实时输入准入，未接受手势保留原修订。连续阅读 Stage 接入父输入修订及实时函数，旧指针在恢复前景后继续退休。语义目录校验原 Content、Surface、List 和当前章节事实。搜索的历史、提交、停止、重试、结果与筛选入口在首次动作前消费当前可见性，发布与已接纳队列保留原生命周期。[第四轮全局报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-04.json)

4 个新准确用例及平面目录共用判据复查通过，9 个修改脚本语法通过。第四轮本地候选为 0.2.0.DEV.436dbd994df8，完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 字节绑定无漂移。首次构建期间继续修改测试适配器导致受控输入封存失败，固定全部输入后第二次构建通过，失败记录保留。13 项受影响登记已同步，引用 0 诊断，原有登记诊断仍为 37。连续通过仍为 0，VM、HDC 和设备操作继续为 0。[第四轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round04-repair-summary.json)

第五轮绑定 f22699d4，完成 472 个必审文件，结论为 FAIL，确认 3 组 P2。UIF-76 至 UIF-78 已按 68 项同族入口表修复。书架首读、长按／More 首开、book-action 和顶部 More token 在本地写状态或排队前消费原 live input。书源类别、状态、分组、清空在首次修改前复用已有管理输入资格。Manga semantic／flat、BookDirectoryPage semantic、FullDirectoryPanel 及上层 opening 均递送原宿主当前资格，Surface 直属 fold／retry／clear 与 Full 本地工具也消费它。[第五轮全局报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-05.json)

3 个新增准确用例及原 Reader／semantic 共享适配复查通过，11 个修改脚本语法通过。第五轮本地候选为 0.2.0.DEV.012ee74c63d5，一次完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 字节绑定无漂移。21 项登记指纹已同步，引用 0 诊断，原登记诊断继续为 37。原已接纳 pending action、native 消失／分组收起清理与业务回执保留原 owner。连续通过仍为 0，下一轮从当前冻结代码开始。[第五轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round05-repair-summary.json)

第六、七轮完整全局审计曾连续 PASS。第八轮最终封存前补查恢复路径，确认 UIF-79 与 UIF-80 两组 P2，连续计数从 2 归零。先前父层 live guard 没有覆盖叶节点一次性 dispatchedId 及选择面板 closeInFlight 的首次修改，失效后恢复场景遗漏已纠正。[第八轮最终报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-08.json)

两组已修复。书籍操作与顶部 More 把原实时资格递送到叶节点 isCurrent，失效 token 保留未消费状态，同一 opening 的新动作在恢复后可被接纳。SourceGroup 把原 managementInputIsCurrent 递送到 SelectPanel，在 selectAndCollapse 首次修改前检查，已接纳的动画 finish／onDismiss 仍由原 owner 完成。两个新增恢复用例首次运行通过，第八轮本地候选为 0.2.0.DEV.7045c48f046a，一次规范全 ArkTS 编译及指定证书签名通过，642 个生产字节绑定零漂移。2 项受影响登记已同步，原 37 诊断保留。下一批重新从 0 开始三轮独立全局审计，VM 操作为 0。[修复及恢复回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round08-repair-summary.json)

第九轮全 472 个必审文件审阅确认 UIF-81，两个控制栏抓手的共用首 DOWN 入口漏用已传入的实时 inputCurrent，可能取消原控制导航意图并占用指针。修复集中在唯一 Runtime.down 之前，已接纳 Move／Up／Cancel 继续沿原 owner 收尾，committed geometry 保留其显示事实。[第九轮报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-09.json)

新增准确回归覆盖两个实际 SDK callback、live／lost-first-DOWN／同 actor 恢复及 Up／Cancel，共 8 场景。首个 fixture 的 accepted endpoint 遗漏 commitVisualSession 已补实际方法并保留失败记录。第九轮本地候选为 0.2.0.DEV.c14fc0e6178c，一次规范完整 ArkTS 编译与指定证书签名通过，642 个生产输入字节零漂移。13 项登记指纹同步，原 37 诊断保留。代码重新冻结后开始第十轮独立全局审计，连续通过为 0，VM 操作为 0。[修复与回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round09-repair-summary.json)

第十轮完成 472 个必审文件，确认 UIF-82 和 UIF-83，结论为 FAIL。第四轮 Search 的实时输入判据误用于已接纳回执，造成触摸收尾后的结果延迟和原生面板消失后的输入占用残留。当前修正三处判据，List 新 Down 继续校验实时输入，原 Up／Cancel 按原 query／list 收尾；Filter／Task dismiss 按原 page／query／opening identity 收尾，新选择、重置和重试保留原实时输入准入。[第十轮报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-10.json)

新增两项准确回归一次通过，共 8 组场景，覆盖结果发布、后台／前台恢复、同页面新输入、旧查询拒收、scroll stop 和两类 native sheet 消失。当前本地候选为 0.2.0.DEV.d33f5b7933c2，一次规范完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS／TS 字节绑定无漂移。登记源输入无需更新，引用 0 诊断，37 项原有登记诊断保留。重新冻结后开始第十一轮，连续通过为 0，VM、HDC 和设备操作为 0。[第十轮修复与回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round10-repair-summary.json)

第十一至十三轮连续通过，代码阶段收口。后续原生与视觉证据按原实施批次和关闭条件执行。21 项登记的完整原生验收、独立整页视觉、可听读屏、G05 和历史 G10 保留原标准。VM 最后保存的字号为 1.3 倍，原字号恢复仍待执行。

## 2026-11-15 执行量与效率复核，VM 验证已禁止

用户已要求停止 VM 验证，先核算原计划、实际完成量和效率。当前阶段使用本地 Git、原计划、构建台账、部署回执及已保存的原生会话。统计截止于北京时间11月15日23时21分19秒，源码为e8b80d12。下方各轮进度保留其当时输入，当前限制和核算以本节及原账本executionAssessment20261115为准。

原计划为6个批次，包含5项初始问题、2个条件风险和4个页面族含变体共21项的16层验收。初始5项的应用侧修复和准确局部回归均已有交付。批次0至3已有应用侧成果，批次4和5继续开放。正式336层保存结果仍为19 PASS、27 FAIL和290 NOT_RUN，较10a5d58d基线新增PASS为0，完整关闭页面为0/21。

实施跨时段为35小时14分9秒，包含中断与等待。记录中有65次HAP构建尝试，其中52次成功、13次失败。52个不可变候选均有成功保数据安装记录。464个VM会话包含5077项动作，382个正常结束、82个失败，其中15个会话没有动作。会话正常结束不计为页面验收通过。构建台账累计34分59秒，VM会话累计3小时33分36秒，部署从首个记录阶段至结束累计26分17秒。三个区间合并去重为4小时34分34秒，其余跨时段包含源码与测试修改、分析、文档、编排、中断及等待，当前日志不足以逐秒分摊。

确认的低效因素包含过早代码完成判定、零散补夹具与候选、至少21个驱动或判据错误会话、13个Toggle修改提交、39个纯文档或登记提交，以及未及时同步的当前状态别名。13次构建失败分为6次ArkTS编译、4次漏传已有Native缓存路径、2次worker优先级准入和1次构建输入漂移。详细逐条统计、原始路径和口径保存在[执行核算记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/execution-assessment-20261115.json)。

最后保存的VM会话已释放，页面停在诊断菜单，临时系统字号仍为第4档、实际1.3倍，原字号第2档恢复待执行。保存的VirtualPixelRatio和DensityInCurResolution均为3.5。当前候选为0.2.0.DEV.9014de0e4eca，641个ETS/TS运行时输入与不可变快照逐字节一致。AE漫画自然行命中修复及已有原生动作已追加到原账本，13项Directory登记已同步生产组件和测试入口指纹，8个漫画变体补入准确组件证据。选定引用检查0诊断，登记保留27项既有E2/E3及测量、范围诊断，来源漂移为0。

漫画自然行的UIF-50已经由e8b80d12修复。原响应区固定44vp，实际长标题行高488px时，标题中心点击超出原154px响应高度45px。当前响应区消费整行自然宽高，既有身份、禁用、选择及分组准入继续由原owner持有。准确SDK12样本及旧44vp负例已有结果，保存的font1.3组件原生记录包含标题中部、另一行下缘和独立章节下载动作。语义和平面换源的完整及168vp短槽首目标均有0→1→1的忙态拒重记录。[AE现有证据对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-manga-ae.json) [13项登记更新及检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-followup-ae.json)

## 2026-11-15 VM 显示异常与正常重启恢复

本轮读屏和Toggle验证期间，11月15日04:14:13的RenderService绘制线程卡在模拟器DGLES的eglSwapBuffers，随后出现SERVICE_BLOCK和Watchdog退出。foundation、DMS及SceneBoard重建，OEM显示配置读取失败，保存DPI的user_set_dpi_value查询count为0，defaultDpi为0，实际显示密度回退到1.5。具体交互触发DGLES阻塞的直接因果继续保留。

此前通过系统设置切到大档再切回默认档，Reader比例及VirtualPixelRatio恢复3.5。用户再次指出系统显示无法恢复后，本轮确认DensityInCurResolution仍为1，状态栏窗口只有58px高，完整桌面图标和系统文字仍过小。此前只核对Reader比例及VirtualPixelRatio就继续验证，恢复结论不完整。

恢复期间另有4次临时原生适配尝试。01/02在动态库加载处失败，03/04已调用ScreenManagerAdapter.SetVirtualPixelRatio(screen0,3.5)，均返回100。此前将4次都表述为未进入密度写入不准确，现按原始源码和输出纠正。临时二进制及依赖副本的清理沿原记录保存。

用户明确授权正常重启VM并保留数据后，已执行一次正常重启。DMS启动时刻更新为16:53:33.897，SceneBoard从30321变为1426。物理分辨率保持1280×2832，VirtualPixelRatio和DensityInCurResolution均为3.5，屏幕挖孔信息恢复，状态栏窗口从58px恢复为136px。锁屏、完整桌面及Reader书架实屏均已查看。[重启、前后参数与实屏证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-recovery-after-reboot-20261115.json)

原安装包0.2.0.DEV.d61901614df1的版本、内容身份、UID及更新时间前后一致。正常启动后可见原四本书，Sample EPUB及Native Check保持未读，ReaderFramework显示27%，ReaderManga显示100%。本轮核验范围为正常重启、完整显示恢复、安装身份及可见书架数据，全部用户数据的逐字节审计沿其原范围保存。[完整原因与更正记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-density-incident-20261115.json)

最初DGLES阻塞的底层触发点以及再次异常恢复后的保持行为仍有各自证据缺口。全应用框架实施目标已恢复为active，后继验证沿完整恢复的系统显示配置推进。


## 2026年11月15日当前实施状态

全量实施目标已恢复为active。现有批准资料和紧凑布局保留决定继续有效，未完成工作保留在账本。此前把尚未完成的原稿检索、分支核对和原生场景提前写成待用户决定，现已纠正。当前运行代码提交为`c189905d`，已安装候选为`0.2.0.DEV.b2a0c9e4d9eb`。下文保留各批次当时的源码、失败及验证范围。正常重启后的完整系统显示已恢复，代码、原稿和准确原生入口的剩余工作继续由agent推进。


### 1.3倍字体下的文字目录与短槽控制内容

当前b2a0候选通过现有DEBUG装配调用生产ReaderFullDirectory和ReaderControlDirectoryContent，补齐文字详情、阅读上下文，以及树／平面Full／Quick和短槽共七个实际场景。九个捕获点分别核对配置1.3与独立原生倍率1.2999999523。文字父槽为320×770.2857vp，控制父槽为320×809.1429vp，实际Full内容为272.5714×533.7143vp，Quick为220.5714×190vp。正常应用路由、原阅读会话和业务写入继续按各自入口验收。[准确场景及证据范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-directory-ad.json)

文字详情、阅读上下文和树Full的46vp完整章节行分别完成章首书签及下载附属动作，平面Full完成书签创建。平面Quick在38vp行内、26vp原生按钮盒上方18px的位置触摸，准确创建第21章章首书签。八次附属动作共取得五次书签创建和三次下载回调，四个控制场景均捕获实际书签页。26vp横向容量和Quick38vp行高的已知约束继续登记。

同一短槽actor的目录和书签模式分别完成122→168→190→168→122vp。十个点均保留各模式自己的原生List，实际高度为427／588／665／588／427px。122vp前缀经滚动到达标签、查询及工具，五个工具原生盒均完整154×154px并位于同一List内。当前工具可见性和八次附属动作各有明确范围，其余动作、焦点、读屏、方向及完整E2/E3继续按各自条件处理。

私有驱动修正两项入口问题。首次控制会话因标准输入关闭，在零UI动作时正常结束。后续详情动作与书签页完成后，菜单允许列表漏列已有阅读及控制入口，在查找阅读入口前停止。现已按当前菜单源码补齐允许列表，并复用已完成的详情范围。章节动作检查还显式拒绝裁切后的行和按钮盒，支持本次实测46／38vp行高。原始FAIL及准确续接均已保留。[驱动问题与修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-directory-driver-failure-ad.json)

Directory基础登记修订为48，reading-text、control-text及两个短槽变体分别修订为47。十四次有限内存owner回调由八次附属动作和六次标签切换组成。系统三个滑块最终恢复2／1／1，独立原生字体回到1，正常启动返回原四本书架，TXT27%、两本测试书未读、漫画100%。两个密度字段均3.5，状态栏136px，SceneBoard1426。漫画及换源目标的1.3倍场景、其余正常宿主与焦点条件继续由agent执行。[登记范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-directory-ad.json) [本批收尾与后继工作](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ad-delivery-review.json)

### 1.3倍字体下的下载变体、九状态与可见性判据修正

当前b2a0候选在320vp、实际系统字体1.3下补齐五个下载变体。全高父槽实测770.2857vp，书籍固定管理栏、章节浏览及章节固定管理栏已有当前原生依据。168vp父槽补齐书籍和章节流内管理栏，原生List归属、实际0→12本书及0→18个条目的全选、准确书籍身份和Back返回均已核对。原九状态及布局回执保留其当时的1倍字体和1849.3333vp全高输入。[本批完整原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-download-ac.json)

读取中、空书架、读取失败、保留内容失败、原操作待核对、核对读取中、筛空、章节投影读取中及章节投影失败共九种实际有限状态已补证。读取失败重试接纳一次，清除筛选后查询为空、意图计数仍为0，章节失败的两次重试合并为一个未完成读取。全高恢复提示的重复触摸保持一次刷新，原操作结果仍未确认。[准确入口与已有证据不足之处](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-plan-ac.json)

**私有可见性判据已修正。** 旧查找只检查裁切后的bounds，短窗章节全选载体曾只露出83px，原始高度为154px。该次实际回调及List归属证据保留。当前文字查找比较原始范围，布局断言显式检查完整摘要及154px全选载体，实际断言分支拒绝旧裁切样本，接受当前完整样本。固定栏四份及流内四份完整载体范围均已核对，一份流内初始截图通过同一实际断言分支复用。其余动作和整页E2/E3继续按各自条件处理。[判据、更正及当前证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-visibility-correction-ac.json) [真实分支负例与正例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-visibility-method-ac.json)

168vp恢复样本中的Notice Scroll实测217px，正文原始高400px。两次实际滚动补齐分段正文和末项刷新动作，当前按钮完整高154px。刷新后的禁用重复触摸保持意图计数0→1→1，底层查询focused始终为false，当前捕获窗口中没有IME。原未知事实在读取中继续保留，正文分段及动作实屏已查看。

本批五次driver FAIL均保留，包含两次固定八步查找不足、一次断言顺序错误、一次把流内页头可见性加作详情身份前提，以及一次菜单45秒总限。查找与前提已按当前源码、原生位置和准确回执修正，已完成步骤逐项复用。末端菜单采用有界较快拖动，本次准确查找实测8545ms，四次及45秒限制继续生效。[失败及定位](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-driver-failure-ac.json)

Downloads基础登记修订为31，五个变体分别修订为28，interaction及adaptation附上各自实际范围。当前七次有限owner回调来自三个准确打开书籍场景、读取重试、全高恢复、章节重试和短窗恢复，队列、文件及网络业务继续沿原范围验收。系统三个滑块最终恢复2／1／1，独立原生字体回到1，正常启动返回原四本书架，原TXT27%、两本测试书未读、漫画100%，两个密度字段均3.5，状态栏136px，SceneBoard1426。[登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-download-ac.json) [本批收尾与后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ac-delivery-review.json)

### 1.3倍字体下的书源与工具恢复提示

当前b2a0候选补齐320vp、实际系统字体1.3、父槽高770.2857vp下的六个恢复状态。Source的回执待核对及原操作未确认分别完成实际核对，待清理完成实际继续清理，三次当前意图均被接纳。提示退休后原保留行Toggle恢复启用。Tools的未知回执完成核对，原操作未确认和待清理分别完成继续及继续清理，三次当前有限内存意图均只增加一次，原未决事实继续保留。[六状态及当前动作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-recovery-ab.json)

Source三份及Tools两份长提示均完成展开、收起。五份原生正文范围保持完整，十四个启用的动作载体均至少154px高，对应当前密度下44vp，全部位于各自当前Notice Scroll内。五张展开实屏已查看正文末尾和动作。Tools未知回执沿现有投影使用短“等待核对”，其正文范围单独记录。实际配置和独立原生字体比值在六个状态中逐项核对，其他高度、方向、真实业务写入和完整读屏沿各自范围验收。[准确入口及原证据不足之处](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-recovery-plan-ab.json)

本批私有菜单驱动保留两次FAIL。首次固定约900px拖动在四次后停于工具目标之前，后继按实际2597px视口分配跨度。较长拖动随后触发10秒客户端超时，当前只读原生树确认原拖动已生效、目标已完整可见，后继直接消费该目标。后续菜单拖动使用30秒普通命令上限，四次及45秒总限继续生效。[失败、现场位置及修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-recovery-driver-failure-ab.json)

Source和Tools基础登记分别修订为51及41，interaction和adaptation追加本批范围。六次恢复动作与三个工具默认关键词初始化回调分开计数，原生收尾观察的全局计数为9。两份文档和当前原生清单已更新，完整21项逐层判定沿原条件保存。[登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-recovery-ab.json) [当前后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-ab.json)

系统三个滑块已恢复原2／1／1，独立原生字体读数回到1，正常启动后回到原四本书架。原TXT27%、两本测试书未读、漫画100%，两个DMS密度字段均3.5，状态栏136px，SceneBoard1426。当前运行代码和原签装候选继续复用。[本批收尾](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ab-delivery-review.json)

### 实际1.3倍系统字体与基础适配补证

**系统字号第4档已实测为1.3倍，前序环境缺口分类已纠正。** 前序仅测量第2档和第5档，就把1.3与1.6、2一并列入环境缺口，缺少中间档实测依据。当前ReaderWindowCoordinator接受有限正字体值，Ability配置优先，原生观察另读UIContext的fp2px与vp2px比值。实际系统滑块为4／1／1时，配置值为1.3，原生字体比值为1.2999999523162842，跟随系统为true。[实际字体能力与更正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font-intermediate-capability-aa.json)

当前b2a0候选完成Source默认内容、详情文字Full目录、下载书籍浏览和书源工具内容四个基础页面的八个初始状态样本。请求宽度分别为320vp和366vp，实际宽度为320vp和365.7143vp，高度均为770.2857vp，每个样本独立确认配置及原生字体为1.3。八张实屏已查看，目录窄宽查询及工具形成分行，下载长标题与元数据自然增高，Source保留其横向筛选条和既定省略，工具七项动作均有原始字形像素。[八个样本、原生树与准确范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-aa.json) [原始像素复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-aa-pixel-review.json)

Source的320vp样本实际选择“纪实样本”，显示12／24个书源、8个启用。系统字号恢复后，同一进程31278、presentation8继续持有原生输入4222及分组Button4239，分组值、计数和触发器焦点均保留。触发器范围从[438,884][1135,1038]变为[413,823][1134,977]，恢复后的范围在后继分组Back观察之前已取得。晚于配置回调的当前公开Back回执另确认配置与原生字体均回到1。两次工具初始化使内存owner的意图计数为2，分组动作及字号恢复保持该值。

恢复期间一次私有驱动检查失败。旧Source业务历史断言要求开场launch仍在当前日志中，该记录已退出返回范围，驱动因此停止。系统三个滑块当时已经恢复为2／1／1，原始FAIL保留。后继使用已核对的当前进程、页面身份、原生面板及公开Back回执完成续接，早期配置为1而原生读数仍为1.3的观察也按原值保存。[失败及准确续接](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font-restoration-driver-aa-failure.json)

Source、Directory、Downloads及Tools四项基础登记分别修订为50、47、30和40，adaptation层追加本批准确证据。其他状态、变体、完整原生命中、读屏、方向及整页适配继续逐项处理。当前暴露的系统字号滑块最高第5档实测为1.45，实际1.6及2的系统字体输入路径仍未建立。完整21项逐层判定沿原条件保存，1.3的其余可执行状态继续由agent推进。[四项登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-aa.json) [当前剩余原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-aa.json)

本批复用c189905d运行代码、原签装候选及保数据安装依据。系统字号、字重和显示缩放最终恢复2／1／1，正常启动返回原四本书架，原TXT27%、两本测试书未读、漫画100%。物理分辨率1280×2832，两个密度字段均为3.5，状态栏136px，SceneBoard1426。[本批收尾与完整证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-aa-delivery-review.json)

### 书源其余24目标的实际动作补证

当前b2a0候选在同一default内存宿主、同一presentation中完成其余24个交互目标。四个可用状态的原生selected与实际16/24、6/24、12/24及24项计数吻合，禁用“自定义”触摸后仍选择全部。七个分类逐项取得当前原生selected及投影计数，屏外项经真实横向Scroll到达，最后恢复全部类型。[24目标、34个断言点与完整原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-targets-z.json)

分组当前项、两项样本分组及回到全部分组均取得实际回执，面板外部触摸关闭后保留当前值。五个关闭捕获点均回到同一原生触发器289，focused=true。页头工具回调捕获“科幻样本”，页脚工具回调捕获“纪实样本”，同一owner记录了对应当前筛选元组。查询TextInput272在实际IME、Back及清除后保持同一实例，值为NoMatchZ73129、NoMatchZ73129及空值，焦点为true、false、false，清除后恢复24个书源、16个启用。实际输入法和最终书架实屏均已查看。

页头与页脚新增入口各接纳一次内存add意图，第一源登录和第三源检测分别接纳到准确实体。两项进入checking后，新原生按钮enabled=false，重复触摸后的业务意图总数仍为6。本批业务回执来自既有独立内存owner，实际导入、浏览器登录及网络检测沿各自业务范围使用。源码与回调准入先从当前入口核对，原签装候选继续复用。[当前入口及停止条件](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-target-native-plan-z.json)

34个目标的动作证据现已逐项齐备，包含本批24项、前批9项及准确复用的Toggle行1项。每项保留其原始候选、宽度、密度、状态和回执范围。Source登记修订为49，interaction追加本批准确证据。完整页面E2/E3的边缘命中、其余焦点、读屏语义、字号及方向条件继续逐项核对。[当前34目标对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-native-target-map-z.json) [登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-targets-z.json)

六个会话均完成并释放租约，正常启动返回原四本书架。原TXT27%、两本测试书未读、漫画100%，两个显示密度字段均为3.5，状态栏136px，SceneBoard1426。全量目标继续处理剩余完整原生条件。[本批收尾与后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-z-delivery-review.json)

### 书源恢复动作与34目标原生对账

当前b2a0候选在实际366vp请求、365.7143vp宽、770.2857vp高、系统字号1的Source页面中完成六次场景打开。状态动作、保留列表刷新、空列表重试、未知回执核对、原操作核对、继续原操作及继续清理，共七次业务意图均取得当前进程和当前presentation的唯一回执。刷新后原恢复动作退出，空列表重试后呈现“暂无书源”，未知回执或原操作处理后提示退出，保留行Toggle恢复启用。实际页头返回Button触摸后取得夹具菜单回执。[完整原生动作与逐步断言](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-recovery-y.json)

未知回执与原操作长文均完成实际展开、收起及动作命中，两个展开实屏已查看。当前正文与动作在该完整Source视口内可见，原生文字范围和动作范围另存。该场景使用正常SourceManagementPage、公共Notice和公共动作控件，业务投影及回执来自现有独立内存owner。源码几何换代、短窗、大字号、实际业务写入及完整读屏继续沿各自条件验收。[入口、当前代次与有限回执范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-recovery-native-plan-y.json)

书源34个交互目标现已逐项对应当前证据。九项目标取得本批准确原生动作回执，一项Toggle行按已核对的源码范围复用，另24项继续逐项核对当前动作或准确复用依据。七个历史目标的原始局部回执保留在对应行。Source正式登记修订为48，仅interaction层追加本批证据，完整E2/E3判定沿原条件保存。[34目标对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-native-target-map-y.json) [正式登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-recovery-y.json)

本批沿当前c189905d运行代码及原签装回执复用候选。五个原生会话均完成并释放租约，正常启动后回到原四本书架，原TXT27%、两本测试书未读、漫画100%。两个密度字段保持3.5，状态栏136px，SceneBoard1426。后继准确工作继续留在全量目标内。[当前收尾及剩余范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-y-delivery-review.json)

### Toggle消费者核对与正常设置补证

全树八处生产构造已按七个页面族核对。正常通用设置已有四次纯读屏及四次混合激活的原生证据。书源页已有两次键盘及两次纯读屏激活证据，本次核对共享Toggle完整字节、十二个实际行方法及LazyForEach行键和回调装配均未变化，按原范围复用。书源sourceList整段方法已有其他修改，其前缀、状态和完整页面布局继续沿各自证据范围验收。[八处消费者及入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/toggle-caller-audit-x.json) [书源准确复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/toggle-source-reuse-x.json)

当前b2a0候选从正常设置进入书架设置，一次Tab到达当前Toggle。两次受控Enter使原生代次0→1→2，值true→false→true，三个捕获点均enabled=true、focused=true。返回并重新打开后，新页面身份7:1:0仍读取原值true。开发者页面从正常通用设置进入，两次Tab到达“显示组件边界”，原生代次0→1→2，值false→true→false，换代后均保持启用和键盘焦点。重新打开的developer:7页面仍读取原值false。[正常书架设置](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-bookshelf-toggle-x.json) [正常开发者设置](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-developer-toggle-x.json)

两项新场景复用当前已签名安装候选，实际修改的是应用级偏好。书架与开发者原值均已恢复，最后回到原四本书架。两个DMS密度字段保持3.5，状态栏136px，SceneBoard1426。规则管理缺少当前正常设置触发，RSS两页面继续保留L0条件。新场景的结论限定于实际键盘焦点、受控值及重新打开读数，完整读屏语义、声音、异步时序与页面E2/E3保留各自范围。[消费者结果与收尾](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-consumers-x.json)

本批驱动有两项失败。底部导航隐藏了普通文字节点，按“设置”文字查找失败后，改用当前原生Button的实际范围进入。UITest再次拒绝accessibilityText扩展属性，私有驱动已将可选扩展属性限定为当前支持的uniqueId，后继使用默认原生树。两次失败均发生在偏好动作之前，原始输出保留。生产源码保持c189905d，本批增加准确原生证据和账本更新。

### 原始截图像素复核与误判撤销

**UIF-49已撤销，原始目录四行像素实际存在。** 原V批Back和后续静止态两张PNG的完整文件校验和分别保持f2b2a545245a0f13af36cf2c0f91a4039eb798dd56892870443ef84f8b51d875和6bcc0a04cf31fd4bd375cf5fc2b5a96f3b4e6c56b03d11c64f074844ff58c5d8。四行区域为[120,930,1160,1510]，含13163个深色像素，RGB像素SHA-256均为3a3cd1c6fd140d55c81e828029c90d18b669bf7130dccfda0c0c138cf46e9d9f，与W批可见四行截图完全一致。四个标题区域分别有892、4065、4078、4128个深色像素。原图、原生树和客户端文字命令相互吻合。[原始字节与逐区域比较](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-back-paint-w-original-byte-review.json)

此前将该图像读成目录空白并登记FAIL，是agent的视觉复核错误。该误判引出了额外静止态和RS读取、空草稿与非空草稿的Back对照、3.658秒输入到Back节奏对照，以及一次正常应用冷启动和首个目录入口。W批双截图均可见四个条目，随后原始像素对照确认误判。UIF-49及相应应用或平台归因任务已撤销，原始记录另存供追溯，原生产修复候选继续复用。[更正与额外执行范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-back-paint-w-correction.json)

当前目录编辑的源码修复c189905d、三个正常调度SDK回归和Search准确方法，以及实际草稿、Back和再次编辑的有限原生结论继续有效。独立首次Area缺口在原生场景中未触发，完整E2/E3、整页视觉、可听读屏及G05/G10沿原条件记录。后续执行转回真实的逐目标、状态与原稿对账。


本批当前b2a0候选继续沿c189905d及原不可变签装回执使用。正常收尾后已核对原四本书架，原TXT为27%，两本测试书保持未读，漫画为100%，两个密度字段均为3.5，状态栏136px，SceneBoard1426。当前正常Full目录查询的有限原生证据已补入directory::control-text的query和interaction层，完整层判定保留。[当前收尾与证据范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-w-delivery-review.json)

现有原稿引用已逐项展开到全部21项登记与194个声明状态。五份现有来源的SHA-256均匹配，其实际授权范围分别保留。当前权威登记没有这些页面与状态的独立整页批准组合，整页视觉继续沿用户接受的原条件保存。逐页逐状态的来源对账已完成，剩余原生命中、焦点和状态格继续按准确入口核对。[完整页面与状态来源映射](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/whole-page-reference-state-map-w.json)

### 正常目录编辑的同宿主重算修复与前序图像误判

**UIF-48已完成代码、准确回归、编译签名及当前目录编辑的有限原生验证。** 当前34f诊断候选实际进入原生焦点ACK和公开键盘请求，随后同一输入收到allowed=false，键盘显示后立即隐藏。完整Reader进程日志补齐了最初过滤日志采样之后的失效边沿。Parent已有当前Search编辑资格，Directory缺少对应接线。前序同型输入装配核对遗漏了这条目录链，本轮已修正。[原始事件与原因链](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-keyboard-observation-v.json)

当前Panel复用同一按模块和语义作用域判定的编辑入口，Directory只在真实原生焦点回执后报告编辑活动。查询输入和草稿保留当前编辑资格，普通搜索、排序、章节及其他动作仍使用几何准入。Back、失焦、失败、卸载、换实体及新列表打开清理原编辑资格。四个普通工具发出实际enabled=false并拒绝其回调，Native Button继续使用平台焦点依赖。旧609源码负例复现准入失效，当前正常Panel装配和SDK回调通过。[准确用例复审](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-method-review-v-reflow.json) [回归与失败尝试归档](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-reflow-regression-v.json)

三个准确用例已重新审读并通过正常调度入口，keyboard-transfer、directory-focus、keyboard-ack-delay共三项PASS。搜索原有search-native-editor-scope准确方法也通过。首个新增断言错误地要求Native Button显式focusable=false，已按共享modifier实现改为检查无显式覆盖，并保留enabled=false和实际动作拒绝。一次资格发布脚本误选父项集合导致派发前拒绝，已改为只发布三个准确caseEntries后正常执行。其他用例及完整套件保持NOT_RUN。[正常调度结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/selected-directory-reflow-v/results.json)

当前候选0.2.0.DEV.b2a0c9e4d9eb绑定运行代码c189905d，不可变run为20261115T105219Z-c189905d-55212394，签名HAP的SHA-256为d34c3fa9c3c2431e482fc4747633ec88ba8e156999626c33911400a42b08a3c3。641个运行源码输入与候选逐字节匹配。指定minliny_HarmonyOS证书验签通过，当前停止态存储副本经正式FFI准入后保数据覆盖并启动。[当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-v-reflow.json)

原正常TXT同一目录输入实际保持focused=true，重算后的allowed仍为true，实屏可见键盘，草稿晋江已进入输入。一次Back使focused=false并隐藏键盘，再次显式点击恢复focused=true、可见键盘和原草稿。原四个条目在键盘可见时均显示。UIF-47的显式再次编辑有了当前原生依据，独立首次Area缺口在本次loaded=true场景中未触发。[当前输入、Back及再次编辑](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-reflow-v.json)

**UIF-49的目录空白判断已撤销。** W批对原始V截图完成像素复核，原文件SHA-256保持原值，四个标题区域均有字形像素，整块四行区域与当前已确认可见的截图逐像素完全一致。此前将图像读成空白是agent的视觉复核错误。原图、原生树、绘制命令及误判历史均保留，更正后的依据见下方W批记录。完整目录interaction及整页视觉继续沿原验收条件保存。[失败、已排除范围与后续准确问题](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-ime-back-paint-v.json)

70处实际变化的登记源码及测试引用已按字节更新，原21项逐层结果保留，引用检查0诊断。[准确引用更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-v.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-v-contract-refs-01.json)


本批最终沿正常Back依次退出输入、Full、Quick和控制栏，正文仍为原第一章段落4，随后返回原四本书架。原TXT显示27%，Sample EPUB及Native Check保持未读，原漫画显示第2页及100%。最终实际书架为native/1794740421722，前一份文件名带final-shelf的截图实际仍是正文，原文件名和回执保留。两个密度字段均为3.5，状态栏136px，SceneBoard1426。[当前签装、原生边界和最终实屏](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-v-delivery-review.json)

### 正常文字目录续接、入口归属与本书规则

**UIF-47补齐目录显式编辑和首个布局回执的续接。** Back会把键盘恢复偏好设为关闭，当前原输入的再次点击原先缺少重新表达编辑意图的接线。另一个旧源码负例复现首次Area在输入准入前被拒，同尺寸原生盒随后缺少新Area，显式点击仍因未载入布局而停止。当前固定工具栏和短页前缀均传递当前编辑意图，缺失回执时只安排一次同ID原生尺寸读取，再沿当前ticket和真实焦点ACK请求键盘。Back、卸载、旧身份、禁用及无效尺寸继续拒绝过期工作。[代码、旧源码负例和准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-explicit-editing-u.json)

三个准确SDK用例直接运行通过，覆盖keyboard-transfer、directory-focus和keyboard-ack-delay。统一调度器因它们原有的REVIEW_NEEDED状态在派发前拒绝执行，原FAIL及原资格保留。本次证据使用实际生产Content、Toolbar、Field回调和显式属性重放，焦点与键盘服务由有限端口提供。后继完整ArkTS编译和指定证书签名通过。[当前输入与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-u.json)

**U批原正常目录编辑当时为FAIL。** 首个后继27ca和当前ea174均保留原生失败。当前显式点击日志为enabled=true、loaded=true，随后原生onFocus回调为true，但采样树仍报告输入focused=false、收起Button focused=true，实屏及窗口记录均未出现IME。本次已有布局回执，首次Area缺口没有在该次触发。已查看的当前Reader日志没有blur或键盘恢复错误，继续追查ACK之后的revision、ticket及键盘请求准入。[原生回执和剩余问题](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-normal-u.json)

正常文字阅读当前通过Quick/Full嵌入ReaderControlDirectoryContent。独立reading-text目录登记是保留的路由装配分支，当前ReaderShell的onOpenDirectory实际调用来自mangaSurface。文字通过书籍信息和详情进入独立完整目录。正式登记保留该分支及原层级判定，补充实际入口归属。[完整入口链核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-directory-entry-source-u.json) [13项登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-u.json)

正常原TXT已核对四个目录条目、空书签标签及拖动展开。实际搜索Button提交无匹配查询的旧回执按未改动的提交方法范围保存，首次Enter只递送草稿的观察继续保留。当前正常书籍信息进入同书详情和完整目录，本书规则显示默认卷规则，添加规则和预览可见，应用禁用。实际Back依次退出规则、返回目录及捕获的详情来源，再回到同书第一章段落4，最终正常返回四本原有书籍的书架。规则标题采样焦点仍为false，动态编辑、应用及其余容量状态沿各自条件验收。[正常宿主、默认规则与返回证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-normal-u.json)

当前运行提交为1523faef，已安装候选为0.2.0.DEV.ea1747817c17。不可变run为20261115T101238Z-1523faef-4e65b794，签名HAP的SHA-256为e059c58774204602b9266bc0fc9fd40184881576633881bede7106c1e7552262。641个运行输入与候选逐字节匹配。两次覆盖均沿当前停止态存储准入及指定签名身份保留数据，Core和Reader-UI pin沿原值。本批一次pixelMap截图失败经现有显示、窗口和控制栏日志检查后，在同一静止界面补取成功，原始空值原因保留。最终两个密度字段均为3.5，状态栏136px，SceneBoard1426。[当前不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T101238Z-1523faef-4e65b794/manifest.json)

完整原生编辑、21项登记的其余状态和整页视觉仍由agent推进，既有外部资料及环境能力缺口按原条件保留。当前没有等待用户作出的实施决断。[后继准确工作范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-u.json)

### 深色主题原生补证与原偏好恢复

正常通用设置的深色Button已取得selected=true原生回执。实际外观偏好只改变appThemeMode和activeTheme，冷启动后继续使用保存的深色选择。四个320vp、默认系统字号1样本已查看实际书源页、详情完整目录、书源工具初始卡片及下载书籍列表，当前文字、图标、选中项和容器使用原有夜间角色。下载排序sheet的四选项、选中标记和完成按钮完整可见，Back返回同一列表。原生实际父高度为770.2857vp。[当前深色实屏及精确范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-night-theme-t.json)

初次诊断目标查找仅取得普通书架，该失败保留。旧辅助入口丢弃停应用输出，未观察实际进程退出。后继辅助入口记录停止输出及有界退出观察后，取得实际诊断页，随后只执行缺失样本。书源工具初始化另收到一次内存debug-key回调，原日志保留该计数，颜色取证沿实际初始卡片视口使用。完整宿主、其余状态、目标焦点及方向字号组合继续按各自条件验收。

验证后沿正常通用设置恢复跟随模式并返回原书架。完整外观快照逐字段与验证前相等，包含原四个主题选择、字体和排版项。两个DMS密度字段仍为3.5，状态栏窗口136px。四个页面族追加本次夜间适配局部证据，21项完整层级结果沿原判定保存。[原外观完整恢复](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/theme-t-restoration.json) [四项登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-theme-evidence-t.json)

### 正常阅读父级接线与恢复后的宿主验证

本批新增准确用例normal-host-chain，通过正常单用例检查入口执行通过。实际RetainedReaderScene、ReaderShell文字ForEach及漫画根装配、readerDirectoryActions、ReaderDirectoryOperations和独立ReadingOfflineHost串联到共享Surface的Button回调。覆盖当前身份、遮挡、前景、旧书籍、忙态重复及原操作确认。属性递送由SDK测试显式重放，等待完成后的动作记录树重新装配，原生保留实例的绘制沿前批证据。当前641个生产输入沿已签名安装候选复用。[本批准确SDK与检查回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-reader-recovery-code-s.json)

正常重启恢复后，现有Sample EPUB从正常书架进入，实际打开更多菜单及待处理事项。原书签未知提示的覆盖Scroll为378px高，两动作均为154px高，对应44vp。一次Tab将焦点送到重新载入核对书签Button。Back关闭请求的提示投影，保留同一本书的正文，随后正文触摸可再次打开当前控制栏。Back后的原生树只有根和保留宿主Stack报告焦点，显式阅读目标焦点恢复及完整键盘顺序仍待对应证据。本次保留原书签任务，未发送核对或继续动作。[正常入口、实屏、原生树及精确边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-reader-recovery-native-s.json)

最终沿正常Back返回四本原有书籍的书架，两个DMS密度字段均保持3.5，状态栏窗口136px。两次驱动参数错误和一次书名简称断言失败保留原FAIL。后继按实际字段继续，书架完整标题由已取得的原生树离线核对，最后只补读显示参数。13项适用的目录登记更新本次测试指纹，层级判定沿原范围保存，本批沿当前安装候选完成验证。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-s.json)

### 当前原离线恢复接线与消息文本修复

**UIF-44补齐原离线清理的恢复接线。** 正常ReadingOfflineHost在独立目录投影读取成功后，仍可能保留原清理结果未知的事实。当前文字阅读宿主复用现有恢复分组递送离线DTO及核对、继续回调，ReaderShell补齐文字和漫画两条装配。漫画继续使用已有下载popup和阅读内下载sheet的有界Scroll。回调复用原presentation、generation、前景和当前阅读或目录资格，漫画下载sheet另核对当前panel及opening。原操作确认与继续资格仍由ReadingOfflineHost拥有。[当前代码及准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

**UIF-45修正清理回读中的下载进度归因。** 首次原生样本显示未知清理提示被替换成部分下载结果，夹具还错误使用了空session条目。夹具已改用实际64条目录输入。有效session的真实Host负例另证实清理操作会取得章节下载进度，当前Host仅为下载操作更新进度，投影兼容旧清理快照中已有的progress。真实下载的部分完成文案继续通过准确用例核对。[原始失败与定位](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-native-r-initial.json) [修复回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

**UIF-46修正动作预留行被三行上限截断。** 首次原生popup内，业务标题后的装饰预留空间被Text的maxLines3裁掉，正文与动作发生重叠。当前已适配的业务标题可绘制其真实动作预留行，长业务正文继续沿现有三行折叠和展开入口。准确SDK用例包含32个样本，冻结旧maxLines的行为负例保留失败。[当前源码与SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

当前完整ArkTS编译、指定minliny_HarmonyOS证书签名及远程VM保数据覆盖安装通过。运行提交为20443d1b，候选为0.2.0.DEV.d61901614df1，不可变run为20261115T073103Z-20443d1b-3a66831a，已签名HAP的SHA-256为ccb23e54acc5e880800587a318f2894f2f10de70ddc1a749ed917e8f48e98074。641个运行输入与候选逐字节匹配，包含273个ETS和368个TS。Core及Reader-UI pin沿原值。首次两个编译前入口失败、首个原生布局失败和驱动入口失败均保留各自结果。[不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T073103Z-20443d1b-3a66831a/manifest.json) [当前源码绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-r.json)

前批在重启前的VM上完成正常BookDirectoryPage下载popup的有限原清理场景。当时VirtualPixelRatio为3.5，DensityInCurResolution为1，状态栏窗口58px，布局结论保留该实际环境。两个原生恢复Button1452、1458高154px，对应44vp。原清理保持同一presentation和generation，独立可用内容回读成功后继续显示未知事实。实际核对进入忙态，两动作禁用，重复触摸后最终query计数只从2增到3。实际继续进入secondaryBusy，重复触摸后最终continue计数为1，准确有限回执将原操作推进为confirmed，rawOriginal清空，共享提示退休。正文及两动作实屏已查看。[当前原生按钮与原操作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-offline-recovery-r.json)

一次驱动错误将同步发布的busy观察误作异步gateway计数已更新，原会话保留FAIL。源码确认Host先发布recoveryAction，再await pendingClearOperation，计数在后续gateway调用内递增。后继沿同一PID及同一原操作补齐重复触摸和确认步骤，当时正常启动回到书架，VirtualPixelRatio保持3.5，完整系统显示随后经授权正常重启恢复。该场景使用独立真实Host和有限公共回执端口，Core请求计数始终为0。正常文字阅读和漫画阅读宿主的完整原生动作、焦点及读屏矩阵继续由agent补齐。[观察顺序归因](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-r-native-observation-failure.json)

21项登记更新本批实际变更的源码和测试指纹，原层级判定保持。引用检查0诊断，登记检查仍为37项既有诊断。完整E2/E3和整页visual保持各自原有条件。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-r.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-r-contract-refs-01.json) [登记判定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-r-register-01.json)

### 前一批空结果续读与短页查询滚动修复

**UIF-42修复已确认空结果后的读取装配。** 原Surface将visibleTotal为0视作无保留内容，再次搜索进入pending或failed时选择居中状态Column。短页查询已由真实Grid前缀承载，该分支会移走前缀消费者。当前保留已有view与native prefix的消费者分支，加载和失败继续通过原emptyBuilder进入Grid空态item，重试复用当前读取代次及拒旧能力。新鲜SDK分支见证确认旧实现缺少消费者，当前实际Grid Builder验证加载状态的递送。早期见证02使用的工具没有模拟分支移除，该次PASS没有作为保留演员依据。[当前10项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/empty-query-code-q.json)

**UIF-43修复短页输入后的顶部滚动。** 首次VM输入发现查询被滚回视口之外，当前方法见证确认applySearch每次输入都会安排scrollEdge Top。短页流内查询现复用onListUserScroll取消旧顶部及当前行定位任务，保留用户正在编辑的位置。完整覆盖工具栏继续沿原顶部滚动入口。有限读取夹具还修正了不同查询复用viewId的错误，当前两个明确查询拥有不同的公共viewId。首次候选35c4的观察保留原输入边界。[当前10项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/empty-query-code-q.json)

当前候选的完整ArkTS编译和指定证书签名通过，640个运行ETS/TS输入与不可变候选相同。远程VM保数据安装成功。10项准确代码与SDK用例通过，覆盖空态装配、当前重试、旧代次、卸载、短页滚动及原有忙态和Grid索引合同。[完整编译与签名](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-build-02.log) [当前源码候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-q.json)

当前原生证据在366×168vp、系统字号1的同一个有限语义目录演员内取得。TextInput285和Grid244跨过MissingA空结果、MissingB未完成读取、明确失败及输入法Back，焦点依次为true、true、true、false。原读取在14:19:53.534进入pending，14:20:05.537记录失败。当前原生重试随后得到Ready空结果，清除搜索恢复普通章节读取，原生headerBack回到菜单，普通启动恢复书架。当前owner的intentCount保持0。[当前原生状态与动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-empty-query-q.json)

查询可见时，读状态正文位于短页视口下方。失败正文、重试、后继空态正文和清除按钮按各自滚动位置核对可达，正文与动作的完整可见位置分别记录。原生字段与网格身份、读状态回执、正文动作可达及实际读屏继续沿各自证据范围保存。该场景使用明确有限公共读取回执，Core过滤和正常换源提交保留原范围。[当前原生状态与动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-empty-query-q.json)

本批前七个driver会话保留FAIL。它们包含初始未滚到查询、夹具viewId、追加输入、成功输出误匹配、隐藏Text选择器、返回查询方向及日志mount时效前提。各会话已有准确断言逐项复用，后继只补缺席步骤，最后会话PASS_SESSION并恢复书架。登记首次刷新漏了两个测试输入，共26条漂移诊断，当前已按原批次修订补齐。13项目录登记更新实际输入，8项Book消费者增加准确原生范围，现有整层判定保持，引用检查0诊断，登记继续保留37项原诊断。[当前登记引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-contract-refs-02.json) [当前登记判定检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-register-02.json)

### 当前换源目录忙态、短页首行与测量归属修复

**UIF-40修复漫画换源目录的忙态投影。** 正常MangaSourceSwitchPresentation已按当前selection合并章节准备请求，ReaderSourceSwitchSurfaces此前漏传该事实。当前沿原owner递送selectionBusy，语义及平面目录的原生行资格与保留回调同时读取当前忙态，提交前Back继续使用原取消入口。准确方法场景进入真实Gateway的一次有限未完成进度读取，检查当前页面演员更新、重复合并和Back，原书籍身份保持。[当前代码与9项准确用例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-switch-code-p.json)

**UIF-41修复短页目录的偏移容量和滚动归属。** 当前168vp父槽不足以容纳首尾native offset，List接口约定和Grid的CalcContentOffset均会在容量条件下归零。原生观察中，目录行因此与覆盖摘要重叠。首次加入真实List留白后，独立覆盖工具栏仍在进入可见带时挡住下层拖动。当前短页平面List和语义Grid均沿原prefixBuilder装配实际摘要、工具、流内页脚及原生首尾item，页头继续固定。Grid只平移native索引及span，Core rank、目标与原证明入口保持原定义。当前行定位按实际剩余高度限制默认间距。[平台Grid偏移实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/pattern/grid/grid_layout_base_algorithm.cpp)

平面、语义及固定槽分别持有当前工具和页脚测量owner。旧平面退出后，当前语义Grid的实际帧仍可发布工具和页脚高度。无当前章节的夹具已修正undefined误命中group的错误，显式chapter0继续定位实际章节。旧adaptive-footer用例在已删除的mangaToolHeight处提前失败，现已迁移到当前PageScaffold、geometry及原生Area回调，覆盖固定/流内唯一页脚及保留演员。当前9项准确选择用例形成通过记录，20个显式属性或行为失效负例被拒绝。全部测试范围沿各自真实生产方法、SDK和有限端口记录。[SDK、原夹具错误与旧用例修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-switch-code-p.json)

当前VM在366×168vp、系统字号1下补齐两条首章路径。语义Row309完整边界为[393,1449][888,1536]，平面Row1217为[393,1452][888,1539]，均位于当前页头下方。首次选择后保持各自原生身份，enabled变为false，重复触摸的owner意图计数均为0→1→1，两次页头Back均回到当前Root。流内页脚在真实GridItem及ListItem内有完整文本样本。此前全高语义/平面第4章，以及原生查询→筛空→共享清除→IME Back→页头返回，继续按各自91de/eac候选保存。该查询保持TextInput1181与List621，选择意图始终为0。[原生首行、忙态、流内归属及查询证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-switch-p.json)

当前运行代码提交为`db3cea00`，测试迁移提交为`2783854c`，已安装候选为`0.2.0.DEV.e204cd67520d`。完整ArkTS编译、指定minliny_HarmonyOS证书签名、保数据覆盖和启动通过。不可变run为`20261115T053552Z-db3cea00-edb16804`，HAP的SHA-256为`0b136de041581b26505b7024b9980561b6a99ac9fb23c3178a43952e554e4126`。640个运行ETS/TS输入与当前候选匹配，测试迁移发生在运行输入之外，沿用该包。VM已恢复普通书架，本批会话均已终止。[运行输入绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-p-final.json) [不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T053552Z-db3cea00-edb16804/manifest.json)

本批保留初始夹具、首次偏移修复、工具覆盖命中、语义首行及驱动对齐失败。固定步长曾在首行的可见窄带两侧往返，后继按实际行、页头和viewport中点分配最后一段拖动，再补未派发动作。完整登记的E2/E3、视觉、读屏及正常原始业务条件继续保留。目录其余动态状态、实际可执行主题和方向格、正常宿主动作的缺席证据继续由agent核对。当前没有等待用户作出的实施决断。

### 前一批下载状态、布局与触摸边界补证

本批沿既有DEBUG入口增加9种下载状态输入，包含读取中、空书架、读取失败、保留内容失败、原操作待核对、核对读取中、筛选为空、章节投影读取中及章节投影失败。实际SharedDownloadPage消费正常公共props及initialViewState，管理、选择和弹层继续由页面拥有。有限内存owner按正常Host的loading/error、恢复generation和按书籍合并读取规则发布事实。9项准确选择用例通过，原菜单属性及测试提取器的两次失败按原日志保留。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/download-state-code-o.json)

原VM已完成9种状态的准确观察。读取失败重试接纳一次，清除筛选恢复当前查询且没有新增业务意图，章节投影失败的两次实际重试合并为一个未完成读取。未决恢复保留原操作尚未确认的事实。普通及168vp父槽的书籍和章节浏览、固定管理栏、流内管理栏均已核对，实际全选分别从0到12本书及0到18个条目，Back回到当前菜单。该结果覆盖6个登记上下文的所列布局和当前状态输入。[状态、实际List归属与回调](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-states-and-layout-o.json)

**UIF-39修复忙态恢复提示的触摸穿透。** 基线10a5d58d已使用Transparent提示外框及覆盖祖先。实际168vp下载恢复提示中，禁用按钮拒绝重复业务动作，下层搜索框仍获得焦点。首次把提示及分组外框改为Default后，原生复验继续失败，两个Transparent祖先仍让下层参与命中。后继将层级命中边界放在拥有手势的有界Notice Scroll上，使用当前最低API23支持的BLOCK_HIERARCHY，子按钮及Scroll自身继续参与，命中结果向外阻断低优先级层。平台源码按子节点返回结果决定后续兄弟遍历，相关节点自行收集手势后再返回层级边界。[平台命中实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/frame_node.cpp)

3项准确SDK用例通过，覆盖外框、分组、忙态回调、正文及动作容量、旧回执拒绝。恢复原Notice Transparent、Group Transparent和有界Scroll Default的3个负例分别失败。当前原生366×168vp父槽中的Notice Scroll高62vp，原正文可读，实际滚动后动作完整可达。原生按钮297首次刷新后禁用，意图计数0→1→1，下层输入在三次断言中均未获焦，捕获中均无IME面。随后一次实际Back返回当前Root。UITest对该Scroll的枚举字段仍输出Default，实际层级策略的依据沿编译输入及行为对照保存。[UIF-39原始失败、修复与原生回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/recovery-hit-boundary-o.json)

当前生产提交为`a3d84a63`，已安装候选为`0.2.0.DEV.6c87d094e03a`。完整ArkTS编译、指定minliny_HarmonyOS证书签名和保数据部署通过，HAP的SHA-256为`b8cd4e9fc0a258bf804f6430df92677dcb1bc284fdade95d5e24f071e4654bdb`。640个运行输入均匹配不可变候选，其中273个ETS、367个TS。与首个下载状态候选相比，只有Notice及Group两份运行源码变化，其余638份同字节。此前状态和布局结果按其实际输入范围复用。VM已恢复普通书架，所有本批会话均已终止并释放租约。[源码绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-o-recovery2.json) [实际输入复用](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/download-input-reuse-o.json)

本批保留了首次命中修复的原生失败，以及等待参数、启动后入口时序、Back参数和滚动查找方向的脚本失败。后继只补尚未派发或尚未获得的准确问题，已通过的状态和选择动作沿原回执复用。当前完整E2/E3及整页visual判据保持原结果。目录换源的准确装配和未覆盖状态继续由agent核对，原稿、声音、精确字号、真实窗口改高、连续像素和历史同期材料沿既有证据条件保留。当前没有等待用户作出的实施决断。

### 前一批书源编辑器回执恢复补证

本批生产提交为`852c2d2d`，沿既有DEBUG场景表补齐“保存已确认但回读失败”和“保存回执未知”两种编辑输入。输入按正常SourceToolsOrchestrator的readBackEditor/publish发布editorReadback、editorOperation、receipt、反馈事件及消息，正文使用实际共享SourceToolsPage。一次当前内存核对将读取阶段推进到reading、busy=true、回读代次加1，并保留原confirmation、草稿及编辑代次。6项准确选择用例通过，包含2种确认事实×2条恢复回调、旧编辑/操作代次、禁用编辑保存取消、重复及退休拒绝，既有菜单冻结输入负例也被拒绝。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-editor-recovery-code-n.json)

完整ArkTS编译、指定minliny_HarmonyOS证书签名及保数据部署通过。当前候选为`0.2.0.DEV.00d04806261d`，HAP的SHA-256为`d5bb1a2ba07dd4c0328af0c66228404da8b01a6ca0e727094c15e0e6d7bafc2b`。640个运行输入与不可变产物匹配。与前一候选的输入快照比较只有本批DEBUG夹具1个文件变化，其余639个运行输入字节匹配。此前8种准确原生状态按原b556身份和范围复用。[当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-n.json)

当前VM在366vp宽、系统字号1下完成两种编辑恢复。已确认场景的原生重新读取按钮342接纳一次，进入reading后该恢复按钮退出，TextArea334、取消336、保存339保持原生身份。未知回执场景由共享核对提示接纳一次，TextArea917、取消919、保存922保持。两条场景的251字节草稿及编辑代次1保持，owner意图计数均为1→2→2，最后一步为实际点击禁用保存，增量0。回读代次均为1→2→2，confirmation分别保持confirmed和unknown。当前事实停在读取中，完整业务的最终读取及持久化结果继续使用各自证据。[两条实际恢复与禁用保存回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-editor-recovery-n-00d0.json)

移除确认与More的现有源码和旧能力取证已复核。移除内容读取当前主窗口高度及安全区，metricsRevision驱动订阅已存在；More第二锚点由topBarVisible=false及home输入准入。此前WMS、UITest、DisplayManager帮助及实际最近任务路径尚未提供已达成的同宽主窗口改高操作。单独改变页面内容高度的已有样本按其实际父槽范围使用，准确主窗口高度及短窗口More条件继续保留。该项没有产生用户决断要求。

### 前一批书源工具八状态与停止回调补证

本批生产提交为`6323d632`，沿既有DEBUG页面结构入口增加8种有限内存输入。读取中、空列表、保留列表读取失败、空列表读取失败、未知回执、原操作未确认、原操作待清理及检测运行均使用现有fact投影器和实际共享SourceToolsPage。原默认内容与旧入口位置保留，菜单当前presentation、字体准入和退休回调继续受既有条件约束。6项准确选择用例及2个历史失效负例形成通过结果。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-state-code-m.json)

首次候选`0.2.0.DEV.56d54d918fda`暴露了本批夹具输入遗漏。4种读取状态缺少正常Orchestrator发布的loading/current事实或失败feedback事件及消息。当前按正常open/reloadManagement链补齐，旧截图只保留其实际正文和动作资格范围。后继完整ArkTS编译、指定证书签名和保数据安装通过，当前候选为`0.2.0.DEV.b556c020a81d`。640个运行源码输入与不可变候选逐字节匹配，其中273个ETS、367个TS。[源码与当前候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-m-corrected.json)

当前VM完成全部8种状态。保留列表的刷新列表及空列表失败的重试分别接纳一次当前内存核对意图。未知回执显示现有投影器的“等待核对”，核对动作接纳一次。原操作未确认和待清理的长提示均完成展开，全文及核对、继续或继续清理、收起在当前宽度和字号下可见。核对和继续分别各接纳一次当前owner意图。有限内存端口按设计继续保持未决事实，原业务写入、文件出口、真实取消及完整读屏语义沿各自条件验证。[8状态、原生目标及动作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-states-m-b556.json)

运行→停止中保持7个原生Button身份3152、3155、3158、3161、3164、3167、3170。运行时仅停止动作可用，实际点击原生3161后意图由0到1，7个按钮全部禁用；再次点击同一禁用按钮，计数保持1。实际根宽366vp，系统字号1。两类原操作长提示的展开范围限定于该当前高度，短瞬反馈在普通树及截图采样前已收起，其视觉和语音结果仍需对应证据。

原生脚本在进入最后运行场景前曾因菜单末项被平台树省略而失败，未派发运行或停止动作。已有树明确显示Root菜单及被裁切的前一项，脚本现允许在唯一当前Scroll内向下有界查找缺席项，保持4次滚动及45秒上限。随后只补缺失运行→停止及禁用重复点击，恢复普通启动入口并释放租约。首次脚本失败与补跑结果分别保存。完整E2/E3、整页视觉及其他高度/字号条件保持原判定。

### 前一批书源工具批量动作与导出确认补证

本批复用已安装的`0.2.0.DEV.d6005e1cdf9a`完成当前内存内容场景。启用→停用→检测的原owner意图依次为2、3、4，七个原生批量Button身份201、204、207、210、213、216、219保持。当前实际根宽549px对应owner回执366vp，六十六像素高的动作对应44vp。清空选择后，全选保持可用，六个依赖选择的按钮全部禁用；实际点击禁用的启用按钮，owner计数保持5。[本批原生动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-actions-l-d600.json)

原生导出确认的取消保持计数5，后继准确焦点检查后Enter确认使计数到6。另一次当前场景取得删除内存意图、首行调试及导出全部的回执，均按各自一次实际接纳记账。删除及导出业务回调使用既有有限内存端口，正常业务持久化和文件出口继续保留各自范围。首次标题选择器因共享Button隐藏子Text而在点击前停止，已按实际七动作卡及源声明顺序定位。另一次外部焦点断言失败后编排仍发出了Enter，实际接纳一次内存导出，原截图cancelled命名失实。该次失配原样保留，后继按键派发入口增加当前原生确认框、准确焦点及enabled检查，真正取消和确认分别使用独立回执。

该批曾登记8种状态缺少准确DEBUG入口，本批已完成输入装配与当前VM的有界状态/动作补证。完整E2/E3及整页视觉、读屏和适配条件继续保留。[状态入口源码对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-native-state-entry-review-l.json)

### 当前几何、重试与目录换代修复

当前生产提交为`0e55a34c`，本批修复代码提交为`fdf383b0`。本批修改4个生产UI文件，5项准确选择用例和4个历史失效负例取得通过结果。完整非增量ArkTS编译与指定`minliny_HarmonyOS`证书签名通过，当前候选`0.2.0.DEV.d6005e1cdf9a`已保数据安装并启动。640个运行源码输入与候选逐字节匹配，包含273个ETS和367个TS。[本批准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ui-layout-retry-results-k.json) [当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-k.json)

**UIF-36修正搜索筛选的窗口几何续接。** 原sheetBody把一次计算的SearchFilterGeometry对象传入六层Builder。相同布局分支下窗口缩窄时，两个已挂载分组继续保持284vp，当前应为264vp。当前消费处直接读取既有几何缓存方法。准确SDK覆盖inline/stacked及fit/scroll四种组合，检查八个当前分组宽度、四个堆叠标签宽度和四次当前筛选动作。冻结几何对象的旧实现负例被当前宽度断言拒绝。[原几何失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-filter-geometry-01.log) [几何回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/live-layout-retry-k.json)

**UIF-37修正验证页连续字体失败后的重试。** 原attempt按值传入，第二次失败后仍携带第一次attempt，第三次重试被拒绝。当前fontAttempt使用State，并以当前attempt为实际PageState动作建立子树身份。两次有限失败后第三次准备成功，旧attempt、旧菜单及退休owner的回调继续被拒绝。[原字体重试失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-fixture-font-retry-01.log) [当前重试与拒旧回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/fixture-font-retry-k-final.json)

**UIF-38修正Full目录的保留Tab。** 原默认参数捕获首次layoutPresentation，而tab的PropWatch每次调用openList都会换代，第一次切换后返回章节被拒绝。Full默认参数现读取当前代次，Short头部继续捕获自身ForEach代次。SDK检查三次切换及旧Short回调拒绝。当前VM的同一内存夹具完成章节→书签→章节→书签，两个原生Button身份110和119始终保持，三次原owner意图回执依次为1、2、3。该次内容实际宽315.33vp、高620vp，系统字号1。[原Tab失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-directory-tabs-01.log) [SDK代次回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-tab-renewal-k.json) [原生三次切换](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-tab-renewal-d600.json)

完整编译另检出了前一批UIF-29徽标的类型错误，colorRole原声明为string，公共颜色接口要求ReaderAppColorRole。当前复用已有联合类型，四个注册角色与当前主题行为保持原合同，准确徽标回归及冻结日间色负例通过。首次编译失败原样保留，后继完整编译和签名成功。Short既有回归还使用旧固定prefix高度及64vp行断言，已按当前minHeight及40+20=60vp的大字回退配方修正，准确short-sdk通过。[首次完整编译失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-build-01.log) [类型修正回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/import-formats-k-typed.json) [完整编译与签名](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-build-02.log) [Short回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-short-sdk-03.log)

原343个显式原始参数候选现对账为32项修复、311项已有正常宿主/键/身份生命周期依据、0项待核对。额外37个有省略参数调用的默认参数完成核对，其中1项Full目录失效已修复，36项有固定角色、稳定对象、路由准入或原生打开代次依据。Index的runtime在EntryAbility中先安装，启动准入完成后才装配Index，SearchHost为只读实例。SourceTools日志由正常checkSource整批发布，每条均绑定source/trace/request身份。这些结论限定于逐项登记的当前生产入口。完整页面语义和原生矩阵继续按原条件关闭。[343项生命周期对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-parameter-lifetimes-k.json) [37项默认参数对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-default-parameters-k.json)

当前书源编辑器原生验证完成。TextArea540获焦后显示系统输入法，Back收起输入法并保留同一原生编辑器及251字节草稿，显式取消移除编辑器并保留批量已选3项。最后原owner记录cancel-editor、editorRevision2、intentCount4。此前过早启动采样、错误诊断枚举和已选0的前提失配均保留，前提失配在编辑动作前停止，后继沿实际已选3继续。[输入法返回与取消](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-ime-cancel-d600.json)

13项正式登记的变更输入及一次修订已更新，引用检查0诊断，登记检查继续保留37项原验收诊断。当前Figma准确节点接口再次返回403及Token expired，冻结目录原稿和完整TTS Make V17仍是已有可读输入。用户已批准保留紧凑布局，容量冲突继续保留其原关闭条件。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-k.json) [当前Figma接口回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-api-k-20261115.json)

漫画的当前原始原生失败已补齐。正常书架按准确source/book身份进入现有漫画，一次原操作在10:42:28.803返回当前网络无法解析书源域名，10:42:28.843记录Manga image unavailable NETWORK。界面显示章节加载失败及原重试/换源入口，本次未派发后续重试。此前标题选择器命中同一书架演员内两个保留Text，在点击前停止，后继改用已有原生行身份。当前可把该次失败定位到域名解析阶段，健康图片内容、保留头部与连续绘制仍沿原条件保留。[当前漫画原始回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-manga-original-result-d600.json)

### 当前未决内容与关闭条件

- 全应用正式登记仍有37项诊断，其中E2完整交互21项、E3适配5项、G-03视觉依据8项及SCOPE范围3项。各页全部目标、动作状态、字形、裁切和读屏语义的逐格证据继续由agent补齐。本批与历史原生场景均按各自准确输入及行为范围登记。
- 独立整页视觉依据继续按原图、原稿版本及当前页面状态对应。目录冻结层级与TTS Make V17已找到，当前Figma准确节点403只影响远端当前版本读取。冻结资料支持其已覆盖尺寸及比例，其余整页G-03条件保持。
- 用户已决定保留紧凑布局。目录工具、行及TTS Quick的44vp容量冲突保留具体槽位核算，命中与相邻响应分别使用实际可达证据关闭。
- 当前暴露的系统字号滑块最高第5档实测1.45，第4档已补证为1.3。1.3的八个基础初始样本及Source分组和恢复已有本批准确原生依据，其余状态和变体继续推进。实际1.6与2的输入路径仍未建立。对应有限SDK几何样本保留原判定。
- 移除确认的实际纯高度变化及部分More回退锚点尚未达到准确运行前提。源码高度依赖修复与准确方法回归已完成，原生后果按实际窗口行为单列。
- 当前读屏接口可记录client/window身份，普通UITest扩展项只返回uniqueId。完整spoken名称、role、实际语音队列及短反馈听觉结果仍缺对应可观察回执。
- G05需要连续实际绘制帧。已有两次平台录屏调用均未获得实际授权及STARTED，独立C接口也未建立有效创建结果。G10需要历史异常同期原始录像、trace或绘制数据，沿用户确认的现有资料边界保留。
- 现有漫画资料在当前VM的一次原始请求中域名解析失败，健康内容路径的关闭仍需可用的既有输入或环境。当前失败阶段已有原生回执，历史主机输出与当前结论各自保存。

### 前一批列表行、实体动作与时序索引修复

该批生产修复提交为`8771b09f`，当时修改3个生产UI文件。4个新增准确SDK用例及2个既有准确回归形成通过证据，含13个按最终属性或动作参数拒绝的负例。当前代码相对有效部署回执绑定的`0.2.0.DEV.2d056e9641ba`有19个生产ETS文件变化，当前完整工程编译、签名及本批VM验证待执行。[本批用例与准确复用范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-j.json)

**UIF-33修正RSS其余两处Repeat行。** 全部条目与订阅管理的同键行在DTO替换后都实际保留“旧标题”。当前两个父ListItem把当前item和index递送到保留行。回归覆盖当前文章标题、摘要、日期及实际选择回调，管理行的名称、来源信息、Toggle输入值、行分隔和出现回调索引。两个行身份记录在同键更新中保持，四个旧DTO或索引捕获负例被拒绝。RepeatItem调度及Toggle输入采用有限平台port，原生复用、焦点及绘制继续按各自条件验证。[全部条目原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-source-01.log) [订阅管理原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-management-01.log) [当前管理行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-management-rows-j-final.json)

**UIF-34修正复用管理行的实体动作。** 源码见证把同一行的当前实体从initial换到current后，查看、编辑、刷新、删除四个已保留动作都仍递送initial。当前actionBar接收当前实体getter，四次SDK回调分别递送current。旧Toggle实体回调在该变化后继续被身份条件拒绝。该场景采用有限的同节点实体替换及公共动作构造回调port，RSS按现有L0条件登记。[四动作原实体失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-actions-02.log) [当前实体及旧Toggle拒绝回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-management-actions-j.json)

**UIF-35修正书架保留行的动效位置。** bookRowRenderKey明确省略行位置，排序可把相同内容的行移到另一位置。原Builder把rowIndex和后续index按值递送，现有动效合同对首行与后续行采用不同延迟。准确见证中，行移出首行后卡片宽仍为109.52380952380952，当前时序应为100。现有数据源增加按行键查询当前位置的getter，位置表与items、keys一起更新，并在同步reload监听器前可读。Row、Card、Cover及CoverLayer沿当前索引取样，位置查询在行移除后返回原捕获值，供该节点的剩余绘制使用。回归覆盖0→1→0的位置变化、同一节点身份、卡片宽度、封面及图层圆角、同步监听器读取和四个捕获负例。测试使用实际生产时序常量及方法，原生曲线以有限线性接口递送，原生LazyForEach移动和连续合成继续待验。[原行时序失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-shelf-index-02.log) [当前位置与同步一致性回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-shelf-row-index-j.json)

既有bounded-badge准确回归通过36个样本，RSS主题图标准确回归及4个负例通过。未选择的旧view-handoff脚本仅调整对应私有参数签名，保留NOT_RUN。原登记引用检查为0诊断，登记检查结果为FAIL、37项诊断。[角标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-badge-01.log) [RSS图标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-theme-j.json) [正式登记检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-register-01.json)

343个后续参数调用现有29个已修正，220个按固定值、键控身份、捕获的owner代次或当前ID查询建立源码依据，另有94个继续核对。逐组记录当前文件哈希、准确源码锚点及原始调用序号，源码判定范围限于参数生命周期。搜索筛选sheetGeometry对象递送及原生验证页的重复字体失败重试继续列为源码待答项。当前代码工作与后续VM验证继续由agent执行。[参数生命周期逐项对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-parameter-lifetimes-j.json)

### 前一批当前数据、几何与晚到页脚回执修复

前一批生产修复提交为`78b00309`，该批修改7个生产UI文件。9个准确选择用例通过，包含28个按最终属性或真实动作拒绝的负例。该批代码相对已安装候选`0.2.0.DEV.2d056e9641ba`共有18个生产ETS文件发生变化，完整工程编译、签名及本批VM验证仍待执行。代码侧复核继续按原顺序推进。[本批准确用例与复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-27修正RSS当前数据递送。** fatalError从1项更新到2项时，正文原保留1；同名源的原因更新及第二条同名源被原名称键遗漏。当前错误计数及数组读取当前投影，错误行键包含位置、名称和实际原因。feed、refreshing及emptyUnread的订阅列表原保持62vp，当前3项更新到186vp，两个未读条目的范围更新到144vp。同键Repeat的源标题、URL、未读计数、暂停状态和文章标题、摘要、日期及行索引均改为当前读取。回归保留四个行原生记录身份，两次实际选择回调各一次。Repeat调度、索引更新和ListItem展开采用有界平台port，原生虚拟化、裁切及移除绘制仍需对应环境证据。RSS沿现有L0条件登记。[数组原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-rss-feed-01.log) [同键行原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-rss-rows-01.log) [当前行值与动作回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-rows-i-final.json)

**UIF-28修正搜索空结果的关键词和计数。** 实际resultsContent的延迟ListItem挂载后，正文沿保留的ReaderPageState接收当前关键词和已搜索数。准确场景检查1项“原关键词”更新到7项“当前关键词”，两个独立旧值捕获负例均由当前正文断言拒绝。[搜索当前正文回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-29修正导入格式徽标主题色。** TXT、EPUB、MOBI、AZW3继续使用原四个注册颜色角色，消费端按当前主题解析。四个保留Text背景跟随主题变化，冻结日间色的负例被拒绝。**UIF-30修正排版库几何递送。** 两个选择行、四个步进行及八个加减按钮读取当前坐标；有限几何输入下检查同一组节点的纵向及横向更新，并实际接纳一次步进。完整原生字号、字形和连续绘制沿各自开放条件记录。[徽标及排版坐标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-31修正书源恢复覆盖槽的页头续接。** pendingOverlay直接读取当前页面geometry，页头起点60→100时，同一Column的顶部padding更新到100，当前Notice容量由440更新到400。准确回归检查实际父节点和公共Notice参数，长文原生裁切继续按原验收范围记录。[覆盖起点原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-source-overlay-01.log) [当前起点及容量回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-32补齐已挂载书架内容的晚到页脚回执。** 旧footer-propagation在137vp测量回执到达后才挂载内容，覆盖范围只有初次装配。当前先在0值挂载，再沿实际Scaffold→MainTabShell→BookshelfShell→Scene递送137、153、137，有书、空书架及加载状态均检查同一页面子实例的当前Prop。新见证在正常有书分支实际得到0而预期137。Shell的内容槽现递送当前高度getter，Scene在三个页面的Prop装配处取值。该捕获及旧测试顺序在基线`10a5d58d`已存在，追溯到`d8ad88ef1`；本轮修正此前对晚到续接的覆盖遗漏。八个负例保留错误页面、丢失预算和旧捕获的实际失败依据。原测试同时改用独立footerMeasurementKey接纳标准设置页的高度回执。[来源与旧测试覆盖边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/shelf-footer-capture-origin-i.json) [三种书架状态与八个负例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-repair-shelf-footer-03.log)

343个后续候选中，21个调用已随本批修复，322个继续按正常入口、键和生命周期核对。RSS数组及DTO递送属于该原始数值、字符串、布尔清单之外的额外源码范围。书架expandedLayout已追到phoneContent固定false及tabletContent固定true，数值行索引继续独立核对。主导航和设置壳的标准页起点最终传入SettingsPage忽略参数的覆盖槽，当前具体消费事实已登记。已有9项准确结果只支持其列明的方法和有限平台port。15项登记绑定及修订刷新后，引用检查0诊断；登记检查继续保留37项诊断。全应用原生矩阵与后续代码复核继续由agent执行。[343项当前对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-candidate-disposition-i.json) [登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-i.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-refs-03.json)

### 前一批文案、图标与字体修复

前一批代码提交为`47d3c245`，该批修改14个生产UI文件。当前已安装候选为`0.2.0.DEV.2d056e9641ba`，对应已交付生产提交`8801ea4d`。后继代码已完成21个准确选择用例的本地结果，完整工程编译、签名打包及对应VM场景待代码复核继续完成后执行。

**UIF-24修正动态文案、计数、元数据和图标的续接。** 实际SDK复现书架全选接纳后仍显示“全选”、书源检测四计数保留0/0/0/12、漫画及替换规则和RSS图标沿用初始主题、同ID分组名称与选择器保留旧值、书籍元数据标签保留初值、导入结果标题和同操作规则恢复文案保留旧值。当前实际父Builder通过getter或同ID当前记录读取，把当前状态送到保留的原生或共享控件。布局及字体配方继续使用原声明。原48候选中37个动态调用已修正，1个固定删除图标随私有类型调整，10个调用有稳定值、当前读取或代次隔离依据。逐项结果绑定原路径、参数、源码哈希及准确case。[48项逐条对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-candidate-disposition-h.json)

12项准确SDK用例覆盖上述更新和实际接纳，19个历史捕获负例均由当前属性或行为断言拒绝。实际替换规则父行同时覆盖编辑和删除图标。已有9项准确调用、角色、目标和布局回归取得通过结果，含书架多选、保留分组管理、文字及漫画详情的字体和窗口样本。先前已通过case沿其准确方法范围复用。[动态属性与行为回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-labels-h-final.json) [替换规则真实父行补充](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-reader-live-icons-h.json) [准确方法复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-evidence-reuse-h.json)

**UIF-25修正搜索缺书源原因换代。** 正常stateContent从noSources切到allDisabled时，旧原始reason使PageState标题和动作继续保留前态。当前按实际reason建立明确的子树身份，新的标题与管理动作同步装配，旧原因回调保留原拒旧条件。实际状态变化和管理动作均通过SDK，去掉原因代次的负例复现旧标题。[动态属性与行为回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-labels-h-final.json)

**UIF-26补齐书架多选页的晚到字体测量依赖。** 既有selectionFontReceipt检出headerFontRevision已到1而测量代次仍为1，旧100vp页头仍被接纳。提交追溯确认，该遗漏由本轮早先`0810d5f4`测量依赖拆分引入，基线`10a5d58d`的统一换代原会覆盖字体完成回执。拆分后的页头身份只读取视口、系统字号、密度和横向安全区。当前页头增加字体修订，页脚独立读取共享几何及底部安全区。回归确认页头换代2、旧高度退出、页脚代次保持，以及退场后的字体回执拒绝。[字体代次原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-h-shelf-detail-layout-02.log) [字体与独立页脚回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-h-shelf-detail-layout-03.log)

既有测试入口中还修正了历史路径、遗漏的当前编辑代次与原生测量依赖、仅退场直接子组件的处理，以及旧Text框高度和旧布局判据。SourceTools忙碌输入沿现有禁用策略断言，原冻结样式记录保留原内容。详情目录的当前30vp自然内容行和44vp原生动作分别断言。详情的旧高度拒绝采用实际320→319vp宽度变化触发，并额外断言相同输入保持原代次。原失败日志均保留。引用检查0诊断，登记检查保留37项诊断，15项登记输入及其一次修订已刷新。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-h.json)

扩大参数名检查时记录343个调用，包含171个数值、151个字符串和21个布尔参数，涉及身份、代次、索引、几何及正文。后继批次已修正其中21个调用，并补齐RSS错误正文、数组及DTO的当前递送。其余322个调用继续核对。后继编译及未覆盖原生矩阵继续由agent执行。[其余参数候选](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-additional-parameters-h.json)

### 已纠正的遗漏与错误

- TTS Make V17完整原始TSX已存在于仓库。此前列为缺失属于检索遗漏。原Quick四个HTML按钮宽高为28、36、28、28，当前独立响应宽度为39、36、32.5、37.5，高度均44。实际AST及分配回归确认包含原按钮且相邻响应分离。Figma接口刷新403记录保留，冻结原稿继续提供其实际覆盖的依据。[原稿准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-tts-original-02.log)
- 目录旧平面行26vp附属宽度曾被概括到正常语义目录。正常语义路径实际支付44vp宽，Quick32/Full40行高及平面26vp宽分别核对。原始40高裁切行将44高响应投影到40，原相邻目标横向重叠14。获准的紧凑布局及容量冲突继续登记。[原稿与分支对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-original-target-comparison-20261115.json)
- UIF-07由先前popup外壳修复引入，overlay根层级落到Appearance全屏关闭面之下，已修正根zIndex并补真实正常装配断言。UIF-09/10补齐Toggle输入身份及原生代次拒旧。13个焦点回调类中9处关键动作已从onIdle移到onFrame。首次完整编译发现测试错误假设FocusController返回布尔值，现按实际void与BusinessError合同修正。原失败记录保留。默认无诊断日志的正常通用设置连续两次换代，键盘和绿色读屏焦点均保持。[准确焦点回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-focus-frame-03.log) [默认无日志原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-silent-c96f.json)
- 目录验证夹具原来省略当前内存owner的恢复投影，默认只读状态遮住可写场景。现已分别接通Full的`directoryRecovery`及Control的`bookmarkRecovery`，并通过公共port的`NoStructure`进入真实平面回退。首次错接属性名的编译失败和修正均保留。新增入口位于既有DEBUG验证菜单，内存动作保持原owner约束。[最终夹具回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-directory-memory-05.log)

### 本次新增生产修复

**UIF-13修复平面目录的旧行值续用。** 基线`10a5d58d`已经在`onDataChange`后返回相同`row.key`。普通对象行的原生Builder因此保留删除前的书签数据，392f上两次点击都派发删除。当前原生键加入已接纳行值，选章、定位和滚动锚点继续使用业务行键。准确SDK回归检查实际键生成器、未变化行稳定性、删除后的添加动作、下载排队后的禁用及旧键负例。Full和Quick的实际回调均为删除、添加、下载各一次，计数1、2、3，随后下载按钮禁用。原生26vp平面承载之外的行内顶部响应也实际收到回调。[SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-flat-update-02.log) [Full与Quick原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-flat-update-12cd.json)

**UIF-14补齐漫画下载局部状态的消息接入与动效。** popup外层零时长transition已接通，内部首次读取仍使用缺少偏好与前景约束的自绘加载分支。正常阅读→目录→完整目录路径实际出现LoadingProgress813及四个运行中的自定义动画。当前两个父入口继续传入既有reduceMotion，局部加载和无可用操作失败按消息规范复用`ReaderPageState`，`loadingActive`读取当前前景及偏好，ready动作面继续复用公共组件并取得同一偏好。重试经过原父owner、当前代次和失败准入。消息入口已登记，原自绘加载与失败分支已移除。[准确SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-loading-04.log) [popup生命周期](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-popup-lifecycle-05.log) [准确消息入口检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-message-01.json) [共享失败态重试回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-shared-retry-01.log)

5aad同场景trace确认LoadingProgress804实际挂载，八次自定义动画采样均为0。菜单显示实际下载操作，Back关闭popup，随后逐层返回阅读和书架。当前采样、实际像素和完整动效验收各保留其证据范围。首个自动入口在章节尚处加载状态时停止，后继观察沿原在途操作继续，确认当前目录按钮出现后进入目录。原失败没有改写。[修复前原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-manga-popup-12cd.json) [修复后原生对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-manga-loading-fixed-5aad.json)

**UIF-15统一章节批量动作的可用性与实际准入。** 全选已完成章节时，原“下载所选”和“暂停所选”仅按选择数量启用，实际点击却被`sendAction`中的章节事实准入拒绝。这个条件已存在于审计基线`10a5d58d`。当前两个按钮读取当前书籍和精确章节身份，复用原`actionAvailable`，`captureSelection`复用同一份选择证明生成逻辑，实际发送前仍保留最终核验。准确SDK覆盖九组状态、同实例enabled更新、不可用投影、同索引陈旧章节身份及失效owner。原生320×168vp流内栏的完成章节双按钮均禁用，实际点击暂停位置没有新增意图。320vp正常高度固定栏的混合章节可暂停，实际只收到一次`intent-pause-chapters`。动作发生于既有独立内存下载夹具。[准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-selection-sdk-05.log) [实际原生回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-action-admission-a0fd.json)

**UIF-16补齐书源整行换代导致的焦点丢失。** a0fd的第一书源开关经实际Tab获焦，一次Enter接纳false后，原生实例1200变为1654，`focused`变为false，原生代次重新为0。外层`LazyForEach`使用包含enabled及sourceVersion的`sourceRenderKey`，接纳新值会销毁整行和`ReaderToggle` owner。通用设置保留同一组件的通过结果此前没有覆盖这个父级替换。Core的`source_list_entry`对完整Source序列化计算sourceVersion，正常开关值改变也会改变版本。实现同时处理两个字段。外层行键改用sourceId，正文和非Toggle动作槽继续按完整渲染证明换代，Toggle保留组件并读取当前值、当前名称和当前源DTO，原陈旧快照拒绝条件继续完整执行。平台文档说明同键条目复用缓存，当前真实失败独立建立了实际影响。[原生失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-before-a0fd.json) [平台LazyForEach说明](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/arkts-rendering-control-lazyforeach/)

13项准确选择的SDK用例通过，包含当前行键、真实Native Prop换代、两次动作、旧版本及移除拒绝、正常Index接纳和待核对生命周期、原生夹具版本变化、80行安全布局及32样本布局矩阵。原测试提取器遗漏当前方法、几何和生命周期的失败已修正并保留。ba71实际Source内存场景在320vp、字体1下，键盘两次Enter和纯读屏两次双击分别接纳true→false→true，原生代次0→1→2，键盘场景持续获焦。纯读屏三个捕获点的键盘焦点均为false，绿色框均为[632,602,698,668]并覆盖当前44vp响应区。实际内存owner的源版本及动作计数分别为1、2。夹具使用有限内存回执和不透明版本，实际Source页面与共享Toggle参与原生绘制和动作。[实际行与开关回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-source-row-sdk-final.log) [正常Index回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-source-index-final.log) [本次原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-ba71.json)

读屏第一次激活已成功，随后日志断言因启动记录过期而失败。原FAIL保留，后续只执行第二次激活，最终同一PID原始日志保留动作计数1、2及源版本1、2。另发现早先同会话的固定`fixture.log`文件名会被第二次捕获覆盖，第一份保存日志的字节新鲜度无法追溯。实际截图、断言结果和最终双回执日志仍有各自证据。取证脚本已给分组、几何、夹具及前景日志分配独立时间戳，并在解析前保存、检查实际dump及传输输出。一次修改引入的局部变量重名已在语法检查中发现并修正，最终脚本语法通过。[原始失败与保留范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-ba71.json)

**UIF-17补齐公共及页面原生加载指示的活动约束。** 基线14个生产原生构造点中，10处缺少减少动态效果或应用前景约束。原`ReaderPageState`仅消费默认true的loadingActive，`ReaderRecoveryAction`及书源、设置、书架管理、多选、导入、详情和漫画条带占位存在未约束分支。现复用`SettingsPresentation.mount`已有的readerReduceMotion发布键及readerAppForeground事实，补齐原生enableLoading。书源两处保留内容的读取中状态复用公共PageState的inline加载变体，保留32vp指示、10vp横距及原调用方内距。其他消息状态继续使用原公共表面与动作。当前13个构造点、12个文件均有准确AST约束清单，未新增偏好发布链。[反例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-loading-motion-witness-01.log) [当前SDK及构造点清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-loading-motion-05.log)

平台enableLoading=false隐藏动画内容并保留布局占位。忙碌按钮原文字opacity为0，单独关闭动画会留下空白按钮。当前在动效隐藏时恢复原动作标签，busy、disabled、generation及原业务准入继续执行。SDK实际检查三个PageState变体的同实例属性更新、调用方活动约束、失败态重试、忙碌标签与零动作，以及SourceTools真实statusCard两种入口的偏好更新。Source和Tools布局准确回归、Root忙碌场景及两项消息入口检查通过。[平台说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-loadingprogress/) [工具布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-tools-layout-01.log) [书源布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-layout-01.log) [Root入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-fixture-01.log)

正常通用设置→开发者模式→消息预览已完成偏好false/true的相同场景对照。关闭偏好时，忙碌与加载各两次捕获的原生裁切像素不同。开启偏好后，两组裁切各自相同，48×48px页面加载盒只有一种背景色，原状态文案保留；忙碌动作“核对示例”实际opacity为1，按钮仍禁用。八个捕获点保留准确采样范围。首个文本导航误命中系统状态栏“设置”快捷返回，已补应用bundle祖先范围。消息样例按钮的普通树标签为空，首次查找停止后按实际截图及按钮边界继续，原失败均保留。[正常偏好原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-loading-preference-99fb.json)

旧DEBUG书源忙碌场景曾把statusKind固定为idle，只覆盖当时的行禁用。现按真实reading事实传loading，320vp、字体1下实际出现公共行内加载态，32vp盒、10vp横距和保留列表均取得原生结果，11个可见Toggle全部禁用，Root意图计数0。书源工具另补选择3→0→12→0及Back回菜单，三次选择实际回调计数2、3、4，进入时已有一次debug-key输入回调1。该回调与选择分开记账。[当前书源忙碌](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-busy-loading-99fb.json) [工具选择](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-selection-99fb.json)

**UIF-18修复书源工具页选择发布后的焦点丢失。** 99fb上全选按钮经实际Tab获焦后，一次Enter接纳3→12项选择，原生实例203变为466，键盘焦点变为false。批量卡片的父级键包含selectionRevision，书源行的键也包含selected、actionsEnabled及列表修订。当前保留批量控件及同sourceId行的原生实例，ReaderButton的实际属性观察直接读取当前快照，动作激活时生成当前精确选择证明。原batchSelectionAction和sourceRowAction继续拒绝陈旧快照，外层回调保留页面opening及当前实体准入。[修复前实际失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794700149586/result.json) [最终批量SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-batch-e-final.json) [行控件SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-selection-e.json)

准确回归覆盖7个批量和3个行按钮的保留实例、标签与可用性更新、当前选择/列表修订、停止中状态，以及busy、原操作受阻、未知回执、编辑读回、移除实体和退场页面。历史父级换键、旧行标签及旧行键三个负例均实际失败。原布局16行/8环境及固定58高、强制同行负例继续保留，实际外层分配及文字宽度用例通过。旧测试缺少当前方法依赖、误将Text作为可点击载体的失败已修正。完整编译另发现新增文案字典的两种泛型键写法均未通过ArkTS，最终改为显式动作分支并取得完整编译通过。全部失败按原记录保留。[行布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-layout-01.log) [写入准入](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-typography-03.log) [动作分配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-actions-01.log) [最终构建](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-build-04.log)

1c2e已在既有独立12书源内存夹具、320vp、字体1下完成准确键盘验证。全选3→12后原生实例201持续获焦。第一书源12→11→12两次选择中，按钮实例248、251、254保持，选择按钮248持续获焦，三次选择回调计数依次2、3、4。进入时debug-key计数1单独记账。场景结束后恢复正常书架。当前键盘结果沿这些实际选择动作保存，纯读屏后继结果见下段。完整动作状态和全页视觉沿各自验收条件继续执行。[修复后原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-focus-1c2e.json)

本轮在同一1c2e候选另补纯读屏激活。系统读屏四项标志实际开启后，单次全选3→12和第一书源12→11→12的三次物理双击均各接纳一次。五个捕获点键盘焦点均为false，全选实例201的绿色框为[447,470,833,536]，行选择实例248的绿色框为[459,1848,525,1914]，均覆盖当前原生响应区。三个行按钮身份248、251、254保持，选择回调计数2、3、4，进入时debug-key计数1单独保存。实际读屏四项标志已恢复0并回到正常书架。[纯读屏实际结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-reader-1c2e.json)

**UIF-19修复书源编辑器的可用性续接。** 正常saveEditor先发布busy=true，再发布保存或读回事实。原editorCard在只跟随读回恢复布尔值的ForEach内，把enabled原始值传入actionButton。实际SDK见证中，保存按钮初始可用，busy发布后仍为true，业务回调则按当前事实拒绝重复动作。当前取消、保存及核对按钮直接从当前editorRevision、busy、原操作和读回事实读取可用性，实际动作复用同一准入方法并保留opening拒旧。取消和保存保留原生实例，原生输入继续按当前编辑资格更新。[修复前见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-editor-witness-01.log) [当前编辑器SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-editor-f.json)

准确SDK覆盖busy往返、未知回执、受阻原操作、已保存待重读、核对busy、编辑修订和页面退场，原始值捕获负例被拒绝。既有DEBUG工具夹具的保存回调由单纯记录改为接纳一次后保持未决busy，草稿及写入/读回事实分别保留实际内存状态，场景退出结束该样例。新增日志只记录当前busy和editorRevision。夹具准入、原生动作冷态、布局分配及44次字形测量按七个准确case通过。[夹具回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-fixture-01.log) [实际状态日志回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-fixture-02.log) [准入回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-typography-01.log) [布局分配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-actions-01.log)

51ef的实际编辑器中，取消459、保存462和TextArea457的原生身份保持，保存后全部同步enabled=false，251字节草稿保持，重复点击禁用保存位置后，保存意图仍为1次。Root原始回执记录busy=true、editorRevision=1、累计意图4。进入时debug-key1、打开编辑器2及初始editor-draft3分别记账。首次取证脚本在滚动前要求尚在视口之外的双按钮，原生树已证明编辑器打开及TextArea被底边裁切，保存尚未派发。入口改为600px有界外层滚动后沿同一编辑器继续，一次保存完成上述结果，最后恢复正常书架。原失败与采样均保留。[实际编辑器结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-editor-busy-51ef.json)

### Toggle迟到回执与可用性续接的补正

UIF-09后继验证实际进入了纯读屏激活。a679在第三次换代丢失绿色焦点，338的六次纯读屏通过后，混合输入接管又出现真实丢焦。缓冲记录保留当前pendingAccessibility及pendingAfterAccessibility，却停在上一代读屏身份。源码见证进一步复现busy挂载、已排帧期间的恢复锁，以及读屏回执之后、最终键盘帧之前的续接丢失。前序两次通过只覆盖当时的实际时序，原失败逐次保留。

当前修复在当前身份、代次、前景和挂载有效的前提下保留被busy或disabled阻断的键盘与读屏意图。可用性恢复后继续当前回执链。平台接受事件与实际原生焦点回执分别处理，未收到实际读屏回执时仅进行一次100ms重试，卸载、后台、身份变化及已移走的实际焦点继续拒绝迟到动作。最终帧、API结算和重试期间暂不可用的分支均有准确SDK回归。[修复前失败见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-late-witness-02.log) [最终13项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-late-availability-08.log)

测试夹具原来只给本地Prop赋值，SDK内部父来源仍为初始空身份。首次父级更新会额外触发身份Watch，掩盖真实可用性续接。当前在挂载之前同步实际SDK初始Prop来源，再执行真实父级更新。此前一次重试负例的字符串匹配随生产谓词变化失效，现已按实际谓词调整，失败日志保留。

fe1f正常通用设置默认关闭诊断，连续四次实际读屏双击、两次键盘Enter和两次读屏接管均通过。原生实例650→762→764→766→768→770→772→774→776，值依次交替并回到false。纯读屏保持键盘未获焦，混合输入保持键盘获焦，十个捕获点的实际绿色框均位于当前Toggle响应区。实际焦点日志为0字节。八次场景的原生结论限定于正常通用设置和已观察时序，全部消费者及异步时序沿各自条件继续验收。[当前原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-current-fe1f.json)

缓冲诊断由agent选择加入现有DEBUG warm-Want入口，默认关闭。显式buffered模式在回调中只保留有界内存，单owner及全局均最多64条，显式flush后才写日志。原有实时诊断仍为显式开启且最多40条。正常Want文件接收链及release关闭条件有准确回归。

### 已补齐的正常原生路径

| 场景 | 实际结果 | 当前范围 |
| --- | --- | --- |
| 正常设置Toggle | 四次纯读屏、两次键盘及两次读屏接管，原生值与实际焦点保持 | 当前fe1f、默认诊断关闭、当前VM密度1.5。精确场景之外的消费者与时序独立验收。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-current-fe1f.json) |
| 外书未决恢复引导 | 既有零进度本地书的受拒绝手势实际显示Sample EPUB、作者及原书更多恢复路径 | 当前正常书籍和既有原未决事实。只读引导绘制与原操作核对分别记账。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-foreign-bookmark-guide-fe1f.json) |
| 下载筛选，减少动态效果开启 | popup打开，选未下载使4/4变为1/4，恢复全部状态及4/4 | 正常偏好、当前宿主、选值和关闭，含8秒trace。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-download-popup-12cd.json) |
| 书源工具，减少动态效果开启 | 模式搜索→发现→搜索，深度列表和关键词我的保留。返回后原工具按钮focused为true | 正常SourceJourney入口和返回焦点，含8秒trace。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-tools-popup-12cd.json) |
| 阅读顶部More，减少动态效果开启 | 实际菜单打开，Back先关闭popup，随后关闭控制栏并退出阅读 | 正常顶部锚点，含8秒trace。短窗口备用锚点依赖实际高度。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-reader-more-12cd.json) |
| 正常Sample EPUB朗读 | 五次当前会话platform-start，首次距意图1128ms、距dispatch769ms，退出收到停止和释放回执 | 当前系统引擎启动与退出，进度恢复0。实际可听语音独立验收。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-tts-platform-trace-12cd.json) |
| 分组及页头 | 正常分组返回焦点、最大系统字体长恢复提示、102vp页头换高与IME续接已有准确原生结果 | 相关生产输入保持相同，沿原范围复用。[分组](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-wrap-focus-c96f.json) [页头](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-header-continuation-140c.json) |

### 本轮补齐的原生场景

- 缺书名或作者的合法旧V1原记录已接入实际`ReaderDirectoryHost`及`ReaderDirectoryRecoverySurface`的独立DEBUG场景。有限gateway端口只提供内存回执，实际Runtime请求计数保持0。默认字体下，第一次核对、busy重复点击、不可用回执保留原字节及第二次确认后移除均有实际原生回执。最大系统字体档5实测约1.45倍，提示展开后的全文和核对动作可达，busy期间重复点击仍保持核对计数1，确认后当前提示移除。新入口保留既有DEBUG、字体、当前scene和Back归属。[旧记录与最大字号](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-legacy-original-max-a0fd.json)
- 下载已补书籍浏览、书籍管理、章节浏览、章节管理的正常高度及168vp短高度。正常管理栏位于List外，短高度管理栏流入同一List，末尾可滚动到达。全选、取消及Back取得实际回执。前一候选中“暂停所选”可用却无操作的失败保留，UIF-15后继结果单独记录。[本轮账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)
- 同一目录组件已完成章节与书签标签切换、短内容滚走后返回头部，以及122→168→190→168→122vp的真实内容高度变化。实际内容宽272.6667vp，默认字体1。122/168vp使用List内前缀，190vp书签分支使用固定标签及剩余列表预算。所有变体的其他控件、读屏、方向和主题继续保留各自验收条件。[短目录逐场景记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-short-variants-a0fd.json)

- 书源页已补默认、空、忙碌、保留列表读取失败、空列表读取失败、待核对、原操作未确认及已确认待清理八种原生呈现。320vp、默认字体下，可见忙碌Toggle均禁用，保留失败仍有原行，空失败显示重试，原操作清理分支显示对应动作。每个场景Back返回菜单，八项实际面积回执的意图计数均为0，最后回到正常书架。场景使用既有独立内存投影，正常业务写入及完整读屏、主题、方向矩阵继续分别验收。[八状态原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-state-matrix-a0fd.json)

### 候选2d的历史交付记录

- 生产修复提交`8801ea4d`，产品版本`0.2.0`，`versionCode 1000000`。已安装`0.2.0.DEV.2d056e9641ba`，运行清单`20261115T005852Z-8801ea4d-06df1067`。完整ArkTS编译、指定`minliny_HarmonyOS`签名、停止态DB/WAL备份、可弃副本兼容性证明、保数据安装及启动通过。formal FFI一项本次执行、两项合成证据复用，五项兼容性结果通过。signed HAP SHA-256为`7b85ca8d70ba8620d6081e6fca316a52d34cf8cf266a67c374b85c91bfc56285`。[不可变清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T005852Z-8801ea4d-06df1067/manifest.json) [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T005852Z-8801ea4d-06df1067/deploy-vm-6460677a198b-20261115T010046Z.json)
- 第一次部署准备由agent误把远端formal驱动指纹填为本地部署脚本指纹，校验处停止，installAttempted=false，原安装身份及停止态数据回读一致。按实际远端驱动字节修正配置后，在新尝试目录完成上述正式准入和安装，原失败保留。[首次准备失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/deployment/vm-ui-framework-2d056e96-20261115/result.json)
- 候选2d的640个生产ETS/TS运行输入绑定该次不可变编译与签名快照，含273个ETS和367个TS。当时后继14文件变更的完整编译与原生验证尚待执行，当前后继结果已记入本文首节。相对51ef只改变Rules、Discover、Sync和RSS四个保留页面，其他636项字节相同。既有Source、Directory、Download、共享组件和夹具原生结果沿其准确行为范围复用。[当前字节与差异绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/candidate-source-delta-51ef-2d05.json)
- 该候选当时的VM实屏为1280×2832、密度1.5、逻辑宽约853vp。候选2d正常书架、Sample EPUB、作者、章节和继续阅读已核对，四项读屏标志实际为0，该会话租约已释放。减少动态效果false、字体档2、粗细1及界面缩放1沿既有准确恢复证据使用。[当前原生启动结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794704491085/result.json)
- 正式登记保留visual21项NOT_RUN、interaction21项FAIL、adaptation5项FAIL及16项NOT_RUN、Source content原FAIL。本批12个准确SDK及本地case按实际范围记账，新增四项保留页面修复未改变已登记页面根。当前引用与登记检查结果见账本，原633输入审计基线保持冻结。

### 当前仍开放的验收内容

| 内容 | 已建立的答案 | 剩余工作或原条件 |
| --- | --- | --- |
| 实际纯高度变化 | 移除确认长文、末尾双动作与准确高度SDK回归通过。已纠正未进入Recents就推断窗口路线的遗漏，实际停留手势已进入最近任务 | 当前已检查的标题入口只恢复Reader，未取得受支持的纯高度调整路线。移除确认与More短窗备用锚点保留准确原生高度场景，备用锚点由topBarVisible选择。[本次能力检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capability-followup-b450.json) |
| G05连续绘制 | 当前ArkUI/RS trace确认初始正文66→110跨两个UIvsync，命令提交相差6.791ms。新SceneBoard环境的一次公共应用录制亦已执行 | 本次仍进入RequestUserPrivacyAuthority却未见授权面或STARTED，30秒截止释放。已有独立C API创建失败。连续真实像素尚未取得，单帧和trace沿原范围保存。[trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-initial-geometry-trace-c96f.json) [录制实际结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capability-followup-b450.json) |
| 实际自动宣告与声音 | 显式不打断宣告、前景、当前generation和宿主资格已接通，TTS实际平台启动、停止及释放已有结果 | 当前可用采集路线没有取得实际音频。读屏队列、不打断听感、可听语音及未覆盖播放状态仍需相应实际证据 |
| 全应用剩余原生矩阵 | 21项当前登记按正常宿主、变体、原稿及局部结果逐项对账。正常GAP-04既有记录的只读指引，以及缺元数据旧V1记录的实际Host内存端口默认/最大字体原生动作均已有准确范围 | 书源当前值及版本变化的键盘、纯读屏焦点已补本次准确原生证据。平台无障碍服务的-c/-w实际只返回客户端与窗口信息，UITest扩展属性实际只支持uniqueId，对accessibilityText返回Invalid attribute name。原生名称、角色宣告尚无对应读取或声音证据。书源工具的本轮纯读屏选择和编辑busy结果按上文范围使用。全部目标、其他焦点和动态状态、整页字形、裁切、主题、方向及完整变体仍由agent继续逐项执行。旧记录场景的有限端口和真实公共Host、组件、原生动作范围已逐项注明。当前局部通过及真实最高1.45字号均保存准确范围，精确2倍原生环境条件保留。[21项对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registered-design-native-map-20261115.json) [实际无障碍读取能力](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-accessibility-capability-ba71.json) |
| 独立整页视觉依据 | 完整TTS Make V17原TSX及目录原始提取已核对，用户保留紧凑布局的决定继续有效。四工具32宽、Quick32/Full40高及TTS Quick横向容量冲突按批准决定登记 | 书架、搜索、详情和部分二级及漫画完整组合的独立批准来源仍未齐全。最近保存的Figma节点读取结果为403、Token expired，冻结原稿继续沿实际覆盖范围使用。[当前读取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-api-k-20261115.json) |
| 漫画健康正文前提 | 停止态原DB/WAL的同字节可弃副本确认3份旧manifest、18页、3个已驱逐版本，当前head、retention、offline receipt及页请求均为0。旧页记录无法提供当前可读离线章节 | 当前d600的原始VM请求已记录域名解析失败及NETWORK分类，准确回执见本文首节。健康正文场景需要当前有效的实际素材前提。两章缓存目录、popup、返回与原进度证据保持其范围。[存储前提](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/manga-storage-precondition-20261115.json) |
| G10历史Tab归因 | 当前代码与现有历史材料已核对 | 异常同期原始录像、trace或绘制数据仍缺，沿用户已确认的现有资料条件保留 |

**UIF-20补齐保留规则管理页的当前草稿与行数据。** 实际SDK见证确认，普通edit方法更新State后，四个表单的共享输入仍使用初始原始值，同ID行刷新后标题和编辑回调仍捕获旧DTO，三个“启用”开关还共用输入身份。当前四个草稿使用组件opening与各自编辑修订，普通输入读取当前值，程序化预填切换草稿身份，旧输入、开关及保存回调拒绝迟到。五个开关身份分别唯一，行标题、详情、编辑和订阅拉取读取当前DTO，已移除实体禁用并拒绝原动作。准确SDK覆盖15个输入、5个Toggle、3个订阅类型、同ID更新、移除、未决保存与退场，并独立拒绝原始值捕获、旧草稿及旧DTO负例。[规则与分页准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g-final.json) [同ID行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g.json)

规则管理的Index和Surface保留了装配分支。全树追踪未发现调用ReaderExitActions.requestRules的生产入口，SettingsScenes也没有绑定规则管理入口。此前仅凭路由存在写为正常入口属于核对遗漏，已纠正。当前保留分支的代码与完整编译已有结果，正常用户导航和该页原生行为仍为NOT_RUN。

**UIF-21补齐保留发现页的分页资格更新。** 实际SDK中，当前页与可用性已更新，两个保留按钮仍沿用初始false/true。当前按钮按静态方向读取当前presentation，原生enabled、primary、页码及实际方向回调同步更新，loading和退场继续拒绝动作。准确负例复现原始布尔捕获。产品L0准入保持原范围。[规则与分页准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g-final.json) [同ID行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g.json)

**UIF-22与UIF-23补齐保留WebDAV和RSS表单。** 实际SDK确认WebDAV五个字段在配置加载后仍保留初始值，RSS十四个字段在快照更新后全部保留空值。当前字段通过getter读取当前状态，WebDAV主题图标也读取当前配方。实际回归确认已接纳草稿更新、未决期间草稿策略、密码原生遮罩、已确认保存后的两个可见凭据清空、本地已编辑URL保留及busy禁用输入。RSS十四个字段逐项输入均到达当前快照与同一共享控件。两个历史原始值捕获负例均被拒绝。产品L0下这两个完整表单继续按保留分支处理。[表单准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/retained-form-current-inputs-g-final.json)

本批12个准确选择用例通过，涉及两项新SDK入口和四项既有入口。测试提取器、旧Text点击假定、JSON输入依赖和旧36vp断言已按当前真实组件纠正，原失败日志保留。完整ArkTS编译及指定签名候选2d已完成，当前正常书架实屏及四项读屏关闭标志已核对。[共享控件调用回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-g-foundation-consumers-01.log) [JSON与RSS当前入口回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-g-foundation-json-rss-05.log) [当前正常书架](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794704491085/result.json)



后续章节保留前序候选的历史审计、失败、修复与原生身份。当前修复、候选及剩余工作以本节和账本`implementation.completionCorrection20261115`为准。全量目标保持执行中。

## 2026年11月15日前序候选记录

全量实施目标保持执行中。现有授权和紧凑布局保留决定足以继续工作。原稿核对、源码复核、准确回归和VM场景继续由agent完成，当前没有等待用户作出的实施决断。此前完成表述只覆盖对应候选的局部交付，整体验收沿逐项证据推进。

### 已纠正的错误与新增修复

- TTS Make V17的完整原始TSX已存在于仓库。此前列为缺失属于检索遗漏。原Quick四个HTML按钮宽高为28、36、28、28，当前独立响应宽度为39、36、32.5、37.5，高度均44。准确AST及实际分配回归确认包含原按钮且相邻区域分离。44vp全目标冲突继续沿已确认的紧凑布局保留。[原稿准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-tts-original-02.log)
- 目录此前将旧平面行的26vp附属响应概括到了正常语义目录。正常路径实际经过ReaderDirectoryNavigationSurface及ReaderDirectoryNavigationList，原生附属承载宽44vp。展开目录下载目标的左右边缘点击分别仅触发chapter16和18的一次内存回调，旁边禁用书签没有新增回调。平面分支26vp、Quick行高32vp、Full行高40vp及四工具32vp宽度分别记账。原始44目标在40高裁切行中投影高度40，相邻目标横向重叠14。[原稿、分支和实际命中对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-original-target-comparison-20261115.json)
- UIF-08已修复四个bindPopup构造点的原生宿主动效，覆盖InlineSelect、阅读更多的两个锚点和漫画下载菜单。减少动态效果开启时显式支付零时长transition，漫画目录的阅读及换源偏好链已接通，修复提交c6f3d7f1。实际SDK参数、实时更新、拒旧和原popup容量回归通过。
- UIF-09已有真实读屏焦点丢失证据。前几次修复的原生失败均保留。最终生产目标ID绑定inputIdentity及nativeRevision，先等实际键盘焦点回执，再请求当前实例读屏焦点，按实际读屏回执完成键盘续接。默认关闭诊断日志。当前正常通用设置连续两次切换false→true→false，原生实例661→773→775，键盘及绿色读屏焦点均保持，前后像素相同，焦点诊断日志为空。[默认无日志原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-silent-c96f.json)
- UIF-10修复inputIdentity改变时继承旧焦点状态和迟到回调的问题。当前身份、代次、前景、禁用、busy、卸载与迟到回调负例及Source、Settings、Rules、RSS正常消费者准确回归通过。[准确SDK回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-native-id-06.log)
- UIF-11确认13个焦点回调类中仍有9处把关键动作放在onIdle。安装SDK明确该回调仅在帧剩余时间大于1ms时执行。现已移到onFrame，原owner和拒旧条件保持各自约束。13类真实SDK方法通过，父级投递、目录键盘回执与IME续接、搜索生命周期准确回归通过。首次完整编译同时发现测试虚构requestFocus的布尔返回值，现按实际void和BusinessError约定修正，第二次完整编译通过。[13类真实回调回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-focus-frame-03.log)

### 已补齐的原生结果

| 场景 | 实际结果 | 证据范围 |
| --- | --- | --- |
| 正常书架分组关闭 | More→编辑分组→Back后，原More Button重新取得焦点 | 正常业务打开点的键盘焦点。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-normal-group-focus-20261115.json) |
| 分组恢复最大系统字体 | 档5实际倍率1.4500000477，180vp槽内长文案可达末尾，双动作实际收到回调 | 实际生产Notice和内存动作。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-max-font-20261115.json) |
| 分组诊断自身换行及焦点 | 三个按钮的完整标签均可见，320vp换到第二行，实际320vp槽可达。当前onFrame候选关闭生产分组恢复层后，实际打开按钮重新获焦 | 最大可选系统字体，当前候选。错误坐标及错误文本断言记录保留，准确后继场景通过。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-wrap-focus-c96f.json) |
| 实测102vp页头续接 | 260→420vp、IME314vp和Back中页头Area计数始终1，正文避让110vp，间隔8vp | StandardPage实际组件和原生盒。初始66→110vp是否进入可见绘制继续归连续帧检查。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-header-continuation-140c.json) |
| 长移除确认基础容量 | 实际Scroll高570.285vp，长文案末尾及双动作可达，移除触发一次内存意图 | 既有确认宿主。真实窗口纯高度变化继续开放。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-removal-long-140c.json) |


正常Sample EPUB的TTS Quick播放按钮已补原生边缘命中。点击前即时核对可用按钮，点在36vp绘制外框下方、44vp响应区内后，实际会话接收启动意图。冻结启动源仍显示旧状态，实际胶囊及阅读跟随按自身owner解释。原进度0%、语速1.00x、定时25分钟和系统音色均已恢复或保留原值，最后回到书架。后续准备态、真实onStart和可听结果继续开放。[正常TTS原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-tts-paid-edge-c96f.json)

### 当前构建、部署与登记

当前已安装候选为0.2.0.DEV.c96f5e48a87a，生产提交24f7533592cbf6001315663b313baaa0a6a68f91。638个ETS/TS输入全部匹配不可变快照，含272个ETS和366个TS。完整ArkTS编译、指定minliny_HarmonyOS签名、准确停止态DB/WAL副本兼容性证明、保数据安装及启动通过。产品版本0.2.0，安装计数器1000000，包名io.reader.minliny。签名HAP SHA256为183f4fc7196c5c5782edf22d29ab7c14a5797899342b13779aded851b134aca3。[manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/manifest.json) · [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/deploy-vm-6460677a198b-20261114T182249Z.json) · [输入绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-c96f.json)

正式control登记为revision27。当前引用检查通过且零诊断，页面检查保留37项诊断，含21项E2 FAIL、5项E3 FAIL、8项G03 NOT_RUN及3项SCOPE NOT_RUN。visual21项NOT_RUN和Source content FAIL继续保留。仅执行本次选定回归，构建contracts-scope为none，全量套件NOT_RUN。[引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-refs-11.json) · [页面检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-register-11.json)

VM最后恢复正常书架。减少动态效果恢复false，屏幕朗读恢复OFF，字体档2、粗细1和界面缩放1均经实际系统树核对。全部本次租约已释放。

### 剩余工作及真实资料缺口

剩余可执行工作继续留在全量目标内，包含其余消费者和纯读屏激活、可写书签及Quick和平面目录的逐目标命中、TTS其余状态、不同下拉宿主的连续动效、实际短反馈可听宣告、移除确认纯高度场景、21项登记的字形裁切和适配矩阵，以及G05连续帧。当前局部PASS沿其精确入口和候选使用。

为连续帧及音频检查，本次由agent增加显式DEBUG warm-Want公共录屏适配。精确参数之外没有录屏IO，输出限自身缓存，麦克风关闭，启动等待上限30秒，实际录制范围1至15秒。准确生命周期回归及工程编译通过。独立shell C API Create返回null，应用身份已进入RequestUserPrivacyAuthority，首次没有STARTED并在30秒后释放。当前没有可用视频或音频，G05及可听验收继续开放。[能力记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capture-capability-20261115.json)


本次另沿当前包取得两段各8秒的真实ArkUI与RenderService trace。260→420→260vp序列中页头Area维持一次、正文避让110vp。初始装配记录到66→110vp正文Area变化及两个ArkUI命令提交，提交相隔6.791ms。实际显示合成是否呈现前一位置继续开放。[窗口高度trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-geometry-trace-c96f.json) · [初始装配trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-initial-geometry-trace-c96f.json)

用户已接受沿现有资料推进并保留原证据条件。Figma API本次刷新返回403和Token expired，冻结原稿、完整TTS原TSX和桌面来源继续使用。G10历史异常同期录像、trace与绘制输入仍缺。独立整页批准组合与精确2倍系统字体按原关闭条件保留。上述缺口没有产生新的用户决断要求。[完整当前账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 前期子批次记录

以下保留此前日期、候选和局部证据身份。段落中的“当前”沿各自当时的候选解释，本次状态以上节和完整账本completionCorrection20261115为准。

## 确认项继续执行与未决条件更新

已确认的UIF-07菜单外壳层级错误已在9fdf3c67修正，正常Appearance宿主的原生选值、关闭和Back证据保留。先前同节点Toggle候选的原生值更新失败已撤回，当前受控重挂候选沿准确键盘值与焦点证据使用。此前扩大“已批准原稿”的归因和误加“原生页头必须93vp”的门槛均已更正。93vp继续用于显式方法见证，原方案原生场景要求实测高于58vp。

### 本次新增执行结果

- 复用ab7c签装包，进入现有DEBUG下载内存装配。四个状态选项的真实Button完整可见，实际选择“未下载”更新当前筛选值。Back和外部点击关闭下拉后保留筛选面板，恢复“全部状态”后Back返回下载页。[下载原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-selector-ab7c.json)
- 新增一个DEBUG分组恢复场景，经现有诊断菜单装配实际BookshelfGroupDialog、恢复投影和ReaderRecoveryNotice。长文案展开后能滚动到“分组长文案末尾”，两个末项动作均收到实际点击并分别记录当前opening的内存意图。实际容器180→320→180vp时，唯一Notice Scroll为156→296→156vp，展开状态及opening1保留。Back关闭后诊断打开按钮重新取得键盘焦点，最后恢复正常书架并释放租约。[分组原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-recovery-3c5e.json)
- 准确新增回归group-native-fixture和page-structure的group-recovery通过。原12组分组容量SDK样本沿未变生产输入复用。新诊断ETS的完整ArkTS编译、指定证书签名、停止态副本兼容性证明、保数据安装和启动通过。未选择的业务及全量套件保留NOT_RUN。

当前安装候选为0.2.0.DEV.3c5e34ef0c10，源码提交ef88c23f，636个ETS/TS输入与不可变快照一致，其中新增1个DEBUG诊断文件。产品版本0.2.0、安装计数器1000000、包名io.reader.minliny，证书为用户指定minliny_HarmonyOS。签名HAP SHA256为8e4c7a7a17fd9b07f901d15332ad63846fa813786ea1fda41da401298a67f531。[不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T153826Z-ef88c23f-3dce928c/manifest.json) · [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T153826Z-ef88c23f-3dce928c/deploy-vm-6460677a198b-20261114T153941Z.json) · [输入字节核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-3c5e.json)

分组场景使用内存回执和动作适配，生产组件负责实际布局、滚动与输入。记录的reconcile和continue代表当前动作意图，持久化分组事务沿自身业务证据解释。焦点返回证据绑定诊断打开按钮。新增诊断入口沿现有DEBUG及字体就绪准入，由本次实施自行选择。

### 仍未决的具体内容

| 项目 | 当前已有答案 | 关闭仍需的事实 |
| --- | --- | --- |
| 目录与TTS紧凑布局 | 原尺寸与密度有冻结来源，用户已选择保留。目录原始提取含章节附属44×44 HitTarget，工具32vp与行32/40vp的容量冲突已核算 | 逐目标对照原始响应、当前原生可命中范围及邻项重叠分派。四工具扩大需48vp横向容量，行32/40vp也要回答相邻44vp响应如何分派。保留布局决定继续有效 |
| Figma原稿归属 | 目录备份4765:7940与冻结原始提取可追溯。TTS当前应用同步节点和原Make来源已分清 | 逐目标响应与状态的完整原稿对照，原TTS Make交互响应依据。当前API返回Token expired，桌面缓存显示待重连，服务端最新版本尚未确认 |
| 页头测量续接 | 同盒续接、有限补采、拒旧及卸载有方法回归。现有目录和书源IME观察各保留准确范围 | 一处实际可进入且实测高于58vp的页头，在完整高度、IME和窗口序列中的页头与正文原点。93vp为方法输入 |
| 减少动态效果 | 九处接线及目录两条来源已补齐。Tools、Appearance和Download的原生选值与关闭已有记录 | 各不同宿主、偏好中途变化以及连续绘制中的实际动效、焦点与收束结果 |
| 分组与移除确认 | 分组短槽全文、末项双动作和180/320vp容量有新增VM组件证据。移除确认的纯高度依赖有SDK回归 | 正常书架打开点的焦点返回，以及大字号、IME等剩余组合。移除确认自身在纯高度变化后的真实Scroll容量和末行动作 |
| 自动宣告及Toggle读屏焦点 | 前景宿主和generation的唯一不打断宣告通道已接入。Toggle的false→true→false及键盘焦点有VM证据 | 实际可听宣告、打断情况和读屏焦点连续性。现场已记录读屏开关关闭，可听结果保持开放 |
| 全页视觉、命中、字形和适配 | 当前21项E2 FAIL、5项E3 FAIL、8项G-03 NOT_RUN、3项SCOPE NOT_RUN及21项visual NOT_RUN原判定保留。局部通过结果按准确输入复用 | 逐页逐状态的有效命中、字形裁切、完整适配及独立整页批准依据。VM最高实际字号1.45，2倍仍缺相应原生环境证据，Source content原FAIL保留 |
| 连续绘制G05及历史Tab归因G10 | 当前源码和选定端点观察已保存，连续帧判定开放 | G05需要当前过程的连续真实帧。G10需要历史异常同期录像、trace或绘制输入，用户已决定沿现有资料保留缺口 |

此后各节保留截至ab7c及更早候选的审计、修复与原生证据身份。当前交付状态以上述后继候选及完整账本confirmedContinuation为准。

## 本轮复核与纠错

用户继续追问保留项是否已有答案，以及已完成修改是否做错。本次复核覆盖本轮29个生产变更文件的差异及相关正常装配链。保留项仍有未决答案，当前准确清单保存在账本implementation.review20261114.remainingItems。

### 确认并修正的一处新增回归

UIF-07由facf700e的共享下拉修复引入。ReaderSelectPanel新增定位Column外壳时，将原zIndex10留在内层，外壳采用默认层级。ReaderControlAppearanceContent.selectOverlay的全屏关闭Row为zIndex9，同容器菜单根层级因此低于关闭表面。先前overlay回归检查了定位和容量，缺少实际外观宿主的遮罩组合。

补充准确回归使用正常Appearance.selectOverlay Builder、现有共享Panel和实际原生属性。旧代码在菜单根层级断言上失败，恢复定位外壳zIndex10后通过，原12组popup样本及5组select-host回归通过。修复提交为9fdf3c67。当前候选完整ArkTS编译及指定签名通过，635个生产输入与不可变快照一致。

正常书架继续阅读既有本地Sample EPUB，进入界面Quick并展开Full后，真实菜单根Column的zIndex为10，关闭Row为9。点击繁转简使实际owner选值更新并关闭菜单，随后重新选择原文恢复原偏好。菜单打开时Back先关闭菜单，同一外观触发器继续挂载。最后现场为当前候选正常书架，全部有界会话结束。[准确原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-overlay-order-ab7c.json)

当前候选为0.2.0.DEV.ab7c29a4a2d9，签名HAP SHA256为ebe67e8e14d34cbc8663137ad0b39716ccf5978c2e68b6501f59130ada1f62f5。保数据签装、准确副本兼容性证明与正常启动通过。[当前不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T150635Z-9fdf3c67-77a64461/manifest.json)

早先同节点Toggle候选的实际值更新失败已经撤回，当前受控重挂的准确键盘值与焦点结果保留。此前将紧凑布局保留概括为完整批准原稿对照的表述也已更正。其余本轮生产差异在此次复核中尚未确认新增代码错误，其正确性结论沿实际方法、SDK和原生覆盖范围使用。

### 保留项当前答案

| 项目 | 已有答案 | 仍需回答 |
| --- | --- | --- |
| 目录与TTS紧凑布局 | 原始比例与密度有冻结来源，用户明确选择保留布局。目录原提取含章节附属44 HitTarget | 逐目标有效原生命中、裁切与重叠分派，TTS原Make交互响应重新对照 |
| 测量续接与动效偏好 | 原因、生产接线及准确方法或SDK回归已回答 | 实测高于58vp的页头、完整高度/IME组合，各不同宿主动效与焦点 |
| 短反馈宣告 | 当前前景generation平台通道有准确方法回归 | 实际可听、打断情况及读屏焦点 |
| 分组恢复与移除确认 | 有界容量和纯高度订阅的代码及SDK已回答 | 真实长未决分组的末项动作，以及真实移除确认纯高度场景 |
| Toggle换实例 | 键盘两次激活的实际值与焦点已回答 | 实际读屏焦点及其余原生消费者 |
| 全页视觉及E2/E3 | 已有局部来源、预算和准确场景均保留 | 逐状态完整Figma对照及批准组合，全目标命中、字形、完整适配与精确2倍字号 |
| G05与历史G10 | 已有源码及选定端点记录 | 连续真实帧证据及历史坏帧同期原始输入 |

正式引用检查通过且零诊断，登记检查仍为37项诊断，含21项E2 FAIL、5项E3 FAIL、8项G-03 NOT_RUN和3项SCOPE NOT_RUN。visual21项NOT_RUN与Source完整字形及裁切验收继续开放。以上保留项沿各自关闭条件记账。[原问题与实施账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 前次交付记录

2026 年 11 月 14 日，已按用户要求先完成代码侧可执行整改，再完成本轮准确 VM 场景。实施沿用原隔离检出，生产候选绑定 HarmonyOS `facf700e27d9246a234f0203d44d2114d7bc0297`。Core 为 `c078126376294faa3a611690fbe48e79f0f86cc4`，Reader-UI 为 `f206f0db011ae82c5a6e4059769fa3688b9cfcd5`。当前阶段为 CODE_AND_SCOPED_VM_DELIVERED，整体验收沿原条件开放。

### 已完成的生产整改

| 范围 | 当前实现与准确回归 | 本轮原生依据及剩余条件 |
| --- | --- | --- |
| UIF-01 测量续接 | StandardPage、SourceManagement、BookshelfMultiSelect、详情、漫画目录和保留 Discover 按头尾真实依赖续接。有限原生矩形补采覆盖同尺寸换代，迟到、卸载和真实失配继续受拒旧条件约束。standard-page-generation、standard-page-same-area、direct-page-same-area 通过 | 目录查询与漫画的 IME/Back 原点、1.45 倍书源输入及页头连续性已有准确采样。实测高于58vp的页头和全部窗口组合仍按原生关闭条件保留 |
| UIF-02 动效偏好 | 下载六处、书源工具两处、目录规则一处接线完成，详情和阅读内两条目录来源贯通。正常 SDK 装配覆盖偏好、实时变化和回调退休 | 书源工具原生打开、Back、末项选择和实际 owner 更新通过。动效逐帧、下载和目录的完整焦点矩阵继续开放 |
| UIF-03 短反馈宣告 | 沿当前前景宿主及 generation 接入不打断平台宣告，跨宿主同代只认领一次。transient-announcement 通过 | 现有 VM 屏幕朗读开关为关闭。可听、打断情况和读屏焦点保留原验收条件 |
| UIF-04 测试判据 | 最终属性、状态更新和真实动作断言替代 modifier 调用次数拒绝，合法顺序组合与行为负例通过 | 方法与 SDK 结果沿各自范围入账 |
| UIF-05 分组恢复容量 | 实际覆盖槽按窗口、安全区、IME 和 recoveryTop 支付 maxHeight，既有单一 Notice Scroll 消费预算。长文案、双动作、busy、零容量及 resize 回归通过 | 真实长未决分组提示的原生全文、末项动作及焦点返回继续开放 |
| Toggle 条件风险 | 受控重挂后仅对当前先前键盘焦点执行一次有界帧后恢复，拒旧和禁用条件已回归 | af920500e5af 上两次 Enter 后值 false→true→false，后继原生 Toggle 均保持焦点。原偏好已恢复。实际读屏焦点继续开放 |
| 移除确认条件风险 | 补窗口 revision 依赖，实际 SDK 更新路径能重算纯高度变化后的 Scroll 容量。removal-resize 通过 | 精确纯高度变化的真实确认场景继续开放 |
| 目录查询响应 | 既有 50vp 工具栏支付透明 44vp 承载槽，保留 32vp 外框与 Control 30vp、Standalone 32vp 输入配方。48 个查询上下文、42 个目录预算与动作样本和 200 个 Source SDK 样本通过 | 60649f803468 上查询框上下外框边缘均能使真实 TextInput 获焦，IME/Back 恢复通过。当前40bc候选复用该项原身份观察 |

当前生产库存为 635 个 ETS/TS 文件，含 270 个 ETS、365 个 TS。14 个 StandardPage 和 11 个 Scaffold 构造点的框架消费处置逐项对账。20 个路由值、4 个 manifest 根及 L0 准入沿原来源保存。当前候选完整 ArkTS 工程编译通过，635 项生产输入与不可变候选快照一致。后续文档与登记更新沿同一生产输入复用签名包。[代码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-first-review.json) · [候选字节绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-40bc.json)

### VM 新发现与修复

VM 发现 UIF-06。旧候选中，书源工具底部下拉的原生包裹盒为零尺寸，绝对定位内容没有参与平台 popup 避让，末项被裁切且内部没有可滚动范围。ReaderSelectPanel 现按 popup 自然流和页面 overlay 定位宿主提供各自布局，ReaderInlineSelect 支付当前窗口、安全区及 IME 高度。inline-popup-layout、select-host、select-reduce-motion 和 parent-chain 回归通过。

后继候选40bc完整编译、签名及保数据部署通过。默认字号下，平台将底部下拉安置到触发器上方，末项原生 Button 完整可见，Back 关闭后保留原宿主，实际选择“发现”更新 owner 并关闭面板。系统特大档的真实倍率为 1.45，末项 Button 与文字也完整可见，实际选择回调通过。初始失败候选、错误方向及修复后证据均保留。[UIF-06 原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-popup-40bc.json)

### 签名候选与现场恢复

当前 App 为 `0.2.0.DEV.40bc7b38fab6`，产品版本 `0.2.0`，安装计数器 `1000000`，签名 HAP SHA256 为 `9e8741e2073076468b96c7200070c5de1bd61b6182e5d62d2019bdca18eeb38f`。证书为用户指定 minliny_HarmonyOS，包名 io.reader.minliny。iteration 构建及准确交付已完成。contracts-scope 为 none，全量套件结果为 NOT_RUN。[不可变 manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T054448Z-facf700e-15be72a2/manifest.json)

保数据安装在远程 HDC server `192.168.1.10:8710` 的准确 VM `127.0.0.1:5555` 上完成。停止态原库和 WAL 有不可变备份，精确副本完成兼容性证明，安装与启动回执为 PASS。系统字体由标准档2临时调到特大档5，Reader 实测倍率为 1.4500000477。场景结束后，设置恢复到2，原字体粗细1、界面缩放1均核验，Reader 实测倍率恢复为1。最后现场为当前候选正常书架，全部有界 HDC 会话已结束。[部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T054448Z-facf700e-15be72a2/deploy-vm-6460677a198b-20261114T054634Z.json) · [字体及现场记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font-and-environment-40bc.json)

### 保留的布局与验收条件

用户明确选择沿批准原稿保留目录与 TTS 紧凑布局。目录四个 32vp 工具扩成四个独立 44vp 响应时有 48vp 横向缺口，tab 的 Quick/Full 高度为31/36vp，章节行为32/40vp，附属响应宽度26vp。TTS Quick 的四个独立响应宽度为39、36、32.5、37.5vp。这些容量冲突保留准确数值和 E2 诊断。

正式 control 登记为 revision25。21项页面登记的输入与引用已同步，引用检查通过。正式页面检查保留37项诊断，含 E2 的21项 FAIL、E3 的5项 FAIL、G-03 的8项 NOT_RUN 和 SCOPE 的3项 NOT_RUN。visual 的21项仍为 NOT_RUN。完整读屏可听、真实长分组恢复、全部页面命中和字形、精确2倍系统字体、独立整页视觉批准、GAP-04、连续绘制G05和历史Tab坏态归因G10按原关闭条件保存。用户明确选择沿现有资料推进，新增原稿和同期历史证据的缺口继续保留。[完整账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

方法、SDK、编译、签名、安装、原生观察、复用和用户验收分别记账。原始633项审计库存、历史失败候选与未运行项保留其原始身份。下文保存授权前实施方案，当前结果以上述交付记录及账本为准。

## Figma 对照补核

用户于2026年11月14日追问保留项的Figma依据。本轮代码实施主要复用了冻结的原稿提取、既有来源登记和当前生产容量核算，保留项逐项重新打开Figma的对照尚未完成。前述“批准原稿保留”需要同时注明本轮用户选择保留布局的授权，以及每项独立的原稿对照范围。

本次已通过Figma桌面补看33页同步前目录备份节点4765:7940，确认单行查询与四工具、双tab、紧凑章节行和底部当前章节的组合。2026年9月5日冻结提取另提供336×52工具栏、168×32查询绘制、32×32工具绘制、16图形、5间距及36高Full tab、40高Full章节行。该提取还包含8个章节下载或书签的显式44×44 HitTarget。当时核对的平面分支26vp附属原生响应仍需逐项对账，正常语义分支44vp宽度及新原生命中依据见本次继续实施状态，原提取中的40高裁切行和相距30的附属动作中心也会影响有效命中。原生裁切、重叠和分派仍按真实消费者核验。[目录原始提取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json)

TTS的独立依据是2026年9月11日Make版本17的冻结DOM测量，Quick视口286×190、播放卡264×66，四个传输控件绘制依次28、36、28、28。前述39、36、32.5、37.5为当前代码分配的独立响应宽度。当前Figma的07页节点1977:22789明确标为当前应用同步App7fc3af9a，其内容需沿此来源使用。原Make每个目标的交互响应仍缺本轮重新对照。[TTS冻结测量](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-control-tts-make-20260911.json)

本次API读取备份目录节点返回403和Token expired，Figma桌面可以查看已有内容，同时显示待重连同步。服务端最新版本的新鲜度继续开放。完整保留项的逐项设计对照、命中及视觉验收沿各自条件保存。[补核记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-followup-review-20261114.json)

## 原始实施方案

日期为 2026 年 11 月 14 日。实施输入为 HarmonyOS `10a5d58d0231f48a4c4fceff22c733b3b3cb1fe2`、Core `c078126376294faa3a611690fbe48e79f0f86cc4` 和 Reader-UI `f206f0db011ae82c5a6e4059769fa3688b9cfcd5`。

本方案承接[全应用审计报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-framework-audit-20261114.md)及[五项问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)。当前状态为 PLAN_ONLY。各批次列出的源码修改、回归增补、构建和原生验证均为后续实施工作。

## 实施目标与交付边界

第一组交付关闭 UIF-01 至 UIF-05 的应用侧原因，并提交对应真实方法或正常 SDK 装配回归。第二组交付回答 Toggle 焦点与移除确认容量的两个条件风险。第三组交付逐页补齐 E2、E3、视觉来源和原生生命周期证据。历史 Tab 坏态归因沿 G10 单独保留同期取证要求。

每个问题在原账本中追加生产修改、输入指纹、准确测试项、结果、剩余问题和原生证据。源码修复、方法回归、编译签名、安装、原生交互、视觉批准分别记录。实施后报告应能直接回答哪些问题已经在代码侧关闭，哪些证据已复用，哪些原生结论仍开放。

## 批次与依赖

| 批次 | 主要工作 | 依赖与产出 | 完成条件 |
| --- | --- | --- | --- |
| 0 | 核对当前 checkout、问题与旧证据 | 输入指纹、受影响调用点、逐项验证选择 | 相关差异有归属，复用与待跑范围已写入原账本 |
| 1 | UIF-01 测量续接和页头避让 | 共享页、原生测量宿主及同型直接 owner | 同盒换代可收敛，真实失配旧回调继续无效 |
| 2 | UIF-04 判据修正及 UIF-02 偏好接线 | 原生属性回归、九处下拉及两条目录来源 | 正常入口继承偏好，行为断言和负例具有对应结果 |
| 3 | UIF-05 分组恢复容量及 UIF-03 短反馈宣告 | 分组覆盖层和共享反馈的薄平台适配 | 长内容与动作可达，当前前景反馈按代次宣告 |
| 4 | 两个条件风险与跨宿主组合复核 | 代码定位、必要时的准确原生问题 | 各风险得到已排除或可复现归因及相应处置 |
| 5 | 受影响原生行为和全应用剩余项关闭 | 固定候选、最小交付、逐页证据 | 本次五项逐层记账，E2/E3、视觉、G05/G10 各自更新 |

批次 2 和 3 的问题在技术上可以独立实施。一次共享修改影响多个问题时合并采样并保存各自断言。UIF-04 的测试调整随所覆盖控件提交，避免无行为依据的计数规则继续充当生产结论。各批次按问题提交，便于审查和局部回退。

## 批次 0　固定输入与复用依据

1. 在当前隔离检出核对 HEAD、未提交差异和实际正在工作的 owner。以本报告指纹作比较起点，保留并行 WIP。
2. 对五项问题重新核对相关输入有无漂移。仅在相关生产方法或依赖改变时更新该项来源，历史见证保留原结果与原指纹。
3. 复用最近交付中已经覆盖且本次未影响的普通 Back、目录往返、表面边框、短内容滚动原点等准确场景。后续修改改变其生产依赖时，再选择对应的局部回归。
4. 在原账本为每个拟运行项补充唯一问题、旧证据不足之处、实际入口、隐式调用、输入、时间上限及停止条件。缺少目标场景的旧 PASS 只能沿其已证明范围使用。
5. 记录本次实施耗时的代码、方法、构建、签装、设备查询和等待部分。后续候选具备复用条件时沿用已有产物与缓存。

本批次使用现有[源码清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)、[覆盖快照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/full-report-scope.json)和[最近交付记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/control-module-height-20261113/goal-completion-audit/current-delivery-23dc.json)。

## 批次 1　修复测量换代后的续接

### 修改范围

| 文件或 owner | 修改内容 |
| --- | --- |
| ReaderStandardPage | 区分页面几何变化与实际头尾测量依赖变化，明确同盒事实的续接资格 |
| ReaderFixedHeaderHost | 对确需新代测量的情况提供当前挂载盒的有限补采入口，并保留原生 Area 后续更新 |
| ReaderPageScaffold | 必要时传递测量请求与当前挂载身份，统一 header/footer 回执 |
| ReaderMeasurements | 沿用有限高度、单调代次及拒旧语义，只有共享 owner 确实需要时才扩充最小接口 |
| SourceManagementPage | 核对并修正其独立的 generation、fallback 和 Area-only 续接链 |
| 其余直接 Scaffold owner | 逐个检查失效条件、测量产生入口和 fallback，按实际同型证据纳入修复 |

源码入口见[StandardPage](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderStandardPage.ets:55)、[FixedHeaderHost](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderFixedHeaderHost.ets:15)、[Scaffold](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderPageScaffold.ets)、[测量存储](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderMeasurements.ts)和[书源独立 owner](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceManagementPage.ets:1320)。14 个 StandardPage 构造点和 11 个 Scaffold 构造点已保存在 AST 清单。

### 采用的处理方向

页面 geometry revision 与头尾 slot 的测量资格分别判断。仅窗口高度、键盘或无关环境字段变化，且页头的宽度、字体、内容配方和挂载身份继续有效时，保留已知页头高度并据此重算正文。真正改变测量依赖时生成新请求，并由当前原生宿主补采当前事实。

补采使用现有 SDK 节点或矩形读取能力及有限 post-frame 调度。实现时先核对项目已有 SurfaceRectMeasurement 适配是否能直接复用。相同高度也能按当前有效请求交回，避免把数值 epsilon 去重当成代次续接。每次读取捕获宿主、请求和挂载身份，采纳前再次核验。原生查询失败、零尺寸或节点退休均有明确退出结果，后续真实 Area 仍可更新。

Header 和 footer 分别判断测量依赖。rail 与底栏互换、footer 条件消失、真正宽度改变、字体就绪以及实体重挂均需要独立覆盖。对 header 合法保留事实时，不能连带复活已退休 footer。直接 owner 的修复沿用其自身配方和滚动职责。

### 最小回归与负例

在现有 `test-ui-window-layout-closure.mjs` 中增加同盒续接场景。建议 case 名为 `standard-page-same-area`，该名称当前尚未注册。

- 用真实 StandardPage 方法和完整几何输入建立 93vp 页头。保持页头原生盒和宽度，改变 viewport 高度、IME 及环境 revision，验证 startInset 持续按有效 93vp 分配或由有限补采恢复。
- 通过正常 build 装配回调，验证新请求即使得到相同高度也可以采纳。测试显式不给 Area 事件，不能由夹具补发一个生产端没有义务产生的事件。
- 改变宽度、字号、字体就绪、配方或挂载身份，注入上一请求的迟到回执，验证其无法修改当前几何。
- 覆盖 footer 消失、rail 往返和卸载重挂，验证 inset 只由当前存在的 owner 支付。
- 对 SourceManagement 的独立生命周期复用其实际方法和当前 producer，验证同型原因已经消除。

已有 `standard-page-generation` 的拒旧和手动新回执收敛断言继续保留。实现后按实际依赖调整其期待值。方法级证据充分后，剩余原生问题为窗口纯高度或 IME 变化时是否会出现中间避让错误。最小原生场景选一个实际可进入且页头实测高于 58vp 的页面，记录变更前后页头与正文原点，保留同窗同帧身份。

## 批次 2　修正控件判据并补齐动态效果偏好

### UIF-04 的测试修改

`assertSingleNativeModifier` 的计数结果只能解释局部装配约定。现有 Button 的合并 modifier 实现可以继续使用。回归断言直接检查最终 native carrier、语义、样式和业务动作，状态更新后再次执行正常 SDK 更新路径。[现有测试](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs:25)

具体断言覆盖实际宽高或 minimum、选择角色与选中值、enabled、按压和禁用外观、真实 onClick，以及 disabled/retired 后回调拒绝。负例移除一个必要属性、破坏某个状态更新或动作资格，使相应行为断言失败。两个合法 modifier 顺序组合应按平台规则得到合并及后写覆盖结果，测试记录该边界。

现有 `source-native-targets` 和 `source-group-budget` 为点名入口。需要补充的状态断言并入该文件，必要的新 case 先注册准确含义。华为对多个 modifier 的顺序应用已有平台约定。[官方文档](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/arkts-user-defined-extension-attributemodifier/)

### UIF-02 的实际接线

优先沿现有 Prop 传递单一全局偏好，实际修改位置如下。

| 来源 | 完整 UI 装配链 | 修改 |
| --- | --- | --- |
| 下载 | Index → SharedDownloadPage → 六个 ReaderInlineSelect | 消费页面已有 reduceMotion Prop |
| 书源工具 | Index → SourceJourneySurface.toolsPage → SourceToolsPage.debugCard → 两个 ReaderInlineSelect | toolsPage 传递，Tools Page 接收并向两处传递 |
| 阅读内目录 | 已有 reduceMotion 的 ReaderShell → ReaderDirectoryDestination → ReaderFullDirectory → ReaderDirectoryRules → ReaderInlineSelect | 补齐四层真实 UI 绑定 |
| 详情目录 | Index.externalDirectory → DetailDirectoryScene → ReaderDirectoryDestination → 后续相同链 | 根使用 settings snapshot，Scene 与 Destination 接收并传递 |

链路见[下载](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets:784)、[书源装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceJourneySurface.ets:105)、[Tools](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceToolsPage.ets:792)、[阅读根](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderShell.ets:335)、[详情入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets:1093)、[详情 Scene](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/DetailDirectoryScene.ets:24)、[Destination](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderDirectoryDestination.ets:139)、[FullDirectory](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderFullDirectory.ets:390)和[规则选择器](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderDirectoryRules.ets:293)。

ReaderSourceJourney 等业务导航类继续只处理原导航职责。偏好的持有者沿用 SettingsPresentation。菜单生命周期中途改为减少动态效果时，核对 SelectPanel 当前 Watch 和动画完成逻辑，按现有 motion policy 完成当前状态及回调退休。

### 回归与关闭

修正 `inlineSelectSdk.choose` 的无条件 `inline.reduceMotion=true`。由调用方显式选择偏好，测试分别检查 true/false。需要即时完成的有限方法场景可以显式提供对应输入，并另设正常调用方传播场景。[SDK helper](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/lib/reader-inline-select-sdk-probe.mjs:41)

在现有 secondary layout 的 `select-host`、`actions-tools-rules` 和 `download-controls` 场景中复用真实装配，按实际依赖补充正常入口。建议增加 `select-reduce-motion` case，该名称当前尚未注册。覆盖九个构造点，目录包含阅读和详情两来源，检查当前 panel 的 reduceMotion 和实际动画参数。true 时遵守现有零时长或无动画分支，false 时沿当前配方。菜单打开后切换偏好、关闭时切页、旧 selectionId 与卸载时，已退休回调不得继续操作新 owner。

原生剩余问题为 popup 实际打开与关闭的动效、焦点和外点行为。选下载、书源工具和目录三个宿主各一个实际入口，已覆盖相同宿主语义的旧证据可复用。若只修改测试判据且生产输入相同，沿用原生产包。

## 批次 3　恢复提示容量与短反馈宣告

### UIF-05 的容量分配

在 BookshelfGroupDialog 的恢复覆盖槽中计算当前可用高度。输入来自实际宿主 viewport、safe-area、现有 recoveryTop 与上下留白。沿用 ReaderRecoveryNotice 的 `maxHeightVp` 有界滚动能力，或由该槽提供一个有界 Scroll，选择单一实际滚动 owner。[分组覆盖槽](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:39) [共享容量入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets:25)

宿主显式订阅会改变该预算的窗口事实。高度为零或负值时夹取到零，原操作事实与恢复入口仍由原 presentation 持有。空间恢复后重新分配容量。展开长文案时，动作和全文在当前边界内可以滚动到达。原分组事务的 identity/generation、双动作 busy、外点、Back、焦点域与焦点返回按当前规则执行。

在 `test-secondary-layout-repairs.mjs` 的 recovery overlay 场景或现有分组装配测试中增加准确分组子项。建议 case 名为 `bookshelf-group-recovery-capacity`，当前尚未注册。通过正常 build、surface、recovery 链进入共享 Notice，输入短文案、长 blocked message、展开、双动作、busy、zero-height 和 resize，检查预算确实落到原生 Scroll，并点击真实动作验证原代次资格。

最小原生剩余问题为短窗口和大字号下最后一个动作是否可达，以及滚动和关闭后焦点是否回到当前触发入口。已有原操作自然完成或前提失配时结束该场景并记录结果。

### UIF-03 的显式宣告

由 ReaderTransientToast 的有效前景宿主发起一次平台宣告，复用 ReaderTransientFeedback 已有 generation 和 active-host 归属。平台接口使用 SDK 提供的 `sendAccessibilityEvent`，按当前 API 能力选择不打断宣告。API18 起的事件类型已经存在于本机 SDK，当前实际构建目标及运行环境仍在该动作处核对。[宿主生命周期](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientToast.ets:110) [SDK 接口](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.accessibility.d.ts:376)

宣告适配保持在现有消息或平台边界，包含下列行为。

- 在当前 host、foreground、visible、非空消息及有效 generation 均成立时发出。前景宿主竞争沿用现有优先级。
- 同一业务 generation 的宣告资格由现有共享反馈归属协调，处理同一反馈的宿主交接，避免只靠单组件本地计数造成重复。
- 从反馈当前 title/message 生成可理解的文字，重复发布、空内容、替代和隐藏的规则与现有可见状态一致。
- 使用平台宣告事件保留当前输入焦点。可见 UI 和原业务操作继续由已有 owner 持有。
- 在实际发出前再核验身份。异步 API 返回只记录该次调用结果，失败按当前消息日志边界记账，随后到达的旧完成不改写新反馈。

在共享反馈现有测试目录中增加准确宣告场景。建议 case 名为 `transient-announcement`，当前尚未注册。运行真实 host 的 syncToast、挂载、前景变更及卸载方法，对平台接口设置有限 spy。覆盖活动/非活动 host、竞争、同代重复、不同代替代、同代宿主交接、后台、退休和平台拒绝，检查发送次数与文字，检查无请求焦点调用。

方法测试关闭应用发事件的接线问题。原生读屏场景回答宣告是否实际可听、是否打断当前内容、焦点是否稳定。平台 API 成功回执和实际听到分别记录。已由代码定位的缺口修复及局部回归完成后，再安排该准确问题。

## 批次 4　两个条件风险的定位

| 风险 | 先做的源码工作 | 原生未决问题与最小场景 | 实施条件 |
| --- | --- | --- | --- |
| Toggle 焦点 | 追踪八个构造点、nativeRevision 替换、受控值回写及已有 focus 处理 | 对当前可达设置开关做一次键盘或读屏激活，观察焦点能否继续同一操作 | 若确实丢焦点，优先使用原生受控更新或当前 focus owner 的有限恢复，并复验拒绝状态的投影 |
| BookRemoval 高度 | 追踪 Index 装配、父约束、文字 Area、窗口 revision 与 messageMaxHeight 更新 | 打开真实移除确认后只改变高度，观察正文与动作边界 | 若新预算没有传到当前宿主，补充实际 owner 的窗口依赖或有效测量更新 |

风险源码见[Toggle](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderToggle.ets:43)和[移除确认](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets:68)。源码或旧证据已经回答的问题直接记录结论。原生行为足以排除风险时保留排除证据。确认缺陷后登记准确触发、因果链和最小回归，再实施对应修改。

## 共享框架组合回归的选择

下表列出实施时可用的现有入口以及保护边界。执行前核对该项定义与隐式调用仍符合本次范围。新增 case 以注册后的实际名称为准。

| 入口与准确 case | 嵌套或范围 | 本次必要依据 | 停止与复用 |
| --- | --- | --- | --- |
| test-ui-window-layout-closure，standard-page-generation | 选定生产方法、完整纯几何/store、有限输入 | UIF-01 修改会影响代次及拒旧 | 该项失败先审方法与输入，其他无关窗口 case 保留原结果 |
| 同文件，window-environment | 真实 environment/coordinator 绑定、有限平台端口 | 仅实际改到环境发布或订阅时选择 | 只改 slot 策略时核对旧结果能否复用 |
| test-framework-confluence-controls，source-native-targets | 当前 SDK Button、相关 spec、所选状态 | UIF-04 修改其行为判据 | 计数断言退回局部含义，失败归于对应属性或回调 |
| 同文件，source-group-budget | 当前 SelectPanel/ChoiceRow border-box | 只有控件预算或 modifier 实际受影响时选择 | 单纯补 Prop 时复用未变配方结果 |
| test-secondary-layout-repairs，select-host/actions-tools-rules/download-controls | 当前相关控件和具体页面装配，有限量字/动画端口 | UIF-02 的正常接线与六处下载下拉 | 仅点名受影响 case，平台 popup 仍另记 |
| 同文件，recovery-overlays 及拟增分组 case | 当前恢复层与实际 Notice | UIF-05 需要验证原生容量属性确实被装配 | 外围 overlay 旧断言继续沿原来源使用 |
| 共享反馈拟增 transient-announcement | 实际消息 host 与有限平台事件 spy | UIF-03 缺少自动宣告通道 | 只证明平台调用与身份，实际读屏单列 |
| overlay assembly 检查的准确宿主 | 现有已登记槽和真实 build 追踪 | 仅新增或改变装配合同、登记时选择 | 已知槽检查覆盖边界继续记录 |
| 读者控制栏历史准确 case | 按本次实际依赖选择 lifecycle、budget、surface 或 navigation 子项 | 修改进入这些生产依赖时才执行 | 共享 UI 名称相似本身不触发全组 |

测试入口见[窗口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-ui-window-layout-closure.mjs)、[控件](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs)、[二级装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-secondary-layout-repairs.mjs)、[覆盖层检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/check-overlay-assembly.mjs)和[门禁选择规则](/Users/minliny/Documents/Reader/GATE_INDEX.md)。当前方案中的表格是执行选择依据，实际运行结果在原问题中追加。

## 批次 5　原生行为与全应用剩余项

### 固定候选和实际交付

当实施进入 HAP 或设备动作时，使用项目 reader-harmonyos-hap-pipeline 流程，核对候选源码、Core pin、工具链、输入、不可变产物和签名。沿用用户指定 `minliny_HarmonyOS` 证书、`io.reader.minliny` 包名和匹配 Profile。版本按现行治理处理。每个签装动作单独核验身份及保数据条件。

先查相同生产输入的已有产物与场景证据。确需新构建时只构建该候选一次，记录产物 SHA 与 manifest。仅测试变更且生产包输入相同的情形，复用已签名生产 App。HDC 经 reader-hdc-lease 入口，按实际 server、精确 target 和占用执行，完整调用链直连，设置本次问题所需的有界期限。

代码侧已回答的原因先完成修复与局部回归。设备场景逐项写明剩余问题、旧证据为何不足、动作、观测值和停止条件。平台工具或必要运行条件缺失时记录具体缺口，已完成的代码与方法结果继续有效。

### 正式登记的后续工作

当前四个页面族含变体共 21 项。保存结果为 visual 21 项 NOT_RUN、interaction 21 项 FAIL、adaptation 5 项 FAIL 与 16 项 NOT_RUN。实施后更新实际受到影响的登记和证据，保留各项输入及原结果。登记中的 FAIL 包含完整原生命中、焦点或读屏证据缺席。Source 的 content FAIL 还保留整页原生字形与裁切验收缺口，具体原因沿原条目处理。[正式 register](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/page-structure/register.json)

| 工作面 | 实施内容 | 关闭依据 |
| --- | --- | --- |
| Source/Tools | 测量续接、下拉偏好、真实 native target 及选择语义 | 正常入口，实际父级预算、触摸、焦点、读屏及大字号 |
| Directory 及 12 变体 | 详情/阅读来源、text/manga、规则/书签/正文及各临时层 | 按变体的真实装配、响应可行性和返回身份 |
| Downloads 及 5 变体 | 普通/管理/章节/弹层的偏好、内容和原操作 | 各实际状态的命中、焦点、容量与大字号 |
| 书架/搜索/详情/设置及诊断根 | 报告中的路由与根责任逐项对照，复用已有有限来源 | 对实际可达状态的独立依据和对应运行证据 |
| L0 保留模块 | 复核共享框架消费和关闭条件，保留 S-06 来源 | 未来实际开放范围明确后按其真实入口完成对应验证 |

当前目录及 TTS 部分紧凑横向响应与 44vp 下限存在已知冲突。每处先列 paint、native carrier、父槽、边框、gap 和可用宽高，再选择可容纳的响应分配或经确认的页面布局调整。使用真实目标和相邻命中验证，默认密度与小窗口分别给出依据。

### 视觉依据、连续绘制与历史坏态

1. 对完整书架、搜索、详情及部分二级和漫画状态补齐独立批准来源，核对后续批准是否覆盖当前组合。源码衍生画板继续标注来源。存在明确设计差异时沿原配方实施，涉及布局变更时给出具体可审阅方案。
2. 阅读恢复引导的 GAP-04 沿已有 `CODE_VERIFIED_NATIVE_OPEN` 记录补实际原生入口与遮挡证据。
3. G05 先检查现成视频、trace 或可用连续取帧能力。在固定候选的一段正常操作中记录目标、profile 提交、Area、输入资格与像素时序。只改变某一链路时选择对应动作，保留真实窗口和帧身份。
4. G10 需要历史 Tab 扇形坏态同期的 App、PID、window、frame、Area、半径、path 与绘制命令。缺少同期输入时继续开放归因。后继正常场景的像素与 RS 证据沿其采样时刻保存。

来源与现有开放状态见[原设计审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-comparison-audit-20261113.md:131)和[整改总账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md)。

## 验收、失败处理和回退

| 问题 | 应用侧关闭 | 方法或装配关闭 | 原生剩余关闭 |
| --- | --- | --- | --- |
| UIF-01 | 测量事实续接与拒旧均成立 | 无 Area 同盒场景、真正依赖变化、卸载与迟到回执 | 当前窗口/IME 变化的正文避让与中间绘制 |
| UIF-02 | 九处接线和目录两来源完整 | true/false、过程中变更、旧 identity 及卸载 | popup 动效、外点、Back 与焦点 |
| UIF-05 | 分组恢复槽支付当前高度 | 长文展开、双动作、零空间、resize 与原操作资格 | 全文和动作可达、关闭及焦点返回 |
| UIF-03 | 有效 host 按反馈 generation 宣告 | 竞争、交接、重复、替代、后台、失败与退休 | 实际可听、不打断策略及焦点连续 |
| UIF-04 | 每个负例能对应一个真实失败 | 属性、更新、交互和合法组合均按平台语义检查 | 所涉及原生行为随相应生产项复验 |

每次局部失败先保留输出、输入指纹及本次已完成结果，再审生产路径与夹具。夹具缺端口记夹具失败，生产动作失效记对应问题，缺少所选证据保持未完成。形成新的可检验原因后再安排一次有界运行。

按问题保存小型提交及其对应回归。回退时核对当前差异和后续依赖，只恢复本问题实际修改。安装候选及用户数据按既有保数据流程处理，源码回退与设备结果分别记录。

最后交付包括实际源码差异、准确测试结果、更新后的原问题账本及页面登记、发生过的构建签装 manifest、原生证据和仍开放的视觉或历史归因项。当前这两份文档及覆盖快照构成实施输入。


## 2026-11-17 全应用目标续接与当前状态对账

当前安装候选为 `0.2.0.DEV.e6736ba4966d`（x86_64，run `20261117T135651Z-6a2f03ab-f6d2355a`），HAP SHA-256 `27594dc5f52406ae3aa008081c720d395677e7bfdbf9f94fdbca851d1871d0ed`。Host `6a2f03ab` / Core `c0781263` 加保留的 dirty WIP，共648个生产ETS/TS输入。指定证书签名、Core/Native同字节复用、ArkTS/包身份、停止态数据兼容验证、保数据安装与启动通过。用户已明确解除VM禁令；本次 agent 操作保持现有1280×2832、density3.5与应用数据，未执行重启、重置、卸载、清数据或显示配置写入。用户另行反馈的重启见下文，具体范围未说明。全量合同未运行，不能由开发包及局部原生结果推导完整验收通过。

此前补修下载书/章选择框实体标签和章节标题动作语义；规则编辑器与漫画恢复提示两处展示代次改为受观察状态，避免启用按钮仍使用旧回调。准确失败、通过及同原因15处身份构造点核对见 [回调代次修复](../../../evidence/2026-11-17-framework-native-closeout/callback-generation-repairs.json)。本次没有开启新的全局审计轮。

本次原生执行又定位并修复正文搜索的四个相关行为：Full/Quick切换把另一端锚点设为0；末尾视口变大后按未约束位置裁掉可见行；同词新查询被当作原列表的相同前缀而保留旧位置；旧查询尚未归一的原生偏移提前触发新查询续取。修复仅在搜索组件中绑定当前查询代次、保留语义锚点，并复用实际滚动投影计算端点遮罩与当前可见范围。公共表单滚动策略保持原有适用范围。`scroll-receipts` 与 `geometry-policy` 点名回归通过，包含50/2000/10000条、反向拖动、末尾双向遮罩、新查询归零、旧偏移不续取及当前近末尾仍续取。[修复与证据边界](../../.reader-artifacts/app-ui-framework-audit-20261114/search-morph-query-repair-20261117.json)

原生数据证据分开记录：正常《365天读点经典》（366条目录）的Quick搜索51条及IME中四项导航沿未变更路径复用。自有1025章固定语料中，第二次长扫描实际观察295处匹配并到达第1025章稳定末尾；前后两次取证合计覆盖全部309处匹配、279个章节。原生输入和List节点相同不能单独证明重新搜索前后的业务代次相同，因此没有把跨会话309覆盖写成单一查询的309条连续遍历。[长结果与代次边界](../../.reader-artifacts/app-ui-framework-audit-20261114/native-search-309-and-morph-1423-20261117.json)

e281候选上，Full末尾首个完整可见结果为1020，收回Quick后仍为1020；Quick滚到1025再展开，实际截图确认1020至1025的标题与摘要可见，两条1022分别高亮不同匹配。点击末项后已进入1025正文。4042只再修新查询归属和续取判据，上述未变更方法范围按证据复用。[切换、末尾绘制及实际定位](../../.reader-artifacts/app-ui-framework-audit-20261114/native-search-morph-e281-20261117.json)

4042上，同词“2”搜索从首项2滚到24，再次搜索回到2，输入框保持。当前系统键盘窗口实际显示时，Full结果List仍是同一个原生实例，首项及多行结果可见；Back恢复原List高度、查询和首项。这些是当前准确场景通过，不扩写为全部Quick/IME/字体及失败分支通过。[新查询与Full结果输入法回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native-search-query-scope-4042-20261117.json)

e673已补齐快捷正文搜索的当前原生场景：正常书架续读进入自有1025章书，搜索“2”，实际输入法出现后Quick外框整体上移1029px，高度仍为1147px，内容宿主仍为657px。输入框260:14953与结果List260:15019在输入法前、显示时及Back后保持同一实例；Back保留查询、首项及位置。实际截图已检查，前两条标题与摘要完整可读，四个底部入口未被淡化，无加载更多覆盖。再次聚焦输入法后，对完整可见的第一条结果点击一次，已进入第0002章实际正文。该结果只关闭当前默认字号Quick/IME/Back/点击场景，不提升为全部错误/空态/字号及E2/E3通过。[快捷结果输入法与实际定位证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-quick-ime-completion-e673-20261117.json)

同一e673包另已补齐Quick/Full空结果分支。实际基线查询为“zzz”，两种形态在真实输入法下均完整显示未找到提示；输入框260:15378与提示260:15384贯穿Quick、Full、两次Back及收回Quick。Full原始外框仍为2346px高，输入法只把可见范围截到1733px，空态正文在当前容量内上移并保持完整；不把该结果写成整个Full外框已容纳于键盘之上。两张实际截图已检查。驱动原请求zzzz，但首个有效原生基线已是zzz，故只证明已观察查询的空态保留，不推断未观察的字符丢失。[Quick/Full空态与输入法证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-search-empty-ime-completion-e673-20261117.json)

P3在4042候选上已补齐自有TXT1025正常链路，本轮未变更该生产路径：预览1025节点/1025可读/0无法映射，同一预览List先到1025，再返回1，末项实际截图可读。随后只应用一次当前预览证明，收到规则已应用结果；正式目录仍显示末项1025及1025/1025，原阅读位置保持。返回详情后新开full-directory:2实例，经Core重新载入已保存的第.*、层级0、已有标题规则，最后返回原详情。测试书保留这条明确规则，其他书籍和系统设置未修改。[当前预览、应用及重读证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-preview-apply-completion-4042-20261117.json)

早期1423末尾screenCap失败保留为历史FAIL；当前另一次实际P3截图成功，不追溯改写旧结果。本次文字选择器失败和完成返回扫描后的空闲会话释放亦有原记录；未派发的动作没有计为成功。同页关闭/展开保留的字段未当作持久读取，持久读取只采用新目录实例的Core get。未知ACK、输入变化拒绝及回滚边界复用未变更Core/Host准确测试，没有制造真实故障来取证。

G05系统控制中心录屏文字入口及独立图标载体各点击一次，后者有SYS_UI实际onIconClick回执，但未进入录制或产生视频。这里只证明点击已派发，后续无响应原因未定位；不推断整个平台不支持录屏。单张搜索截图成功也不是连续绘制通过。[系统录屏入口记录](../../.reader-artifacts/app-ui-framework-audit-20261114/g05-system-recording-result-1423-20261117.json)

本轮继续P2真实入口前，发现并修复搜索到换源的错误排除链：SearchOrchestrator在请求派发前记入书源，Journey将集合传给换源，Gateway却把这些书源当成已完成而跳过。现已删除跨查询集合及排除参数；仅有合格缓存候选时复用候选，其余按当前书名、作者、书源版本独立取得后续页。旧生产方法在首屏后转入换源会错误显示空态，修复后的真实Host回归可在第二页命中；渐进、缓存、取消及漫画准入等9个准确case通过，实际ArkTS、签名和保数据安装通过。原1ceb“天道”首轮107/107书源、608结果只能证明首轮，后续页数字日志为空，不据此关闭P2。e673“天道”首轮708结果，259.631秒有界采样记录342个分组，未取得后续页；“天道酬勤”首轮446结果的遍历也已停止。随后按实际工具帮助，以同一查询完成4次原生fling，25.017秒内仍无后续页回执。这些尝试均不计P2通过，也不构成书源已穷尽或应用续取正确的证据。已停止宽泛查询和逐屏遍历，P2原生项保持开放。[接线修复、选定回归及原生计划](../../.reader-artifacts/app-ui-framework-audit-20261114/p2-search-switch-handoff-repair-20261117.json)

当前e673已从正常设置进入真实书源登记页，核对默认页头的全部7项事实：返回角色、固定呈现、返回/标题/工具组成、不透明表面、58vp名义高度、安全区归属及工具action owner。实际槽盒202px高（density3.5下保留1px取整边界），与内容根同起于y137px，标题和两个154×154px按钮完整可见。真实输入法与Back前后保持同一个260:18525页头及原范围。已逐项审阅登记以来7个源码/夹具输入差异并更新该页绑定，新增编辑框架输入；只把Source默认header从NOT_RUN改为PASS，revision58→59。[正常页头与绑定对账](../../.reader-artifacts/app-ui-framework-audit-20261114/source-header-layer-native-e673-20261117.json)

继续复用同一正常书源页快照，信息架构已补齐实测预算：可见主列表770vp、筛选prefix244.2857vp、首行相对起点302vp，页脚槽前完整容纳5个内容单元；实际输入法覆盖时仍有2个完整单元。区块清单补登记分组筛选，保留有条件的status-action槽。页脚同时核对唯一动作owner、两项controlRef、主次/快捷入口关系及默认安全区，Back后恢复原生按钮身份与范围。按原契约附录A第3/8层关闭这两项结构事实；完整页面、E2原生命中/焦点/读屏及其他字号方向不作为它们的附加前置，也没有被一并改判。Source revision59→60。[首屏与页脚结构证据](../../.reader-artifacts/app-ui-framework-audit-20261114/source-structure-layers-native-e673-20261117.json)

当前正式登记为21项336层：26 PASS、27 FAIL、283 NOT_RUN，整页原生关闭0/21。当前已确认的代码修复队列为0，完整原生验收继续开放；普通搜书/换源后续来源页、其余P1变体和原方案页头条件、不同宿主动效/焦点、可听宣告、真实长未决恢复、纯高度窗口及正式E2/E3仍各有未闭环条件。漫画新代恢复动作目前只有真实SDK层关闭。独立批准整页资料和历史G10同期原始trace沿既定缺口保留。当前见 [全应用续接记录](../../.reader-artifacts/app-ui-framework-audit-20261114/framework-current-continuation-20261117.json)、[当前逐层缺口](../../.reader-artifacts/app-ui-framework-audit-20261114/requirement-native-gap-index-e673-20261117.json) 和 [原账本](../../.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)。外观、性能两项子agent仍按全量实施完成后启动；历史R30 FAIL及0/3保留，已取消的全局轮不再作为VM前置。

用户随后反馈“重启没有了”：VM 中此前报告的加载按钮在用户重启后不再出现，具体重启范围未说明。当前 e673 候选的只读抓取帧没有该按钮，已安装候选对应 HAP 的 `ets/modules.abc` 中“加载更多结果”精确字符串为0。重启前的按钮身份、所在状态及消失原因未取到证据，不能据此归因于旧包或缓存，也不将重启本身记作代码修复验证。该现象停止重复复测，原始未决边界保留。见 [加载按钮反馈记录](../../.reader-artifacts/app-ui-framework-audit-20261114/vm-visible-loading-button-20261117.json)。

当前 e673 正常书源页底部进入工具页，打开已有书源的真实 JSON 草稿，完成320vp多行框的键盘、Back、一次外层滚动后取消及返回。原生输入 `reader-editable-target:13` / `260:20174` 和外层Scroll身份保留，898字符文本SHA保持；框高1121px，IME时整体上移443px，底边1705px，键盘顶1733px。取消按钮在键盘显示时完整位于1558–1712px，实际点击后输入框与键盘节点退场，随后Back返回书源页；没有保存或书源写入。图片已复核。该正常场景关闭书源工具的骨架、页头、无目录查询、无业务页脚四项结构事实，登记修订49；原 `contentEndInset=none` 更正为 StandardPage 的 `max(16, interactiveSafeBottom)`，不是生产改动。交互/适配完整层仍FAIL，整页0/21。极端高框、浮动键盘、组合输入及完整读屏不由本场景推导。见 [正常多行编辑原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-source-code-ime-e673-20261118.json)。

正常详情目录的 TXT 规则边界下拉已补原生证据：当前 e673 从正常设置将减少动态效果false切为true，进入已有1025章测试书的详情目录规则。四个边界选项完整绘制；Back与外点均只关闭菜单，原`第.* / 0 / 已有标题`保持。键盘路径从规则标题经3次Tab进入同一原生触发器260:23432，Enter打开，Back后同按钮focused=true。8秒trace共3267/3267条，ReaderSelectPanel建立与销毁均在区间内，6个RunningCustomAnimation样本均为0，单次动画回调生命周期1.677ms；这些不是连续像素或全局性能通过。原动效偏好已从真实设置开关读回false，规则未应用/保存，会话释放。已有下载和书源工具证据按各自原范围复用。正式26 PASS、27 FAIL、283 NOT_RUN及整页0/21不变，G05连续像素/G10同期证据继续保留。见 [正常目录下拉原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-rules-e673-20261118.json)。

UIF-05当前组件容量已补证：e673中的真实BookshelfGroupDialog/ReaderRecoveryNotice由既有内存回执样本装配，180vp宿主展开后Scroll为156vp；5次有界手势滚到“分组长文案末尾”，双动作原生盒均完整且实际各记一次当前opening意图。320vp时Scroll为296vp，回180vp恢复156vp，同一原生Scroll260:231和opening1保持；再次滚到末尾后图片复核通过，Back返回样本按钮且focused=true，最后已恢复正常书架。当前容量、滚动及样本焦点可按这一范围关闭；真实持久化分组结果未执行，也不作为证明组件高度/滚动事实的新增前置。当时尚未验证当前候选的大字号末尾动作及正常书架父入口焦点。另有旧候选的实际 1.45 倍字体完整动作回执，后文核对了该证据与当前源码的差异。首次500ms过早查菜单及遗漏开源审计页→页面结构菜单步骤的私有入口失败保留，续接同一现有进程后完成，未重复启动样本。正式26 PASS、27 FAIL、283 NOT_RUN和整页0/21不变。见 [当前分组容量原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-group-capacity-e673-20261118.json)。

UIF-05另补正常父入口：e673正常书架中，已有1025章测试书的更多按钮→编辑分组使用真实BookshelfGroupPresentation.open与BookshelfHost读取装配，随后实际Back。原书籍更多原生按钮260:271保持，返回后focused=true，分组覆盖层退场；未选择默认分组，也未派发assign/reconcile/continue。8个动作、62.921秒，会话释放，正常书架保持。由此补齐当前正常父入口返回焦点；初始默认分组子按钮focused=false、对话框focusScope=true按原观察保存，不宣称子按钮初始焦点通过。当前容量原生组合仍缺实际大字号展开长提示的末尾动作，业务持久化结果继续独立记账。见 [正常分组返回焦点](../../.reader-artifacts/app-ui-framework-audit-20261114/native-group-normal-focus-e673-20261118.json)。

原条件风险RISK-TOGGLE-FOCUS已按批次4的原关闭标准收口。原要求是“对当前可达设置开关做一次键盘或读屏激活，观察焦点能否继续同一操作”，现有正常书架设置及开发者设置已实际各完成两次受焦点/值守卫的Enter：原生实例0→1→2分别换代，接受值往返变化，每次新实例均enabled=true、focused=true，随后正常重开确认原偏好。此次重读实际布局文件及SHA、原始派发回执确认上述事实；共享Toggle与旧原生候选及当前e673不可变快照均为相同4d5ff91d字节。SDK AST另证书架设置Toggle装配、值、资格、身份、回调和生命周期全部未变，唯一变更成员是无关的显示方式保存。完整读屏名称/角色/音频、所有保留调用方及正式E2/E3继续开放，但不再作为这个原“键盘或读屏”焦点续接风险的新前置。原失败候选保留，未重跑VM、构建或签名，正式26 PASS、27 FAIL、283 NOT_RUN及整页0/21不变。见 [原Toggle条件风险关闭依据](../../.reader-artifacts/app-ui-framework-audit-20261114/toggle-original-risk-closure-e673-20261118.json)。


2026-11-18补齐P2普通搜书的真实后续页：当前已安装e673，正常书架搜索“365天读点经典”，首轮107/107、366条。原生列表向尾部16次有界fling后，当前Reader进程实际取得page2成功回执，回到页头计数为526。查询输入260:1746、List260:1616及owner2:2保持；所有采样布局与日志SHA已复核，页头图片已查看。查询、追加和回看共167.445秒，没有重提查询或重建列表。保存的四条数字回执各为page2/decoded10/matched10，不据此把完整160条增量逐项归到四个书源。旧失败扫描保留，不因换源仍OPEN重跑本场景。见 [普通搜书page2原生结果](../../.reader-artifacts/app-ui-framework-audit-20261114/native-p2-normal-search-pages-e673-20261118.json)。

独立换源入口仍OPEN：从该正常结果进入真实详情和换源，原有5个候选可见，仅点击一次“重新查找”；观察119.938秒后仍为“正在查找”，采样日志没有合格route=switch后续页目标。实际Back关闭覆盖层，原详情来源和原生触发器保持；没有点击候选、提交换源或写书架。不能由此认定没有请求后页、来源无后页或取得有效空结果；不追加书名或查询循环。见 [换源单轮有界结果](../../.reader-artifacts/app-ui-framework-audit-20261114/native-p2-switch-target-e673-20261118.json)。本次8分10.335秒会话已释放，没有生产改动、构建/签装、钥匙串访问或VM显示/系统设置变更。私有采样首次误传label而非name，在采样前失败，已独立保留。正式26 PASS、27 FAIL、283 NOT_RUN、整页0/21及全框架OPEN不变；账本原CURRENT_CANDIDATE_NOT_RUN已保留为历史，当前改指向分项原生证据。


2026-11-18目录默认登记按原附录A完成四项结构收口：复用当前e673正常“详情→完整目录→规则→返回”的真实原生快照，102个登记生产输入均与已安装包的不可变输入快照一致；骨架、信息架构、页头、页脚由NOT_RUN转为PASS。首屏预算为770vp视口、133.142857vp模块标题/页签/查询前缀、首行距应用视口顶233.714286vp、440.285714vp列表视口与10条完整40vp行。页头配方基准54vp与原生193px/3.5=55.142857vp分别记录，控件当前下限44vp；TXT的上下文入口是目录规则，远程分支才是离线菜单。页脚在内容内支付standaloneFooterHeight()，当前168px=48vp，但随字体计算，不能登记为全局固定48。见 [目录默认四层证据](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-structural-native-reuse-e673-20261118.json)。

本次修正登记元数据，没有生产改动或新VM动作。现有引用检查发现旧directoryBody方法已删除：重试控件改指当前standaloneCatalogState，13处目录装配输入改指build；同一上下文控件的名称来源补齐TXT规则分支，控件登记29→30，21项消费修订同步更新，其他层的事实和结果不变。仅编辑默认目录及两项控件的schema与默认目录引用检查通过，原引用失败独立保留。目录默认修订63；当前正式合计30 PASS、27 FAIL、279 NOT_RUN，整页仍0/21。查询、完整命中/焦点/读屏、各变体、2倍字号、完整测量及业务生命周期没有由结构结果升级。当前汇总见 [逐页剩余要求](../../.reader-artifacts/app-ui-framework-audit-20261114/requirement-native-gap-index-e673-20261117.json)；选定检查见 [结构登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-structural-selected-checks-e673-20261118.json)。


### 漫画完整目录回顶实施结果（2026-11-18）

固定页脚漫画目录在筛选或排序改变后，由 `ReaderDirectoryNavigationSurface` 按已接纳查询判断是否回顶，并把定位意图附在当前结果。新的 `ReaderDirectoryNavigationList` 先装入数据，等布局后按内容起点对齐首项。回执使用现有数据与前缀世代拒绝迟到定位。短视口的内容内前缀、同一查询重试、首次进入和显式“定位当前条目”沿各自原有分支执行。平面回退目录由 `BookDirectoryPage` 处理首项对齐。[两次修复及原始回执](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-top-repair-e673-20261118.json)

`projection`、`catalog-filter-admission`、`catalog-result-position` 三个准确用例通过，分别检查父层交接、异步接纳、等待布局与拒绝旧帧。广义 Surface 和 Grid 历史夹具失败按原回执保留。当前 `9087635e27b6` 已按原签名和保数据流程安装，VM 密度与分辨率密度读数为 3.5。同一本漫画一次输入、退键盘、清除和返回的原生场景用时 33.192 秒，首章和输入框回到原位，阅读仍在第 1/4 页。第一次 `beac03c7666f` 修复与其原生失败保留。正式验收维持开放。[VM 场景回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native/1794940557986/manga-directory-verification.json)


### 阅读内漫画目录的测试与结构登记（2026-11-18）

修复两个旧测试夹具。Surface 用例执行真实请求身份门与重试回调，断言保留章节时继续显示旧内容、无可用章节时显示加载、旧重试回执被拒绝。Grid 用例改用当前窗口读数、共享滚动布局与消息宿主，检查 44vp 按钮、实际清除回调、原生属性、锚点及滚动坐标。两项原失败用例和两项回顶定向用例通过。此次变更限于测试夹具和登记。[四个定向用例及失败记录](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-sdk-fixtures-scope-20261118.json)

复用已安装 `9087635e27b6` 的正常场景，对照附录 A 更新阅读内固定页脚漫画目录五层。校验通过所选页登记 schema、引用和 Brief 推导。默认目录仅更新六处指纹。整页登记仍开放，正式 336 层为 35 PASS、27 FAIL、274 NOT_RUN。[阅读内漫画目录登记依据](../../.reader-artifacts/app-ui-framework-audit-20261114/reading-manga-structure-9087-20261118.json) [登记校验](../../.reader-artifacts/app-ui-framework-audit-20261114/reading-manga-structure-9087-20261118.checks-final.json)


### GAP-04 原范围完成回执（2026-11-18）

先对比已安装候选与旧原生证据，发现共享恢复提示的命中与文案载体经历过修改，因此只复验当前包的原书入口、展开位置及 Back。沿正常书架进入现有 Sample EPUB，完成“更多 → 待处理事项 → Back”。一次 18.126 秒会话得到当前场景的树和截图。两枚按钮完整，正文保持 Chapter One、0%。跨书引导沿已有实际记录复用。[当前场景与原生截图](../../.reader-artifacts/app-ui-framework-audit-20261114/native/1794941591841/gap04-current-normal-entry.json) [原验收回执](../../.reader-artifacts/app-ui-framework-audit-20261114/gap04-original-scope-closure-9087-20261118.json)

本地 `reading-request-policy`、`foreign-book-guidance`、旧版 `native-fixture` 共三项通过。第一次旧夹具缺少外观状态读取和当前菜单归属的方法，已补当前调用与旧菜单身份拒绝断言并保留失败日志。设计依据登记的 GAP-04 改为 `NATIVE_VERIFIED_ORIGINAL_SCOPE`，G05 与 G10 各自的原关闭条件保留。[原验收回执](../../.reader-artifacts/app-ui-framework-audit-20261114/gap04-original-scope-closure-9087-20261118.json)


### 下载正常结构验收与章节同行修复（2026-11-18）

从正常设置入口实测四种下载布局，登记新增 11 PASS，合计 46 PASS、27 FAIL、263 NOT_RUN、整页 0/21。采样曾期待混合夹具的“已选 0个条目”，原生小说正常显示“已选 0章”。保持原页面，在同一候选上仅补摘要与 Back 的验证，恢复设置页。书籍、章节、下载状态和用户偏好保留。[正常下载结构登记](../../.reader-artifacts/app-ui-framework-audit-20261114/download-normal-structure-9087-20261118.json) [VM 场景回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native/1794942115118/download-normal-structure.json)

章管理同行修复基于实际内容宽度减去 44vp 复选框载体和间距，再按当前字号判断文字列最小宽度。正常有余量时，复选框与文字共用一条外层布局，文字列可收缩到其最小宽度，标题和当前阅读标记继续在列内换行。无法容纳时可外层换行。两个准确 SDK 用例通过，包含窄宽、安全区、字号、原复选框回调、读章及拒绝已退休回执。[章节管理行的原稿、实测和修复](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-manage-alignment-9087-20261118.json)


`8a5ada358af9` 的不可变快照相对 `9087635e27b6` 只变更 SharedDownloadPage 一个生产文件，Core 输入和包内 Native 相同。保数据安装并启动后，VM 实测管理复选框与同一标题 ID 同行，行高 468px → 282px，正文下载状态保持，逐级 Back 返回设置页。首次标题选择器和原摘要选择器的失败分别留档。[签装、原生回执与同章前后尺寸](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-inline-native-8a5a-20261118.json)

章固定管理首屏预算以实际 770vp 视口、57.714286vp 章节工具项和距视口顶 246vp 的首章为依据。四个正常下载登记通过 schema、引用与 Brief 检查。新增 12 个结构结果在原账本同步，当前合计 47 PASS、27 FAIL、262 NOT_RUN。[四项正常登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/download-structure-8a5a-20261118.checks.json)

### 下载短窗两个管理分支

已安装 `8a5ada358af9` 复用一次应用内短窗入口，两次会话分别记录书籍、章节管理及同一个 168vp List 的末尾选择区。只操作全选和 Back。五个批量动作的完整原生按钮均可滚达。首次脚本的 Back 断言误要求返回页头，后续沿原书籍 List 续验；试点返回按钮直接承载文本，现已通过原生按钮实际返回书架。两次脚本失败及原始证据保留。[短窗原始回执与范围](../../.reader-artifacts/app-ui-framework-audit-20261114/download-short-structure-8a5a-20261118.json)

更新两个变体的 A4 页头和 A8 页脚。登记引用、候选源码指纹及 Brief 推导通过。当前 336 层为 **51 PASS、27 FAIL、258 NOT_RUN**。A3 已记录实测 168vp 视口和首帧 0 个完整条目，首项起点和其余层级仍待原条件。[两项登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/download-short-structure-8a5a-20261118.checks.json)

### 短窗首屏预算与旧大字号回执

两个 168vp 短窗首屏均由同一主列表的前缀占满。页头首项 78vp；书籍筛选前缀 163.71vp，章节的书籍上下文前缀 154.57vp，其后才是章节工具与章节行。滚动采样中实际数据项进入视口，列表末尾的选择区仍由同一主列表承载。附录 A3 要求首屏预算有依据，允许在短窗内滚动访问内容；场外首项精确起点保留空值。两个 A3 记 PASS，当前 336 层为 **53 PASS、27 FAIL、256 NOT_RUN**，整页验收 0/21。[原生首屏预算](../../.reader-artifacts/app-ui-framework-audit-20261114/download-short-first-screen-8a5a-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/download-short-first-screen-8a5a-20261118.checks.json)

旧候选 `3c5e34ef0c10` 在实际 1.45 倍字体、180vp 宿主中展开了长分组提示，两个动作均有同一打开代次的原生回执，Back 恢复焦点。此前对旧截图范围的描述遗漏了这些回执。分组覆盖层、恢复提示、动作和夹具输入随后改变，当前候选的大字号动作仍待验证。[旧证据与当前源码差异](../../.reader-artifacts/app-ui-framework-audit-20261114/group-large-font-evidence-correction-8a5a-20261118.json)

### 下载页减少动态效果补验

在同一已安装 `8a5ada358af9` 的正常设置入口打开下载管理，应用的减少动态效果实测为开启。书源、空间上限、过期清理、章节快速选择和多书范围的五个原生弹层均完整显示选项。书源以外点关闭，其余用 Back，各自保留同一触发器和原值。书源的 8 秒 trace 记录 4179 条数据，9 个动画计数样本均为 0。达到 60 步驱动上限后，仅续接恢复应用偏好，实际读回原关闭状态并回到设置。储存策略、清理和下载均未提交。原阶段的驱动失败回执保留。 [原生和恢复回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-download-extra-8a5a-20261118.json)

当前 SDK 的九处 true/false 接线、两条目录来源、零时长属性、偏好更新、迟到与卸载回调均已通过。测试适配补齐生产字段编辑目标、弹层键盘协调和现有目录 owner，保持原业务和判据。基础 Rules 与 Sync 原生 SDK 受控输入回归通过。五处原生行为仍按命中、焦点和连续像素的既有证据条件记录，正式 336 层保持 **53 PASS、27 FAIL、256 NOT_RUN**。 [测试与登记输入](../../.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-download-extra-8a5a-20261118.checks.json)

### 页头测量续接原生验证

同一已安装候选 `8a5ada358af9` 的正常书架搜索，展开历史后复合页头实测 **274vp**。输入法显示、Back 收起、重新点输入三次采样，页头和输入框均保持同一原生节点与边界。此前所查 normal Source/Tools 的 58vp 不再是唯一可用样本。当前 `ReaderStandardPage` 实际几何夹具使用 102vp 页头，输入法避让量 0→314→0vp，三个采样端点的正文起点均距页头底 8vp。两次键盘 metrics 更新期间页头没有新增 Area 回执。结束已回书架。[正常入口与正文回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native-uif01-current-8a5a-20261118.json)

三项点名方法回归通过，覆盖同盒、真实失配、迟到/卸载拒绝及直接 owner。初次原生脚本误把 ZOrd = −1 的已隐藏键盘当成可见，沿原输入继续后按 WindowManager 的实际顺序判断。冷挂载还取得正文 startInset **66→110vp** 的两条原生布局回执，发生在 IME trace 之前。该回执不能判定当前屏幕出现过初始重叠。G05 连续像素和真实系统窗口纯高度变化仍沿原条件。正式 336 层或整页结果未改判。

### 书源工具首屏、滚动与下拉末项

当前 `8a5ada358af9` 从正常书源页底部进入批量管理与书源工具。实际主体高 770vp，首屏完整呈现导出和批量管理区。首个书源距视口顶 748.57vp，第一行部分可见；滚动后，838 项书源的内部容器实测高 420vp，可见 6 个完整条目，外层主 Scroll 继续承载调试区。在同一个列表向下滚动进入调试区，Back 后重开可见主 Scroll 重建并回到首屏原位。两项结构登记 A3、A5 已通过，69 项生产输入匹配安装快照。[原生与源码回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-depth-8a5a-20261118.json)

开启应用内减少动态效果时，列表、详情、目录和正文四个原生选项全部可见。点击末项载体底边内侧 6px 后深度从“列表”变为“正文”，搜索模式保持。系统 Back 把焦点交还重建后的底部工具按钮。重开后深度仍为“正文”，随后已恢复“列表”和原动效偏好，实际返回正常设置。未触发检测、导出或删除。原生确认、系统文件选择器、读屏和适配仍按原层验收。正式 336 层更新为 **55 PASS、27 FAIL、254 NOT_RUN**，整页 0/21。[登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-depth-8a5a-20261118.checks.json)

### 短反馈焦点与系统窗口能力

复用 `8a5ada358af9`，从正常设置进入消息样式预览。Tab、Enter 分别激活普通和成功短反馈。反馈文字完整可见，出现、定时收起前后均保持各自原生按钮与键盘焦点。首次脚本直接查 text，漏读了按钮装饰子节点的 originalText，纠正后沿同一页面完成；已返回正常设置。当前无障碍服务只读结果为 enabled 0、client num 0，未取得平台语音回执。SDK 已验证当前前景一代一宣告，以及替代、后台、卸载和拒绝处理。可听宣告维持原验收条件。[当前原生、SDK 与能力证据](../../.reader-artifacts/app-ui-framework-audit-20261114/native-feedback-removal-capability-8a5a-20261118.json)

移除确认的当前真实 SDK 接线通过纯高度 600→320→700vp 更新，Scroll 高度 400→120→500vp，无需等待 Text Area。旧 140c 同样式确认原生长文证据仍保留；窗口协调和夹具输入随后改变。本次直接读到当前 VM 的 uitest 拒绝 `uiWindow`；本机 SDK 声明 `UiWindow.resize` 只作用于可调整的窗口。系统真实等宽纯高度变化仍未发生。没有改动系统设置、应用数据或正式层结果。

### 漫画目录页脚独立测量

实际 `BookDirectoryPage` 装配复现了短窗只收到页脚 Area 时正文起点沿用旧高度。已把摘要和搜索的测量移到自身节点。流内页脚继续沿原编辑宿主挂载，正文前缀由摘要和搜索高度、页脚间距、当前页脚高度共同计算。固定页脚继续使用原底部预算。通过 `adaptive-footer`、`direct-page-same-area` 和 `current-grid-geometry` 三项回归，覆盖回执重放、首项位置和保留节点。[执行方案](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-toolbar-measurement-plan-20261118.md) [回归及部署账本](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-toolbar-measurement-20261118.json)

签装 `96499ffb06e4` 后，在原 VM 的详情换源夹具验证全高与 168vp 两个生产装配。固定页脚在靠底槽位，流内页脚位于首章之前。两场景首章各触发一次，Back 各回到诊断菜单，最后恢复正常书架。两项 A15 更新为 PASS。正式合计 **57 PASS、27 FAIL、252 NOT_RUN**，整页 0/21。已同步 29 个文件的当前指纹，目录父登记及 12 个变体的引用核验通过。其他目录挂载、真实系统缩放、连续绘制、读屏及视觉原稿仍按各自的证据条件。[登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-toolbar-measurement-20261118.current-refs.json)

### 书源筛选原生边缘命中

在同一签名候选的 320vp、原生字号 1.0 倍内存夹具内，完成 11 项可用筛选器的实际边缘命中，以及“自定义”禁用触摸。七种类型覆盖可见胶囊外与原生按钮内之间的透明响应带。点击各项后核对选中状态与相邻筛选组，底部工具回执再核对当前筛选值，并走 Back 返回正常书架。首轮在实际状态条横向滚动后误按固定五节点找目标，已修探针并沿同一 PID、同一页面代次续接，不重复前三项。[执行范围](../../.reader-artifacts/app-ui-framework-audit-20261114/source-native-filter-edge-plan-9649-20261118.md) [当前验收](../../.reader-artifacts/app-ui-framework-audit-20261114/source-native-filter-edges-9649-20261118.json)

Source 交互登记 revision63 已收录，源码、注册引用和实际签名输入已核对。其余控件的边缘、焦点和读屏、整页 E2 与 E3 继续使用原验收判据。正式 336 层保持 **57 PASS、27 FAIL、252 NOT_RUN**。

### 应用级大字号与固定页头续接

复用 DEBUG 页面结构入口，通过应用级字号 API 请求倍率，并从新挂载的 ArkUI Area 和像素转换读取实际结果。三项夹具回归已通过。原 VM 的 180vp 分组在实际 1.45 倍字号中可滚到正文原生末尾及两个完整响应框，实际动作计数依次为核对、继续、关闭，Back 恢复同一打开按钮。该次未采末尾文本截图，后文记录了补采结果。系统设置传播和完整 E3 范围继续独立计证。[原生字号计划](../../.reader-artifacts/app-ui-framework-audit-20261114/native-app-font-preview-plan-20261118.md) [分组动作与倍率回执](../../.reader-artifacts/app-ui-framework-audit-20261114/native-app-font-preview-20261118.evidence.json)

书源 320vp、2 倍显示暴露固定页头标题单行截断。已让标准固定页头依实际文字自然换行，继续使用原字号。初次换行后，真实 List 首项仍在旧边界；向下回顶后使用新回执。补齐书源首项的同一位置续接，只有首项仍处原顶部且无当前用户滚动或恢复锚点时同步。标题约束、同盒回执、顶部合并及回跳保护四项点名回归通过。[共享页头实施与复验范围](../../.reader-artifacts/app-ui-framework-audit-20261114/page-back-bar-title-growth-plan-20261118.md)

最终签装 `da463784257c`，原 VM 上同一 320vp 场景首开读得完整标题，首项与页头底对齐，搜索框保留 32px 间距。之后实测恢复 1 倍并回到书架。受影响的 21 份登记引用检查通过，Source 局部 2 倍回执已收录，正式 336 层保持 **57 PASS、27 FAIL、252 NOT_RUN**。其他固定页头、其余字体宽度矩阵、读屏及绘制连续性按原范围关闭。[签装、起点与恢复回执](../../.reader-artifacts/app-ui-framework-audit-20261114/page-back-bar-title-growth-and-source-top-20261118.json)

### 书源及书源工具大字号实测

复用已安装 `da463784257c`。书源默认态覆盖 320/366vp 与实际应用原生字号 1/1.3/1.6/2 共八组，其中两组复用同候选的既有证据。八组首项贴合当前页头底，搜索框留 32px，首行关键动作、状态和底栏标签可见。书源工具在 320/366vp 与 1/2 倍的四组均显示完整标题、导出说明和首个动作，首卡距页头 73px。完成后恢复 1 倍及正常书架。 [书源八组原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/source-app-font-native-matrix-20261118.json) [书源工具四组原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-app-font-native-20261118.json)

这两页已更新正式证据及 E3 原因，结论仍由原 row/chip/footer 所需尺寸回执、完整相应状态、系统字号来源和其他真实交互条件决定。本轮正式层统计维持 **57 PASS、27 FAIL、252 NOT_RUN**。 [登记校验](../../.reader-artifacts/app-ui-framework-audit-20261114/source-app-font-native-matrix-20261118.checks.json)

另补书源工具 320vp、实际 2 倍的首行。外层滚动后，选择、编辑、调试的原生响应框均为 **88×61.14vp**。首行标题和 URL 按原规则省略，三个动作文字完整。点选择框左边缘内 6px，夹具同代选中数由 3 变为 2，恢复后为 3，首行位置全程一致。首次探针误把检测进度里的同名行当作定位点，已改用可编辑行独有的 URL。再次运行的首行动作取得完整回执，末尾菜单仍读到旧 fp/vp 日志，脚本保留 FAIL。正常重开 Reader 后返回书架，六组稳定文字的位置与已验证的 1 倍书架对照一致，显示密度仍为 3.5。 [书源工具首行尺寸与边缘动作回执](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-row-320-2x-20261118.json)

旧 SDK 报告与当前代码指纹失配，已仅重跑书源 `matrix`。当前 120 个输入指纹复核通过，获得 32 个行形态、40 个目标尺寸及 24 组 SDK 预算。正式 E3 继续要求当前原生文字所需尺寸和状态证据。 [当前 SDK 行形态与预算](../../.reader-artifacts/app-ui-framework-audit-20261114/source-current-sdk-layout-matrix-20261118.json)

### 书源默认页原生行度量

已在 DEBUG 书源夹具给生产组件的原有 Text 节点接入可选控制器，读取排版后的行范围、宽和高。普通入口沿用原布局。夹具代次与退场拒绝回执的回归通过，32 个 SDK 行形态、40 个目标尺寸和 24 个预算通过。首轮测试记录端把 Text 内容与可选控制器合并，已修正记录并复测。默认沙箱首次拒绝流水线降低进程优先级，随后沿同一规范入口得到 x86_64 签名候选 `03bfea14a669`。 [签包、保数据部署与原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/source-native-line-evidence-20261118.json)

原 VM 保数据覆盖安装并启动。320/366vp × 1/1.3/1.6/2 倍实际应用字号共八组，采到 96 项同节点行度量。关键动作、状态和分类标签的文字范围完整，采到的可见 Text 框均容纳当前行。长书源名和 URL 沿现行规则省略。八组的首行、标题、元数据、状态与底栏文字布局高度与此前逐项相同。实测恢复应用 1 倍后返回正常书架，VM 显示密度为 3.5。 [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/source-native-line-evidence-20261118.checks.json)

正式 E3 继续覆盖筛选滚出视口后的父槽、其余书源和恢复状态。系统设置来源的 1.6/2 倍沿原证据条件单列。正式 336 层仍为 57 PASS、27 FAIL、252 NOT_RUN，整页为 0/21。

同候选还复验了 320vp、366vp 下 2 倍字号的状态筛选。实际横向滚动后，五个状态标签均可完整进入视口。每个文字框都位于对应原生按钮内，原生行宽和行高均能容纳，「自定义」保持禁用。两次宽度均取证，最后以新挂载确认恢复 1 倍并返回正常书架。该证据补齐最大字号的右侧筛选去向，Source 登记 revision 67。 [横向滚动与原生标签回执](../../.reader-artifacts/app-ui-framework-audit-20261114/source-status-native-tail-20261118.json)

### 当前 Figma 原稿来源

官方接口本轮返回 41 个画布。搜索原始母版 `2635:59600` 下有手机、平板各五种完整设计画面，分别是初始、加载、结果、空和失败。主流程的搜索历史、来源部分状态，以及书架、书源和工具若干画板明确标记当前源码。整页参考另保留书架、详情和书源的手机与平板装配。具体属性继续沿 10 月 8 日的搜索后继裁决和原设计账本。历史 403 保留时点，当前缺口为尚未取得剩余现版本组合的独立整页批准及其像素验收。 [Figma 来源核对](../../.reader-artifacts/app-ui-framework-audit-20261114/figma-original-authority-current-20261118.json)

### 下载页离开管理后的滚动位置

旧候选 `03bfea14a669` 在常规高度复现。管理态的章节行变短后，原生 List 将当前偏移限制在更小的范围。旧 Back 逻辑把这个偏移当作普通态位置，导致原本可见的第 18 章与「选择章节」退出视口。点名回归观察到旧路径恢复 80vp，进入管理前为 143vp。现实现保留原浏览位置。实际用户滚动或当前页面、字号、窗口几何失效时，才废弃原位置。

远程 VM 保数据覆盖安装签名候选 `cca8fe05bc6f`。常规窗口的第 18 章与「选择章节」回到相同坐标。168vp 短窗的「选择章节」完整可达，距原位置差 3px。短窗书籍管理也复验了两条路径，未滚动时 Back 恢复同一入口，实际滚到流内选择区后 Back 保留书籍列表当前位置。三次会话最终都返回书架，显示密度 3.5。下载六个登记的 A5 滚动层更新为 PASS。全应用登记为 **63 PASS、27 FAIL、246 NOT_RUN**，整页验收仍为 **0/21**。[签装、原生对照和点名回归](../../.reader-artifacts/app-ui-framework-audit-20261114/download-scroll-transition-repair-20261118.json) [六项登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/download-scroll-transition-repair-20261118.checks.json)

### 分组恢复大字号末行

在同一 `cca8fe05bc6f` 上复用 180vp 分组夹具，原生字体换算读到 1.45 倍，Notice 内实际 Scroll 为 156vp。展开并滚到底后，同一 Text 节点的截图清楚显示「分组长文案末尾。」及「核对分组」「继续原分组操作」。系统 Back 让原打开按钮恢复焦点。前次两项点击回执沿核过字节的九个相关输入复用，本轮未执行分组数据写入。应用预览已由新挂载实测还原至 1 倍，返回正常书架，显示密度为 3.5。UIF-05 此组件场景的末行画面缺口已关闭，业务持久化和系统字体传播仍按原条件取证。[原生画面与回执](../../.reader-artifacts/app-ui-framework-audit-20261114/group-tail-raster-current-20261118.json)

### 书源工具的系统返回与删除确认

沿正常设置、书源管理、批量管理与书源工具入口验证三条系统宿主。导出确认按 Back 关闭并回到同一原生触发器。确认继续导出后，实际系统保存页显示生成的文件名，按 Back 回到同一触发器并显示「已取消导出」。首次探针按 uitest 的 bundle 树识别选择器失败。以保存画面及文件名的相同像素核对当前打开实例后续接操作，无重新发起导出和保存文件。书源总数维持 838。

同一次排查发现，删除确认弹出时原 `requestDelete` 已经清空选择，Back 回来从已选 838 变为 0。现改由实际确认时复核并消费当前选择，复用既有 Runtime、页面 lease 和列表/选择 revision，旧回调不派发。旧源码的点名方法回归失败，修后与保留测试同过。签名候选 `0105807bc5dd` 保数据覆盖后，系统 Back 与「取消」都保留原 838 项，再恢复测试选择为 0，正常回到设置页。未删除书源。安装时旧停止态快照字节与当前不符，复用条件未满足，在本地副本核验兼容后才安装。

三个宿主登记为平台先处理 Back，工具路由 A1 与 S7 更新为 PASS。应用内恢复提示和其他覆盖层场景仍按 A9 原条件。正式 336 层为 **64 PASS、27 FAIL、245 NOT_RUN**，整页仍为 **0/21**。[原生回执与修复](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-native-platform-back-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-native-platform-back-20261118.checks.json)

### 书源工具应用内恢复覆盖

复用 VM 已安装的 `0105807bc5dd`。在真实 320vp 组件宿主和实际 2 倍应用字号下，原操作未确认与已确认待清理的两种长提示均由 StandardPage 的单个覆盖 Scroll 承载，两次滚动到达正文末行及各自的核对、继续和收起动作。截图与原生盒均验证。每个点按只返回一次当前内存意图，12 个样本和三个已选项保持，原确认事实沿各自代次不变。另在 1 倍验证回执待核对的短提示和原代次核对。

补齐点名 SDK 用例的共享页头、Scroll、编辑适配和实际 Area 装配。旧本地夹具缺运行依赖，也无法模拟原生分支移除。现在以实际 mount 测忙碌和动作资格，保留旧回调用于换代和卸载拒绝，点名 case 通过。VM 记录在最后一次返回书架点击后达到 60 步上限，保留原失败回执。独立只读确认正常书架已出现，应用字号已实测恢复 1 倍，系统密度仍为 3.5。

结合前次三个系统宿主 Back、正常工具返回和深度选择，书源工具 A9 标为 PASS。读屏、完整焦点、真实业务持久化和全状态矩阵仍按原各层验收。全应用 336 层为 **65 PASS、27 FAIL、244 NOT_RUN**，整页仍为 **0/21**。[原生截图、回执与点名测试](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-recovery-overlay-current-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-recovery-overlay-current-20261118.checks.json)

### 阅读内短窗目录与书签

`ReaderControlDirectoryContent` 按标签的布局代次装配工具栏和结果分支，当前新行使用本次结果代次。纯高度变化保留外层编辑 Scroll 和同标签结果 List。`bookmark-branch-admission` 在旧实现复现书签无回调，修后验证当前书签可选、旧回调继续拒绝。`short-sdk`、`prefix-anchors`、`keyboard-transfer` 同次通过。

`0.2.0.DEV.da87ec2af295` 已在远程 VM 保数据覆盖并启动。320vp 预览以原生应用字号 2 倍测量，122vp 与 190vp 两次各确认一次书签动作，返回章节后确认一次同章动作。恢复实际 1 倍应用字号并返回正常书架。没有执行持久书签写入。旧候选的高度回执判据失败和两次真实书签点击失败均保留。

两个短窗登记采用当前各自的编辑与结果边界。下一批先对账共享合同 §6.2 的短窗同列表前缀要求及当前限高同级编辑区，同时验证实际编辑滚动、锚点恢复、正常路由查询与焦点。维持已有 A3、A5 及适配结论，全应用 **65 PASS、27 FAIL、244 NOT_RUN**，整页 **0/21**。[最小场景与停止条件](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-short-current-font2-20261118.plan.md) [源码、签装与原生回执](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-short-bookmark-opening-current-20261118.json)

### 短窗查询合同和原生输入连续性

按原键盘实施第四步将持续挂载的编辑 Scroll、唯一结果 List 及其共同预算纳入 §6.2。登记使用现有查询模型的 Inline 决策，定向 `query-height` 拒绝非嵌入、零结果空间和第二个主滚动。两个短窗以当前包和实际 A3 盒关闭首屏结构。

原生复用 `da87ec2af295`，仅走应用内 320vp/2 倍字号预览，滚动→触摸输入→系统键盘→录入→Back→190vp 沿同一输入和 List 保留第 22 章与草稿。首次探针在尚未点按时把部分裁切判为失败，保留原回执；续验确认聚焦后整框已露出。最后恢复 1 倍应用字号并返回正常书架。总计 **67 PASS、27 FAIL、242 NOT_RUN**，整页 **0/21**。完整 A5 坐标及恢复、原生正常路由提交、实际过滤结果和其余适配继续按原条件。

书签筛选空态后续核对两个真实消费者。已提交查询但无匹配时沿既有 ReaderPageState 反馈，并由当前查询 owner 清除筛选。真正无书签、加载和失败按原状态处理。需覆盖当前和已退役动作、两条入口、短窗与正常容量。[当前回执和首屏预算](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-short-inline-contract-current-20261118.json) [定向登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/directory-short-inline-contract-current-20261118.checks.json)

### 书签筛选无结果及短窗首屏

`6f3c3cd1f5f6` 已签名和保数据安装，现有目录控制内容和独立完整目录的两处预览均完成已提交无匹配、实际清除、同标签恢复。短窗标题被已有大留白挤出首屏，手动滚动可达。该事实保留为独立未决；当前代码已使用共享 inline PageState 及其紧凑间距显示短窗筛选空态，并用实际标题和动作测量。真实无书签及正常高度配方继续使用原布局。

现有 `short-sdk` 和 `recipe` 已通过紧凑分支回归。只构建一次对应开发候选，待原生验证 168vp 首屏标题和清除、较大字号可滚达动作。非短窗控件、旧回执拒绝和清除动作沿已准确验证范围复用。[书签筛选原生与签装回执](../../.reader-artifacts/app-ui-framework-audit-20261114/bookmark-filtered-empty-current-20261118.json) [定向计划](../../.reader-artifacts/app-ui-framework-audit-20261114/bookmark-filtered-empty-20261118.plan.md)

已在 `0.2.0.DEV.c411bf4af760` 完成最后一次有界确认。168vp/1 倍和 190vp/2 倍同样在首帧呈现完整标题及清除按钮，两次点击均留在同一查询框并恢复书签。保留正常高度独立目录已通过的清除证据。登记重核还确认下载六项使用的导航改动仅属 `nav.sourceTools`，其引用的 8 个消息登记一致，更新共用登记指纹。短窗书签 A7 更新为 PASS。全应用 336 层为 **68 PASS、27 FAIL、241 NOT_RUN**，整页 **0/21**。[当前截图、动作及签装回执](../../.reader-artifacts/app-ui-framework-audit-20261114/bookmark-empty-compact-current-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/bookmark-empty-compact-current-20261118.checks.json)

### 漫画目录动态遮挡和滚动恢复

§9.1、登记 schema 和现有 G-03 已形成同一个动态补偿声明。八个漫画目录变体消费同一实测计算，固定与入流保留各自唯一的原生消费路径。点名 `dynamic-scroll-compensation` 已通过。复用两个精确组件布局与点按的数据，滚动位置恢复继续核对实际 signed 值及对应动作。无需为静态声明构建或重装。[定向计划](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-scroll-compensation-20261118.plan.md) [计算源码与原生图树](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-scroll-compensation-20261118.json)

《非人哉》实证确认正常目录从真实顶部重开会越过整个页头下的摘要和工具区。修复在已有的 Grid 位置捕获、目录会话锚点与 START 命令中续接测量，不再把首行前的留白截掉。相同 inset 保留实测位置；实际 inset 变化时按原相对进度复位。仅在固定漫画 Grid 的首个真实条目之前使用该记录，其余行仍按真实节点及行内比例恢复。

准确 `current-grid-geometry` 已通过，实际 `c411bf4af760` 失败保留。继续使用同一本书的正常书架条目、真实 Grid 顶部、Back 和重开确认修复候选效果。S3 和完整 A5 的其他形态分别沿已有范围。[滚动原始失败与代码回归](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-signed-restore-current-20261118.json) [最小验证计划](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-signed-restore-20261118.plan.md)

完成 `0.2.0.DEV.4f3b4acbb498` 指定签名、保数据覆盖、启动与同书正常重开。书架入口从之前普通条目自然切到同书续读卡，进入同一 reading body 和完整目录。本次 22 步实测，之前丢失的查询和第一话标题保留原盒，原书名摘要也保持位置。准确方法回归提供 signed 负/零/正证据，VM 覆盖实际顶部返回路径。跨宿主 A5 矩阵仍按原范围。全应用 **68 PASS、27 FAIL、241 NOT_RUN**，整页 **0/21**。[当前候选和原生恢复坐标](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-signed-restore-verified-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-signed-restore-verified-20261118.checks.json)

在候选 `0.2.0.DEV.4f3b4acbb498` 复用同一本《非人哉》，补齐正常固定 Grid 在起始留白内及进入章节区后的重开。两处 raw 分别由原生行相对顶部的位移估算为 −789px 和 +152px，分别核对 8/11 个同一章节项，前后最大坐标差均为 0px。两次的新 Grid 均承接原位置，并保留相同页头、页脚坐标。37 步后回到正常书架。[原生回执和当前源码指纹](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-scroll-matrix-current-20261118.json)

当前 `catalog-result-position` 与 `projection` 两个点名 SDK 已通过，覆盖语义 Grid 更换结果和拒绝旧视图，以及平面 fallback 空结果清除、固定 START 与入流 Top。正常固定 Grid 的顶部及两个非顶部恢复证据已登记。A5 仍待准确原生 raw 0 与固定平面装配的初始定位、清除实测，S3 继续按真实遮挡及操作条件验收。登记 revision 71 总计 **68 PASS、27 FAIL、241 NOT_RUN**，整页 **0/21**。[定向登记校验](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-directory-scroll-matrix-current-20261118.checks.json)

### 移除确认的纯高度交接

补验原 `removal-resize` 启动点之前的窗口链路。实际协调器收到有限 WindowPort 的 `windowSizeChange`，写入新 AppStorage 版本，由 SDK 测试端口将该版本交给现有 `@StorageLink`。在固定宽度、安全区、字体及原长文的条件下，窗口 600→320→700vp 对应同一 Scroll 的 352→72→452vp。重复通知没有再次发布。当前签名包的四份直接生产输入均与执行输入摘要相同。实际系统窗口 resize、文本末尾及动作命中仍使用原生关闭条件。[当前代码交接证据](../../.reader-artifacts/app-ui-framework-audit-20261114/removal-window-to-scroll-20261118.json)

### 下载章浏览行和内容层登记

以批准的下载页原稿和旧候选的正常章节列表定位同行缺口。旧码浏览行无论文字与操作能否同时容纳，外层均允许换行，原生在 365.71vp 把两项操作放到下一整行。以现有 `SharedDownloadPage.chapterRowWrap` 核算文本和尾部操作的最小预算，保持窄场景可换行、内部标题和状态按需增长。章节管理分支及既有动作身份沿原装配。三个章节内容层的槽位、密度、截断和控件引用已按章节登记，不再套用书籍卡片。

点名 `download-chapter-width`、`download-accessibility`、`book-row-density` 和 `management-scroll` 通过。签名包的生产快照仅变动 SharedDownloadPage。保数据安装至已授权 VM 后，原样本的阅读、下载、暂停与更多完整同行，长标题和当前章标签均可见。夹具内动作只做读取与退出，总结复验记录还附两次收尾探针未派发的失败和最后实际回到书架的回执。前三个书籍内容层与章节浏览、固定管理记录 A6 PASS。实际原生命中、读屏、适配及原稿覆盖依旧按原层。[定向回执](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-browse-alignment-current-20261118.json) [登记校验](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-browse-alignment-current-20261118.checks.json)

余下 168vp 流内章节管理复用同一签名包。一次滚动后，第 6 章原生整行高 282px，复选框、标题、状态均在该行与同一 List 视口内，原有动作车道按实测登记。按 Back 后，实际书籍行仍在此前位置，页头已滚出视口。用确切书籍节点确认返回，并完成正常书架收尾。下载六种装配的 A6 全部通过；336 层 **74 PASS、27 FAIL、235 NOT_RUN**，整页 **0/21**。[最终登记与原生范围](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-browse-alignment-current-20261118.json)

### 区分下载章节的两个空结果

按同一正常 `SharedDownloadPage` 的读取 DTO 分配状态。确认 0 个可读章节、没有目录数据、读取中和读取失败各由原事实决定，已有条目继续留在原 List。两种成功空态无重试动作，失败态重试核对当前书和失败投影后沿既有读取入口。正常页头与底部的章节管理动作都读取同一管理资格，已有管理保持完成退出的能力。消息登记继续由现有 `chapterPage` 负责。

`chapter-read-states`、`chapter-selection-actions`、`management-scroll`、`state-samples`、`text-projection` 与下载页定向消息检查均已通过。真实 Gateway 用例覆盖成功返回的已知 0 与未知总数。旧代码空态断言失败及管理滚动夹具补入真实可选书章的过程已保留。

候选 `0.2.0.DEV.0fa161a0cda9` 在既有 VM 保数据覆盖。两个新输入均在同一生产章节页面显示相应提示，已知 0 同时显示确切总数，未知总数保留空白。顶部和底部均实测不可启动管理，实际点按后仍保持原生实例及浏览状态，最终回到书架。现有工具白名单拦住新菜单项的回执保留；续验使用同一菜单实际条目，复用当次安装。三处章节装配更新 A10 事实和准确证据，A10 完整状态矩阵仍按原条件。总计 **74 PASS、27 FAIL、235 NOT_RUN**，整页 **0/21**。[原生、SDK 与消息入口回执](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-empty-current-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/download-chapter-empty-current-20261118.checks.json)

### UIF-05 分组恢复容量按原条件结项

既有证据核对到当前安装候选 `0.2.0.DEV.0fa161a0cda9` 的 12 个同字节输入。实际宿主由 180vp 扩至 320vp 再回到 180vp，同一 Scroll 对应 156、296、156vp。应用字体 1.45 倍下完整绘制长文末行及两个恢复动作，内存原回执各接纳一次核对和继续。正常书架的单独入口证据确认 Back 后同一书籍的更多按钮重新取得焦点。点名 SDK 证据覆盖零容量、恢复容量、忙碌与过期动作。业务持久化回执、系统字号与完整无障碍矩阵保留各自原要求。诊断菜单壳的不同哈希在证据中单列核对，本次复用未重跑 VM。[原条款与证据对账](../../.reader-artifacts/app-ui-framework-audit-20261114/group-original-capacity-closure-20261118.json)

### 书源工具空列表、待核对与提前停止

空列表读取失败现只提供一个“重试”按钮，动作校验发出按钮时的页面 opening 和读取代次。成功读取零条可显示“暂无书源”；有待核对回执时使用既有恢复覆盖槽。批量检测停在首条结果之前时保留“已停止”、0/3 进度和剩余项，取消将来会出现结果的提示。旧代码的 SDK 探针记录到重试派发 `[8, 8, 9]`，修复后为 `[8]`。同批装配、加载动效、原检测 owner 停止及定向消息入口均通过。

候选 `0.2.0.DEV.90ef1d2193a3` 已在授权 VM 保数据覆盖。三种内存输入通过实际生产页和原生动作验证，检测停止只派发一次，最后回到正常书架。首轮把首屏外提示作为需可见项，续验从同一检测页滚动。后续日志另有输入初始化事件，按动作种类确认唯一停止回执。诊断入口的返回按钮部分被安全区裁切，最后一次在可见区点按返回。首次夹具编译的 ArkTS 对象展开错误、各原生中间回执及修正保留。A10 真实业务回执和完整状态矩阵继续按原要求。登记为 **74 PASS、27 FAIL、235 NOT_RUN**，整页 **0/21**。[源码、构建和原生证据](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-read-and-batch-state-20261118.json) [登记核对](../../.reader-artifacts/app-ui-framework-audit-20261114/source-tools-read-and-batch-state-20261118.checks.json)

### UIF-02 三个正常宿主按原范围结项

当前候选 `0.2.0.DEV.90ef1d2193a3` 的定向 SDK 用例验证九处偏好接线、两种偏好、打开过程中切换及旧回执拒绝。下载状态下拉通过真实 Tab、Enter、Back 和外点。同一个原生触发器在关闭后保持焦点，原筛选值保持。书源工具检测深度的四个选项完整出现，Back 与外点仅关闭下拉。由相邻已聚焦的关键词输入直接 Shift+Tab 可到达同一下拉，Enter 展开，Back 恢复原触发器焦点，关键词、检测模式和深度保持。

TXT 目录规则复用正常入口的原生回执，十个当前生产输入逐字节一致。三个独立 8 秒 ArkUI trace 记录到各自 ReaderSelectPanel 创建与销毁，工具、下载、规则分别取得 3175、3156、3267 条完整记录。各现场采到的 RunningCustomAnimation 值均为 0。各次临时开启应用内减少动态效果均已读回恢复 false，最终为正常书架。书源工具首轮误将全屏遮罩边界当菜单面板边界，之后按子面板实际位置补验。两次键盘探路失败也保留，分别为默认 Tab 先移至顶部导出，以及先按 Back 收输入法后相邻 TextInput 失焦。

此结项覆盖原方案指定的三个代表入口。连续像素 G05、全目标焦点与读屏、各页独立视觉与完整 E2/E3 仍按原要求。正式登记为 74 PASS、27 FAIL、235 NOT_RUN，整页 0/21。[原范围证据、原生快照和 trace](../../.reader-artifacts/app-ui-framework-audit-20261114/uif02-popup-original-scope-90ef-20261118.json)

### 详情入口漫画完整目录的固定章位验收

当前候选 `0.2.0.DEV.90ef1d2193a3` 沿正常书架进入《非人哉》，从该行更多操作的“书籍信息”进入详情，再打开完整目录。1286 个可读条目的实际 Grid 首屏可完整显示 5 条。770vp 应用可用高度内，页头实测 52vp，章位框 48vp，工具组 180.86vp，首行距应用视口顶部 260.57vp。实际滚动时，页头和底部章位框坐标保持。骨架、信息架构、页头、页脚四项由 NOT_RUN 改为 PASS。

在同一目录验证无匹配搜索。Back 收起键盘后草稿保持，清除恢复 1286 条、同一输入实例、首行和页头原位置。再次 Back 返回同一详情入口，原生按钮实例、坐标与焦点均核验通过，最后回到正常书架。首次取证把共享文字与原生 Button 同时计为目标，按唯一可见 Button 续验后通过。正常交互回执只用于对应状态，全量路由、查询及其他状态仍按原判据。

同批修正四个漫画流内登记的区块顺序。实际 `BookDirectoryPage.mangaToolbar` 把流内章位放在工具组末尾、目录首行之前，占位由 Grid 或 List 前缀支付。定向 `adaptive-footer` 通过，覆盖实际共享 Scaffold、固定和流内章位装配、原生 Area 更新及旧负例。流内原生行为和实际窗口适配仍待对应场景。代码与安装包继续复用现有候选。全应用 336 层累计 **78 PASS、27 FAIL、231 NOT_RUN**，整页 **0/21**。[原生与登记证据](../../.reader-artifacts/app-ui-framework-audit-20261114/detail-manga-structure-90ef-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/detail-manga-structure-90ef-20261118.checks.json)

### 漫画换源目标目录首次打开与直接单选

旧候选 `0.2.0.DEV.90ef1d2193a3` 的固定高度目标目录首次打开时，原生首个可选章节载体从 y254 开始，固定页头覆盖到 y346，查询输入没有出现在当前可见树。现有回归复现了无当前章、无有效锚点时，定位将当前 260vp 起始留白再传为额外偏移。修复沿用已有目录回顶分支，完整语义 Grid 的初始对齐使用 START 并等当前视图布置，保留已有锚点、当前章节、Quick 和流内前缀的既定策略。旧脚本后续目标扫描超时保留，旧截图和实际 SDK 构造共同定位原因。

`catalog-result-position`、`current-grid-geometry`、`busy-catalog`、`direct-selection` 均通过。旧 `busy-catalog` 定向夹具补齐当前编辑 Scroll 和目录发布输入，继续验证真实待提交 owner 忙态、重复点击合并和 Back。当前 `0.2.0.DEV.9de0fda0e4cf` 完整编译并按既定私有身份签名，生产快照差异仅 `ReaderDirectoryNavigationList.ets`。已在原 VM 保数据覆盖，正式验证完回到书架。

全高内存装配无需滚动即显示标题、工具、查询和首个可选章节。168vp 流内装配实际章位在首个可选章节之前。两个场景的 Back 均可用、每个首章只收到一次内存选择意图。详情来源固定装配的 A2/A3/A4/A8 与 168vp 流内装配的 A2/A4/A8 更新为 PASS。四个目标登记改用当前根部 `ReaderSourceSwitchSurfaces`、`MangaSourceSwitchPresentation.directoryBack` 和直接单选 Back 契约，并按真实参数移除目标页的当前阅读徽标与下载栏描述。实际书源查询、真实换源提交、正常阅读父覆盖层、完整 E2/E3 和整页视觉继续按原要求。当前 **85 PASS、27 FAIL、224 NOT_RUN**，整页 **0/21**。[源码、两份原生回执与部署](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-target-first-open-20261118.json) [登记检查](../../.reader-artifacts/app-ui-framework-audit-20261114/manga-target-first-open-20261118.checks.json)

## 2026-11-18 书源管理空列表状态实施

修复 `SourceManagementPage.sourceList` 在保留零条首次读值或存在待核对写入时的显示。`failed` 与 `refreshFailed` 使用同一个整页读取失败入口，加载识别实际读取和回读事实。有可用行时沿用列表与局部提示。共享重试及状态动作携带渲染代次并校验当前开页，拒绝旧回调。新增两种内存场景，经现有 DEBUG 菜单挂载实际生产页面。`list-state`、`source-states` 与书源管理文件消息接线各自通过。 [旧缺陷、修正和测试边界](../../.reader-artifacts/app-ui-framework-audit-20261114/source-management-list-state-20261118.md)

一次签装后的 VM 核对验证了读取错误重试与待核对动作各产生一次当前开页回执。菜单滚动超时后的续接复用同一安装及先前两项回执。已退出到尺寸与预览前一致的书架。A10 补录新状态覆盖。A6 新增 320vp、2× 三行裁切及字形取证，三条 URL 均只画出协议前缀，域名显示和完整内容层继续验证。正式分层 **85 PASS、27 FAIL、224 NOT_RUN**，整页 **0/21**。 [定向签装与复验回执](../../.reader-artifacts/app-ui-framework-audit-20261114/source-management-list-state-20261118.json)
