# HarmonyOS 开发与交付脚本

从任意目录使用 Node.js 执行这些入口。脚本按自身位置定位仓库，不依赖用户目录、macOS 应用目录或当前工作目录。

| 入口 | 用途 |
| --- | --- |
| `node scripts/toolchain-info.mjs` | 只读显示工具发现结果；不会输出签名材料或密码 |
| `node scripts/check-local.mjs` | 主题检查和完整 Host 合同；旧 `check-local.sh` 仅为 Bash 兼容入口 |
| `node scripts/deveco-build.mjs` | DevEco 原生增量 debug 构建，复用项目签名准入与产物复验；可透传 Hvigor 参数 |
| `node scripts/hap-pipeline.mjs --help` | 不可变交付 HAP、复验、精确目标检查与保数据安装的唯一入口 |
| `node scripts/test-toolchain-portability.mjs` | 不构建 HAP、不访问设备的工具发现与执行策略回归 |

脚本路径以本仓根目录为基准。工作区根目录调用示例：

```text
node Reader-for-HarmonyOS/scripts/toolchain-info.mjs
node Reader-for-HarmonyOS/scripts/deveco-build.mjs
node Reader-for-HarmonyOS/scripts/hap-pipeline.mjs build --class iteration
```

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

SDK priority is `READER_HARMONY_SDK_HOME` → `HARMONY_SDK_HOME` → `DEVECO_SDK_HOME` → `OHOS_SDK_HOME`, then `local.properties` and discovered Studio SDKs. The shared environment contract is generated from Core and checked by workspace sync; this local copy keeps standalone Host source tools independent. Full HAP/IDE Native admission still requires the canonical adjacent Core/Harmony/UI workspace. `READER_CORE_ROOT`, `READER_HARMONY_ROOT`, `READER_UI_ROOT` may identify the same real checkouts but cannot redirect full gates to unrelated repositories.

Acceptance builds also require `--core-gate-receipt <receipt.json>` from a complete current Core gate; the pipeline copies and validates its stage logs. HAP resources include an explicit font/license list whose bytes are checked inside each package. Failed build attempts retain redacted stage logs under `.reader-artifacts/hap-attempts/`.

For VM inspect/install, supply `--vm-log <current-emulator.log>` from the operator-confirmed current instance. Before any Bundle Manager operation the pipeline requires completed boot, a current Guest OS boot marker and stable SceneBoard across observations. Physical targets use the boot/SceneBoard checks without an emulator log. These checks do not imply interaction acceptance.
