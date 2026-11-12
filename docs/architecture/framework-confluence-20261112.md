# 页面契约与 UI 框架合流实施记录

2026-11-12。用户已授权按合流方案实施。当前记录属于本次限定整合，长期页面定义进入 PAGE_STRUCTURE_CONTRACT，历史页面试点记录继续保留原始结果。

2026-11-13 新增代码侧全量开发与全页面排版独立审计。当前批次的覆盖、分工及完成条件见 [代码侧独立审计记录](code-side-ui-audit-20261113.md)，全部开发与审计 agent 完成后才进入后续原生阶段判断。

## 前轮已安装候选

本节保留11月12日结束的设备操作及其固定候选。11月13日新增的代码开发与独立审计由上方代码侧记录承接，当前工作树已在该历史候选之后发生变更。第四次保数据安装后的具名场景、真实字号及恢复结果绑定下表字节，下文早期构建、失败及现场准备记录保留各自时点。

| 项目 | 当前事实 |
| --- | --- |
| 历史候选源码 | `9ce09f588c05b1dcdca310f73d6eb66cdf893d5a`，该候选构建快照为 clean |
| Core / UI 配套 | Core `e689f2ae65bb77e23c15f7f054d8917463d1f5dc`；UI `9bfc916` |
| 最新候选 | `b447de33e4f2`，run `20261112T152829Z-9ce09f58-d9a3f259`，`0.2.0.DEV.b447de33e4f2`，versionCode `1000000` |
| 签名 HAP | SHA-256 `64dd34f940ef41f206fa225f1390d56e3d88daa90869452d721cb0f2e688cb84`，指定证书验签通过 |
| 最新部署 | `deploy-vm-6460677a198b-20261112T153242Z.json`，install / launch 均 PASS，dataPolicy 为 preserve |
| 契约登记 | 21 个实例、230 项唯一输入，输入无漂移；model / refs PASS；register 保留 39 项开放诊断与 403 项人工观察 |
| 登记开放项 | E2 FAIL 21 项、E3 FAIL 5 项、G-03 NOT_RUN 8 项、B1 NOT_RUN 2 项、SCOPE NOT_RUN 3 项 |
| 当前原生阶段 | 历史准确场景按后文复用；b447 的分组、筛选、只读检测、忙碌拒绝及 Manga 正文已观察，真实 1.45× 与恢复已记录 |

最新部署回执 SHA-256 为 `e8110e98c9853414aca3ccdf433a12dd0513a2cd494e94261a431d9ceadee96f`。规范构建使用 `contracts-scope none`，产物仍为 iteration，完整套件未执行，产品验收保持 OPEN。[最新 manifest](../../.reader-artifacts/hap/20261112T152829Z-9ce09f58-d9a3f259/manifest.json)、[最新部署回执](../../.reader-artifacts/hap/20261112T152829Z-9ce09f58-d9a3f259/deploy-vm-6460677a198b-20261112T153242Z.json)

## 固定输入与工作区

- HarmonyOS 基线为 PR #22 的 `8f825544afe4cff659fd97201f1f7003ff127210`，SVG #21 为 `bf24f1a85126a85928211fc3539e1c133c461619`。
- 最初冻结的 UI 权威主题为 `cff94a46c1f9280fbd3a33088641f0f090d1d1fb`，Core 为 `1cff7d5db9cf89cf5e5baf77650c7668fb80cf58`。后续已批准配套变更见当前执行状态，原冻结输入保持原字节。
- 整合分支为 `codex/framework-confluence-20261112`。工作区位于 Reader 下的 `.reader-isolated/framework-confluence-20261112`，三个仓库成套检出。
- 原工作区 dirty 内容保持原位。选定本地输入冻结 580 个文件，清单位于本次私有 `.reader-artifacts/framework-confluence-20261112/local-inputs-manifest.json`，实际快照位于原工作区同名批次目录。
- 应用版本沿用 `0.2.0` 与安装计数器 `1000000`。产物采用指定 minliny_HarmonyOS 证书及既有保数据部署入口。

现有受管 worktree 均有并行修改。桌面 create_worktree 拒绝嵌套仓库 sourceRoot 后，本批采用独立克隆检出，Git 对象复用本机仓库，源码和分支独立。

## 行为及职责裁决

| 范围 | 合流决定 |
| --- | --- |
| 几何 | 采用 PR 的唯一正文 owner、只读 window port、当前代读取和回执守卫 |
| 页面契约 | 迁入 16 层 schema、推导、登记、引用和证据检查，重绑实际路径和 owner |
| D1 | 保留书源现有工具、批量管理及新增入口 |
| D2 | 移除未使用 groups prop，选项来自当前 sources |
| D3 | 下载普通浏览的页头和普通 dock 属于同一 List，管理 dock 按真实预算准入 |
| D4 | 四项条件和有效锚点归 SourceJourneyPresentation，按同 Runtime 的 Tools 返回上下文恢复 |
| B4 | blocked/unknown 下允许只读检测，实体、单飞、任务和定义身份仍须有效 |
| 目录 | 保留远端自然 minimum profile 与行测量，合入短高度前缀、焦点和键盘观察策略 |
| 共享控件 | 使用当前原生交互节点支付 44vp 目标和父预算，分组面板计入两侧描边 |

## 执行批次

| 批次 | 交付范围 | 当前状态 |
| --- | --- | --- |
| 1 | 固定跨仓输入、本地快照、差异及依赖 | 已完成，输入冻结 |
| 2 | 运行时框架与页面契约合流 | 已完成 |
| 3 | 书源、Tools 和共享控件 | 已完成 |
| 4 | 下载常态列表及目录短模式 | 已完成 |
| 5 | 当前装配、反例、引用与证据重绑定 | 已完成 |
| 6 | 配套 Native、签名候选、保数据部署及原生验证 | 四次成功保数据安装；本轮具名采样结束，准确结果与未验范围分层记录 |

## 本批检查选择

执行前逐项说明实际 case、嵌套依赖、范围、风险和必要性。未选检查保持 NOT_RUN。本轮用户的全量实施对应上述交付范围，检查依据仍按本次实际影响选择。

| 实际入口 | 嵌套与范围 | 保护的风险及必要性 |
| --- | --- | --- |
| test-svg-fill-adapter 的 interior-attribute-order、none-attribute-order | 实际 renderRecipe 与两个生产 recipe，私有临时 SVG | 两个 PR 同改资源工具，须证明主题迁路径后仍支付每个 path 的填充语义 |
| validate-model、check-contract-refs、具名模型正反例 | JSON schema、当前登记、生产符号及引用 | 目录迁移和 owner 变更需要重新建立可解析合同 |
| Source 定向 case | 具体清单见本批 source-plan.md，实际 Gateway/Orchestrator/Journey/SDK probe | 规则定义、旧回调、登录准入、过滤与返回状态共同改变 |
| Downloads 定向 case | 具体清单见本批 download-plan.md，生产页面方法与 SDK 装配 | 常态滚动、管理 dock、章节锚点和输入资格共同改变 |
| Directory 定向 case | 具体清单见本批 directory-plan.md，真实 List 前缀/测量/焦点与旧代码负例 | 短内容装配与 minimum profile 合流需要验证 native/data 索引和焦点状态 |
| 共享控件目标与消费者 | 选定真实 modifier/原生 Button/ChoiceRow SDK 路径，搜索筛选、外观和 InlineSelect | 真实 carrier 已变化，旧 Text 尺寸证明需要重新绑定 |
| 当前候选规范构建 | hap-pipeline，contracts-scope none；仅本次直接需要的 Native/SDK/签名/包字节检查 | 整合后的完整 ArkTS 装配和跨仓配套身份必须由同一候选证明 |
| 当前候选原生变化场景 | 同一已授权现有模拟器，准确 server/target 租约 | 代码侧不能证明命中、IME、系统字号与实际窗口遮挡 |

## 证据与回滚

本地 HAP15、远端历史候选和已有 Native 证据保留原时点绑定。源码、方法、SDK、产物、安装、原生与用户验收分别记录。必要源输入改变时按实际依赖复验。

代码按功能追加可逆提交。已运行数据的二进制回退重新进行兼容及保数据准入。原始失败、私有用户数据、签名材料和历史 UNKNOWN 内容保持既有保护边界。

## Native 配套动作准入

本批最初选择新 Core 的 `scripts/build-harmony-napi.sh --abi x86_64` 生成配套 SDK、SO、storage companion 和输入快照，后续规范构建及同步已完成。该入口只调用规范 build-ohos、reader-ffi release cross-build 及 CMake/Ninja；host probe 与 SDK smoke 保持未选。必要性是新的保数据安装边采用 x86_64/Library47，历史 arm64 配套不能代表当前 Core 身份。

本机为 arm64，当前 Core 固定 Rust toolchain 已安装 x86_64 OHOS target。显式复用既有 `/Users/minliny/Documents/Reader/Reader-Core/target` Cargo 缓存，遵守共享 build-resource lease 和单重型任务预算。该阶段先完成 Native 配套，再进入签名候选、现场存储证明及保数据安装。

Native 第一次执行在取得租约后的降低当前 worker 优先级处被沙箱拒绝，编译尚未开始。原 native-build.log 保留。第二次通过受审执行权限运行同一规范入口，以完成所要求的进程优先级和工具链操作。

## 首批实际结果

- SVG 两个属性顺序 case 通过。
- 模型 schema 通过。初次引用检查发现旧目录、Index owner、私有产物和旧指纹引用，随后已按实际结构完成重绑，原 refs-initial.json 保留。
- 共享控件 source-native-targets、source-group-budget 通过，分别检查新 Native Button 的28个字号/变体组合及分组实际面板/选项父预算，并包含旧28vp负例。
- choice-live-admission 初次因旧 Settings 路径失败，修正实际消费者路径后8个变体及正反传播通过。原日志保留。
- 新 Core 的 x86_64 Native 构建通过，Core输入快照为28e3813135c5063c212bbd832568210713340f99520efe663208de8125ef645e。host probe和SDK smoke保持未选。

本机既有 Mate 90 Pro 实例配置为 arm64。PR 当前正式保数据准入边仅覆盖 x86_64/Library47，后续安装必须按现场准确目标和已审ABI边裁定，源码与构建结果各自成立。

字体链合流补充进入本批范围。配置初值及onConfigurationUpdate转交当前window owner，保留PR的readerUiConfigurationRevision及窗口/对话框生命周期。AppScope仅声明followSystem。选定test-reader-window-font-configuration的configuration、entry-consumer、native-context三个case，分别保护Configuration与density独立、旧window拒绝和实际Native读回边界。共享恢复动作的44vp及notice父预算、陈旧展开回调保护也进入同一共享改动范围，由Source完整目标producer及受影响message SDK消费者验证。

消息检查本批显式选择入口扫描。理由是PR目录迁移使大量原登记file/id失效，加上本地ReaderRecoveryAction入口识别和选定文件/retained检查需要合流。嵌套范围仅官方SDK AST与registry比对，业务测试、构建和设备均不触发。保留PR的openToast/closeToast识别与transient-presentation家族名称，新增动作入口仍按当前业务事实登记。新注册记录逐项核对宿主和退休规则。

搜索消费者按 PR 当前入口复验。旧六 case 文件和 compact-sheet 针对旧目录及旧筛选组件，冻结输入保留；本次实际采用当前 SearchPage／ReaderSearchFilterPanel／SearchFilterGeometry，新增选择 test-search-view-state 的 content-filter。嵌套为当前生产投影和真实 SDK chip／native sheet binding，不运行该父文件其他 case。必要性是共享 ReaderButton 的 Native carrier 与 modifier 变化影响筛选消费者。报告绑定当前所有相关输入，不沿用旧 SearchPage WIP 的历史 PASS。

## 源码冻结与定向结果

UI 配套提交为 `9bfc916`，在主题 PR 原提交上支付目录 clear/download 目标的44vp尺寸。当前 Core 为 `e689f2a`，配套 Native／SDK 已由规范入口生成和同步。x86_64 SO 由生成输入管理，补齐忽略规则并退出Git跟踪，实际本地字节继续由构建provenance核验。

| 范围 | 本次已执行结果 |
| --- | --- |
| 框架 | 55个schema／推导／引用正反case通过，host-variants与footer-placement通过，layout-evidence／direct-selection／query-height／browse-list通过 |
| 书源／Tools | 首批26个具名case保留原时点结果；当前matrix32行／40局部目标／24预算、interaction200／48样本及组合176目标／22引用／24预算已准确重跑；trigger-parent20组通过；Tools父预算16行／8上下文按未受影响闭包复用 |
| 目录 | 首批22个具名case及59项输入保留原时点；后续fixture身份5项、IME晚ACK3项及2项未受影响复用、Manga publication/header、QA menu/font两项分别绑定准确补充报告 |
| 下载 | 13项定向case通过；后续Source专属字阶和ReaderButton选择语义对下载的实际依赖审查后复用 |
| 共享消费者 | Native目标、分组面板父预算、ChoiceRow、外观、RSS／同步图文动作、当前搜索筛选、Configuration链、DEBUG准入与首批7个根fixture场景保留各自结果；Source group触发器旧探针的44vp注入错误已明确失效并定向纠正 |
| 消息 | 当前全树157／157入口登记通过；RecoveryAction／原生Alert缺登记、缺bridge及游离callback反例通过 |
| 契约登记 | 21个实例／230项唯一输入；模型及引用通过，无SOURCE_DRIFT或REFERENCE；登记保留26项FAIL和13项NOT_RUN诊断，E2/E3继续开放 |

完整SDK报告及其两个原始样本报告进入受控仓库路径。规范命令为 `node tools/page-structure/source-e2-evidence.mjs tools/page-structure/evidence/source-layout-matrix.json tools/page-structure/evidence/source-interaction.json tools/page-structure/source-layout-evidence.json`。本次Source group纠正后，matrix与interaction重新执行，canonical composer及10项拒绝边界再次通过。当前报告SHA为 `1757ca390305721d539c016968ce2c929b97aaf149f35ac2e8bed95fe452aafe`，register SHA为 `c02add3aa49a7ddc137eeda72acc8bc3fda95e9587515e42d64b00626b15bbeb`。历史 `5ce6d609…` 等原报告保留原字节，其group-trigger尺寸结论按后文纠正。[当前SDK报告](../../tools/page-structure/source-layout-evidence.json)、[当前治理回执](../../.reader-artifacts/framework-confluence-20261112/governance-verification.json)

复核补修两处真实装配缺口。ReaderButton将尺寸和选择语义合入唯一Native modifier，增加旧双modifier负例；Tools按实测List宽度、增长后的动作尺寸和摘要行分配row／List预算，窄宽使用上下分区与动作换行，旧58vp和强制同行源码负例均失败。根DEBUG夹具的旧SourceHost类型导入已指向当前SourceOrchestrator。

所有初次失败日志保留，包括旧路径／接口探针、字体工具缺失和冻结前指纹漂移。后续结果只覆盖对应已纠正输入。旧六case与compact-sheet仍保留在原工作区冻结输入，本批当前PR消费者由具名content-filter验证，新候选包含当前SearchPage字节。

### 最初现场与原生交付准备

指定签名配置已经规范sync-signing固化，证书身份保持用户指定值。构建只选择contracts-scope none，未选完整Core／Harmony套件。

该时点只读发现远程HDC `192.168.1.10:8710` 持有在线x86_64实例，已安装Reader0.2.0／versionCode1000000。本机现有Mate90Pro配置为arm64。两者按不同server／target分别记录。远程SSH22超时与HDC8710可达各自保留，当时尚无远程当前实例宿主日志与新鲜正式storage-transition证明。用户裁决前继续完成源码和签名候选，该准备阶段尚未安装、停启App、复制用户数据库或改变字号。后续授权和实际动作见四次部署记录。

早期Stage5作者准备JSON已随本批私有history保存，原工作区冻结输入保持原位。当前仓库只有register.json作为active页面登记，迁移后的checker／测试均读取该唯一登记。

### 首次候选编译与修复

首次canonical构建在CompileNative的bookturn桥接发生14处严格浮点转整数诊断，尚未进入ArkTS，没有发布成功HAP。按实际当前OHOS clang的-Werror要求改为经安全整数校验后的NAPI整数读取，保持原gesture七字段与有限代次、token、profile准入。Percentile维持原floor(product+0.5F)结果。定向number-boundaries与ohos-compile两个case通过，含1536个Percentile等价组合、两个真实翻译单元和旧转换EXPECTED_FAIL负例。Core Native及storage身份没有变化。

工作区环境模块按Core受控源重新投影，统一生成文件行尾。配套模块与当前Core保持一致。后续构建继续使用contracts-scope none和同一Cargo缓存。

用户已选择远程现有x86_64实例，随后指定通过HDC无线调试。当前HDC TCP链路已能发现该实例并读取ABI和安装元数据。UU远程的工具访问被拒绝，现场取证沿HDC入口执行。该时点曾把宿主日志列为前置，随后按用户裁决改为可选；正式storage-transition继续按实际安装动作核验。

无线交付入口合入既有HDC租约的准确server/target准入、命令时限、当前child清理及清除代理变量的直连环境。保留现有acquire/release接口与HAP安装参数。9个具名离线case和真实临时loopback所有权检查通过，该工具验证阶段未执行HDC服务维护或设备动作。首次沙箱socket失败保留，受审执行权限下的实际回执单独归档。工具改动当时没有影响页面登记的220项输入，后续页面修复现已扩展为230项。

第二次canonical构建已成功发布签名候选09596，指定证书验签通过，contracts-scope none。编译发现新增DEBUG根夹具仍使用旧全局router的两处deprecated API，已改为当前UIContext的Router；admission、source-callbacks、fixture-scenes三个受影响case重新执行通过，其他夹具逻辑按影响范围复用。该改动进入下一固定候选，09596保留原时点manifest。

### 用户裁决与最后部署配套

用户明确裁定宿主emulator.log为可选证据，实际readiness及Core受控交付文档已同步。Core配套提交更新为 `e689f2ae65bb77e23c15f7f054d8917463d1f5dc`，1180个有效源码输入与原1cff逐字节一致，Git身份单独更新并重新执行规范Native构建、sync-native。当前Native SHA为 `a1f13fb4df1a083196afa3ba307d7c8e13a91e7ea4892c327f3b689bfb4b9f76`。

无宿主日志的readiness精确case通过，原有日志、snapshot和physical检查继续保留，新增25项拒绝样本。对应父门禁改为导航入口，准确readiness叶独立选择，其他历史fixture保持NOT_RUN。现场随后在同一规范server会话实际取得guest boot milestones、完成启动与稳定SceneBoard，2秒观察通过，回执明确guest-only和emulatorLog NOT_PROVIDED。

部署层合入已有连续server会话及显式local/remote路由，4个精确case通过，12个现有签名、storage-transition、ABI、UID、verify和provenance guard保持原体，3个移除guard负例拒绝。安装继续调用canonical实现，停态复制、正式Core副本验证、最终源pair重验和覆盖更新由同一有界会话编排。该配套随后用于以下四次成功保数据安装，前09596及5f2be6候选保留原字节和原时点结果。

## 四次成功保数据安装

四次均使用远程 server `192.168.1.10:8710` 持有的现场 target `127.0.0.1:5555`，targetRef 为 `6460677a198b`，按同一有界会话覆盖停态前证、备份、副本证明、最终源 pair 重验及 canonical 安装。包名、签名谱系、UID `20020064`、x86_64 ABI 和安装后的 appBuildId 均有对应准入回执。各轮 dataPolicy 均为 preserve，install / launch 均 PASS。

| 完成时间，北京时间 | 源码提交 | 候选 / HAP SHA 前缀 | 不可变 run | canonical 部署回执 |
| --- | --- | --- | --- | --- |
| 11-12 21:01:33 | `1b741ac9` | `a02b3c0439df` / `de4c5db2…` | `20261112T122735Z-1b741ac9-8398cf92` | `deploy-vm-6460677a198b-20261112T130133Z.json` |
| 11-12 22:07:12 | `8c6a21ae` | `7de10f3ec178` / `dda28f4d…` | `20261112T140522Z-8c6a21ae-38e092eb` | `deploy-vm-6460677a198b-20261112T140712Z.json` |
| 11-12 22:41:16 | `dd8b56e2` | `67f6aed23929` / `2917b1ba…` | `20261112T143908Z-dd8b56e2-a9ac45e8` | `deploy-vm-6460677a198b-20261112T144116Z.json` |
| 11-12 23:32:42 | `9ce09f58` | `b447de33e4f2` / `64dd34f9…` | `20261112T152829Z-9ce09f58-d9a3f259` | `deploy-vm-6460677a198b-20261112T153242Z.json` |

每轮正式存储证明有三次实际 Rust 精确执行。format-admission 和 l0-writer-preservation 使用合成兼容模型；formal-ffi 对本轮已授权的数据库/WAL可丢弃副本执行真实 runtime bootstrap、cold reopen 与 whole-snapshot rejection。验证器据这三份原始执行回执映射五项准入 case，三个真实 test 均为各1通过、0失败。停态原始 pair 在安装前再次核对，副本内的测试写入独立保留在该轮私有证据中。最新 storage-transition receipt SHA 为 `79a8b1501fa77f25437d9cafe2d4183697412f9b29fe8394a69d8b36f41e0d64`。[最新五项准入记录](../../.reader-artifacts/hap/20261112T152829Z-9ce09f58-d9a3f259/storage-transition-79a8b1501fa77f25437d9cafe2d4183697412f9b29fe8394a69d8b36f41e0d64/validation.json)

首次 `deploy-a02b3c0439df-01` 因 file recv 未在预期本地路径生成数据库而失败，随后 chmod 得到 ENOENT，未进入安装。该轮原始身份及 DB/WAL pair 保持一致，恢复原应用的 AA 请求已接受，原证明作废。成功的 `-02` 使用独立目录及新鲜前证，旧失败完整保留。

首次成功安装后的 AA start 已接受，较晚一次 pidof 未找到 PID，原因仍为 UNKNOWN。21:22 的一次正常启动在四个进程快照中保持同一 UID/PID `24885`，有限观察跨度7423ms，同时取得 native-open、core-info、runtime-published、Core ready 及 shelf/query ready。该观察与此前 PID 缺失分别记账，后续当前候选的稳定性继续由对应采样记录。readiness 回执采用用户批准的 guest-only 范围，宿主 emulator.log 为 NOT_PROVIDED。[首次失败](../../.reader-artifacts/framework-confluence-20261112/native-deployment/deploy-a02b3c0439df-01/result.json)、[正常启动有限观察](../../.reader-artifacts/framework-confluence-20261112/fresh-startup/receipt.json)

## 已完成的准确原生场景

以下事实绑定各自已安装候选和原始 PNG、tree、PID 日志。未受后续源码变化影响的范围复用原证据，最新 b447 结果追加在下节。

| 范围 | 候选与已观察事实 | 证据及范围 |
| --- | --- | --- |
| Source D4 页头入口 | 7de10 候选真实 Source→Tools→Source 保留查询17、启用、小说和 Reader Acceptance，原页头工具入口恢复 native focused=true | `native-ui/d4-fixed-7de10f3ec178/receipt.json` PASS，当前PID身份与focused成功日志匹配 |
| Source D4 页脚入口与宽度 | 67f6 候选真实页脚入口往返保留同四条件，并恢复页脚入口焦点；两页脚按钮在Native等分且文字居中 | `native-ui/d4-footer-67f6aed23929/receipt.json` PASS；已修外层Common权重及内部full宽度两处支付 |
| Downloads 普通尾部 | 7de10 候选普通List前滚5次后，storage按钮154×154px完整位于同一List内，截图中普通存储dock整体可见，Back返回菜单 | `native-ui/downloads-tail-7de10f3ec178-02/downloads/receipt.json` PASS，实际字体倍率1、fixture intentCount0 |
| Downloads 短视口尾部 | 实际List为168vp，管理态前滚24次后，全选、完成、下载所选、更多四个控件均完整位于该List内，随后Back退出管理，再Back返回菜单 | `native-ui/downloads-tail-7de10f3ec178-02/downloads-short/receipt.json` PASS；没有点击存储或业务操作 |
| Downloads 管理态返回 | 前序短视口007→008系统Back消费管理态，同一book title的nativeId8405及bounds保持，非零锚点保留 | `native-ui/download-short-actions` 原树/PNG；普通浏览前滚时页头、搜索和Tabs随同一List离屏，回顶位置吻合 |
| Directory 同实例IME交接 | 67f6候选在目录query17的同实例尺寸切换后，TextInput保持focused=true，inputmethod系统root仍在，App root底为1733px；Back序列回菜单 | `native-ui/completion-directory` 003–009；007帧证实恢复后的实际键盘可见，原7de10的013有焦点却无键盘失败保留 |
| 系统字体与恢复 | 67f6候选通过真实系统Settings将字体滑块2改为5，weight/zoom保持1/1；后续currentPID记录systemFontScale1.45、nativeFontScaleVp1.4500000477；恢复原滑块2/1/1后，settled native读回1 | `native-ui/large-font-scenes/009-source-tools.log`、`font-restored.json`、`font-restored-native-confirm.receipt.json` |

下载第一次Tail脚本在普通首帧、尚未发出列表前滚时失败，原因是两次解析创建了不同节点对象，导致内容签名恒为空。该失败和首帧保留；修复使用同一节点树并排除裁切/隐藏内容，六项离线正反检查通过后才运行独立的 `-02`。此前普通下载操作批次还曾因Runner误把退出管理的一次Back当成回菜单而FAIL，原批次保持该结果，准确已得帧继续按实际内容使用。

字体变更与恢复的最初回执存在Configuration和UIContext读回的短暂延迟，上表采用后续settled记录。QA fixture每次record均重读四个Native font getter，新增native-font-observation方法case验证动态context、revision、不可用清空及退休边界。原 `large-font-scenes` 因菜单点击落入系统手势区域并触发小艺首次教程，预期stage未在当前树中出现，批次保持FAIL。原始九帧保留，系统教程已取消，准确字体事实单独记录。

## 最新修复与本轮原生结果

Source旧SDK端口曾注入 `TRIGGER_H=44`，而生产ReaderSelect常量实际为36，导致历史group-trigger最小尺寸claim失效。Native又观察到分组文字的固定74vp扣减未支付实际增长宽度。现已改为读取真实常量、仅sourceGroup支付最小44vp，并由实际UIContext量字与父Row预算共同支付宽度。trigger-parent20组、matrix32/40/24、interaction200/48、canonical176/22/24及10项拒绝边界均在准确新源码上通过。旧报告字节、错误注入和失效范围保存在 `source-group-evidence-correction`。当前 `1757ca39…` 报告表示SDK证据，b447 的1×与1.45×两宽度已取得当前分组控件44vp和文字完整的原生证据；1.45×右界有1px量化差，保持原值记录。

67f6候选Manga目录日志已证明全部字体在47ms内完成，`prepare.accept`为当前generation、mounted=true、ready=true，8秒后的正文仍为准备态且Grid数量0。源码与真实SDK复现定位到plain arrow slot中的原始if没有建立Page-owned状态订阅。现已将四个状态相关区域迁为具名@Builder，保留同一Scaffold actor；manga-publication与既有manga-header准确case通过。此前pending-font假设已被上述Native日志纠正，字体API、资源和加载owner沿用原实现；b447 的正文、页头更多工具与页脚已在1×和1.45×原生帧出现，准备态消退。Native ready后单帧证明当前结构，同Scaffold实例保留复用manga-publication的SDK证据。[Manga定位与修复证据](../../.reader-artifacts/framework-confluence-20261112/manga-publication-verification.json)

QA菜单的Scroll现支付实时interactiveBottom并显式clip，menu-safe-area/native-font-observation两项通过，Source与fixture舞台区段保持逐字节一致。该修复用于支持当前候选的准确场景选择。

| 范围 | 当前结果与边界 |
| --- | --- |
| Source 1× 分组与筛选 | final-baseline 的005/010两宽度按钮高154px=44vp、右界与父Row吻合；打开分组后Back退层。NoMatch空态清除后恢复query空及24/16统计 |
| Source 只读检测 | 同PID32673、original-unknown presentation4，当前触摸窗口内新增唯一fixture1 intent-detect，原操作notice保留；仅内存UI到当前回调，不代表真实网络检测 |
| Source 忙碌拒绝 | 原final-baseline在disabled selector处FAIL且未派发。final-busy-disabled独立补发一次禁用登录pointer，busy presentation5保持、无新增intent，原批次FAIL保留 |
| Source 真实1.45× | final-large-scenes两宽及final-source-live-large同actor，group高44vp、标签完整；右界1px量化差如实保留，两footer等分且高约53.14vp |
| Manga 正文 | final-baseline/002与final-large-scenes/020出现Grid、当前22话、完整页脚和44vp页头工具，准备态消退；未展开菜单 |
| Directory 大字号 | 实际320vp/1.45×，control viewport190vp、完整行约53vp。当前章定位使搜索prefix处于屏外，该帧未验证其触控 |
| QA 菜单 | 最终21帧批次完成，Scroll底部真实留出28vp；未再出现小艺教程覆盖 |
| Tools 大字号 | 上方8动作文字在各自bounds内。源行所在List完整分配174vp，外层Scroll只露9px；屏外源行Native未验。代码及已得树确认外层裁切，无需为9px修改布局 |
| 字号恢复与结束态 | final-font-restored三个Slider为2/1/1，final-font-native-one当前UIContext及window均为1；正常书架恢复至pages/Index，PID12470/当前b447身份与Runtime ready只读核对通过 |
| 全局E2 / E3 | 继续FAIL。当前系统最大实测1.45×；1.3/1.6/2各格原生效果与完整全目标触摸仍缺证据 |
| 可访问性与平台宿主 | 读屏、完整焦点顺序、真实登录宿主内部行为及平台Back顺序继续开放 |
| 全部业务流程与用户验收 | 未选择的全局业务套件保持NOT_RUN，用户验收OPEN |

本轮只读复核报告位于私有native-review与directory目录，原始batch状态分别保留COMMANDS_COMPLETED、SCENE_CAPTURES_COMPLETED和FAIL，局部行为按原始树、PNG、PID与当前回调单独裁定。采样完成后系统字号、粗细和显示缩放已恢复，App回到正常书架，设备租约已释放。

## 开发流程复盘

用户指出反复构建验证暴露的主要问题可以在代码侧提前识别，这一判断成立。本轮首次候选前的审查没有完整覆盖父子装配、真实常量、编译后的响应式依赖及异步回调时序，导致修复分散到多轮签名、保数据安装和取证。

- 页脚的Common分配与内Button填充应一起检查，第一处修复只覆盖了外层。
- Source group生产36vp与probe注入44vp应在源输入对照时发现；固定74vp扣减的字体增长欠账可直接从预算公式识别。
- Manga slot普通箭头中的if可从真实SDK编译产物及状态flush识别，无需先到设备观察加载态。
- 等值TextInput回声取消返回焦点、迟到focus ACK遗漏IME恢复，可用当前owner、revision及回调顺序的本地探针复现。

剩余收尾采用现有代码侧优先原则。先集中核对变更闭包的生产常量、父子约束、编译结构和生命周期，完成必要定向回归，再形成固定候选。新增原生取证须先写清代码侧无法回答的具体问题、旧证据不足之处与最小场景；未受影响结果直接复用。本轮设备操作已经结束，未为文档、元数据或Tools屏外9px追加构建与安装。

产物源码仍绑定9ce09f58。其后提交仅更新执行记录及Source九条knownGap文字，层状态、引用和生产输入指纹经对象比较保持一致。SDK/三登记检查复用9ce时点回执，当前register文字版SHA为 `2b5057e6d4eafcd93698853104ae4dd7bb63109f2ee51429918d59e75eb8882d`。这次文字收尾未触发构建、安装或设备采样。
