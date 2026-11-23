# 应用版本与构建身份

本合同落实用户于 2026-11-10 确认的版本规则。适用唯一 HAP 流水线及 DevEco 原生 Build/Run；不改变 Core buildId、协议版本、SQLite 格式或逻辑快照版本。

## 字段与唯一来源

| 字段 | 规则 |
| --- | --- |
| versionName | 三段纯数字产品版本，当前 0.2.0；不增加第四段构建计数，不写 DEV/RC/摘要。 |
| versionCode | 系统升级排序，来自 config/app-release-ledger.json；当前基线 1000000。构建不自增、不使用时间或随机数。 |
| appContentHash | reader-app-build-v1 输入域的完整 SHA-256。 |
| contentId | appContentHash 前 12 位，仅供展示；完整值保留在包内和 manifest。 |
| appBuildId | 产品版本.渠道.contentId，例如 0.2.0.DEV.a1b2c3d4e5f6。 |
| HAP SHA-256 | 最终包的文件核对摘要，不反写包内版本。 |
| certificateSha256 | 签名证书身份，沿用项目指定证书，独立于应用内容摘要。 |

发布台账是版本分配唯一来源；AppScope 中的静态值是未注入时的安全基线，不能覆盖台账。DEV 使用台账当前 versionCode；新 RC/REL 必须先登记完整内容摘要、appBuildId、versionName、渠道和单调递增的 versionCode。相同分发记录重复打包/安装沿用分配；相同内容不同分发记录可以使用不同 code。台账按分配顺序排列，重复 ID、短摘要碰撞、超界和回退拒绝。构建读取 HEAD 中的已提交台账，要求历史分配不可改写、新分配递增；首次接入以 HEAD 的原 AppScope 版本代码作为防回退基线。该历史只用于校验，不参与内容摘要。调整产品版本和台账由明确的发布决定触发，不由 agent 每次构建决定。

渠道选择顺序为命令参数 --channel、READER_APP_CHANNEL、台账显式声明的 developmentChannel=DEV；不推测分支、主机或目录。RC/REL 必须 clean、signed、class=acceptance，且有台账分配。该分类不代表业务测试、设备交互或用户验收通过。

## 内容输入

新域独立于既有 contentSnapshot/Core provenance，旧算法不变。固定 UTF-8 字典序、POSIX 相对路径和规范 JSON 序列化；不包含绝对路径、mtime、普通文件 mode、Git commit、dirty 标志或构建次数。

输入覆盖 AppScope 资源、entry 源码/资源/CMake、本次 ABI 的 Native 字节、vendored Core SDK、实际依赖/构建配置和参与身份/打包的控制代码。结构化 buildIdentityInputs 包含选定 ABI、product、buildMode、SDK 组件版本、Hvigor/plugin、Node、Java 和 Native 编译器版本。功能开关及改变代码的配置继续作为内容输入。

仅剔除受控版本字段、生成的 reader.appBuildIdentity、台账分配及签名配置；其他业务 metadata 保留。仅所选 ABI 参与，其余 ABI 的存在与变化不改变本次内容标识。符号链接和特殊节点拒绝。

已解析的构建 JSON5 按有效配置规范化为 LF；源码、资源和二进制按原始字节计算，不把任意文本换行视为无影响。仓库 .gitattributes 对新检出的构建源码固定 LF；已冻结的 vendored SDK Index.ts 和 sdk/smoke_report.ts 以精确 -text 例外保留原字节，避免提交后检出改变既有候选身份。来自不同主机的实际 Native 或资源字节不同，就应有不同摘要；本合同不宣称跨主机 Native 构建字节可复现。

## 注入与核对

顺序固定为读取当前有效输入 → appContentHash/contentId → 台账分配 → expectedVersion → Hvigor 注入 → 编译签名 → 验包 → manifest。流水线只在临时副本写会话载体；IDE 直接使用公开 get/setAppJsonOpt、get/setModuleJsonOpt 内存接口，并同步设置内存中的 default product 版本，避免旧 product 覆盖台账，不改写工作树或生成源码/资源。两种入口共用生成器。编译期间输入、工具版本或台账变化会停止交付。

完整身份以 reader.appBuildIdentity 写入 entry 模块 metadata，关于 Reader 从实际安装包的 BundleInfo 读取，展示产品版本、渠道、短摘要、code 和完整摘要，支持复制完整值。缺失或矛盾时显示不可用/标识缺失，不伪造默认身份；反馈功能仍保持未开放。

新 schema-v2 manifest 增加 appIdentitySchema、expectedVersion、app-content-snapshot.json 和 app-release-ledger.json 的字节记录。verify 从快照重算完整摘要并按冻结台账核对，再与 signed/unsigned HAP 的系统版本及 metadata 比对。新 controller 缺身份字段即失败；历史 controller 没有这项合同的包继续按旧规则复验，并明确 LEGACY_NOT_PRESENT，不回填新身份或改写历史 issue。

保数据安装拒绝 versionCode 回退。安装后比较 bm dump 的 versionName/versionCode 及模块完整 metadata；不一致停止启动，绝不卸载或清数据。部署回执同时记录 expectedVersion、实际包身份、HAP SHA-256 和证书指纹。相同 appBuildId 不承诺签名后 HAP 的字节相同。

## 使用与证据

只读计算：`node scripts/hap-pipeline.mjs identity --channel DEV --abi x86_64`，输出 PLAN_ONLY。

开发打包：`node scripts/hap-pipeline.mjs build --class iteration --channel DEV --abi x86_64`。默认 contracts none，不附带业务全量。DevEco 直接 Build/Run 使用相同台账与身份，原 Native ABI 必须匹配当前模块配置。

新增检查位于 tools/test-app-build-identity.mjs；无参仅列 NOT_RUN，使用 --case 精确选择。构建成功、历史复验、安装比对、关于页实际交互及用户验收分别记账。旧 0.2.0 包未满足包内完整身份合同；其既有 Core 修复与数据保留证据不因此作废。
