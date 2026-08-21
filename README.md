# Reader for HarmonyOS

Reader 当前唯一完整产品 Host/UI，也是唯一实际消费 `Reader-Core-Native` 的应用。

## 开发准入

运行全部非服务型契约：

```bash
./scripts/check-local.sh
```

同时执行类型检查和无增量 debug HAP 构建：

```bash
./scripts/check-local.sh --hap
```

`test-*-server.mjs` 是常驻 fixture server，不计入测试数量，也不会由本命令启动。

## 单独构建

```bash
/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw \
  assembleHap --mode module \
  -p product=default -p module=entry@default -p buildMode=debug \
  --no-daemon --no-incremental
```

当前开发 HAP 会编译尚未纳入 L0 验收的 RSS、Discover、Sync 等扩展页面；开发构建成功不代表这些
页面已进入发布范围。最近一次已审计交付 HAP 的精确哈希、安装结果、阅读生命周期、冲突项和证据边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。
