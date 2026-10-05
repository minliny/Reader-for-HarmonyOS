# R4 独立漫画 UI 源码保留

2026-10-03 保存。归档来自 `/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913` 的冻结交付树；当前完整设计稿另从 `/Users/minliny/Documents/Reader/evidence/2026-10-02-manga-ui-demo` 保存。此目录位于持久 Reader 工作区，不依赖 `/private/tmp` 保留。

| 归档 | 文件数 | 压缩字节 | SHA-256 |
| --- | ---: | ---: | --- |
| `reader-source.tar.gz` | 7111 | 209937914 | `765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132` |
| `approved-design-source.tar.gz` | 70 | 29272946 | `1415dbf6f7c334fbf967c8e7e1a6b229a5f8be76737e83ff74f72a6079539dd0` |
| `native-sdk.tar.gz` | 11 | 9662167 | `0100e26efb0589baf76ca449bcd5aaeba7000e61e856879a99d3ff4268e3355d` |

三仓库使用真实 Git LFS 环境运行 `git ls-files --cached --others --exclude-standard -z`，读取工作树的实际字节。HEAD、完整 dirty 路径状态、缺失路径、范围和逐路径排除理由在 `preflight.json`；每个文件的 SHA、字节数和权限在对应 `*-inventory.json`。归档不包含 Git 历史。

| 仓库 | HEAD |
| --- | --- |
| Reader-Core-Native | `dfd729cffd79ed11da6d44be9e1ba10c4223247f` |
| Reader-UI | `2922d9cd236942a4fdba3fdf1fd8c228a60b0fc0` |
| Reader-for-HarmonyOS | `568ec4e32a2bdce01f62724cfb04a3f6b5a63a60` |

源码包还保留 Root 受控文档、`scripts` 和 `.agents`，全部三方源码与许可证、字体、资源、fixtures，以及现有测试读取的设计参考 JSON、完整 reference 项目和 `.before` 基线源码。旧运行日志、截图、trace、生成报告、依赖目录和构建缓存按清单排除；它们仍属于原历史证据，不在本源码包范围内。实际私有签名目录 `.reader-local/signing` 不进入 Git 源枚举；签名配置、证书、密钥、Profile、私有环境材料全部禁止纳入。两个公开 `build-profile.json5` 仅在检查不含 signingConfigs／口令字段后保留。

独立交付 Core 的全部 1069 个规范 Native 构建输入在源码包中，保留前后指纹一致：

`9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b`

源码包中的 Host SO 与 Native SDK 七文件 manifest 对应的 SO 都为：

`1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996`

R4 `MangaReadingSurface.ets` 为：

`0f5e6d2654e8cc228b43b2ab2c9023e728db904193a147ce71da425113a6b897`

Native 包另保留生成 package manifest、Core 输入快照、build identity 和必要的生成证据。没有从仍在变化的共享 Core 引入 schema35／retention 功能，没有更改产品、测试、构建 manifest、签名材料、设备或规范构建输出。

## 验证

保存脚本完整解压读取了全部归档成员，逐文件检查实际读回字节、SHA、权限、精确成员集合，并复查源文件在归档期间未变化。独立验证脚本再次读回三个压缩包，重算 Core 指纹，核对 Native manifest、Host SO 和 R4 Surface；通过记录分别为 `preservation-run.jsonl`、`verification.json` 和 `independent-verification.jsonl`。

即使原交付临时目录已删除，仍可仅凭本目录验证：

```sh
python3 /Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-03-manga-reader-sheets-r4/source-preservation/verify_archives.py
```

`preserve_sources.py` 只用于重新从原冻结来源保存，要求来源仍存在，并使用 GitHub Desktop 的真实 `git-lfs`；重新保存应指定新的 `--output` 目录，避免覆盖本记录。

## 还原范围

源码归档中的 `Reader-Core-Native/`、`Reader-UI/`、`Reader-for-HarmonyOS/` 对应各仓库；`workspace/` 下受控文档、脚本及 `.agents` 映射到 Reader 工作区根。设计包的 `approved-design/` 是完整可运行 demo 源码，依赖由保留的 lockfile 重新安装。Native 包的 `native-sdk/package/` 对应生成 SDK 包，配套四份生成身份文件另列于同包根。只在新的空目录或已明确选择的独立 checkout 还原，避免覆盖正在工作的共享树。

`tools/refresh-source-supply-manifest.mjs` 的一个历史外部输入 `workspace/evidence/2026-08-31-five-line/supply-admission-results.json` 在独立交付根原本缺失，已记录在预审清单；本次没有猜测补造，也没有从变化中的共享源引入。当前规范 Core 1069 输入及绑定 Native 包不依赖该额外 refresh 工具输入。

本记录只证明源码、设计稿和配套 SDK 已持久保存与逐字节一致。规范 R4 HAP、验签、VM 和视觉结果由父任务另存原始记录。
