# 下载 Host 恢复诊断（仅手动）

在 HarmonyOS Host 仓库中显式选择：

```sh
node tools/diagnostics/shared-download-host-recovery.mjs --case host-negative-recovery
```

无参数或 `--list` 只输出 `NOT_RUN` 和唯一 case，不读取生产源码或执行断言。其他参数拒绝执行。源码根通过 `import.meta.url` 定位，调用方的当前目录不影响源码选择。需要提供 `node:module.stripTypeScriptTypes` 的 Node；不需要 HarmonyOS SDK。

此入口没有注册到合同索引、默认发现、full、CI 或构建流程。只有需要核对下载状态缓存恢复与旧 revision 回调隔离时才手动选择；不能据此扩大其他检查范围。

## 执行范围与证据

入口读取真实的 `SharedDownloadHost`、`SharedDownloadGateway`、`MangaSessionGateway`、`SharedDownloadProjection` 和 `ReadingImageDiskCache` 五个生产源。前四个加载完整类/投影，第五个只提取实际 `readValidManifest` 方法。书架、Core 响应和文件完整性边界使用有限 fixture；不读取真实资源文件、数据库或用户数据，也不启动 Core/Native、SDK、子进程、网络或设备。

17 组断言包括：

- `cached` / `completed` 候选分别从 Host 不完整和 IO 失败恢复，普通 reload 重验，完整结果继续复用。
- revision 变化、Core 拒绝、小说以及 Core-only missing / 无版本的既有行为。
- entry 为空或版本不匹配后的恢复、已索引负结果重验，以及完整漫画复用。
- R1 负结果迟到时保留 R2 完整索引及后续复用。
- 在内存中旁路两个负缓存保护，重现旧粘滞零值；调回旧 revision fence 顺序，确认竞态断言拒绝它。

反例仅改变加载到内存的真实生产源码，不复制生产缓存算法，不修改任何生产文件。成功输出唯一 `PASS` JSON，包含 17 组观察、诊断自身 SHA256 与五个源文件 SHA256；任何断言或源提取失败均退出失败，不自动重试或转跑其他检查。Node 的 TypeScript stripping 实验性提示不属于产品诊断输出。

这是受控边界下的本地恢复行为证据，不证明历史 VM `0/2` 的原因、安装包行为、SDK `AtomicFile` 兼容性、当前业务数据、资源完整性或用户验收。运行前仍须按工作区规则记录入口、隐式依赖、范围、具体风险和本次必要性。

## 漫画容量维护诊断（仅手动）

在 HarmonyOS Host 仓库中分别显式选择所需 case：

```sh
node tools/diagnostics/manga-capacity-maintenance.mjs --case capacity-maintenance
node tools/diagnostics/manga-capacity-maintenance.mjs --case capacity-sdk
```

两个 case 独立选择，不互相附带执行。无参数或 `--list` 只输出 `NOT_RUN` 和两项清单，在读取生产源码、加载 SDK 或执行断言前退出；其他参数拒绝执行。此诊断默认 OFF，没有注册到合同索引、默认发现、full、CI 或构建流程，不依赖 `.local` 文件。源码通过 `import.meta.url` 定位。

`capacity-maintenance` 需要提供 `node:module.stripTypeScriptTypes` 的 Node，不需要 HarmonyOS SDK。它加载真实的 `ReadingImageDiskCache` 和 `SharedDownloadStorageGateway` 完整普通类，以合成库存、虚拟文件 IO、空间探针和 Core 响应作为边界，执行实际预算分桶、容量计算、预约、串行锁与精确 grant 交接方法。17 组断言覆盖充足预算下普通启动和直接容量维护保留近期缓存、达到预算或物理余量后立即停止、在途预约、调用方写入停止条件、派生文件与永久下载、保护状态、迟到的 Core 拒绝、显式 clear、expiry、pending grant 和观测失败；其中两个源码反例分别恢复无条件清空、禁止压力回收，必须被断言拒绝。自动维护使用公共总缓存预算和系统余量，写入时的原件／派生分区限制仍由原写入预约负责。

`capacity-sdk` 需要已安装的 HarmonyOS ETS SDK 和可执行的 Ark 前端，只执行两组检查：SDK 对实际磁盘缓存 TS 源码的解析／转换，以及 Ark 前端 `--parse-only` 接受该源码并拒绝临时目录内的无效语法反例。它复用现有工具路径解析器；若自动发现前端失败，先记录失败和现有二进制身份，再用一次性 `READER_ES2ABC` 指定已确认路径。例如本机已安装的前端：

```sh
READER_ES2ABC=/home/administrator/.local/share/reader-dev/toolchains/harmony-6.1.0/command-line-tools/sdk/default/openharmony/ets/build-tools/ets-loader/bin/ark/build/bin/es2abc node tools/diagnostics/manga-capacity-maintenance.mjs --case capacity-sdk
```

该覆盖仅作用于本次命令，不修改全局解析器，也不下载或构建工具。SDK 检查还通过现有 `ets-compiler-runtime`、`tool-environment` 和 `harmony-toolchain` 解析安装位置；不会调用其他测试入口。

两项均不读取应用资源、数据库或用户数据，不启动 Core/FFI、应用、网络或设备，不构建、签名或安装 HAP。源码反例只在内存中修改，不写回生产文件。成功分别输出包含源文件 SHA256 的 17 组或 2 组 `PASS` JSON；断言、工具缺失或前端失败保持失败，不转跑其他 case。SDK 解析结果不替代完整 ArkTS 语义编译；虚拟边界结果不证明原生文件系统行为、当前缓存数据或历史 eviction 调用者，也不能据此解释 Nov10 `0/2` 的历史因果。执行前仍须逐项记录检查入口、嵌套依赖、触发范围、所保护风险和本次必要性。
