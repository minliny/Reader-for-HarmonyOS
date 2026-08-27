# HarmonyOS L0 EPUB 正文图片执行交接（2026-08-27）

本文件记录 L0 EPUB 正文图片闭环的实际执行结果。完整 HAP、EPUB fixture、来源清单和哈希保存在工作区 `evidence/l0-epub-image-2026-08-27/`，不重复提交大体积证据到源码仓库。

## 关闭的问题

旧 EPUB 正文图片 fixture 的资源只有 4 字节 PNG magic，能够证明 locator 地址生成，却不能证明平台解码或 ArkUI 渲染输入有效。本轮将 fixture 升级为确定生成的完整 360 x 180 RGB PNG，并把图片链路验证到两种正文渲染面：

```text
Core U+FFFC image block
  -> reader-local-epub:// locator
  -> Host bounded archive entry read
  -> image decode/dimension validation
  -> temporary display file URI
  -> paged + continuous Image(fragment.fileUri)
```

`LocalEpubResourceHost` 也新增了章节请求取消检查，并把 `isCurrent` 继续传入共享 `ReadingBodyImageHost`，防止过期的本地 EPUB 图片在翻章后继续进入会话。

## 归因基线

```text
Core commit=a3672b83c8a4e48088fb500ac5ad1f2d20e77935
Harmony artifact-bearing commit=d29de2863838ca2f56b99ca259096970c33e039b
Core dirty=false
Harmony dirty=false
acceptanceEligible=true
Core buildId=1222bb399406be531fab23cd512ed4ce2f05e64ac18dd2290c9d94aae88263fd
NAPI input sha256=7670e0e7f7a0d80b8e64280d263cdf1135406d65ba7999313c767806a402ef6f
HAP embedded stripped NAPI sha256=d233d0b610c5ef51e41a32950a4be700abd14f3e456b6f19b80a9d1ecc8dbe8a
```

本摘要的文档提交不改变上述产物归因。

## 门禁结果

| 层级 | 结果 |
|---|---|
| Core EPUB parser fixture | 10/10 PASS |
| Core FFI asset tests | 5/5 PASS |
| Core runtime EPUB image projection | 1/1 PASS |
| Core standard gate | PASS：3429 nextest、210 conformance、strict drift 163 / 0 blockers、C/C++ ABI smoke |
| Harmony contracts | 85/85 PASS |
| ArkTS type check | PASS |
| no-incremental unsigned HAP | PASS |
| Core/NAPI/HAP provenance | PASS，`acceptanceEligible=true` |

unsigned HAP：

```text
file=entry-default-unsigned.hap
bytes=131705198
sha256=944416100a2057923029db626f7d41c4ed3068f60602deba34cf85decbccf576
```

确定性 EPUB fixture：

```text
file=epub3_nav_spine_resource_cover.epub
bytes=2827
sha256=b662f05b4931c14d420c051d4d3f7585da4af76a3fd93ae9d795637f983bde58
image=PNG 360 x 180 RGB, valid IHDR/IDAT/IEND
```

## 验收边界

本轮只关闭实现、合同和可追溯构建层。另一个任务正在同一主工作区重构 PageCurl，且共享 VM 属于冲突资源，因此没有安装 HAP、清理应用数据或操作模拟器。

仍需完成：

1. VM 导入该 fixture，验证正文图片实际显示、离开/返回和强停恢复。
2. 对应 commit 的 signed HAP 安装。
3. Tablet 和物理设备图片布局/清晰度验收。
4. 用户验收。
