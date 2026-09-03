# Reader for HarmonyOS

Reader 当前唯一完整产品 Host/UI，也是唯一实际消费 `Reader-Core-Native` 的应用。

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

## 仅编译诊断

```bash
/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw \
  assembleHap --mode module \
  -p product=default -p module=entry@default -p buildMode=debug \
  --no-daemon --no-incremental
```

该命令绕过源码内容绑定、产物自校验和 immutable manifest，只能用于本地编译诊断，产物不得安装、
分发或作为任何验收证据。

当前开发 HAP 会编译尚未纳入 L0 验收的 RSS、Discover、Sync 等扩展页面；开发构建成功不代表这些
页面已进入发布范围。最近一次已审计交付 HAP 的精确哈希、安装结果、阅读生命周期、冲突项和证据边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。

当前待开发内容只维护在根目录
[`../DEVELOPMENT_BACKLOG.md`](../DEVELOPMENT_BACKLOG.md)。本仓 `docs/` 下的审计、实施切片、
遗留问题和状态账本只作历史证据或专项合同，不得维护另一套当前 TODO。
