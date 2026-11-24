# HarmonyOS 准发布核验清单

适用范围为 Wave 3 的 `io.reader.minliny`、`0.2.0`、arm64 本地调试候选。核验基线采用已发布的 Wave 2 Core `c5ba89fc`，其中 Native 生产提交为 `40177a0d`。兼容和目标 SDK 均为 `6.1.0(23)`。构建、验签、设备验收和公众发行分别判定。

## 依赖、源码与包内声明

| 对象 | 本地核验 | 公开发行前 |
| --- | --- | --- |
| libmobi `0.12` | Core 固定上游 tag 和归档摘要。适配器通过 `cc` 静态编入，Harmony NAPI 链接该 Core。HAP 资源清单包含 libmobi 公告、LGPL-3.0 和 GPL-3.0 文本。 | 按 LGPL 第 4 节准备对应源码及允许更换、重链的应用材料，确定相应安装信息、公告入口和实际获取路径。用同一发行材料演练更换 libmobi、重链和安装。包内公告中的旧仓名也需校正。 [libmobi 上游许可](https://github.com/bfabiszewski/libmobi/blob/v0.12/COPYING) |
| `cssparser 0.36.0`、`selectors 0.36.1` | 均为 MPL-2.0。Cargo 锁和 Core 许可清单分别绑定现行版本及许可文件。Harmony 包内 `oss-reuse-NOTICE.txt` 仍列 `cssparser 0.31.2` 与 `selectors 0.25.0`，对应下载链接也为旧版本。 | 更新包内声明为实际锁定版本。向接收者提供这些 MPL 覆盖文件的对应源代码及取得方式，带上实际修改和原有声明。Core 私有仓的访问权限不足以覆盖公众发行。 [MPL-2.0 第 3 节](https://www.mozilla.org/en-US/MPL/2.0/#responsibilities) |
| RustCrypto、解析与压缩 | arm64 FFI 锁定图确认 `aes 0.8.4`、`aes-gcm 0.10.3`、`pbkdf2 0.12.2`、`scraper 0.26.0`、`html5ever 0.39.0`、`quick-xml 0.41.0`、`zip 2.4.2`、`flate2 1.1.9`、`png 0.18.1`、`zune-jpeg 0.5.15`、`kamadak-exif 0.6.1`。Core 源码保留现行依赖清单和许可。Harmony OHPM 锁只解析本地 `@reader/core-harmony 0.1.0`，未解析 Reader Kit 或 Readium。 | 按最终 Native 和 feature 图回填完整发行归属，标明择一许可的选项，逐个确认交付物与当前 notice 一致。Core 局部许可清单和 Host 现有公告各保留其现有范围。 |
| SVG、图标与字体 | Radix `1.3.2` 的 MIT 及 Lucide 图标的 ISC 有固定来源记录。Inter 4.1、Noto、LXGW 1.522、Zhuque 0.212、Sarasa 1.0.41 随包登记 OFL，衍生 Noto UI／漫画字体保留来源并使用独立内部名称。 | 确认最终 HAP 随分发提供图标归属及许可。复核字体派生物和保留字体名。逐项确认产品图标及批准的设计导出资源可随发行分发。 [OFL 正文](https://openfontlicense.org/open-font-license-official-text/) |
| 账户、联网与密钥 | 产品 L0 入口继续读取已有 book source 和系统接口。自备 WebDAV 配置留在 `extended` 开发入口，凭据由现有系统安全存储管理。本轮外观、窗口及排版工作沿用系统能力和本机偏好。 | 复查发行版网络权限、能力门控及实际产物中可读配置。正式签名材料留在私有配置，发布材料仅保留非秘密的身份与产物摘要。 |

依赖依据为 Core [Cargo.lock](../../../Reader-Core/Cargo.lock)、[libmobi 集成说明](../../../Reader-Core/third_party/libmobi-0.12/READER_INTEGRATION.md) 与 [Core 许可清单](../../../Reader-Core/third_party/oss-reuse-licenses/manifest.json)。Host 的配对依据为 [OHPM 锁](../../entry/oh-package-lock.json5)、[HAP 必带资源](../../scripts/lib/hap-required-resources.json)、[图标来源](../MANGA_SHEET_ICON_LICENSE.md) 与 [字体来源](../../entry/src/main/resources/rawfile/FONT-SOURCES.txt)。

Wave 2 签名 HAP 中登记的 32 项字体和许可资源已按 manifest 逐项复核。书架、Radix 漫画和 Lucide 下载图标的点名来源检查通过。全目录检查发现四个在 Wave 2 基线已跟踪的 SVG 缺少登记，分别为阅读控制栏小箭头和设置导航图标的日夜版本。公开发行前补核原始出处及分发权。

## 发行前待决定

- 确定渠道、相容的正式签名与 Profile，验证同包名已有调试或发行安装的保数据升级准入。当前候选仅使用 `minliny_HarmonyOS` 调试身份。
- 明确接收者能取得的 LGPL 对应源码和重链材料及 MPL 覆盖源码。确认分发渠道允许附带这些材料和必要的安装说明。
- 授权后用同一终验计划执行 W0–W3 的保数据覆盖、旧库冷启动、书架与阅读位置、分享、听书、漫画、WebDAV 和系统外观/握姿/无障碍验证。WebDAV 入口使用 `extended` 开发候选。
- 由用户决定是否把 HarmonyOS 产品版本从 `0.2.0` 提升至 `0.3.0`，兼容代际、安装计数器和其他平台版本分开判定。
