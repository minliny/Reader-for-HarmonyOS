# 自定义动作封口修复与交付记录（2026-10-26）

范围：用户冻结审计中的共享自定义控件、书详页及可达的阅读器目录、TTS、外观与次级面板。以当前 dirty 工作树实施，保留其他任务修改。七个入口的组件依赖闭包及原始 125 个 onClick 分类见同名 JSON；清单是源码范围证据，不是设备通过证据。P3 参数治理与未挂载 legacy 面板删除不在本次缺陷修复中。

问题：自定义点击区域缺少统一角色、焦点、选择/禁用状态，部分命中区小于 44vp；仅扩大 responseRegion 会在密集选项或裁切父容器中产生重叠。修复复用 ReaderActionAccessibility（同时委托现有按压反馈），由各既有布局 owner 分配实际动作尺寸，保持业务写入与回调准入在原 owner。

## 本次精确验证计划

- `node tools/test-custom-action-audit.mjs --case semantics,builder-actions,target-geometry,scope-coverage`：四个明确 case。semantics 仅执行生产 modifier 与命中矩形；builder-actions 使用已安装 SDK 的 builder lowering 及 native 属性记录器执行六种实际 selector 触发器、TTS 行、菜单回调；target-geometry 执行现有生产几何函数，检查快速/完整端点的相邻动作不重叠、容器边界；scope-coverage 仅解析七入口闭包中的组件与例外。SDK probe 会加载现有基础控件/主题依赖，不执行其他 contract case、HDC 或构建。必要性：验证本轮增加的语义不会丢失禁用/反馈、尺寸修改不会让相邻动作抢占点击、同一冻结范围不遗漏未标注动作。
- `node scripts/hap-pipeline.mjs build --class iteration --signing local`：隔离非增量 ArkTS/HAP 编译、输入闭包、包字节及指定证书/Profile 检验；contracts 为 none，不附带业务全量。必要性：用户明确要求可安装 HAP。
- 真机安装只在明确真机 server/target 后通过规范 manifest install 执行：目标、包身份与保数据前置属于实际安装刚需，不附加 VM 或全业务验收。

## 连接事件与停止边界

本轮曾误选共享 HDC server 192.168.1.10:8710 进行 discovery，返回 Connect server failed。用户指出该入口属于其他 agent/VM；本任务客户端已退出、无残留本任务租约。没有选择 VM target、安装 VM、重启 server 或断开他人连接。停止使用该 server，等待准确真机入口。不得把该失败解释为真机未授权。

## 验证状态

代码修改：完成。精确回归：四个 case PASS。新 HAP：隔离构建与指定证书验签 PASS。真机安装/启动：PASS，已保数据覆盖安装，未卸载或清数据。交互、系统读屏、设置重启持久化、100%/150%/200% 字号、旋转/分屏、用户验收：NOT_RUN；本次安装请求不自动扩大为全设备验收。

首次测试命令误用 --tests，被选择器拒绝，未执行 case；已按入口要求改为 --case。

Builder fixture 首次缺少菜单 effectiveScheme 方法，未触发生产失败；补入实际生产方法后仅重跑未通过的三个 case。

首次隔离编译 FAIL：三处 primary 分支冗余 cancel 比较、TTS 配置行误插入 toggle 回调、外观组件未声明 quickContentHeight。已按实际分支标签、移除非动作父行回调、从主面板传入快速端点高度修复。计数检查收紧为冻结的125个动作，防止误加双重回调。

补充 selector SDK fixture 时遗漏 CHEVRON_GAP 常量，已从实际源码常量导入，未改产品实现规避断言。

四个精确 case 已通过；其中 builder-actions 覆盖六种 selector 变体、TTS 标注开关整行与菜单当前/退役回调。系统读屏与实际命中仍需设备证据。第二次构建开始前停止本任务源码写入。

## 当前可交付候选

- runId：`20261026T131344Z-3b297fdc-302ed5d9`；HarmonyOS `0.2.0` / versionCode `1000000`，未改产品版本。
- 构建时间：2026-10-26T13:13:07.964Z 至 2026-10-26T13:13:43.839Z。
- Host commit：`3b297fdc7e724cf655eca3bac2a8efeda2001c56`，dirty；Core 及 Native 身份见 manifest。
- 源码指纹：`302ed5d94b313fc12033e532aaadf6262880e64149263468cee9228238e7358b`，1305 个输入；构建后逐文件核对，当前输入差异 0。
- 签名 HAP SHA256：`743aa0aaa320bb25446a39e1fa486a7f641ff5a1174710623f6b27d75aca2c46`。
- 指定证书 `minliny_HarmonyOS` 验签通过；manifest：`.reader-artifacts/hap/20261026T131344Z-3b297fdc-302ed5d9/manifest.json`。
- 编译中现有警告不等于设备行为通过；contracts-scope none，四项局部检查在构建前单独执行。

用户给出真机 target 后，仅对本机回环 server 发起一次带租约 tconn；返回 Connect server failed，尽管客户端 exitCode=0，连接仍记 FAIL。本机 8710 无监听，客户端已退出；未执行 inspect/install/launch。已请求启动本机 HDC 的独立授权，未触碰共享 VM server。没有清数据、卸载或提交。

用户要求复用既有 HDC 后，读取现有租约和另一任务执行记录，确认共享服务仍在工作，且租约已释放。按既有不带代理的命令环境复用该 server，真机 tconn 返回 Connect OK；未启动、重启或断开其他目标。随后规范 inspect 在物理设备的第二组 boot fallback 采样返回 Physical guest/host clock or observation is inconsistent，停止于 Bundle Manager 查询之前，尚未安装。租约事件显示每组采样约3.4秒，未超10秒；接下来只读一次手机 epoch 并记录本机前后时钟，以区分实际时差与取样问题，不重试整套 inspect、不放宽前置。

时钟最小诊断：本机epoch毫秒起止 1793020929409 / 1793020929816，单次只读取样耗时 406ms，手机整秒epoch 1793020928。整秒回执比本机起点早1409ms；手机精度为秒，不能将该数直接当作精确时差。没有重试整套失败前置、绕过时钟校验、修改系统时间、安装或清数据；等待用户同步网络时间后再继续。同一 server 的租约每条命令退出即释放。

用户报告时间已同步后，独立 inspect PASS：matching-identity-signed-update-candidate / preservesData=true，physical-boot-milestones-v1 稳定。紧接着 install 的同一 readiness 再报时钟不一致，未安装。代码仅用 date +%s 向下截断为整秒，再与毫秒级本机时间比较；需检验精度边界，不能重复要求用户调时间或取消保护。下一次只读 date +%s.%N 确认平台高精度时钟输出能力，若支持则使用实际更精确回执，保持现有一秒阈值与其他 boot/SceneBoard 条件。

高精度最小取样：本机1793021200732至1793021201292ms，手机1793021200.330408437秒；真实回执位于既有一秒范围内。已将物理fallback时钟读取改为设备实际纳秒格式并保留毫秒，不修改一秒门槛、10秒取样上限、boot里程碑、观察期或SceneBoard条件；不支持高精度仍拒绝。执行刚需新用例 `node tools/test-physical-clock-precision.mjs --case clock-precision`：仅import生产targetReadiness并注入时钟/只读查询fixture，覆盖整秒截断反例、正负5秒偏差、时钟冻结/跳变、boot/PID变化及无效高精度。无HDC、无构建、无嵌套回归。旧delivery-admission fixture仅同步命令格式，不运行其无关全量。

精度修复用例首次fixture选用的毫秒相位没有触发整秒截断反例，修正为真实跨秒相位后PASS；未改断言或放宽阈值。既有delivery-admission fixture同步高精度格式并通过node --check，仅语法检查，不执行全套。高精度修复后的inspect再次PASS，保数据路由允许，正在安装同一HAP。该修复只影响主机交付控制器，应用构建输入与HAP字节未变。当前控制器文件SHA256：`65096f45edae6fc015ead9c073e989b1641a381b37878f240fc51c601d254d8d`。

## 最终交付结果

- 2026-10-26 21:30:13（Asia/Shanghai）完成：指定真机 targetRef `2a10c2b26b06`，install PASS、launch PASS、dataPolicy preserve。
- 已装包 `io.reader.minliny` / `0.2.0` / versionCode `1000000`；旧安装中历史 versionName 为1.0.0，已按当前源清单覆盖，未改安装计数器或数据兼容版本。
- 同一签名 HAP SHA256 `743aa0aaa320bb25446a39e1fa486a7f641ff5a1174710623f6b27d75aca2c46`。
- 安装回执：`.reader-artifacts/hap/20261026T131344Z-3b297fdc-302ed5d9/deploy-physical-2a10c2b26b06-20261026T133013Z.json`。
- 五个局部 case PASS：semantics、builder-actions、target-geometry、scope-coverage、clock-precision。其他回归 NOT_RUN。
- 本任务HDC客户端均已退出，无本任务残留租约；共享服务中另一VM agent继续持有其自己的租约，未中断或接管。无服务启动/重启/断开操作。
- P0/P1：本轮修复范围未新增已知代码阻断；P2冻结125动作的共享语义与命中区修复已编译交付；交付精度误判已修复并独立验证。P3参数治理及未挂载面板删除保留backlog。
- 设置重启持久化、rail/底栏切换、100%/150%/200%字号、旋转/分屏、系统读屏及实际点击命中未逐项执行，featureInteraction/userAcceptance仍OPEN。安装启动PASS不代表这些场景验收通过。
- 未提交，保留原有dirty WIP。


## 交付后回归：本地数据版本过新（处理中）

用户在上述已安装 HAP 启动后报告“本地数据版本过新”。安装/启动回执仍为 PASS，但书架加载为 FAIL，当前候选不能视为功能可用。该 HAP 绑定主工作树 Core `80d614e929ae9e320ab767a1dc04579363c361d7`（dirty），生产 `SQLITE_SCHEMA_VERSION=38`。同一 targetRef `2a10c2b26b06` 的既有证据 `20261025T163600Z-56680d88-c7778edd/device-evidence-20261026-bookshelf-schema/diagnosis.json` 已记录实际数据库 v44、Core 支持 v38。当前无新的真机采样；由构建来源、生产准入分支及既有同目标证据定位版本不兼容，不能归因于 UI 提示错误。

已检查主分支 schema/migration/open_observed、SchemaTooNew 映射，以及并行 HarmonyOS Core 工作树 `958a9ff8` 上 v39–v44 的真实迁移。差异包含本地正文事实、书籍身份、资源恢复所有权和恢复位置归档，不能仅提高版本常量或降写 user_version。修复准备采用三方合并保留主分支最新兼容门禁、换源和下载回执，同时接入完整必要存储依赖；不修改另一工作树。尚未应用、测试、构建或再次安装。所有用户数据保留。


v44修复已应用：只读冻结另一分支的storage/domain/contract依赖后按共同祖先三方合并，共53文件；写入前逐一核对主工作树前像，保留本地WIP。5处冲突合并保留了主分支下载原操作回执、换源准确回执和缓存清理排除项，接入v39–v44真实DDL、读取/写入所有权与snapshot v18。首轮存储编译发现主分支stage回执缺少新的StorageWriteScope参数，记FAIL并修正到共享checked finalize/rollback入口；未运行设备重试。

当前精确验证计划与结果：
- Core `workspace-tests:reader-storage#lib#sqlite_backend::storage_compatibility::tests::legacy_v38_upgrade_and_v44_reopen_preserve_library_facts#features=sqlite`：PASS；从空库执行原0–38生产迁移生成真实v38，再执行38–44，核对升级前备份事件、书架/进度、库身份和恢复归档冷重开保持不变。
- 同入口 `newer_schema_is_rejected_without_touching_stored_data`：PASS；原测试的固定44已改为未知999，保持未知版本拒绝及数据不改。没有把user_version回写旧值。
- `reader-runtime#test=cache_download_receipts#original_body_and_lease_checkpoint_rollback_together`：待结果；执行合并冲突涉及的正文/下载回执原子回滚（故障注入），防止只保留一侧事务。
- `reader-runtime#test=cache_download_receipts#completed_original_cold_query_replay_and_changed_params_reject`：拟执行；补同一事务的成功冷重开/回执重放路径。
- `reader-runtime#test=reader_ui_source_switch_commands#caller_finalize_stage_and_canonical_ack_survive_cold_runtime_and_replay` 与 `caller_rollback_stage_exact_ack_survives_cold_runtime_and_replay`：拟执行；验证新身份fence接入主分支stage回执后两种终结路径。
上述均通过 `scripts/check-local.mjs --stages workspace-tests --select <准确选择器> --rationale ...`，每次只编译所需测试target/依赖并执行一个准确case，共享构建租约、Cargo并发1；不运行其他测试或设备动作。Native随后按 `scripts/build-harmony-napi.sh` 默认无probe/smoke重新编译；Host `sync-native` 校验并同步新SO/SDK来源，然后 `build --class iteration --signing local`，contracts none。必要性：已安装旧Native只能支持38，必须替换实际二进制并验证签名包身份。

真机后续最小验证问题为：新HAP能否打开原v44数据并实际完成书架加载；此前代码已定位且本地迁移回归完成，不安排旋转/字号等无关场景。只复用原HDC server/指定真机、保数据覆盖安装，通过新启动日志与书架页面核验；不清数据、不卸载、不重启或断开共享服务。


Runtime编译曾FAIL（新增DTO字段未接入），已补齐实际读取投影；保留主分支已有正文衍生缓存恢复逻辑和下载回执。恢复归档中的未验证坐标经过原有storage事实查询后不再作为当前阅读位置，重导入/排版变换保留原事实且仅迁移已验证坐标。尚未开放整套库恢复UI。

补充两个直接对应启动故障的准确case，仍使用同一workspace-tests入口，仅编译Runtime lib并执行单case：`reader-runtime#lib#remote::tests::compatible_v44_reopens_after_older_binary_blocked_without_losing_shelf` 验证旧v38留下的blocked记录不会阻止兼容v44重开、原书架可读且元数据恢复idle；`reader-runtime#lib#remote::tests::newer_schema_blocks_startup_preserves_data_and_records_reason` 验证超过当前支持范围时仍返回不可重试错误并保留原数据。后者原断言固定44/38，现按当前版本+6构造真正未知版本，不放宽生产门槛。


本次八个精确case全部PASS。记录的中间失败还包括：换源测试实际属于`runtime_integration`聚合target（首次按文件名调用被Cargo拒绝，未执行）；新增Runtime测试首次缺少`super::bookshelf_get`限定路径（编译FAIL，修正后PASS）。没有删除用例或降级断言。实际换源选择器已改为 `reader-runtime#test=runtime_integration#reader_ui_source_switch_commands::<准确case>`，只运行点名case，不运行其余838项。

PASS回执均在Core `.reader-artifacts/gates/`：v38升级/v44重开 `1793024970873-ab008716-a494-41f0-8268-b5ec19b7d296`；未知schema拒绝 `1793025004045-abecde32-8355-4c83-aec8-2fee946a1660`；下载回滚 `1793025226680-ca3d198f-f94b-470b-a1db-0e269d3b5856`；下载冷重开 `1793025284018-b83d24a0-0167-4d01-9da4-ed108d919c31`；旧blocked解除 `1793025430114-dafda727-a69d-4322-adc3-776ef338354b`；Runtime未知schema `1793025476419-3b9b9348-a930-4d6d-8c1d-ad4ab7426444`；换源finalize `1793025477748-c5a10fc4-022c-44e5-8aa5-79565ef67400`；换源rollback `1793025499036-cae45c90-d600-4c61-977f-6c2d662722c5`。各回执绑定自己的源码输入；后续只调整相关兼容投影与测试适配，未改已经通过的迁移/事务逻辑。完整套件NOT_RUN。

Native正在按当前dirty主工作树重新编译（host probe、SDK smoke不选择）；其编译完成前不能用旧SO签新包。


## v44 兼容修复交付与原故障验证完成

- Native从当前主工作树重编译PASS，原SO SHA256 `2ec61f9897b4c665c4e48a9cde59eac1c6933d79741492f5f79a9ecfd77175e0`；`sync-native` 来源与配套校验PASS。HAP内经工具链处理的SO SHA256 `32df5beed58997926083f7c025ed5e419f8d8dc01a231bc939dd70d12e647929`，流水线校验PASS。
- 新runId `20261026T144417Z-3b297fdc-da2ad0fd`，构建时间2026-10-26T14:43:48.663Z至14:44:16.712Z。签名HAP SHA256 `0d63d0f2bfb8bc8e6312a19729cd644e9e307353be95927b0d1eeacffa6d5150`；指定 `minliny_HarmonyOS` 证书/Profile验签PASS。
- Host `3b297fdc7e724cf655eca3bac2a8efeda2001c56` dirty；Core `80d614e929ae9e320ab767a1dc04579363c361d7` dirty。Host输入指纹 `da2ad0fd7892382d2d5b68852b28866a44268c5d1eeca52c37b342b6b652a78f`，1305文件。产品版本0.2.0、versionCode1000000保持不变；真实SQLite兼容上限44，snapshot18；没有降写用户数据库版本。
- 首次inspect因目标未Connected停止。用户明确地址没变后，按租约单次读取原始列表确认共享server正常、真机target为Offline。首次tconn在取得租约前被其他owner占用拒绝，未发设备命令；待正常释放后，唯一实际tconn返回Connect OK。随后inspect保数据身份路由PASS。未启动/重启服务、未选择VM、未断开其他目标；此前应先核实会话状态，不应直接要求用户恢复连接。
- 2026-10-26 22:49（Asia/Shanghai）同一指定真机targetRef `2a10c2b26b06` 覆盖安装并启动PASS，dataPolicy preserve。回执 `deploy-physical-2a10c2b26b06-20261026T144900Z.json` 位于新run目录。
- 最小真机验证PASS：原书架正常显示，多本在线书、本地书及已有阅读进度可见；原“本地数据版本过新”提示消失。当前进程5625日志 `startup.runtime-published=ready`（22:49:00.381）、`shelf.query=ready`（22:49:00.683，174ms），本次捕获49行未出现schema too new/native-sqlite-open/Bookshelf main read failed。UI dump与截图已经人工核对；没有把单次页面恢复等同完整阅读/设置/字号回归。
- 证据位于新run的 `device-schema44/verification.json`、`reader-control-schema44.json`、`reader-control-schema44.png`、`hilog-current-process.log`，verification绑定HAP和每个文件哈希；原始诊断和失败没有抹除。
- 本次“旧Core不支持已存v44”的阻断已修复并在真机证实书架恢复。8个定向case PASS，完整套件、其余交互、用户验收仍NOT_RUN/OPEN。无卸载/清数据，无提交，保留其他dirty WIP；本任务probe与HDC客户端正常退出释放租约。
