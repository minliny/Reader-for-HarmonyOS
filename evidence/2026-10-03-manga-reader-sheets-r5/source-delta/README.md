# R5 两文件源码增量

2026-10-03 从冻结独立交付树保存。只读对比 R4 父档的全部 7111 条路径，结果恰好两个替换项；其余 7109 个文件的实际字节、大小和权限完全一致，没有缺失，也没有额外生产／工具路径。原工作树和独立交付树的两个最终文件逐字节一致。

| 路径 | R4 SHA-256 | R5 SHA-256 |
| --- | --- | --- |
| `Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets` | `0cebb24ce4796a20da30e9f55952b7365a2380c1d0dbeec5d34120abf700578d` | `00087dbd1fc42a843b93242f4c450d17f7f70dde8bd7e1ea575431aebfce3685` |
| `Reader-for-HarmonyOS/tools/test-manga-directory-font-readiness-sdk.mjs` | `2cfff33a8a906f8489c7e088436e1119b79f3a52fde802e139cfa250d04a033b` | `d70ab1686040b7a45408b6b87b951966106c934ec8a417be9287ad6cc9e22f67` |

父档为 R4 `source-preservation/reader-source.tar.gz`，SHA-256：

`765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132`

本次 `r5-source-delta.tar.gz` 为 11530 字节，SHA-256：

`a1bba804791fc0873bb924d6696755fd91132629c645c5331391d112c6a04137`

有效 R5 全源码清单的指纹为：

`cf5c309423a064363ee5ed842804ebb0575e6610312a8d8286ad9ce1f7c15952`

`delta-manifest.json` 精确绑定父档和父清单 SHA、两项旧／新记录、delta SHA、有效清单 SHA、Core 指纹和原 Native 包。`comparison.json` 保留完整对比结论及仓库状态；`effective-source-inventory.json` 是应用增量后的全部 7111 个文件记录。

已在新的临时目录真实解包父档并应用两文件增量，逐文件对照有效清单与冻结交付源验收，所有字节和权限通过，随后删除验证目录。独立验证脚本又完整读回父档与 delta，不依赖原交付临时目录。原 R4 父档没有改变。

Core 的 1069 个规范构建输入指纹仍为 `9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b`；Native 七文件 package 及四份生成身份文件逐字节保持 R4 原记录。Host SO 仍为 `1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996`。字体、motion 及其他产品文件使用 R4 父版本，没有打包私有签名材料。

只凭持久父档和本目录即可重新验证：

```sh
python3 /Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-03-manga-reader-sheets-r5/source-delta/verify_delta.py
```

还原时，在新的空目录解包 R4 父源码，再解包本增量覆盖仅这两个相同仓库前缀的路径；`workspace/` 的 Root 文件映射沿用 R4 说明。不会恢复 `.git`、私有签名配置、依赖目录或构建缓存。

本阶段没有填入尚未提供的规范 R5 run／manifest。父任务提供最终构建绑定后，会另加绑定记录；本增量、父档和已冻结证据保持不变。保存与重建结果只证明源字节，构建、VM 与视觉验收由规范记录另证。
