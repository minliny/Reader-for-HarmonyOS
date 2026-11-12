# 页面契约与 UI 框架合流实施记录

2026-11-12。用户已授权按合流方案实施。当前记录属于本次限定整合，长期页面定义进入 PAGE_STRUCTURE_CONTRACT，历史页面试点记录继续保留原始结果。

## 固定输入与工作区

- HarmonyOS 基线为 PR #22 的 `8f825544afe4cff659fd97201f1f7003ff127210`，SVG #21 为 `bf24f1a85126a85928211fc3539e1c133c461619`。
- UI 权威主题为 `cff94a46c1f9280fbd3a33088641f0f090d1d1fb`，Core 为 `1cff7d5db9cf89cf5e5baf77650c7668fb80cf58`。
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
| 6 | 配套 Native、签名候选、保数据部署及原生验证 | Native配套完成，候选构建中；原生待执行 |

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

当前 Core 精确提交与本地历史候选不同。本批将通过该 Core 的 `scripts/build-harmony-napi.sh --abi x86_64` 生成配套 SDK、SO、storage companion 和输入快照。该入口只调用规范 build-ohos、reader-ffi release cross-build 及 CMake/Ninja；host probe 与 SDK smoke 保持未选。必要性是新的保数据安装边采用 x86_64/Library47，历史 arm64 配套不能代表当前 Core 身份。

本机为 arm64，当前 Core 固定 Rust toolchain 已安装 x86_64 OHOS target。显式复用既有 `/Users/minliny/Documents/Reader/Reader-Core/target` Cargo 缓存，遵守共享 build-resource lease 和单重型任务预算。HAP、安装及现场存储证明继续等待实际新输入与目标前提成立。

Native 第一次执行在取得租约后的降低当前 worker 优先级处被沙箱拒绝，编译尚未开始。原 native-build.log 保留。第二次通过受审执行权限运行同一规范入口，以完成所要求的进程优先级和工具链操作。

## 首批实际结果

- SVG 两个属性顺序 case 通过。
- 模型 schema 通过。初次引用检查发现旧目录、Index owner、私有产物和旧指纹引用，正在按新实际结构逐项处理，原 refs-initial.json 保留。
- 共享控件 source-native-targets、source-group-budget 通过，分别检查新 Native Button 的28个字号/变体组合及分组实际面板/选项父预算，并包含旧28vp负例。
- choice-live-admission 初次因旧 Settings 路径失败，修正实际消费者路径后8个变体及正反传播通过。原日志保留。
- 新 Core 的 x86_64 Native 构建通过，Core输入快照为28e3813135c5063c212bbd832568210713340f99520efe663208de8125ef645e。host probe和SDK smoke保持未选。

本机既有 Mate 90 Pro 实例配置为 arm64。PR 当前正式保数据准入边仅覆盖 x86_64/Library47，后续安装必须按现场准确目标和已审ABI边裁定，源码与构建结果各自成立。

字体链合流补充进入本批范围。配置初值及onConfigurationUpdate转交当前window owner，保留PR的readerUiConfigurationRevision及窗口/对话框生命周期。AppScope仅声明followSystem。选定test-reader-window-font-configuration的configuration、entry-consumer、native-context三个case，分别保护Configuration与density独立、旧window拒绝和实际Native读回边界。共享恢复动作的44vp及notice父预算、陈旧展开回调保护也进入同一共享改动范围，由Source完整目标producer及受影响message SDK消费者验证。

消息检查本批显式选择入口扫描。理由是PR目录迁移使大量原登记file/id失效，加上本地ReaderRecoveryAction入口识别和选定文件/retained检查需要合流。嵌套范围仅官方SDK AST与registry比对，业务测试、构建和设备均不触发。保留PR的openToast/closeToast识别与transient-presentation家族名称，新增动作入口仍按当前业务事实登记。新注册记录逐项核对宿主和退休规则。

搜索消费者按 PR 当前入口复验。旧六 case 文件和 compact-sheet 针对旧目录及旧筛选组件，冻结输入保留；本次实际采用当前 SearchPage／ReaderSearchFilterPanel／SearchFilterGeometry，新增选择 test-search-view-state 的 content-filter。嵌套为当前生产投影和真实 SDK chip／native sheet binding，不运行该父文件其他 case。必要性是共享 ReaderButton 的 Native carrier 与 modifier 变化影响筛选消费者。报告绑定当前所有相关输入，不沿用旧 SearchPage WIP 的历史 PASS。

## 源码冻结与定向结果

UI 配套提交为 `9bfc916`，在主题 PR 原提交上支付目录 clear/download 目标的44vp尺寸。Core保持 `1cff7d5`，配套 Native／SDK 已由规范入口生成和同步。x86_64 SO 由生成输入管理，补齐忽略规则并退出Git跟踪，实际本地字节继续由构建provenance核验。

| 范围 | 本次已执行结果 |
| --- | --- |
| 框架 | 55个schema／推导／引用正反case通过，host-variants与footer-placement通过，layout-evidence／direct-selection／query-height／browse-list通过 |
| 书源／Tools | 26个具名case观察通过；最终matrix32行／40局部目标／24预算，完整SDK组合176目标／22引用／24预算；Tools父预算16行／8上下文通过 |
| 目录 | 22个具名case通过，59项输入无漂移；受控旧前缀、键盘、parent负例保留 |
| 下载 | 13项定向case通过；后续Source专属字阶和ReaderButton选择语义对下载的实际依赖审查后复用 |
| 共享消费者 | Native目标、分组父预算、ChoiceRow、外观、RSS／同步图文动作、当前搜索筛选、Configuration链、DEBUG准入与7个根fixture场景通过 |
| 消息 | 当前全树157／157入口登记通过；RecoveryAction／原生Alert缺登记、缺bridge及游离callback反例通过 |
| 契约登记 | 21个实例／220项唯一输入；模型及引用通过，无SOURCE_DRIFT或REFERENCE；登记保留26项FAIL和13项NOT_RUN诊断 |

完整SDK报告及其两个原始样本报告进入受控仓库路径。规范命令为 `node tools/page-structure/source-e2-evidence.mjs tools/page-structure/evidence/source-layout-matrix.json tools/page-structure/evidence/source-interaction.json tools/page-structure/source-layout-evidence.json`。原SDK producer结果按原字节复用，composer与10项拒绝边界重新执行，当前报告SHA为 `5ce6d60958f59fa702162f87a3f60ffa350718205c35313f87ba5a83e6c5cec1`。

复核补修两处真实装配缺口。ReaderButton将尺寸和选择语义合入唯一Native modifier，增加旧双modifier负例；Tools按实测List宽度、增长后的动作尺寸和摘要行分配row／List预算，窄宽使用上下分区与动作换行，旧58vp和强制同行源码负例均失败。根DEBUG夹具的旧SourceHost类型导入已指向当前SourceOrchestrator。

所有初次失败日志保留，包括旧路径／接口探针、字体工具缺失和冻结前指纹漂移。后续结果只覆盖对应已纠正输入。旧六case与compact-sheet仍保留在原工作区冻结输入，本批当前PR消费者由具名content-filter验证，新候选包含当前SearchPage字节。

### 原生交付准备

指定签名配置已经规范sync-signing固化，证书身份保持用户指定值。构建只选择contracts-scope none，未选完整Core／Harmony套件。

现场只读发现远程HDC `192.168.1.10:8710` 持有在线x86_64实例，已安装Reader0.2.0／versionCode1000000。本机现有Mate90Pro配置为arm64。两者按不同server／target分别记录。远程SSH22超时与HDC8710可达各自保留，尚无远程当前实例宿主日志与新鲜正式storage-transition证明。已请求用户裁定是否将原生验收移至该远程实例，期间继续完成源码和签名候选；没有安装、停启App、复制用户数据库或改变字号。

早期Stage5作者准备JSON已随本批私有history保存，原工作区冻结输入保持原位。当前仓库只有register.json作为active页面登记，迁移后的checker／测试均读取该唯一登记。

### 首次候选编译与修复

首次canonical构建在CompileNative的bookturn桥接发生14处严格浮点转整数诊断，尚未进入ArkTS，没有发布成功HAP。按实际当前OHOS clang的-Werror要求改为经安全整数校验后的NAPI整数读取，保持原gesture七字段与有限代次、token、profile准入。Percentile维持原floor(product+0.5F)结果。定向number-boundaries与ohos-compile两个case通过，含1536个Percentile等价组合、两个真实翻译单元和旧转换EXPECTED_FAIL负例。Core Native及storage身份没有变化。

工作区环境模块按Core受控源重新投影，统一生成文件行尾。配套模块与当前Core保持一致。后续构建继续使用contracts-scope none和同一Cargo缓存。

用户已选择远程现有x86_64实例，随后指定通过HDC无线调试。当前HDC TCP链路已能发现该实例并读取ABI和安装元数据。UU远程的工具访问被拒绝，现场取证沿HDC入口执行。原生更新仍需当前实例日志和实际正式storage-transition事实。

无线交付入口合入既有HDC租约的准确server/target准入、命令时限、当前child清理及只清除代理变量的直连环境。保留现有acquire/release接口与HAP安装参数。9个具名离线case和真实临时loopback所有权检查通过，未执行HDC服务维护或设备动作。首次沙箱socket失败保留，受审执行权限下的实际回执单独归档。页面登记220项输入未受这些工具变化影响。

第二次canonical构建已成功发布签名候选09596，指定证书验签通过，contracts-scope none。编译发现新增DEBUG根夹具仍使用旧全局router的两处deprecated API，已改为当前UIContext的Router；admission、source-callbacks、fixture-scenes三个受影响case重新执行通过，其他夹具逻辑按影响范围复用。该改动进入下一固定候选，09596保留原时点manifest。
