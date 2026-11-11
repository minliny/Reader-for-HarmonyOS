# 框架收尾实施结果

2026-11-11。范围是阅读职责减法、Stage取舍、平台警告与页面宿主合同，不重开视觉设计或改写分页/手势算法。

| 批次 | 实际结果 | 证据边界 |
| --- | --- | --- |
| P0 | 生产/参考职责及19项行为矩阵已记录 | 后续采用参考分支 |
| P1 | 测量事实/Native转换、呈现与retained、准备队列和minimum seam抽取；LRE15131→14746、Panel2561→2479 | 6个必要case通过，其中2个经独立重审及索引通过；实际ArkTS构建通过 |
| P2 | 生产保留Panel→ReaderControlRuntime，旧Stage页归档并关闭cold-start/registration | 3个准确索引case及5个真实负对照通过 |
| P3 | 20missing和32deprecated清零；TTS降级/精确释放、诊断失败边界修复 | 成功编译374→322 warnings；313throws按边界登记，7capability和2native提示保留 |
| P4 | 宿主/geometry owner/测量代次/预算合同与旧代回调修复 | 10directScaffold、14Standard调用/13文件、13resolver消费者；16layout文件逐项保留理由；方法/清单/navigation索引通过 |
| P5 | 新停态数据两章均missing、无version/candidate，与当前0/2一致；旧scope的Host6个登记文件完整；负缓存恢复、R1/R2竞态及无压力capacity回收已修 | 克隆Linuxdebug三方法观察，目标事实pre/post不变；恢复性17组与capacity17组分别有回执，capacity另有2组SDK通过；历史撤销者/时间未建立 |
| P6 | 正式发布/整体验收未触发；本轮最终构建待绑定本地交付记录 | 尚无包含最后capacity修复的最终候选绑定/安装证据；完整产品回归、物理机和用户验收未执行 |

新停态数据在独立Linuxdebug Runtime打开前，目标书的head/retention/receipt已均为0，3个manifest与3个evicted身份集合相同；本次bootstrap及三方法观察前后的目标事实未变，不能据此声明全库字节未变，也不等同安装中release或当前进程的直接查询。这些事实与当前0/2一致；既有Host文件不能替代Core有效版本准入。历史0/2的原因、撤销者与撤销时间仍未建立。漫画冷续读因无有效candidate保持NOT_RUN，不以标题入口、清理或重新下载绕过。旧38/new47不具公平内容差分条件，本轮未虚构两包对照PASS，也未改Core计数/迁移。

原VM第一次已授权复制因shell大文件超时失败，已恢复书架；经新一次明确授权，专用file recv -b及同SHA主库复用取得精确新pair。原pair复制前后哈希不变，UNKNOWN只stat/hash且前后相同，代理未读其内容、未对原库SQL。两个范围都已结束，应用恢复书架且租约释放。后续只在私有派生副本进行SQL/FFI，captured不变；方法/包/设备/用户验收分层。

独立复核发现并修正迟到R1负结果删除R2完整索引的竞态；旧代码实际失败，新代码及撤回排序mutant验证通过。另定位普通startup的`maintainAutomaticStorage → capacity`无压力回收：没有写入专用`enough`时，旧实现会继续claim可用缓存。当前只为该分支补公共总预算与物理余量判断：`ordinaryBytes + ordinaryReservedBytes <= cacheBudgetBytes`且`freeBytes >= systemReserveBytes + allReservedBytes`时停止新回收。写入专用分区/新增bytes/headroom回调优先，pending grant恢复、Core候选/LRU顺序、expiry/clear和保护栅栏保持原owner。

capacity源码`ReadingImageDiskCache.ts`固定SHA256为`552915bbf2b141f9b582b37ae3e6bb87fddd52345e4e05ee2edb10282418929f`；[本机结果](../../../.local/framework-closure-implementation-20261111/p5-capacity-eviction-result.json)记录旧生产失败、17组当前行为及2组SDK通过，SDK工具解析失败也保留。SDK解析/发射与前端parse-only不替代最后规范HAP语义编译。该修复证明当前可达的预算合同缺口，不证明它创建了既有3个evicted记录或造成历史0/2，也没有恢复这些既有撤销数据。

此前成功候选均保留历史；最后R1/R2与capacity源码是否进入新包，须由新的规范构建回执证明。最终构建待绑定本地交付记录，届时由本机`.local/framework-closure-implementation-20261111/candidate.json`与对应不可变HAPmanifest登记，本文不预填旧候选为最终。

所有编译、fixture、准入与取证失败均保留。21份旧fixture仅做有限真实模块装配适配；除本次独立重审的两条P1叶子外，旧定义不自动续期，未执行case不记PASS，同文件4个未审sibling显式关闭准入。构建、签名不自动挂全量。

细节见 [分批方案](framework-closure-batches-20261111.json)、[阅读决定](reading-renderer-decision-20261111.md)、[平台警告](platform-warning-triage-20261111.json)、[宿主合同](page-geometry-host-contracts-20261111.md)。
