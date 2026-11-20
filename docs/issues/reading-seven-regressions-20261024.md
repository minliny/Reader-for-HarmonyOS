# 阅读与书架七项真机反馈

用户在已安装run `20261023T180007Z-6b1bd753-576a397b` 后反馈：隐藏状态栏信息上移、打开书后半动画卡顿、松鹤阅读《还不起学贷的我只好兼职猎魔》本地读写提示、封面/正文交接闪烁希望改封面翻开、底栏背景半透明；随后新增点击开发者模式闪退及书架标签文本与轮廓不居中。

当前Host main 6b1bd753 + dirty，保留其他任务WIP；本次不清理用户数据。顶部/底栏/标签、开书动效、特定书源分别写独立问题记录。

开发者模式：已审SettingsPage.openDeveloperPage、两级返回桥、developerPage→ReaderStandardPage→CategorySection/Row的Builder链和ReaderMessagePreviewPage生命周期。已有方法探针未执行ArkUI Builder，因此不能排除运行时绑定；尚无精确崩溃栈。正在用安装SDK的实际Builder lowering定位绑定。

最小真机取证前提：代码已找出开发者页嵌套Builder风险但无法仅凭源码证明实际崩溃点；特定书源PC公开只读查询成功（343章及首章正文），错误消息合并多个内部类别，无法区分手机现场。读取当前已存在、仅限Reader的错误/崩溃日志，回答具体异常栈与reader-failure kind/guard/command/category；不重新点开页面、不改变书源、不重写阅读进度、不采集完整设备业务数据。HDC仍只通过共享租约，不重新连接或重启。结果单独记录，不将PC源请求或本地探针当真机交互通过。

## 本轮必要检查与构建收口

- 状态与标签：status-sdk-track、floating-tab、shelf-capsules，实际几何/安装SDK属性，仅对应原生渲染端口替身，无嵌套套件或设备；保护显隐同几何、不透明日夜表面、中文居中外框与点击身份。
- 书签geometry及novel-status-controls，仅实际LRE/Stage/Chrome几何及窗口策略；旧“状态栏与信息互斥”断言与用户新要求冲突，已改为两态几何完全相同，保留遮挡/固定提示/系统纸层及旧owner断言。
- 开发者mounted-developer-page，实际SDK lowering执行header/content/trailing，旧内联header内存反例报class-as-function TypeError，修后Day/Night及身份准入PASS。早期cardSdk夹具缺ReaderTextStyle端口而失败，随后改为窄平台组件边界；不将其称为产品失败。
- 封面cover-geometry/native-opening/close-handoff/lifecycle/index-handoff/index-cancellation/index-projection，仅实际actor/Index方法与受控原生动画/帧边界。只在合拢后卸载，旧回调/新实体失效，重复ready不丢投影，视觉取消flush而新导航丢弃旧投影。
- 松鹤Host仅cache-provenance/failure-taxonomy；Core仅两条真实SQLite lib case，红→绿和实际数据库错误反对照见独立记录。公开源请求不等同手机故障定位。
- 索引仅审读更新上述5个既有case定义，登记3个新默认OFF导航父项与10个准确case；不重新封存其他历史case/公共helper。未执行全量或隐式门禁。
- Native是本次Core修复交付刚需，build-harmony-napi默认不附带host probe/SDK smoke；重建及sync-native PASS，SO SHA256 5c3ad5c2e8bbe16fd50ceed985332650e2b3a804449a43ba1d2cbd459be5e1a1。
- HAP采用唯一pipeline iteration/contracts none，执行本次源码/Native/签名/包字节的实际必需校验；测试通过不计设备视觉或用户验收。
- 最小既有设备日志读取未得到Reader异常栈；初次hilog选项用法不合法已纠正；faultlogger目录Permission denied。没有改权限或清日志，没有重新点开业务页取证。手机直接缓存原因和真机交互保持OPEN。

## 追加搜索反馈

用户随后新增第8/9项：搜索栏输入文本不能跟踪最新输入；同一本书当前只有3个书源，旧版本至少7个。与前七项合并处理，不将之前构建计为覆盖新增修复。

前七项中间run `20261023T184540Z-6b1bd753-ef818380` 构建/Native/签名/包字节PASS，HAP SHA256 `e5cf15247dd62a333e88e3d03433b8351e0feac1dac4e38b29e67c361b0d4e2d`，未安装。其规范保留过程回收180007旧HAP，manifest及安装/启动历史继续保留，旧HAP不再称为可分发包。当前最多10次构建，没有为新增项提高上限。

### 搜索追加项收口

用户已明确第8项为长文本不横向滚动、看不到末尾和光标。只给bookPage/bookPanel绑定保留的原生TextInputController，下一帧按原生caret index执行scrollToVisible空范围，不改变光标/选区/预上屏文本；失焦、卸载与旧代回调失效。具体OEM自动滚动失效机理仍属设备边界。

第9项按上下文搜索卡片“已发现x个书源”处理（位置澄清尚未回复）。生产新旧投影反例证实7个已发现源+4个当前目录失败事实，会被当前展示过滤缩成3；修复保留全部已接纳sourceId和失败事实，选择健康代表。未取消重复同源去重、超时或健康准入，未为凑数放开失败请求。真实手机该书到底发现多少来源仍OPEN。

新增必要正式检查仅test-search-view-state#candidate-version：原生产groupResults/投影/候选策略，覆盖发现7、4失败、去重、健康代表、旧/失效事实及稳定顺序。独立Git旧投影before/after probe只作手工证据，无正式case嵌套。agent在收到停止扩展消息前已执行既有source-health-admission/source-cooldown-retry/source-health并PASS，如实保留结果，不重复运行；它们未成为构建默认条件。

### 用户纠正第9项观察位置

用户明确回复：少候选发生在“阅读页换源窗口重新查找后只有3个候选”。普通搜索卡片的两处真实计数缺陷已修复并有独立红→绿证据，但不能当作此第9项已定位或解决。继续查SourceSwitchGateway/Discovery/Host/Window链；暂不将搜索卡片数量对照提升为换源窗口结论。

### 换源窗口继续定位与最小验证范围

已审SourceSwitchWindow展示及DataSource/Host discover→refreshProjection/Gateway refresh final。UI不截成3；当前Gateway逐源book.search走运行时默认30s、并发8，不使用普通SearchOrchestrator的15s/4并发/健康冷却，不能混用两条链结论。

Host的knownCandidates仅由旧context提供；从书架进该context为空。本次live discovery可输出尚未持久化的候选（Gateway已有unpersisted seed校验），随后acquisition delta的cache投影却未带这些候选，存在7→3整体替换缺口。拟只在当前journey闭包把已准入可见候选并入seeds，仍交原Gateway执行relation/启用/版本/身份/删除核验，不修改openJourney事务恢复。

本轮只新增test-source-switch-gateway#host-live-retention：真实Host+Gateway，受控Core存储/注册事实，复现书架known=[]、3durable+4live，force refresh后delta缓存回读不能丢新候选；真持久关系删除、书源停用、旧journey、不同实体必须保持原失效规则。无HDC、网络、全量或额外业务检查。这一反例成功也只证明代码缺陷，不证明该手机七个候选的实际名单或当前网络结果。

### 九项修复最终源码收口

换源窗口新增准确入口实际为 `test-source-switch-gateway#host-live-retention`（名称在上段已纠正）。真实Host+Gateway红测7→3，修后PASS；plain/@作者证明、当前绑定、持久化后真实删除、停用与规则变更、新旧journey与旧回调隔离同case PASS。修复仅discover的当前scope seed合并，前轮openJourney弹窗修复保留；Core未再变更。手机该次候选名单和真实持久状态仍OPEN。

封面交接再补真实Index迟到ready反例：pending close期间拒绝readingReadyCallback/presentPreparedReading，防止退出中旧ready恢复保护或写投影。仅index-handoff/index-projection新增后复验PASS，其余五个case未改动；最新测试SHA269445298906fa209990b30c525dae583eca123ddbe8b739c23e5f7095f419d7。

最终构建前仅做diff空白检查、上述准确新增定义的只读解析；不重复通过的业务测试，不将构建附加全量或隐式门禁。最终HAP需覆盖第8/9项及迟到ready保护，中间包不安装。

### 最终签名包

Run `20261023T191204Z-6b1bd753-5eb631f3`，iteration / contracts none。Host `6b1bd7534b61a8ebfac10150fd308eae8430606e` dirty，Core `9131ddcfeef1922620c6867f88fe82608e51a079` dirty；当前主工作区所有构建输入/WIP统一进入本包，未清理或覆盖其他分支。2035个source-snapshot文件逐一与当前源码核对，无差异；SourceSwitchHost包含本轮discover修复，openJourney弹窗修复保留。

签名HAP SHA256 `cf4db2ccb3a2eae0bc63139b1f30d2a779f3b8f223f7438eba7228c1e2d16fe3`；minliny_HarmonyOS证书SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`、debug Profile、包字节与Native身份PASS。构建有现存ArkTS兼容性/弃用警告，未当作视觉验收。

规范保留策略保持最多10次，回收未安装的184540中间HAP，保留其manifest/历史。唯一前台HDC共享服务继续复用，无重启或重连；wrapper discovery确认真机Connected，pipeline inspect只读检查就绪/签名/保数据路线PASS。随后仅对确认的physical目标执行规范install，安装与启动结果待该操作完成记账。

### 最终真机交付结果

`deploy-physical-2141c5a269b2-20261023T191510Z.json`：install PASS、launch PASS、dataPolicy preserve，安装后签名身份符合保数据路线。没有卸载、清空数据、重试安装、HDC重启或重新连接；本轮唯一安装为最终191204包。physical target仅使用规范targetRef记录。

本地定向回归、Native/HAP/签名与真实安装启动已闭合；设备帧率/像素、长文本可见区、九项功能交互以及用户验收保持OPEN。松鹤手机原缓存的唯一实际故障原因，以及该次换源七条候选的持久状态/名单未捕获，不能将本地反例或PC公开源成功称为手机全部已验证。
