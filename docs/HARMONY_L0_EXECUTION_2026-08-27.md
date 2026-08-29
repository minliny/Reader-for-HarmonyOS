# HarmonyOS L0 执行交接（2026-08-27）

本文件记录 Legado/HarmonyOS 能力差距审计后，阶段 A / P0 在 2026-08-27 的实际执行结果。它只提交可复核摘要；HAP、布局 JSON、截图和完整 SHA 清单保存在工作区证据目录，不进入源码仓库。

## 归因基线

```text
artifact-bearing Harmony commit=ae708c8362165bc7429c189e3caca14c1609050f
Core commit=c17dea52317efb790ded4438be23c6eda4012b88
Core dirty=false
Core buildId=1dabffda3d650ddb22f1d69f8fa95c2b073f28d509f823cb7bec7879306e5da7
NAPI input sha256=d343ad2f0d26a9a5c787c38851ac4bee26a9c057e928b27f3491abeb52659611
HAP embedded NAPI sha256=7006b43e8c5c139d146f0823d42dc719ef2304e0f1e24d75e400932a50450c99
```

本摘要之后产生的文档提交不改变上述产物归因。

最终源码门禁：

```text
nonServerContracts=85/85
arktsTypeCheck=PASS
debugHapBuild=PASS
incremental=false
```

## 产物

签名 debug HAP：

```text
file=entry-default-signed-ae708c8.hap
bytes=131959752
sha256=86d982794cdf1707631b7a525b3bf4f07447ba772dc7868b5229940b2e1ad2f8
profile=debug
codesign=verified
SHA-256 digest=true
verify-app=success
```

VM 未签名伴生包：

```text
file=entry-default-unsigned-ae708c8-vm.hap
bytes=131704446
sha256=5ac0e0f5b4a9c7b4a31f99fb43d130b08ec8244fc8408b4b22904605b28170e8
```

现有 VM 包为 `appSignType=none`，签名覆盖安装被系统以 `9568332 install sign info inconsistent` 拒绝。为保护共享 VM 数据，本轮没有卸载或清数据；改用同源码、同 Core buildId、同内嵌 NAPI 的未签名伴生包覆盖安装。

## VM 回归结果

环境：`127.0.0.1:5555`、API 23、1320 x 2856、arm64-v8a。测试使用独占锁；结束后释放锁，没有关闭或断开共享模拟器。

| 检查 | 结果 |
|---|---|
| L0 书架 / 设置范围 | PASS：底部仅书架/设置；设置仅保留当前准入入口 |
| TXT 正文 | PASS：现有 TXT 书正文实际渲染 |
| EPUB 正文 | PASS：Sample/Fixture EPUB 正文实际渲染 |
| EPUB 图片 | OPEN：现有两个 EPUB fixture 均无图片 |
| 强停后恢复 | PASS：重启进入书架；继续阅读恢复精确 current 页键 `1047:9064` |

Reader 进程没有 FATAL 日志。远程书源请求在 VM 中存在不可达/连接拒绝，因此新鲜网络的搜索、详情、入架、下载和离线冷启链没有在本轮验收。

## 仍需关闭

1. 在签名一致或全新安装环境安装签名 HAP。
2. Tablet VM 回归。
3. 含图片 EPUB 的导入、渲染、翻页和重启恢复。
4. 新鲜远程网络全链与实际导入选择器边界。
5. 用户验收。

## 完整证据位置

工作区归档：

```text
/Users/minliny/Documents/Reader/evidence/p0-signed-vm-2026-08-27/
```

关键文件：

- `EVIDENCE.md`：分层结论、运行矩阵和证据映射。
- `execution.json`：机器可读执行结果。
- `signed-build-provenance.json` / `vm-unsigned-build-provenance.json`：Core/NAPI/HAP 来源。
- `signed-verification-sanitized.txt`：脱敏验签转录。
- `SHA256SUMS`：目录内全部证据（除清单自身）的 SHA-256。
