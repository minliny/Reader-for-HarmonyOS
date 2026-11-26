# Reader for HarmonyOS

Reader 的 HarmonyOS 原生客户端，使用 **ArkUI / ArkTS** 构建界面与平台适配层，通过 NAPI 接入共享的 Rust 业务内核 `Reader-Core`，面向手机、平板与 2in1 宽屏设备提供统一的本地与在线阅读体验。

> **当前状态**：活跃开发中（当前开发基线 `0.2.0`，尚未公开发行）。本仓库包含 HarmonyOS Host/UI 源码、构建与验证脚本以及设计参考文档。

## 基本信息

| 项目 | 当前配置 |
| --- | --- |
| 应用包名 | `io.reader.minliny` |
| 产品版本基线 | `0.2.0`（由 `config/app-release-ledger.json` 管理） |
| 兼容 / 目标 SDK | HarmonyOS `6.1.0`（API 23） |
| 适配设备形态 | `phone`、`tablet`、`2in1` |
| 核心技术栈 | ArkTS / ArkUI + Rust (`Reader-Core`, `arm64-v8a` NAPI) |

## 功能范围

### 当前主线能力
- **本地电子书**：支持通过系统文件打开与选择导入 `TXT`、`EPUB`、`MOBI`、`AZW`、`AZW3`、`KF8`，保留原书文件并维护阅读进度与目录。
- **在线小说与书源管理**：支持书源导入/分组/订阅、多源搜索（单源异常隔离）、详情入架、目录更新、换源、章节预缓存与离线下载。
- **漫画阅读**：支持独立漫画图片清单、缓存与归一化阅读位置管理。
- **阅读与听书体验**：支持自定义排版主题、阅读控制栏与目录/书签工具、系统文本朗读（TTS）及后台音频播控（AVSession）。
- **多形态界面适配**：覆盖手机、平板与 2in1 宽屏布局；界面规范参考见 [跨平台界面参考](docs/ui-design/cross-platform-reference/README.md)。

### 开发中扩展模块
- 仓库内同时包含 `RSS`、`Discover`、`Sync`（自备 WebDAV 配置备份等）扩展页面代码，目前处于开发态，不代表已进入首版发布范围。
- 本项目为个人维护客户端，不提供自营在线账号或托管同步服务。

## 架构与多仓关系

Reader 采用“共享 Rust Core + 各平台原生 Host/UI”架构：

- **`Reader-for-HarmonyOS`（本仓库）**：HarmonyOS 原生 UI、页面状态、系统文件访问、网络执行、窗口/媒体/TTS 等平台 Host 能力。
- **`Reader-Core`（闭源 / 私有仓库）**：唯一业务事实源，负责书库与规则解析、电子书解码、持久化与事务语义，通过锁定版本构建为 OHOS NAPI 原生库供本仓消费（锁定信息见 [`scripts/core-dependency.json`](scripts/core-dependency.json)）。
- **`Reader-UI`**：跨平台 UI 契约快照、漫画共享类型、字体与设计资产参考。

## 目录概览

```text
.
├── AppScope/                  # 应用级配置与版本基线
├── config/                    # 版本发布台账（app-release-ledger.json）
├── entry/
│   └── src/main/
│       ├── module.json5       # 模块权限、设备形态与文件打开能力声明
│       └── ets/
│           ├── app/           # 应用初始化与状态装配
│           ├── features/      # 书架、阅读、漫画、搜索、书源、下载、设置等业务模块
│           ├── platform/      # HarmonyOS 系统能力适配（文件、网络、音频、窗口等）
│           ├── ui/            # 公共组件、布局、主题与反馈框架
│           └── pages/         # 页面入口与结构验证夹具
├── scripts/                   # DevEco 构建、不可变 HAP 流水线、工具链检测与 CI 脚本
├── tools/                     # 仓内契约检查与辅助测试工具
└── docs/                      # 版本身份、CI、消息框架、UI 参考与准发布核验文档
```

## 构建与开发

### 前置依赖
- **完整构建（含 Native / HAP）**需要：
  - HarmonyOS SDK `6.1.0(23)` / DevEco Studio（含 Hvigor、OHPM、BiSheng）
  - Node.js `22.23.3`、Java（用于签名/验签工具）、Rust `1.97.1`（`aarch64-unknown-linux-ohos`）
  - 相邻检出的 `Reader-Core` 源码目录（闭源私有仓库，需具备访问权限）
  - 本地调试签名配置（存放于 `.gitignore` 忽略的 `.reader-local/signing/`，不纳入 Git）
- **仅查看源码或运行仓内 Node 契约检查**：只需 Node.js 22+，无需私有 Core 或签名材料。

### 常用命令

查看本机工具链发现结果（只读，不输出签名信息）：
```bash
node scripts/toolchain-info.mjs
```

DevEco 原生开发构建（按需核对并同步 Core Native，在内存中注入本地签名，不改写工作树）：
```bash
node scripts/deveco-build.mjs
```

不可变交付流水线（隔离目录无增量构建、本地签名校验与 manifest 落盘）：
```bash
node scripts/hap-pipeline.mjs build --class iteration
```

只读计算当前工作树的应用版本与内容身份（`PLAN_ONLY`）：
```bash
node scripts/hap-pipeline.mjs identity --channel DEV --abi arm64-v8a
```

列出可用本地检查（默认只输出清单，不隐式运行全量测试）：
```bash
node scripts/check-local.mjs
```

更完整的环境变量、跨平台工具路径发现与部署说明见 [`scripts/README.md`](scripts/README.md)；应用版本与包内构建身份规则见 [`docs/build-version-identity.md`](docs/build-version-identity.md)。

## CI 与验证

- **HarmonyOS CI**（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）：
  - `push` / `pull_request` 自动运行受影响范围的 Host 快速检查；
  - 合入 `main`、仓内 PR、手动触发或定时任务会使用锁定 SDK 容器镜像（`api23` / `api24` / `api26r`）执行 Native 编译与无签名 HAP 验证（不涉及华为账号、签名私钥或设备部署）。
- **Host Explicit Checks**（[`.github/workflows/contracts.yml`](.github/workflows/contracts.yml)）：
  - 手动触发（`workflow_dispatch`），按需点名运行指定契约测试与源码卫生检查。

更多说明见 [`docs/ci.md`](docs/ci.md)。

## 相关文档

- [构建与交付脚本说明](scripts/README.md)
- [应用版本与构建身份合同](docs/build-version-identity.md)
- [消息 UI 框架规范](docs/message-ui/FRAMEWORK.md)
- [跨平台界面与交互参考](docs/ui-design/cross-platform-reference/README.md)
- [HarmonyOS 准发布核验清单](docs/release/HARMONYOS_PRE_RELEASE_CHECKLIST.md)

## 致谢与第三方资源

- 内置字体与图标的第三方来源与许可记录见 [`entry/src/main/resources/rawfile/FONT-SOURCES.txt`](entry/src/main/resources/rawfile/FONT-SOURCES.txt)、[`docs/MANGA_SHEET_ICON_LICENSE.md`](docs/MANGA_SHEET_ICON_LICENSE.md) 及 [`docs/ui-design/SVG_PROVENANCE.json`](docs/ui-design/SVG_PROVENANCE.json)。
- 本项目的部分阅读与书源交互语义参考了开源阅读（Legado）的产品范式，核心实现均为独立重写，未复制其 GPL 代码。
- 本仓库许可协议待正式发布前另行确定。
