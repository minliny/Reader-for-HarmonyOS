# HarmonyOS 交付工具

| 入口 | 用途 |
| --- | --- |
| `node scripts/hap-pipeline.mjs --help` | 构建、验包、检查目标及保数据安装 |
| `node scripts/test-host.mjs --help` | Host 纯 TypeScript 测试按领域选择 |
| `node scripts/vm-journeys.mjs --help` | 使用已部署的远程 VM 候选执行原生旅程 |
| `node tools/reader-hdc-preflight.mjs --help` | 通过共享 HDC 租约诊断精确目标的就绪状态 |

交付工具通过 `scripts/lib/harmony-toolchain.mjs` 查找 SDK 及本机工具。明确指定 SDK 时使用 `READER_HARMONY_SDK_HOME`，单项工具覆盖、签名和 Native 配套规则见[构建脚本说明](../scripts/README.md)。ZIP 和 OpenSSL 可以通过 `UNZIP` 和 `OPENSSL` 指定。

## HDC 就绪检查

`reader-hdc-preflight.mjs` 只读取就绪证据。执行前按[路由、直连与恢复](../../.agents/skills/reader-harmonyos-hap-pipeline/references/lan-hdc-connection.md)核对两段路由、准确 server 和 target。远程 VM 使用 `192.168.1.10:8710` 和实际发现的目标。

```text
node tools/reader-hdc-preflight.mjs \
  --hdc <absolute hdc path> \
  --target <exact target> \
  --server-key 192.168.1.10:8710 --json
```

检查依次核对输入、server TCP 可达性、适用的本地监听者与代理环境、目标和 server 一致性、租约下的 `checkserver` 和 `list targets -v`，并提示遗留前台租约记录。退出码为 `0` READY、`1` NEEDS_ACTION、`2` STOP、`3` 用法错误。
