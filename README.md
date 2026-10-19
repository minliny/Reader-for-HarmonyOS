# Reader for HarmonyOS

Reader 当前唯一完整产品 Host/UI，也是唯一实际消费 `Reader-Core` 的应用。

## UI 与逻辑稿

工作区旧 UI 原型、状态稿与设计归档已按授权清理。新稿以本工作区已接通的应用逻辑为依据。
入口为 [UI 稿](docs/ui-design/app-baseline/index.html) 与 [逻辑稿](docs/ui-design/app-baseline/LOGIC.md)。两者共用逐页参数，包含 iOS / Android 布局、排版、动效、平台适配与验收要求；当前模块索引、准入状态和证据统计以逻辑稿及其分类说明为准。逻辑稿提供各业务章节的入口、动作和返回路线图。预览可检查安全区、键盘和大字体，原生还原仍需逐端验收。

## 开发准入

运行全部非服务型契约：

```bash
./scripts/check-local.sh
```

生成当前 dirty 状态可追溯的日常 debug HAP：

```bash
node scripts/hap-pipeline.mjs build --class iteration
```

该流水线是唯一 HAP 交付入口：先运行全部合同，再按内容生成源码 fingerprint，在临时目录进行
无增量构建和本地签名注入，校验 HAP、内嵌 Native、书源字节和签名后，才原子发布 immutable
manifest。`entry/build/` 不再是交付目录，`check-local.sh --hap` 已停用。

真实书源 L1–L5 是独立网络证据，需要时显式增加 `--live-sources`，不再让每次离线打包依赖网络。
完整的 iteration/acceptance、本地签名、复验和保数据安装合同见
[`../HAP_BUILD_SYSTEM.md`](../HAP_BUILD_SYSTEM.md)。首次安装和旧测试包升级仍会在 Core 可见前补齐或
升级内置测试书源；规则升级不会改回用户的启停选择。

`test-*-server.mjs` 是常驻 fixture server，不计入测试数量，也不会由本命令启动。

## DevEco 原生开发构建与安装

```bash
node scripts/deveco-build.mjs
```

按用户 2026-10-12 的明确要求，DevEco Build/Run 可直接使用此入口。Hvigor 在内存中注入
`.reader-local/signing/build-profile.json5` 的指定私有签名，复用流水线的证书/Profile、Native/SDK
预检和 signed HAP 验签；增量命中也检查最终签名输出。DevEco 的安装元数据指向
`entry-default-signed.hap`，不得卸载或清除应用数据。开发构建不运行每次全量合同，
不声称 immutable manifest 或发布验收通过；agent 交付与 acceptance 仍使用隔离流水线。

当前开发 HAP 会编译尚未纳入 L0 验收的 RSS、Discover、Sync 等扩展页面；开发构建成功不代表这些
页面已进入发布范围。最近一次已审计交付 HAP 的精确哈希、安装结果、阅读生命周期、冲突项和证据边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。

当前待开发内容只维护在根目录
[`../DEVELOPMENT_BACKLOG.md`](../DEVELOPMENT_BACKLOG.md)。本仓 `docs/` 下的审计、实施切片、
遗留问题和状态账本只作历史证据或专项合同，不得维护另一套当前 TODO。
