# Reader for HarmonyOS

Reader 当前唯一完整产品 Host/UI，也是唯一实际消费 `Reader-Core-Native` 的应用。

## 构建

```bash
/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw \
  assembleHap --mode module \
  -p product=default -p module=entry@default -p buildMode=debug \
  --no-daemon --no-incremental
```

当前测试目录包含普通测试和四个常驻 fixture server；不能把 server 启动当测试通过。2026-08-12
排除 server、并对图片 server 使用 `--self-test` 后为 46 通过、1 失败；失败项是仍要求已降级备份
选择器可用的陈旧测试。

最终复核时，dirty Core `a8baff73…` 已由并行任务同步并形成哈希一致的 unsigned HAP；但 Core
门禁为红且 `gitDirty=true`。下一步是先收敛干净 commit、恢复门禁，再按相同哈希链重构建；在完成
该精确 HAP 的 VM/真机旅程前，不得引用旧 VM 总账宣称闭环。主线与详细边界见
[`../README.md`](../README.md) 和 [`../AUDIT_2026-08-12.md`](../AUDIT_2026-08-12.md)。
