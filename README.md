# Reader for HarmonyOS

Reader 当前唯一完整产品 Host/UI，也是唯一实际消费 `Reader-Core-Native` 的应用。

## 构建

```bash
/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw \
  assembleHap --mode module \
  -p product=default -p module=entry@default -p buildMode=debug \
  --no-daemon --no-incremental
```

当前测试目录同时包含普通契约和常驻 fixture server；不能把 server 启动当测试通过。2026-08-14
排除 `test-*-server.mjs` 后，52 个非服务型契约全部通过。

当前产品代码提交为 `ca7f9a5b617d3aba41eb20bdeff7f1ff0f4163d5`，绑定的干净 Core 为
`8336e501debcc68019ffbd44bf040effb7a8d80f`。当前交付 HAP 的精确哈希、安装结果、Legado 式书架
阅读生命周期、冲突项和详细证据边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。
