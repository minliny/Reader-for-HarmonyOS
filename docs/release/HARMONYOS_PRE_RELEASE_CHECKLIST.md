# HarmonyOS 准发布核验清单

适用范围为 Wave 3 的 `io.reader.minliny`、`0.2.0`、arm64 本地调试候选。核验基线采用已发布的 Wave 2 Core `c5ba89fc`，其中 Native 生产提交为 `40177a0d`。兼容和目标 SDK 均为 `6.1.0(23)`。构建、验签、设备验收和公众发行分别判定。

## 依赖、源码与包内声明

| 对象 | 本地核验 | 公开发行前 |
| --- | --- | --- |
| libmobi `0.12` | Core 固定上游 tag 和归档摘要。适配器通过 `cc` 静态编入，Harmony NAPI 链接该 Core。HAP 资源清单包含 libmobi 公告、LGPL-3.0 和 GPL-3.0 文本。包内 `libmobi-NOTICE.txt` 已校正旧仓名（`Reader-Core-Native`→`Reader-Core`），并补入 LGPL-3.0 第 4 节的对应源码与重链指引模板。 | 按 LGPL 第 4 节准备对应源码及允许更换、重链的应用材料，确定相应安装信息、公告入口和实际获取路径。用同一发行材料演练更换 libmobi、重链和安装。把公告中的 `<TO_BE_FILLED_AT_RELEASE>` 占位符替换为稳定公开 URL（不得使用私有仓或不实链接）。 [libmobi 上游许可](https://github.com/bfabiszewski/libmobi/blob/v0.12/COPYING) |
| `cssparser 0.36.0`、`selectors 0.36.1` | 均为 MPL-2.0。Cargo 锁和 Core 许可清单分别绑定现行版本及许可文件。Harmony 包内 `oss-reuse-NOTICE.txt` 已按锁文件更新为 `cssparser 0.36.0` 与 `selectors 0.36.1`，下载链接同步为对应固定版本。 | 向接收者提供这些 MPL 覆盖文件的对应源代码及取得方式，带上实际修改和原有声明。Core 私有仓的访问权限不足以覆盖公众发行。 [MPL-2.0 第 3 节](https://www.mozilla.org/en-US/MPL/2.0/#responsibilities) |
| RustCrypto、解析与压缩 | arm64 FFI 锁定图确认 `aes 0.8.4`、`aes-gcm 0.10.3`、`pbkdf2 0.12.2`、`scraper 0.26.0`、`html5ever 0.39.0`、`quick-xml 0.41.0`、`zip 2.4.2`、`flate2 1.1.9`、`png 0.18.1`、`zune-jpeg 0.5.15`、`kamadak-exif 0.6.1`。Core 源码保留现行依赖清单和许可。Harmony OHPM 锁只解析本地 `@reader/core-harmony 0.1.0`，未解析 Reader Kit 或 Readium。 | 按最终 Native 和 feature 图回填完整发行归属，标明择一许可的选项，逐个确认交付物与当前 notice 一致。Core 局部许可清单和 Host 现有公告各保留其现有范围。 |
| SVG、图标与字体 | Radix `1.3.2` 的 MIT 及 Lucide 图标的 ISC 有固定来源记录。Inter 4.1、Noto、LXGW 1.522、Zhuque 0.212、Sarasa 1.0.41 随包登记 OFL，衍生 Noto UI／漫画字体保留来源并使用独立内部名称。 | 确认最终 HAP 随分发提供图标归属及许可。复核字体派生物和保留字体名。逐项确认产品图标及批准的设计导出资源可随发行分发。 [OFL 正文](https://openfontlicense.org/open-font-license-official-text/) |
| 账户、联网与密钥 | 产品 L0 入口继续读取已有 book source 和系统接口。自备 WebDAV 配置留在 `extended` 开发入口，凭据由现有系统安全存储管理。本轮外观、窗口及排版工作沿用系统能力和本机偏好。 | 复查发行版网络权限、能力门控及实际产物中可读配置。正式签名材料留在私有配置，发布材料仅保留非秘密的身份与产物摘要。 |

Phase 0 已将当前源码的 `oss-reuse-NOTICE.txt` 改为 `cssparser 0.36.0` 和 `selectors 0.36.1`，并更新配套来源链接。本轮按 `Reader-Core/Cargo.lock` 与 Core `manifest.json` 逐条复核全部 19 条复用声明，确认仅 `scraper` 一条仍为旧版，已更新为锁定的 `scraper 0.26.0` 并把上游链接从 `causal-agent/scraper` 校正为 `rust-scraper/scraper`，补上 2024–2025 版权行；公告中的 `Reader-Core-Native` 旧路径一并改为 `Reader-Core`。上表保留 Wave 3 的原始检查发现。最终发行仍需核对实际包内声明和 MPL 对应源码的获取方式。

依赖依据为 Core [Cargo.lock](../../../Reader-Core/Cargo.lock)、[libmobi 集成说明](../../../Reader-Core/third_party/libmobi-0.12/READER_INTEGRATION.md) 与 [Core 许可清单](../../../Reader-Core/third_party/oss-reuse-licenses/manifest.json)。Host 的配对依据为 [OHPM 锁](../../entry/oh-package-lock.json5)、[HAP 必带资源](../../scripts/lib/hap-required-resources.json)、[图标来源](../MANGA_SHEET_ICON_LICENSE.md) 与 [字体来源](../../entry/src/main/resources/rawfile/FONT-SOURCES.txt)。

Wave 2 签名 HAP 中登记的 32 项字体和许可资源已按 manifest 逐项复核。书架、Radix 漫画和 Lucide 下载图标的点名来源检查通过。全目录检查曾发现四个在 Wave 2 基线已跟踪但缺少登记的 SVG：阅读控制栏小箭头（`reader_control_header_chevron` 日/夜）与设置导航图标（`settings_gen_navigation` 日/夜）。本轮核对确认这四个 SVG 已在 `docs/ui-design/SVG_PROVENANCE.json` 完成登记（`originType` 为 `reader-theme-svg`/`theme-palette-derived`，`license` 标注为 `Reader project design`，`sourceFile` 指向 `Reader-UI/theme/icons/`，并带 `sourceSha256`、`sourceCommit`），源文件与包内媒体 SHA-256 实测一致，属项目自绘原创，无需再补登记。

## 发行前待决定

- 确定渠道、相容的正式签名与 Profile，验证同包名已有调试或发行安装的保数据升级准入。当前候选仅使用 `minliny_HarmonyOS` 调试身份。
- 明确接收者能取得的 LGPL 对应源码和重链材料及 MPL 覆盖源码。确认分发渠道允许附带这些材料和必要的安装说明。
- 授权后用同一终验计划执行 W0–W3 的保数据覆盖、旧库冷启动、书架与阅读位置、分享、听书、漫画、WebDAV 和系统外观/握姿/无障碍验证。WebDAV 入口使用 `extended` 开发候选。
- 由用户决定是否把 HarmonyOS 产品版本从 `0.2.0` 提升至 `0.3.0`，兼容代际、安装计数器和其他平台版本分开判定。

## 本轮准发布收口记录（tech-debt-20261127 / Track A）

已完成且已在源码内核对：

- `oss-reuse-NOTICE.txt`：19 条复用声明逐条对照 `Reader-Core/Cargo.lock` 与 `Reader-Core/third_party/oss-reuse-licenses/manifest.json`。修正 `scraper 0.19.1`→`0.26.0`、上游链 `causal-agent/scraper`→`rust-scraper/scraper`，补 2024–2025 版权行；`Reader-Core-Native` 旧路径改为 `Reader-Core`。`sha2` 在锁文件中另有 `0.11.1`（`automerge` 传递依赖，非本切片），本公告保留 FFI 切片使用的 `0.10.9`。
- `libmobi-NOTICE.txt`：校正旧仓名为 `Reader-Core`，补齐 LGPL-3.0 第 4 节对应源码与重链说明模板，公开 URL 使用 `<TO_BE_FILLED_AT_RELEASE>` 占位并在文内说明填写要求。
- `manga-codec-headers-NOTICE.txt`：同步校正旧仓名。
- 四个此前缺登记的 SVG 经复核已登记且 SHA-256 一致（见上）。

仍需人工完成：

- 用真实、稳定的公开 URL 替换两处公告中的 `<TO_BE_FILLED_AT_RELEASE>`，并确认分发渠道可附带对应源码与重链材料。
- 正式签名、Profile 与实机终验，保留为待决定，本轮未执行、未标记完成。
- 释出前复核：Core `manifest.json` 中 `html5ever 0.39.0`、`cssparser-macros 0.6.1`、`dtoa-short 0.3.5`、`ego-tree 0.11.0`、`mutate_once 0.1.2` 等未在 `oss-reuse-NOTICE.txt` 单独列举；其中 MIT/Apache/ISC 正文已在同文件出现，但逐包归属需在最终产物上确认（`kamadak-exif`、`zune-jpeg` 已分别由 `manga-exif-NOTICE.txt`、`manga-codec-headers-NOTICE.txt` 覆盖）。
