# 同一本书搜索书源数量从至少七个变成三个

## 用户报告与范围

2026-10-24，用户报告《还不起学贷的我只好兼职猎魔》“当前版本只能搜到三个书源，旧版本起步就是七个书源”。主任务确认语境紧邻普通搜索输入框，优先审计搜索卡片的 sourceCount；换源窗口只独立核对，不能把两个入口混同。

当前 HarmonyOS main HEAD `6b1bd753`，有大量并行 dirty WIP；本轮不回退、不碰真实用户库，不通过 HDC 取数。前七项 HAP 由主任务负责，本子任务不构建/安装。本轮已有源码审计并非手机当前启用源/旧包身份或“确实曾存在七个独立源”的证明。

## 当前过滤与范围

- SearchGateway `source.list` 读取全部注册项并保留 enabled、原始 sourceId、sourceVersion、bookSource 类型及可选检查报告，不存在 3/7 上限或按已测套件名称的搜索白名单。
- SearchOrchestrator 默认搜索 enabled、名字非空、类别 novel/comic 的来源；显式 source scope 仅缩小本轮，不覆盖用户 enabled。音乐/下载/外部/书单评论类不冒充小说正文源。
- 普通搜索最多四个并发 worker，单源实际 Core 请求 15 秒；调度器排队不计入该源延迟，隐藏/导航的实际生命周期控制派发。不是总共只查四个，也没有三源候选上限。
- source.check 的完整 search 模式、当前规则、24 小时内 L1/L2 明确 fail 会被跳过；L3/L4/L5 失败本身不会令全源跳过。60 秒内上次单源 live 请求失败也可进入 cooldown。显式 retry 绕过这两类 skip，并保留成功来源。
- 同一 sourceId+bookId 去重；同一 bookId 在不同 sourceId 下保留。展示分组按规范同书关系/作者证据；sourceCount 为组内不同 sourceId 的数量，不等于请求数、结果行数或独立上游网站数量。
- SearchResultProjection 对 rank=3 的“当前确认详情/目录失败”变体，若同组还有其他候选会暂不纳入 variants/sourceIds，因此确实存在“底层已搜到七个身份、卡片只显示三个”的代码路径。该路径尚未绑定手机本次候选记录。
- 正文单章失败不属于全书候选确认失败；代理/DNS/普通 transport attempt 已由既有 BookAcquisitionPresentation 排除出 parser-failure rank。不能仅因 API 报过一次错误就永久惩罚所有同源书籍。
- 换源 discoverCandidates 单独查询 enabled text/comic 来源，再由同书 title/author 身份核验；仅复用 SearchGateway 的 decoder；实际直发 Core 命令走默认30秒，八并发，没有查询健康报告的普通搜索 skip。最终 dedup 仍是 sourceId+bookUrl，不按 providerFamily 折叠来源。

## 可核对的旧源码基线

- `a7ecc652`（2026-10-05，fix(search): retain healthy sources and late candidates across reading）明确引入：普通搜索健康跳过、15 秒单源期限，以及 SearchResultProjection 的已确认失败候选隐藏。其父版本没有这些行为。这是源码行为比较，不证明用户“旧版本”就是该父版本。
- 当前 SearchOrchestrator dirty diff 主要是异步共享投影入批与保留列表顺序，不新增源个数上限、enabled/type/health 条件。
- 内置资源当前与 HEAD 一致：1046 行，151 enabled 行，134 个 enabled 原始 bookSourceUrl，其中109个 type=0唯一URL；a7父版为1046行、158 enabled 行、137个 enabled URL，其中112个type=0唯一URL。
- 减少的七行集中在三种原始URL：66书吧/起点书吧/qd小说等五行共用 `https://66shuba.com`，有度两行使用 `https://www.yodu.org` 及带 `##破冰` 的版本。不能把七行误称七个新的独立来源，更不能据此推导这本书少了四个可用源。
- 当前和旧基线中的 QQ阅读01、松鹤阅读、QQ手机版、企鹅读书、企鹅阅读均仍 enabled；同一原始URL的 QQ手机版/QQ阅读是同一个持久来源身份，不应人为重复计数。

## 松鹤已知真实请求

此前本轮对精确书名的公开搜索 HTTP 200，返回作者“小夕岁”、docId `90000001_1159836844`；详情/343章目录/首章正文均返回成功摘要。源为 `https://bookshelf.html5.qq.com`，QQ阅读01是带尾斜杠的另一注册身份，但两份规则复用同一个 so.html5.qq.com 搜索端点。此证据只说明该公开源目前能检索此书，不能证明手机七源均已被本轮遍历。

## 定向验证计划

所有检查默认 OFF。本轮仅执行：

1. 独立 `tools/evidence/search-source-count-20261024/probe.mjs`：执行当前及固定 a7父版的真实 SearchResultProjection，输入七个受控同书来源，分别比对无失败、四个确认目录失败、四个仅正文失败、重复同源行/跨源同URL、陈旧失败事实。仅 Node TS loader 与 Git 只读历史，不发 Core/Host 请求、无用户数据写入或构建。必要性是把数量显示路径和真正未执行的源搜索区分开。
2. `node tools/test-search-orchestrator.mjs --case source-health-admission,source-cooldown-retry`：实际 Gateway/Orchestrator 的受控 Core/虚拟时钟端口，精确两 case；复核 skip 的当前表现和显式 retry 边界，不运行其他 worker/SDK/业务套件。
3. `node tools/test-search-gateway.mjs --case source-health`：实际报告解码与过期判断，精确一 case；核对健康过滤不因无报告或过期报告误排来源。

不默认运行全量、设备或真实全源网络扫查。若公开对比请求，则另记准确源/端点数及响应，不能当作已穷尽本机启用的所有来源。

### 已复现与实施方向

真实生产投影对照已取得：七个不同 sourceId 的同 query 同书候选，四个当前确认目录失败时，a7父版显示7，当前修复前显示3；无失败、仅正文失败、transport attempt、过期失败、规则版本变更及同身份重复的对照都显示7。`before.json` 保留旧/当前源 SHA 和逐项结果。这证明一个具体显示回归路径，不是手机本次四条失败事实的证明。

主任务明确普通搜索文案应为“已发现x个书源”，计全部已接纳不同sourceId，故仅修改 SearchResultProjection：保留全部来源及原失败事实，仍从非确认失败候选中挑代表，若全部失败才保留可重试的失败代表。稳定到达顺序、同身份去重、启用/类别、healthskip/cooldown/并发/超时均不更改。SearchPage 当前实际 `groupResults` 在 newGroup/admit 所有 variants 后执行 `group.book = row.book`，因此不要求把健康候选改排到variants第一个；后续显式选择的原身份不变。

新增必要定向项（与上列检查分开，不自动触发）：

- `node tools/test-search-view-state.mjs --case candidate-version`：原有真实 SearchPage.groupResults + SearchResultProjection 边界，追加七来源/四确认失败，核验最终组的count、全部variants、失败状态及实际点击代表仍健康，包括健康别名匹配得分弱于失败精确名的反对照。
- `node tools/evidence/search-list-stability-20261020/projection-probe.mjs`：现有独立生产投影探针，只涵盖本轮仍需保护的流式追加/元数据更新/代表变化/移除/重挂列表顺序；无 SDK、Core、网络、套件或设备嵌套。不能把此探针当原生触摸或像素验收。

### 健康作用域及本轮结果

既有 `source-cooldown-retry` 明确要求“新关键词搜索仍冷却、显式retry才绕过”，`source-health-admission` 要求未知源可执行、当前24h失败报告可跳过且显式重试恢复。按主任务要求，本轮未改变该产品语义。报告解码只检查 mode/ruleDigest/steps/checkedAt，未把一书的一章失败推广为整源；但全源检查报告不绑定当前关键词，不能把skip误写成“本书已实时搜索无结果”。页面原有 skippedSources/reason 仍保留。此前代码已公开这些事实，不把它们当成本次新发现的唯一手机根因。

| 精确项 | 结果与实际边界 |
| --- | --- |
| `probe.mjs before` | PASS记录修复前路径：固定旧投影7、修复前当前投影3；其余六个反对照均7。结果含准确源码SHA，历史投影依赖当前共享纯模块，因此不是完整旧App回放 |
| `probe.mjs after` | PASS：七个同query身份含四个确认失败全部保留，健康source-4仍为代表；失败事实未改写；重复同身份不增加计数，正文/transport/旧事实仍不惩罚整书 |
| `test-search-view-state.mjs --case candidate-version` | PASS：真实SearchPage.groupResults正确转交row.book；七个来源/四个失败保留，失败精确名不会压过健康同书别名，variants仍按到达顺序 |
| 既有独立 `search-list-stability-20261020/projection-probe.mjs` | PASS：流式新增、代表/元数据更新、重挂、移除、merge/split与缺失delta恢复、media/shelf边界；没有SDK/Core/设备/网络 |
| `test-search-orchestrator --case source-health-admission,source-cooldown-retry` | PASS：按原审计计划执行两条受控Core+虚拟时钟case，在主任务后续要求不要为未改路径追加检查之前已完成；不再重复或扩大 |
| `test-search-gateway --case source-health` | PASS：按原审计计划执行一条解码case，亦在上述范围收紧前完成；没有把未改路径检查加入构建 |

本轮没有追加公开全源扫描；复用已记录的松鹤精确真实请求结果，故不声称本机启用134个URL已遍历，也不能承诺此书现场现在一定恢复七个可用源。此次关闭的是“已发现候选被当前详情/目录失败状态静默移出搜索计数”的具体生产问题；仍保留真实状态/请求失败、不同导入配置和当前网络结果这些独立边界。没有Core修改、HDC、用户数据写入、Native或HAP构建。

## 第二条真实显示原因：可见卡片冻结了发现数

独立 review 发现 SearchResultCard.acceptDisplayFacts 为了避免可见行被补充简介/代表书籍导致重排，在 displayVisible 时保留 displayedFacts；displaySourceCount 同时读该旧snapshot，因此首批3源可见后即使group已增长7源，计数仍停在3，直到滚出再进入。该缺陷不需要四条失败事实即可成立，与上文失败variant隐藏是独立路径。

主任务指定仅让 displaySourceCount 读取当前group.sourceCount，不改变书名/简介/封面/点击身份冻结或行序。必要回归仅新增准确case `visible-source-count`（tools/test-search-view-state.mjs）：真实SDK ObservedObject/ObjectLink/Watch与生产Card Builder、生产DataSource，验证可见3→7直接更新Text，已显示book/intro/封面actor与固定几何约束保持，按下到松开的选择快照不因到源更新而改变；旧query可见回调、旧image error与旧Up帧继续受原guard阻止。只执行该case，不运行兄弟case、网络、Core、构建或HDC。先记录修复前失败，再改唯一生产getter并重跑。

### 可见计数修复与回归结果

- 唯一生产修改为 `SearchResultCard.displaySourceCount(): return this.group.sourceCount`。没有改 acceptDisplayFacts、displayBook、displayIntro、displayInBookshelf、封面回退、按下选择快照或visible/query/selection/image回调guard。
- 新增正式准确case `visible-source-count`。测试先用当前生产完整 Card Builder 与真实 SDK ObservedObject/ObjectLink/Watch 复现：group 已为7，实际同一个 Text actor 仍显示“已发现 3 个书源”；修getter后 PASS。
- 同一可见行重复发布7→6→7→6→7，实际原Text actor直接变化；没有手工调用 displaySourceCount 来冒充渲染更新。已显示book/intro/inBookshelf仍冻结，原封面URI、所有native actor、cover尺寸/Row宽与padding/Column高度约束都保持，未调用元数据行高更新回调，也未向Lazy数据源发结构替换。此为SDK执行和约束身份，不是手机native像素高度测量。
- 手指按下时三源身份快照保持，期间计数变7也不会把Up/Click重定向；旧query可见回调不能改新display，旧封面错误不能拒绝新封面，旧Up帧不能清理新按下。退出后旧可见回调亦不能恢复displayedFacts。
- 首次fixture把 native `onVisibleAreaChange` 的双参数记录误当函数，TypeError发生在业务断言前；改为取实际Builder的第二个参数回调后取得上述真实红测。修getter后第一次绿测PASS；补重复ObjectLink发布与inBookshelf冻结后仅再跑同一case，PASS。没有追加兄弟case/构建/设备检查。
- 新case依赖既有 reader-control-builder-probe、arkui-property-runtime-probe、tool-environment/SDK、生产SearchBookSnapshot/BookIntroText/BookAuthorMetadata/SearchViewState，以及实际SearchBookGroup/DataSource与Card成员。没有新增工具/测试夹具文件，也不嵌套运行本问题独立baseline probe。
