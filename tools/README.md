# HarmonyOS 交付工具索引

本目录收录 HarmonyOS Host 的构建、验包、证据采集、资产生成与供应链工具。全部脚本用仓库内 Node（或 Python / C）直接运行，不依赖 npm scripts；CI 不自动调用本目录脚本。

## 主入口

| 入口 | 用途 |
| --- | --- |
| `node scripts/hap-pipeline.mjs --help` | 构建、验包、检查目标及保数据安装 |
| `node scripts/test-host.mjs --help` | Host 纯 TypeScript 测试按领域选择 |
| `node scripts/vm-journeys.mjs --help` | 使用已部署的远程 VM 候选执行原生旅程 |
| `node tools/reader-hdc-preflight.mjs --help` | 通过共享 HDC 租约诊断精确目标的就绪状态 |
| `node tools/check-message-entrypoints.mjs --check` | 校验 `message-entrypoints.json` 与源码入口一致 |

交付工具通过 `scripts/lib/harmony-toolchain.mjs` 查找 SDK 及本机工具。明确指定 SDK 时使用 `READER_HARMONY_SDK_HOME`，单项工具覆盖、签名和 Native 配套规则见[构建脚本说明](../scripts/README.md)。ZIP 和 OpenSSL 可以通过 `UNZIP` 和 `OPENSSL` 指定。

## 构建、验包与版本证据

| 文件 | 用途 | 调用 |
| --- | --- | --- |
| `reader-build-tools.mjs` | 校验 / 安装 Hvigor、OHPM、SDK 工具链 | 被 `scripts/hap-pipeline.mjs`、`scripts/ci/build-unsigned-hap.sh` 调用；`--install`、`--profile` |
| `reader-signing-authority.mjs` | 读取并校验签名材料与证书权威 | 库模块，被 `scripts/hap-pipeline.mjs` import |
| `generate-build-provenance-manifest.mjs` | 生成 Core/Native 构建来源清单 | 被 `scripts/hap-pipeline.mjs`、`reader-core-inputs.mjs` 调用 |
| `reader-core-inputs.mjs` | 本地 Core 输入兼容入口 | 被 `generate-build-provenance-manifest.mjs` 相关流程使用 |
| `verify-bundled-test-book-sources-live.mjs` | 校验随包测试书源与在线记录一致 | 被 `scripts/hap-pipeline.mjs` import / 子进程调用 |
| `verify-bundled-test-book-source-haps.mjs` | 对签名/未签名 HAP 校验包内测试书源 | 手动传入 HAP 路径运行 |
| `hap-contract-evidence-policy.json` | HAP 契约证据策略输入 | 被 `scripts/hap-pipeline.mjs` 读取 |
| `message-entrypoints.json` | 消息入口显式登记表 | 由 `check-message-entrypoints.mjs` 校验 |

## HDC 租约与设备探测

| 文件 | 用途 |
| --- | --- |
| `reader-hdc-lease.mjs` | 共享 HDC 租约、server/target 解析（库 + CLI） |
| `reader-hdc-preflight.mjs` | 只读就绪诊断，退出码 `0` READY / `1` NEEDS_ACTION / `2` STOP / `3` 用法错误 |
| `reader-hdc-foreground.mjs` | 前台应用租约辅助 |
| `reader-control-device-probe.mjs` | 阅读控制栏设备探针 |
| `reader-control-fast-capture.mjs` | 快速截图采集（`--parallel` / `--serial`） |
| `diagnose-storage-admission.mjs` | 存储准入诊断（仅观察，权威已退役） |
| `native/reader-control-touch-sequence.c` | 触摸序列证据生成器，说明见同目录两篇 `.md` |

### HDC 就绪检查

`reader-hdc-preflight.mjs` 只读取就绪证据。执行前按[路由、直连与恢复](../../.agents/skills/reader-harmonyos-hap-pipeline/references/lan-hdc-connection.md)核对两段路由、准确 server 和 target。远程 VM 使用 `192.168.1.10:8710` 和实际发现的目标。

```text
node tools/reader-hdc-preflight.mjs \
  --hdc <absolute hdc path> \
  --target <exact target> \
  --server-key 192.168.1.10:8710 --json
```

检查依次核对输入、server TCP 可达性、适用的本地监听者与代理环境、目标和 server 一致性、租约下的 `checkserver` 和 `list targets -v`，并提示遗留前台租约记录。

## UI 契约与证据采集

| 文件 | 用途 |
| --- | --- |
| `ui-contract/collectors/harmonyos/transport.mjs` | 探针传输（被 `scripts/vm-journeys.mjs` 等 import） |
| `ui-contract/collectors/harmonyos/candidate-evidence.mjs` | 候选身份与 VM 就绪断言 |
| `ui-contract/collectors/harmonyos/focus-window.mjs` | 焦点窗口分类与锁屏关闭判定 |
| `lib/native-ui-evidence.mjs` | 候选身份、窗口边界与 SHA-256 工具 |
| `lib/ets-compiler-runtime.mjs` | 解析 ETS SDK 编译器运行时 |
| `lib/tool-environment.mjs` | SDK / 工具环境解析（被多个工具 import） |

## SVG、主题与视觉资产生成

| 文件 | 用途 |
| --- | --- |
| `sync-svg-assets.mjs` | 同步并校验主题 SVG 资产 |
| `svg-provenance.config.mjs` | SVG 来源、组件与配方配置 |
| `theme-svg-variants.json` | 主题 SVG 变体清单 |
| `generate-theme-icons.mjs` | 生成主题图标变体（调用 `generate-theme-registry.mjs`、`sync-svg-assets.mjs`） |
| `generate-theme-registry.mjs` | 生成主题注册表 |
| `generate-manga-directory-visual.mjs` | 生成漫画目录视觉常量 |
| `generate-shared-download-visual.mjs` | 由已批准 demo 生成共享下载视觉 |
| `generate-source-switch-visual.mjs` | 由已批准视觉定义生成书源切换视觉 |
| `generate-manga-sheet-fonts.py` | 生成漫画字体（依赖 `manga-sheet-fonts-requirements.txt`） |

## 书源供应链

| 文件 | 用途 |
| --- | --- |
| `source-supply-lib.mjs` | 供应链指纹、密钥与规则共享库（被 12 处 import） |
| `refresh-source-supply-manifest.mjs` | 刷新书源供应清单 |
| `generate-bundled-source-index.mjs` | 生成随包书源索引 |
| `generate-routine-passed-source-bundle.mjs` | 把通过的审计结果物化为随包导入文件 |
| `sanitize-bundled-source-credentials.mjs` | 移除随包书源中残留的固定凭据 |
| `source-login-default-policy.mjs` | 书源登录默认策略 |
| `verify-source-supply-admission.mjs` | 书源准入校验 |
| `baozi-image-source-correction.mjs`、`popofree-source-correction.mjs`、`qidian-directory-source-correction.mjs`、`reading-assistant-source-correction.mjs`、`tencent-picture-source-correction.mjs` | 单源修正脚本，均由 `refresh-source-supply-manifest.mjs` 编排 |

## 测试夹具与本地服务

| 文件 | 用途 |
| --- | --- |
| `generate-manga-platform-fixtures.py` | 冻结漫画平台探针夹具（Pillow） |
| `generate-manga-platform-large-fixtures.py` | 生成超长漫画夹具 |
| `fixtures/manga-orientation/generate.py` | 生成方向/EXIF goldens（Pillow 11.3.0） |
| `fixtures/manga-graphics/` | 漫画图形夹具与 provenance |
| `http-execute-test-server.js` | `http.execute` 验收用可控 HTTP 服务 |

## 诊断脚本（人工按需）

| 文件 | 用途 |
| --- | --- |
| `diagnostics/manga-capacity-maintenance.mjs` | 漫画容量维护诊断 |
| `diagnostics/shared-download-host-recovery.mjs` | 共享下载 Host 恢复诊断 |
| `diagnostics/retired-arkts/` | 已退役诊断/结构夹具的只读归档（含原 `pages/` 夹具与 `message-entrypoints.json` 快照），不再参与构建或测试 |

## 第三方源码

`vendor/aosp-brightness/` 保存随包 AOSP 亮度组件源码与说明，对应许可在 `entry/src/main/resources/rawfile/licenses/aosp-brightness/`。

## 已退役

| 文件 | 退役依据 |
| --- | --- |
| `migrate-theme-consumers.cjs`（82 行） | 一次性主题调色板迁移工具，脚本自述 "One-time reviewed migration utility"。全仓 grep 无引用，不在任何 npm script / CI workflow / 测试清单中；其迁移的旧调色板色值（如 `2D4A3E`、`1F3528`、`2F6373`、`FFF8EF`、`A8543A`）在 `entry/` 中已无残留，迁移结果已固化在 `Reader-UI/theme/registry.json` 的角色表中，功能已下线。于 tech-debt-20261127 Track A 删除。 |
