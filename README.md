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

`--hap` 是当前测试安装包的唯一交付入口：构建前会让包内至少 8 个书源逐一通过 Core
L1–L5（导入、搜索、详情、目录、正文）实时检查，构建后再核对 signed/unsigned HAP
中的 `reader-test-book-sources.json` 与已检查文件逐字节一致；输出目录若残留编号 HAP
也会拒绝交付，避免误装旧包。首次安装和旧测试包升级
都会在 Core 可见前补齐或升级这些书源；规则升级不会改回用户的启停选择。

`test-*-server.mjs` 是常驻 fixture server，不计入测试数量，也不会由本命令启动。

## 仅编译调试

```bash
/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw \
  assembleHap --mode module \
  -p product=default -p module=entry@default -p buildMode=debug \
  --no-daemon --no-incremental
```

该命令绕过书源实时门禁，只能用于本地编译诊断，产物不得作为测试安装包分发。

当前开发 HAP 会编译尚未纳入 L0 验收的 RSS、Discover、Sync 等扩展页面；开发构建成功不代表这些
页面已进入发布范围。最近一次已审计交付 HAP 的精确哈希、安装结果、阅读生命周期、冲突项和证据边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。
