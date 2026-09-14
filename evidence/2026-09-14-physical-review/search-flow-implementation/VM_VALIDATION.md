# aa387f08 HAP 与 VM 验证记录

本记录绑定 run `20260914T171802Z-aa387f08-71c7172c`。HAP 构建、校验、VM 保数据安装与启动已通过；功能证据仅覆盖下表实际操作。**PH90 内容搜索收起后回到首条的终态符合用户原约定；精确中途 paint 未验，本轮不作全部交付或用户验收通过的结论。** 本地书原始采样截至 2026-09-14 17:46:30 UTC；随后核对历史合同，撤回初判的“位置丢失”结论。在线书源新现象另列于证据边界。

## 产物与部署链

| 项目 | 已核对事实 | 证据 |
|---|---|---|
| 构建源码 | Harmony `aa387f08dceef4592c6bf642ca7bd351de1b0f8c`、Core `28369db9405822f4b8277eb95ad94057f177b7bb`；manifest 中两仓均 clean | [不可变 manifest 副本](ph77-91-hap-manifest.json)；原件 `.reader-artifacts/hap/20260914T171802Z-aa387f08-71c7172c/manifest.json` |
| 构建等级 | `iteration`，`acceptanceEligible=false` | 同上；clean 源码不等于 acceptance 产物 |
| Core 官方门禁 | 3832/3832 PASS、0 skipped，含 1 leaky；210 conformance、0 drift，C/C++ ABI smoke 为 ok | [最终完整日志](ph77-91-core-official-final2.log)；[LEAK 审计](ph77-91-leak-summary.json) |
| Harmony 门禁 | 本次正式 HAP 入口执行 260 项通过 | [本次完整构建日志](ph77-91-hap-build-second.log)，`Harmony contract tests passed: 260`；旧 250 项属于早期记录 |
| Native | SDK smoke PASS；输入 `.so` SHA-256 `e53ce3b57639329eabbfd4b465527cbdbac2427aa4395d7e7643001f43883c3a`，与 manifest vendored Native 一致 | [Native 构建日志](ph77-91-native.log) |
| HAP 编译/签名 | ArkTS、非增量构建、打包、签名、内置源字节检查 PASS；编译警告完整保留，未声称零警告 | [构建日志](ph77-91-hap-build-second.log)、[verify](ph77-91-hap-verify.log) |
| 签名包 | 167837451 bytes；SHA-256 `720e4709979005f8dc785c768bcb76208a8ea6ebcc250a05dfa88a818861cc98`；签名 verified、debug Profile | manifest、verify 与部署回执三者相符 |
| VM 安装/启动 | 2026-09-14 17:20:51 UTC 完成；目标类型 VM、targetRef `6460677a198b`；已安装身份与签名包匹配，`dataPolicy=preserve`，install/launch PASS | [部署回执](ph77-91-vm-deployment.json)、[安装日志](ph77-91-vm-install.log)、[身份检查](ph77-91-vm-inspect.log) |

manifest 的 `vmInstall: OPEN` 是构建完成时的不可变状态；后续安装以同 run、同 HAP SHA 的部署回执为准，不倒写 manifest。此次记录没有运行新构建、设备命令或 Git 操作，也没有复制 HAP、签名私钥或本地签名配置。Core 的 leaky 是测试输出管道关闭异常；既有审计发现兄弟测试/子进程继承输出管道的证据，未证明 Reader 应用堆内存泄漏，也未隐藏该异常。

## 已完成的 VM 操作

使用 VM 已有本地书 `ReaderPagingAudit20260911`（150 章）及已有搜索历史；没有为增加样本而导入新书或新增搜索历史。安装采用保数据更新，正常阅读操作仍可能按应用既有流程保存进度。

| 反馈 | 本次事实与状态 | 证据及限定 |
|---|---|---|
| PH80 历史直接展示 | **当前样本 PASS**：已有一条历史直接可见，没有展开入口 | [搜索截图](ph81-vm-reentry-frame-1.png)；只验证现场实际历史数量，没有凭单条历史宣称长历史滚动完成 |
| PH81 自动输入法 | **VM 重入 PASS，首次冷进入延迟 OPEN**：只点书架搜索，未点击输入框；采样 0 已见 IME 上滑、光标和历史，采样 1/2 显示完整键盘 | [审计与原始时间窗](ph81-native-first-open-audit.json)、[操作摘录](ph81-vm-reentry-operation-excerpt.jsonl)。最初空 body/无键盘截图及只有 SceneBoard 的 dump 均保留，不当作永久缺控件；冷进入精确延迟未测 |
| PH82 光标形状 | **观察到的空输入场景 PASS**：光标为竖线；稳定 dump 的输入框聚焦，隐藏 Web 未聚焦 | [采样 0](ph81-vm-reentry-frame-0.png)、PH81 审计；系统选择手柄与插入光标不混称 |
| PH83 详情目录预览 | **PASS**：固定预览视窗可向下滚动，末端可见第 17、18、19、20 章，未把 20 行一次撑开整个详情 | [末端截图](vm-preview-end.png)；[详情/滚动节点摘录](vm-validation-artifacts.json) |
| PH84 外部完整目录 | **入口与返回 PASS**：点详情“完整目录”进入独立目录，随后返回“书籍详情”；该外部入口没有先显示第 17 章正文 | [正确目录截图](vm-external-toc-correct.png)、`external-toc-correct` 与 `toc-return` 的[节点/操作证据](vm-validation-artifacts.json)。既有 standalone 壳保留顶栏、拖动条和“收起”，此次历史复核未将其列为新增样式缺口；不另行宣称 Figma 全像素验收 |
| PH87 阅读更多 | **稳定菜单显示 PASS**：实色背景、边框、指向箭头、右侧锚定及三项文字可见；本地书“下载全部章节”禁用 | [稳定截图](ph87-vm-popup-frame-5.png)、[审计](ph87-native-popup-audit.json)。首张“幽灵文字”是进入过渡采样，原图仍保留；本轮截图没有验证三个菜单业务动作的设备执行 |
| PH90 内容搜索 | **输入/加载/滚动及收起终态符合约定；精确中途 paint 未验**：完整态可输入“段”，原生 List 显示结果；关闭键盘后可继续滚动至第 2 章段 09—第 3 章段 01。点击“收起”后回到第 1 章段 01，符合搜索完整收起后丢弃旧完整页位置的既定规则 | 详见下一节。没有把本地 SDK 50/2000/10000 行测试当成 VM 结果总数，也没有从 `results50`/`results200` 文件名推断实际数量 |
| PH91 搜索图标 | **观察到的快/完整态 PASS**：输入框内部不再重复放搜索图标，右侧保留单个搜索按钮；有查询时显示青色图标，空查询禁用态较浅 | [完整态](vm-content-search-full.png)、[快捷态](vm-content-morph-quick-failed.png)；同图可见 Quick 首条终态，历史合同复核已排除“应保留 Full 锚点”的初判 |

误命名的 `reader-control-ph7791-external-toc.png/json` 来自此前误点第 17 章预览行，实际上打开了正文，**不能用于判断外部目录入口**。其身份与排除原因保留在 [证据索引](vm-validation-artifacts.json)；PH84 只使用 `external-toc-correct` 和随后 `toc-return`。

## PH90 收起终态：初判经历史合同排除

原始现象保持不变：aa387f08 包中，在完整内容搜索输入“段”，结果列表滚动到第 2 章段 09—第 3 章段 01；2026-09-14 17:46:27.071 UTC 点击“收起”。收起后的稳定采样 14 及 17:46:30.291—30.940 UTC 的快捷态 dump 显示第 1 章段 01。根任务和本文此前把它初判为“位置丢失”，该判断已撤回；不是通过修改生产把这一终态改回旧位置。

[用户确认的执行参考](../../../docs/READER_CONTROL_BAR_EXECUTION_REFERENCE_2026-09-05.md)第 196–214 行明确区分两类交互：目录/书签遵守原同列表上下文规则；搜索等滚动页从当前真实位置开始收起，完整收起后丢弃旧完整页位置，下一次新展开到顶部。搜索快捷态从自身当前位置连续展开至完整页顶部；同次未完成动作的反向、重抓及持指端点仍须保留当前轨迹。因此，**本次 Quick 首条终态符合原约定，不应新增“搜索 Full→Quick 必须保锚”的需求，也不修改生产来满足这项误判。**

合同复核与[真实生产方法探针](ph90-vm-collapse-anchor-current.jsonl)说明 `readerControlMorphScrollPath` 从 Full 出发采用 `quickOffset=0`：50 条完整数据、起点 26.25 行，p=1/.75/.5/.25/0 时对应 26.25/19.6875/13.125/6.5625/0 行；同一 DataSource 无 reload/change/add。探针中的原生回执是受控测试输入，不是实测设备 offset 或 paint。三项既有本地回归通过：[native List](ph90-vm-contract-native-list.log)、[滚动合同](ph90-vm-contract-search-scroll.log)、[SDK Builder](ph90-vm-contract-search-settings.log)。详细解释见 [PH90 专项末节](ph90-content-open.md)。本次未改生产或测试，没有增加新交互要求。

`content-deep` 的原生 List 范围为 `[134,774][1148,2686]`，快捷态为 `[130,1831][962,2343]`；原始节点、时间与图像均保留：[证据索引](vm-validation-artifacts.json)、[操作记录](vm-directory-content-operation-excerpt.jsonl)、[快捷态原始截图](vm-content-morph-quick-failed.png)。截图文件名中的 `failed` 是初判时的命名，保留原件身份，不再表示当前结论。

剩余边界是**精确中途 paint 未验**：收起开始前是否可见跳顶、动作中是否空白、Ace 可见区/原生回执/paint 是否同帧，以及未完成反向是否连续，不能只凭终态或桌面探针全判通过。同一 UUID 的 frame 编号跨不同测试场景；frame 0/1/2 是书籍搜索输入法，frame 14 是内容搜索 Quick，不能拼成收起过程的连续动态证据。

## 保留的证据边界

- 300/1000/3000 ms 是截图命令的计划采样点，另有实际触发偏差与 screenCap 耗时；它们不是精确 native 帧时间。约 3184 ms 的 HDC 采样操作耗时不是键盘或菜单响应耗时。
- dump 中的 ListItem 节点数只能说明该次转储内容，不能证明整个数据源总量、Ace 全部实例数、同帧 materialization/paint 或帧率。输入、滚动有反应也不等于性能指标已达标。
- 真实在线闭环仍未通过。根任务追加观察到本次在线搜索 109 源约 3 秒全部失败，正在从运行日志定位；这不是搜索速度 PASS，也没有证明书源请求成功。停止/失败重试、详情→换源→试读→原详情→原搜索闭环、松鹤响应和 PH76 实际资源捕获仍为 **OPEN**。本地书测试不替代网络/书源事实。
- 物理设备上的本包行为、全部 PH77–91 反馈关闭、用户验收仍为 **OPEN**；本记录未取得同 run 的真机部署回执，旧包真机安装不能代替此包。
- 早期 250 项 Harmony / 3811 项 Core、早期 Native 和 HAP 编译失败均保留为历史；当前门禁数量为 **260 / 3832**，且当前包仍是 iteration。

仅复制必要截图、完整构建/校验/部署日志和精简的目录/内容操作摘录。13 份较大布局转储保留原文件 SHA 与相关原生属性摘录，未批量复制所有应用树；[证据索引](vm-validation-artifacts.json)记录每个副本的来源及校验值。
