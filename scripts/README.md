# HarmonyOS 开发与交付脚本

从任意目录使用 Node.js 执行这些入口。脚本按自身位置定位仓库，不依赖用户目录、macOS 应用目录或当前工作目录。

| 入口 | 用途 |
| --- | --- |
| `node scripts/toolchain-info.mjs` | 只读显示工具发现结果；不会输出签名材料或密码 |
| `node scripts/check-local.mjs` | 默认只列清单并报告 `NOT_RUN`；旧 `check-local.sh` 仅为 Bash 兼容入口 |
| `node scripts/deveco-build.mjs` | DevEco 原生增量 debug 构建，复用项目签名准入与产物复验；可透传 Hvigor 参数 |
| `node scripts/hap-pipeline.mjs --help` | 不可变交付 HAP、复验、精确目标检查与保数据安装的唯一入口 |
| `node scripts/test-toolchain-portability.mjs` | 不构建 HAP、不访问设备的工具发现与执行策略回归 |

脚本路径以本仓根目录为基准。工作区根目录调用示例：

```text
node Reader-for-HarmonyOS/scripts/toolchain-info.mjs
node Reader-for-HarmonyOS/scripts/deveco-build.mjs
node Reader-for-HarmonyOS/scripts/hap-pipeline.mjs build --class iteration
```

DevEco 原生 Build/Run 会先核对当前 Core 提交、dirty 状态、输入快照和 Native/SDK 配套。Core 提交或内容变化、或本地 Native 包缺失时，复用 Core 的构建入口按需重建并事务同步；仅 Host 配套落后时只同步，输入已匹配时直接复用。嵌套构建借用同一资源租约，失败仍停止，损坏证据和未知错误不会被自动放过。打包完成后再次核对实际 HAP 内的 Native 身份。首次刷新需要已安装的 Rust/Cargo 和对应宿主 SDK；Bun 仅在显式选择需要它的 Host/SDK probe 时要求，不作为普通 Native 刷新的前置。GUI 的工具搜索保留已有 PATH 优先级，并补充标准 `CARGO_HOME/bin`、`BUN_INSTALL/bin` 位置。

HAP 构建默认 `--contracts-scope none`，Host 回归为 `NOT_RUN`。普通功能开发、漏洞修复和每次构建均不自动执行主题、Host 全量或 Core 全量；[检查场景与入口](../../GATE_INDEX.md) 说明正式发布及完整复验的边界。需要局部回归时先用 `node tools/gate-index.mjs --need '<需求关键词>'` 查询合格项，确认作用、成本和隐式子检查，再按准确 ID 选择。旧 `--full` / `--contracts-scope full` 是历史范围，不能代替经过审定的发布集合；未选择的检查保持 `NOT_RUN`，不合格项不进入发布集合。

普通 IDE/HAP 构建不自动扫描或修复生成的 Native 缓存。当前问题确需诊断时，用 `node scripts/lib/ide-native-cache.mjs --path '<精确的仓库相对生成 SO 路径>'` 只读检查所选文件；只有明确选择 `--repair` 才持有构建租约、先备份并移除与规范库字节完全相同的编号副本。范围仅为生成的 CMake、收集库和裁剪库目录；未知库、不同内容、缺失规范库或符号链接仍拒绝修复，不处理 `entry/libs` 等源码输入，也不放宽最终 HAP 的 Native 集合校验。

## 工具配置

优先使用单项工具环境变量，再使用显式安装目录、项目 `local.properties` 中的 `sdk.dir` / `hwsdk.dir`、平台常见安装位置和 `PATH`。显式设置无效会直接报错，不会静默切换 SDK。SDK 可指向 `openharmony`、包含 `openharmony` 的目录、含 `default/openharmony` 的 SDK 安装目录，或版本化 SDK 目录。

| 环境变量 | 含义 |
| --- | --- |
| `READER_DEVECO_HOME` / `DEVECO_HOME` | DevEco 安装目录；macOS 可填 `.app` 或其 `Contents` |
| `READER_HARMONY_SDK_HOME` / `HARMONY_SDK_HOME` / `DEVECO_SDK_HOME` / `OHOS_SDK_HOME` | HarmonyOS SDK 安装目录 |
| `HVIGORW`, `OHPM`, `HDC` | 对应工具文件或 `PATH` 命令名；Hvigor 可直接指定 `hvigorw.js` |
| `READER_NODE` / `NODE` / `NODE_HOME` | 工具 Node 可执行文件／安装目录；否则优先使用 DevEco 捆绑 Node，再查 `PATH` |
| `READER_ETS_LOADER_ROOT` | ETS loader 目录 |
| `READER_HVIGOR_PLUGIN_PACKAGE` | 官方 Hvigor OHOS plugin 的 `package.json` |
| `JAVA` / `JAVA_HOME` | Java 可执行文件／JDK 根目录 |
| `HAP_SIGN_TOOL`, `NATIVE_STRIP_TOOL` | HAP 验签 JAR、LLVM objcopy |
| `OPENSSL`, `UNZIP` | 已安装的 OpenSSL 与 Info-ZIP unzip 命令；默认从 `PATH` 发现 |
| `HVIGOR_SHARED_TOOLS` / `HVIGOR_USER_HOME` | 已准备的 Hvigor wrapper tools／用户目录 |
| `CARGO_TARGET_DIR` | Core 构建输出根目录；HAP 构建、IDE preflight 与 `sync-native` 读取同一目录。相对路径以 Core 仓根目录为基准 |
| `READER_LOCK_DIR` | 跨进程锁根目录，默认使用宿主系统临时目录；所有协作进程须使用同一配置 |
| `READER_HDC_SERVER_KEY` | HDC server 端点；目标仍必须通过 CLI 明确指定 |
| `READER_HARMONY_SIGNING_PROFILE` | 私有签名配置路径；默认仍在本仓忽略的 `.reader-local/signing` 内 |

Windows 的 `.exe`、`.cmd`、`.bat` 按平台发现，工具 Node CLI 直接由配置／发现的 Node 启动，pipeline 内部子脚本继续使用当前 Node。批处理入口仅接受普通构建参数与路径，拒绝 shell 控制／展开语法；需要特殊字符路径时指定工具的 Node `.js` 入口。Windows 私有签名配置和 pipeline 会话检查文件 ACL，Unix 使用原有私有权限检查。证书、包名、Profile、精确目标、保数据与证据门禁保持有效。

平台候选目录只是自动发现的备选，不要求在固定目录安装。脚本可配置不表示所有厂商 SDK 都支持该宿主：缺少相应平台的 DevEco、SDK、原生库或外部工具时会明确报告缺失项。Windows/Linux 的实际构建与安装仍需在对应宿主验证，本机回归不替代这些证据。

SDK priority is `READER_HARMONY_SDK_HOME` → `HARMONY_SDK_HOME` → `DEVECO_SDK_HOME` → `OHOS_SDK_HOME`, then `local.properties` and discovered Studio SDKs. The shared environment contract is generated from Core and checked by workspace sync; this local copy keeps standalone Host source tools independent. HAP/IDE Native admission requires the canonical adjacent Core and Host workspace; Reader-UI is required only by explicitly selected checks that consume it. `READER_CORE_ROOT`, `READER_HARMONY_ROOT`, `READER_UI_ROOT` may identify the same real checkouts but cannot redirect full gates to unrelated repositories.

Core gate receipts are validated and their stage logs copied only when `--core-gate-receipt <receipt.json>` is explicitly supplied. An absent receipt remains `NOT_RUN`; missing complete Host/Core evidence keeps `acceptanceEligible: false`, including when the requested class is `acceptance`. The build does not generate missing full-suite evidence automatically. HAP resources include an explicit font/license list whose bytes are checked inside each package. Failed build attempts retain redacted stage logs under `.reader-artifacts/hap-attempts/`.

For VM inspect/install, supply `--vm-log <current-emulator.log>` from the operator-confirmed current instance. Before any Bundle Manager operation the pipeline requires completed boot, a current Guest OS boot marker and stable SceneBoard across observations. Physical targets use the boot/SceneBoard checks without an emulator log. These checks do not imply interaction acceptance.

For physical user-build phones that explicitly deny the kernel boot-ID read,
the controller checks Toybox's UTC boot time and all six init boot milestones
across a real two-second observation, with advancing guest time and stable
SceneBoard. The receipt identifies this as `physical-boot-milestones-v1`, not
a kernel UUID. Missing, malformed or changing observations stop deployment.
