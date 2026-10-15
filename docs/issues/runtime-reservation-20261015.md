# 真机阅读命令被隔离：2026-10-15

## 现场与边界

用户在已导入的《仙子请听我解释》跳章，未使用朗读。当前页为原生“跳转失败”，正文同时失败：`Reader-Core command was not admitted: runtime result reservation contract failed; drain and recreate`。948章目录，当前标题“九十三章 鬼雾”实际 Core index=95。

已保存当前页截图、native hierarchy、已安装包元数据及系统持久日志。目标仅记录脱敏引用 `b1f20b88963d`。21:15:57 阅读窗口入场，21:16:01 起位置查询与目录查询持续被拒绝。启动日志显示 Core commit `41e62155`、dirty=true；buildId 仅绑定 Git/协议等元数据，不能单独证明未提交源码字节。日志没有记录首个超出预留的终端方法。

Core 的唯一隔离入口为 `Capacity::begin_delivery`：终端实际 JSON+64 大于请求预留，explicit ACK 模式将 runtime 标为 contract_fault；随后非控制命令全部拒绝。Host 的重试仍使用相同 runtime，故位置核实、目录和时长记录随之失败。ACK本身不能重置隔离。保留该守卫及现有预算，禁止重放不知道是否已提交的写操作。

## 已验证修复

- 兼容 `local_book.import`：短 filePath 输入可返回完整大目录。先构造并预留结果，再发布书籍/正文；预算不足时存储不变。合成948章原159052B会隔离，修复后正常。生产现代导入不是该兼容入口，不将其当作本次已确认根因。
- 已存本地目录解析错误：Serde错误可能回显整份缓存，形成大错误终端。改为固定分类、行列诊断，保留书籍错误及数据。合成错误由96261B降为240B，后续请求正常。现场缓存损坏未获证明。
- TTS 绕开 remote 通用预留：纯读结果按实际编码预留，队列写在状态变化前预留snapshot上界，不复制正文plan。用户语料某章原89256B正常成功终端会隔离，修复后同大小正常。用户确认未朗读，因此这同样不是本次现场已确认根因。

后续只读复查还复现了通用纯读错误未预留的缺口：将临时测试库派生 header 的 `positionScope.chapterIndex` 替换为80000字节错误类型后，直接 `reading.document.window` 返回80169B错误并隔离，ACK后仍拒绝后续读取。普通 `reading.entry.snapshot` 对同一坏派生header会重建并正常返回，因此不能据此认定现场跳章根因。修复范围限定纯读错误的实际容量预留；写命令可能已有副作用的错误不替换为Busy。

真实用户TXT经现代导入、SQLite冷开、完整目录/指标/缓存状态、精确第95章及邻章、窗口/完整正文、存储锚点、邻页预热和读取保存位置，均未触发隔离。不能以这些通过结果冒充真机复现闭环。

## 有限诊断与后续验证

SDK只保留最近16个终态的 requestId、固定白名单方法或unknown、result/error和原始UTF-16长度；在abandoned过滤前记录。方法索引最多256项，终态与close释放，不保留参数、正文、结果对象或wire原文。Host仅在精确隔离错误时输出一次副本，原错误原样抛出，不自动重建或重放。

本地新回归验证真实Runtime显式ACK、预算拒绝前状态不变、队列控制/回调去重、元数据边界和原SDK生命周期。后续HAP、保数据安装、同书打开/翻页/目录跳转与用户验收分别记账；未取得新包现场证据前，最初触发方法保持OPEN。

用户补充目录点选、章节滑条与跨章翻页都会失败。首轮完整HAP门禁在 `test-architecture-shared-producers.mjs` 超过110秒时限，已记录失败并停止该轮，未发布或安装HAP。必须重新通过全部门禁，不复用首轮PASS或放宽时限。

第二轮随执行中断，完成106项后停止，未发布HAP。第三轮完整执行692项，691项通过，唯一失败为 `test-manga-offline-network-probe.mjs` 的类型检查替身缺少新增的 `reservationQuarantineDiagnosticLogged` 字段。仅为替身增加与生产一致的false初值，保留原断言、范围及时限；修正后重新执行完整流水线。

实施在 `.reader-isolated/runtime-reservation-repair-20261015`，Host基线 `c982cf24`、Core基线 `41e62155`，排除主目录同期进行中的工具链/阅读WIP。原始现场证据保存在主Host忽略目录 `.reader-local/device-current-error-20261015/`，最终产物与回执另附不可变manifest。

## 首次候选安装与后续时长提醒

第四轮692项合同、ArkTS、非增量构建、签名及清单复验全部通过，发布 `20261015T150558Z-6c09fdf8-e18af564`。Host `6c09fdf8` / Core `c9497388` 均clean；签名HAP SHA256 `643af85187913a4a6f4a8166142b0a1047bb2077026addf07f72cc8b9d2da9d7`。同一真机于2026-10-15 23:29完成同身份覆盖更新和启动，正式部署回执确认preserve，未卸载或清数据。

23:30用户在《魂断大明》退出时报告原生“阅读时长尚未确认”弹窗。截图与布局保存在候选 `.reader-local/runtime-reservation/physical/reappeared-error.*`，属于同一已安装包；不等同原始“跳转失败”隔离首因。读取日志时设备连接中断，PID/tag读取结果为空，不能当作没有错误的证据。原三条跳章物理验收及底层时长异常仍OPEN。

按用户随后要求，禁用阅读器8处及Index1处纯错误/后台恢复的模态Alert，改短时非交互提示，保留真正的数据选择。时长从页面级等待改为复用既有Runtime outbox-v2、兼容v1回执恢复，避免退出丢弃组件未受理增量。复用来源及局部适配记录在忽略目录 `.reader-local/record-outbox-reuse/`；未覆盖或提交主目录并行WIP。加入有限阶段诊断、UTF8及1MiB边界、同对象防重、关停后继任转交。详细消息通道审计及源码/设备边界见 `reading-background-feedback-20261015.md`。后续新包需重新完整门禁与物理验证，不能沿用第四轮的设备结论。
