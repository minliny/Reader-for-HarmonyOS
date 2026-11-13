# 全应用 UI 对比修复

2026-11-13。依据 `ui-design-comparison-audit-20261113.md` 执行，开发基线 HarmonyOS `ad9e4710`、Reader-UI `09150862`。当前工作位于隔离工作区 `framework-confluence-20261112`，原工作树与应用数据保留。

## 目标与执行边界

本轮目标覆盖15个当前整改条目、1个保留代码条目，以及可在代码侧补齐的来源登记、局部宿主检查和跨书恢复引导。15个当前整改项与1个保留项的代码开发、独立审修及选中定向回归已完成。最终候选的实际ArkTS编译、打包、指定身份签名、保数据安装和最小原生证据评估已完成，goal按该范围收口。完整页批准及全页原生验收继续开放。

三个独立 agent 分别实施阅读、主流程、二级域，再交换阅读与主流程、二级与共享范围审修。Root 负责共享呈现、依据绑定、消息与控件登记和最终差异核对。全部代码开发及独立审修完成后再评估原生取证。

## 逐项实施

| 审计项 | 实施内容 | 定向证据 |
| --- | --- | --- |
| S-01 | 共享恢复动作18横距、6换行距、8文字间隔、下划线、纯标题折叠、长动作分排和测量失效保全文本 | recovery-notice-flow、recovery-action-state、secondary-recovery-assembly |
| RD-01 | 常态314/336内容宽为单排，四个44命中载体与32绘制分离，真实容量不足才两排，Full工具栏总52 | directory-toolbar-budget、reading-design-density |
| RD-02 | Full Header消除额外占高，44载体与标题/收起/标签内部绘制分离，字号自然增长 | reader-control-layout-budget、reading-design-density |
| RD-03 | TXT规则的directoryRulesForm是独立正文，恢复提示用同宿主覆盖滚动层 | directory-rules-targets、overlay-assembly local-content |
| RD-04 | TTS manager正文与未决覆盖分离，短窗左侧有界恢复表面避让右关闭列 | bounded-source-tts-composition tts-owner |
| RD-05 | 阅读恢复采用显式请求展示，既有更多菜单提供待处理事项，Back/正文/开控制收起当前投影 | ui-recovery-composition、secondary-recovery-assembly |
| RD-07 | 书签空/失败复用readingBookmark配方，16/9/23间距、92最小动作宽、10×17内距 | reader-bookmark-state-recipe |
| RD-08 | 保留既有五秒步长，读屏名称与实际增减一致 | reader-control-tts-make preset-controls |
| P-01 | 默认24/18/28/80组合与约111行高，纯信息不各占44，状态28绘制/44响应，单一书籍行入口与状态/More/选择动作各自准入 | shared-download-visual-contract |
| P-02 | 更新徽标明确封面内最大宽，单行省略，卡片读屏保留完整计数 | bookshelf-update-badge-budget |
| P-03 | 导入进行态自然文档测量、有界Scroll与原代次围栏，前后台变化可重绑测量 | bounded-local-import-composition |
| S-02 | App主题按实际行宽与字体预算选择横排/上下排，原168分段控件使用唯一宽度事实源 | secondary-design-budget、switch-enum-shared-contract |
| S-03 | 动态书源统计取消单行上限，原筛选计数口径保留 | secondary-design-budget source-stats |
| S-04 | 纯检测统计恢复内容宽与自然高度，四项可紧凑排列 | secondary-design-budget batch-summary |
| S-05 | 同宿主未决事项共享ReaderRecoveryGroup绘制，原owner/代次/busy独立，已确认结果使用原类别 | ui-recovery-composition、secondary-recovery-assembly |
| S-06 | RSS/Sync同事项主次动作放入原Notice，保留原consent与L0关闭 | rss-original-recovery-surface-sdk、secondary-design-budget sync-recovery |

## 设计来源与恢复引导

`tools/contracts/design-authority.json` 记录20个业务路由的来源处置、局部批准文件及SHA，并通过 `visual.facts.designContractRef` 关联现有4族21个登记。已批准局部规则按原范围使用。

GAP-01 当前书架/搜索/详情完整页，GAP-02 漫画更多/模式/设置和部分宽屏，GAP-03 部分二级表单完整状态的批准来源继续为 `OPEN_APPROVAL`。新增搜索/详情10月8日的局部后继授权引用。当前Figma的源码衍生内容有明确标记，完整页的批准与当前候选对比证据都需要独立解析。

GAP-04 的外书未决事实由原owner提供只读元数据及原书恢复路径。独立审修进一步发现合法V1 intent允许缺标题/作者，但恢复入口严格要求四字段相等，旧记录可能无法到达核对。当前补充原params可证明的create元数据恢复，以及无法归书的原记录独立核对入口。只读核对沿原context、operationId、sequence与fingerprint进入现有资格回执流程，原payload保留。开发4项准确回归及普通全局写准入消费者已通过，独立审修补充confirmed/notDispatched/unavailable显式资格分类，修复同tuple阶段演进被undefined误判。相关准确回归通过。测试仅使用私有合成记录。

## 本轮实现决定

目录的44触控载体需要支付实际不重叠横向空间。正常314/336宽仍单排，搜索宽与原32绘制按键稿不同。窄宽和大字号才增加行数。

阅读未决卡从自动持续覆盖改为显式从更多菜单展开。收起仅改变展示状态。原未决事实、全局写准入、原回执与继续权限仍属于各业务owner。此决定随本次全量修复实施，原生与用户接受另行核对。

TTS compact状态的恢复滚动位于面板左侧，右侧保留原关闭目标及间隔。普通状态沿原header/footer避让。该决定用于避免短窗覆盖高度为0并保留关闭入口，实际字体与焦点待原生核对。

徽标超长计数使用可见省略与完整可访问名称。消息多事项分隔采用最终批准稿日/夜23%分隔色，由Reader-UI canonical registry生成Harmony适配。

## 独立审修发现并修复的遗漏

- Root抽取根恢复Builder时引入语法损坏，独立审修完整重组并补真实根构造回归。
- TTS短窗仍扣已进入Scroll的header/footer，独立审修修正恢复高度与关闭列避让。
- More和标题命中区存在可复算的2vp交叠，已为独立控件支付44横槽。此前把onClick当作可手动阻断的基础冒泡并使用ClickEvent.stopPropagation的判断与实现有误，旧“阻冒泡PASS”撤回。当前按官方隐式Tap手势的默认子优先规则修正，List滚动沿原手势链。
- 导入前后台只增加private代次可能留下全部失效测量闭包，改为可观察代次并补旧/新回执回归。
- 多事项组曾把已确认结果也画成未决表面，独立审修恢复原分类。
- 主题行的旧Area回调可能跨分支、字号、窗口或重新展示回写，独立审修补真实重测、属性重绑和appearance身份。
- 来源检查初稿仅看状态字符串，独立审修要求当前候选完整输入及可解析的对比/原生证据引用。两份证据同时关联完整inputs和designInputs，局部正文的position与全屏Stack也保持内容流检查。

## 结果与产物

实际命令、初次失败、修正后新运行、复用范围和SHA保存在 `.reader-artifacts/ui-full-fix-20261113/`。各域 `*-plan.md` 逐条说明入口、嵌套、触发范围、具体风险和必要依据。未选门禁没有执行，现存旧结果保持原证据范围。

当前全页原生尺寸、字形、触摸、焦点、系统Back及用户接受继续开放。局部代码/SDK通过与整页visual结果分别记录。

## 代码侧最终核对

全部3个agent已完成开发与独立审修并停止生产写入。Root终核下载单Row入口/原生子Tap与导入测量修正、主题行appearance回调、RSS/Sync同代busy和当前canRetry、普通阅读恢复原owner围栏，以及旧记录显式回执分类。

修改范围40个ETS/TS生产输入经实际SDK AST解析，0语法诊断。选定修改文件的消息登记79/79组通过，register Schema单项通过，git diff --check通过。选择集包括普通、保留和共享消费者，声明范围保留各自处置。全树产品门禁本轮未选。

4族21个正式登记的设计引用已解析，visual继续NOT_RUN，3组整页批准来源继续OPEN_APPROVAL，GAP-04为CODE_VERIFIED_NATIVE_OPEN。登记主源和受影响依赖的SHA按已审事实更新，历史SDK/布局/Native产物保持其原输入与结果。Source E2/E3与其他原生缺口继续开放。

候选编译采用唯一hap-pipeline，iteration、x86_64、local signing、contracts none。直接保护真实ArkTS类型/普通入口/打包与指定签名身份，不触发Core/Host全量业务检查。Core源码与Native配套沿本轮当前c0781263输入核验。签名配置和口令材料只在私有路径。

## 编译阶段发现与修正

首次输入预检因漏传既有CARGO_TARGET_DIR而停止，未编译Core或Host。后续明确绑定本机既有 /Users/minliny/Documents/Reader/Reader-Core/target，Native/Core配套预检通过并进入实际ArkTS编译。该编译发现4处本批新增ClickEvent.stopPropagation调用不受当前SDK支持，四处非法调用已移除，标题为普通Flex/Text，唯一书籍Row持原焦点ID，More/状态/Checkbox沿默认子优先Tap手势，44横槽和111密度保留。6组合动作/API与24密度准确回归已通过并完成再次独立审修，进入修正后编译。

官方onClick是隐式单击TapGesture，默认同类手势按子优先竞争。TouchEvent.stopPropagation只终止基础事件冒泡，不能用来证明父手势被取消。修正采用真实受支持的点击结构，保留List拖动，撤回有限probe中手造stopPropagation标志所声称的证明。[OpenHarmony单一手势说明](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/ui/arkts-gesture-events-single-gesture.md)、[华为事件交互原理](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/arkts-interaction-basic-principles/)

## 第一份固定候选

HarmonyOS提交 `ed8d693798d5c3112e938e7a7dd45fda28c17df7`，Reader-UI提交 `f206f0d`，Core沿 `c078126376294faa3a611690fbe48e79f0f86cc4`。候选run为 `20261113T125933Z-ed8d6937-54bfeed6`，App身份为 `0.2.0.DEV.ac7d00ae82ab`，产品版本继续 `0.2.0`，安装计数器继续 `1000000`。

实际编译从 `2026-11-13T12:59:06.286Z` 至 `12:59:32.525Z`。签名HAP为226233325字节，SHA-256为 `f893c0fb9032c831bf1e60a4efae79e58a156def9807be0f38d0608889fd3c05`。唯一证书身份核验通过。当前Core/Native输入与已有缓存一致，Native未重复编译。所有未选业务门禁保留NOT_RUN。

manifest位于 `.reader-artifacts/hap/20261113T125933Z-ed8d6937-54bfeed6/manifest.json`，日志位于 `.reader-artifacts/ui-full-fix-20261113/hap-build-final.log`。本候选编译及签名通过，全页视觉、原生命中、焦点、系统字号和用户验收各保留原状态。

## 原生采样追加的通用圆角修复

第一份候选已在远程x86_64 VM保数据安装并启动。停态原库与WAL的备份保持原字节，当前副本正式FFI用例新执行一次，两项同源合成测试使用冻结原日志复用。签名、UID、ABI、版本检查和安装启动通过，回执为 `deploy-vm-6460677a198b-20261113T131446Z.json`。

该候选首张书架帧出现底部导航白色楔形和断弧，新增 `NATIVE-PILL-01`。后续原生导航暂停，先从代码扩展审计。初始SDK AST库存为161个Normal构造、39处直接pill圆角输入及16处规格赋值，调用链又追出ReaderSearchField一处间接输入。最终逐项处置40处原生入口及16处规格，覆盖24个生产文件。

自然尺寸真胶囊Button使用受支持的Capsule类型。共享ReaderButton通过实际type modifier刷新已挂载实例的规格。已知绘制盒按短边限制半径，触控载体继续按自身预算分配。自然Row/Text复用实际Area或既有精确尺寸输入，保留原业务动作。RSS passive field的宽度沿唯一调用方的原contentFrame传入。

独立审修修正了IconButton的border与圆角应用顺序、TTS状态自然宽的生产测量传播、Labeled测量的appearance/window/UIConfig身份，以及配置修订但同盒不再发Area时的已采用几何保留。无效Area保持最后有效结果，新展示清理旧shape，旧闭包继续拒绝更新。

最终代码证据为 `native/pill-native-input-closure.json`，状态为CODE_ACCEPTED_INDEPENDENTLY_REVIEWED。准确phone shape、shared controls、badge、reading、RSS和Labeled叶分别有新运行或明确REUSED记录。阅读明确尺寸盒为380样本，真实minimum到header链为72组合，RSS为12组合和228个Area回执。全部生产与测试冻结并完成跨域独审后，才进入下一份候选构建。

第一版TTS状态胶囊测试把maxWidth当作实际自然宽，该判断已撤回，最终使用当前状态文字的生产测量返回值。一条RSS初次夹具失败日志被后续运行覆盖，失败原因和修正保留在 `secondary-pill-results.json`，最终及same-box新日志分别冻结。代码与SDK属性结果各自保留证据范围。

四族全部21项登记的2245个主源与依赖绑定已刷新并逐项匹配，包含261个唯一文件。主登记和全部嵌套变体共同更新。21项visual继续NOT_RUN，历史布局、SDK、原生产物维持其原输入和原判定。登记事实更新记录为 `final-pill-register-all-bindings.json`。

## 圆角治理后的原生剩余问题

候选 `20261113T134029Z-91218050-0141197c`，App `0.2.0.DEV.e543e955ba4d` 已实际编译、指定身份签名、保数据安装并启动。其底栏与第一份候选在相同像素区域完全一致，白楔与断弧继续FAIL。Normal加999与Capsule两种子按钮输入在该场景产生相同像素，通用圆角治理未关闭这项原生缺陷。

独立原生树核对确认父Row为196×68vp，两个子按钮约85×50vp，与实际padding、border和密度一致。当前路径Canvas为0，没有额外有效白色覆盖层。源码半径对应的父子端部近乎同心，尺寸预算能够排除版面错位。tree没有导出实际radius和shadow字段，当前代码值不能替代原生属性回执。

包含动态分支的native raised共6个装配站点。PhoneTab的日夜材质均为FF不透明色，其余dock和veil存在半透明主题分支。当前单变量假设仅使PhoneTab显式选择opaqueMaterial，raised helper默认false。上游fill=false分支增加DIFFERENCE剪裁，true分支跳过该内部剪裁，上游同时有自动恢复。当前实验不认定VM泄漏或版本已匹配。抗锯齿边界及实际故障因果继续由新帧回答。[RenderService实现](https://raw.githubusercontent.com/openharmony/graphic_graphic_2d/master/rosen/modules/render_service_base/src/property/rs_properties_painter.cpp)

准确 `opaque-tab-shadow` 叶及独立审修通过。该实验只有PhoneTab的shadow.fill从false到true，其他材质参数、border、clip、几何和业务调用保持原值。证据为 `native/opaque-tab-shadow-sdk.json` 和 `native/reading-raised-path-review.json`，原生假设状态为OPEN。全部代码和独立审修冻结后再构建候选。本轮另一次构建尝试在编译前被沙盒进程优先级权限拒绝，相同冻结输入在允许执行资源保护操作的上下文中完成编译，记录保留。

## 父级剪裁的后继定位

opaque候选 `20261113T135236Z-eaf26f92-b1a9f492`，App `0.2.0.DEV.23a27c337416` 已保数据安装、启动和采样。其选中按钮52150像素及四个白楔区域与前一候选完全相同。外部阴影也没有范围性变化，少量材料边缘像素变化。该假设记为NATIVE_FAIL_HYPOTHESIS_REJECTED，SDK参数PASS保留其原含义。当前存储WAL确已改变，复用入口正确返回NOT_REUSABLE，当前副本FFI新执行一次、两项同源合成用例复用。

当前后继撤回opaqueMaterial选项及其临时接线，shadow helper恢复91218050同字节。只在PhoneTab已支付的包含域关闭冗余父clip。域下界按原item高度、44目标、8间距、8padding和1border推导，两项1到2倍字号需要126到162vp，当前196vp满足。0宽、窄宽、无项、非法宽和尚未满足当前预算的已采用半径保持原剪裁。源字体与实际标签墨迹另行核对，child Capsule和Glyph都包含于当前父材料。

准确 `phone-child-containment` 第06记录通过，36个实际SDK组合、10560个数学边界点、四个负控拒绝。真实同Row的Prop与State回放覆盖2到1倍输入过渡，旧Area拒绝，当前68vp回执采用r34后取消clip。独立审修接受该代码边界。历史opaque代码、参数结果、签名包及失败帧继续保留，当前测试由后继包含条件回归承接。新候选仍须回答实际白楔是否消失，包含计算不作为原生PASS。


## 同类剪裁库存与最终阅读补修

候选 `20261113T141413Z-34cd3bbc-355a26ef`、App `0.2.0.DEV.66c1c747d5a9` 已保数据安装并启动。标准PNG显示底栏四处白楔和断弧消失。独立复核19,560个预期胶囊内部静区像素全部为绿色，旧帧3,147个白色内部像素全部转绿。原生树导出字段中仅父Row的clip从true变false，bounds、颜色和交互字段一致。此结论覆盖当前书架状态，实际系统字号倍率尚未独立读取。

全树121处直接clip调用已登记用途，其中阅读域58处，其余63处位于31个文件。库存包含true和false。独立审查保留Scroll/List视口、封面裁切、展开揭示、动态内容与过渡遮罩。阅读域另核对三个跨域入口。逐站报告位于 `native/non-reading-clip-inventory.json`、`secondary-rounded-parent-clip-review.json` 和 `native/reading-clip-disposition.json`。阅读另覆盖12个运动PathMask，全部保留。

阅读补修两处。亮度条外Column按当前minimum回执、46vp绘制宽、44vp视口与轨道，以及A完整测量矩形的包含条件控制子树裁剪。缺失、陈旧或超预算输入保留裁剪，内部Scroll及8vp百分比轨道继续裁剪。外观字体单元的空背景Row取消冗余裁剪，文字、边框、运动PathMask和原点击owner保留。

精确 `rounded-parent-sdk` 第04日志通过100个受控边界样本、40个实际layout/motion样本、四个实际Props和State更新及四个负控。独立审修从生产测量、layout resolver到SDK Builder复核。测量API采用显式受控seam，字形与新原生帧尚待最终候选核对。未重复运行既有范围外用例。

## 最终交付与最小原生核对

冻结生产提交 `973ec49a` 的最终run为 `20261113T144057Z-973ec49a-2396219a`，App为 `0.2.0.DEV.18805b72930f`，产品版本0.2.0，安装计数器1000000。签名HAP为226273959字节，SHA-256为 `4d3fc8c03a7a465b727e2c73b87429cb34343e06dae499660731e1e8f27995eb`，指定证书身份通过。Core c078与Native配对沿既有已验证缓存。未选业务门禁保持NOT_RUN。

远程现有x86_64 VM通过受控直连HDC完成保数据覆盖安装、身份复核和正常启动，回执为 `deploy-vm-6460677a198b-20261113T144225Z.json`。停止态原数据库SHA仍为4ffa067c，实际WAL已变化，旧全量证明正确拒绝复用。当前副本formal FFI新执行一次，两个未变合成用例明确复用。备份按停态原字节保存，兼容性探针在一次性副本执行。

最终原生动作共四次导航，依次进入Sample EPUB、打开Home、进入快捷目录、拖抓手展开完整目录。未决卡实际隐藏，阅读正文和控制栏均可用。Home的A圆框和字形完整，实际外Column clip=false，Scroll及百分比轨道clip=true，独立审读已归档。完整目录搜索组件383px，内部TextInput248px，四个动作目标各154px，按当前density3.5对应44vp。内部绘制各112px对应32vp，收起44vp载体内绘制40×26vp。当前快捷目录可展开，全目录列表区不再被自动恢复卡占用。

最终采样记录位于 `native/final188-bookshelf`、`native/final188-reader`、`native/final188-home`、`native/final188-directory-quick`、`native/final188-directory-full`。最初采样名称与历史目录冲突，在设备动作前停止，随后使用新名称，记录于 `final-native-capture-retry.json`。本轮未再次核对或继续原始书签记录，未调整系统字号。

全部21项登记、2245个当前源绑定、261个唯一文件经独立只读核对匹配。此次恰21个SHA更新涉及两个阅读源，其他字段和历史证据引用结构保持一致。21个visual仍为NOT_RUN，Source E2/E3仍FAIL，三组完整页来源继续OPEN_APPROVAL。当前原生系统字号倍率未独立读回，大字号、读屏、全页触摸/焦点/系统返回及用户接受继续开放。

总交付索引为 `.reader-artifacts/ui-full-fix-20261113/final-delivery-receipt.json`，Home独审为 `native/final188-home-independent.json`，目录及共享样本独审为 `native-final188-independent-review.json`，登记独审为 `final-reading-clip-register-independent.json`。独立复核直接查看三张PNG，九个原图/tree/JPEG与receipt字节一致，沿receipt绑定driver、config、部署和操作序列，12个相关生产输入与候选source-snapshot匹配，结果为CURRENT_CAPTURED_SAMPLE_REVIEW_PASS。该样本结果保持自身范围。最终文档更新不改变已安装生产字节。


## 控制栏全元素后继审计与修复

用户在已安装App18805b反馈从Home点击目录会改变快捷控制栏高度，并要求检查整个控制栏。旧同窗口帧的可见外壳分别为1197×1140px与1195×1083px，底边同为2734px，目录顶部下移57px。前轮核对覆盖单页尺寸，跨模块外壳一致性遗漏，本节作为该问题的后继范围单独收口。

本轮分三域并行，登记共享51项、目录/书签/朗读105项、其余模块48项，共204个语义元素或变体项。覆盖实际挂载Builder、原始设计角色、Quick/Full与状态分支、字号和宽度预算、当前回调资格。清单中的状态维度代表审读范围，实际SDK与原生采样保留各自执行集合。

| 范围 | 代码根因与修复 |
| --- | --- |
| 共享外壳 | 活动模块的natural minimum与chrome参与选择外壳宽度和Quick/Full高度。改为当前真实Home表单与全部实际header配方共同决定外壳，当前模块继续保有自己的key、自然高度、fits及内部滚动。短窗非Home释放nav后也保持共享亮度预算。 |
| Home | 旧上一章/下一章和三个快捷动作缺少当前Home准入。复用既有progress准入。测量缺失的备用章行52.563vp、进度行30vp不能支付44响应，分别支付至少54/50vp。原34绘制与44响应继续独立。 |
| 顶部与共享操作 | topbar遮挡态、nav和模块inputCurrent、亮度与辅助关闭/收起补当前宿主资格。收起仍可重定向进行中的合法morph。短窗原Exit/Source临时层围栏经真实旧回调核对，More保留关闭自己的入口。 |
| 导航字形 | 原MakeV17为Black900、10fp、13.889行高。先前700/15角色已纠正。六标题专用static900子集缺少界/面，候选复用已含完整中文字形的NotoSansSC-VF及真实variable-weight选项。源资产900轮廓检查和原生字形分别取证。 |
| More | 原缓存只测固定标签，忙碌文字、字号和窗口变化不能更新。现测实际当前标签并缓存真实输入，对无效/抛异常测量有界回退，旧opening的动作核对书籍、打开修订与生命周期。最小176来自现有SurfaceSpec，属于本轮明确实施决定，完整独立popup原稿缺失。 |
| 朗读 | 44载体直接承担原36/28/21等绘制，且Full stop增长后把seek与下部内容推迟23vp。分离绘制与触控，并围绕原中心支付载体；原198播放区、168定时卡与36/32/30/26角色保留，实际文字增长仍入预算。选择行与试听为独立原生动作，移除的旧choice不能启动旧试听或先停止后继试听。 |
| 搜索与自动翻页 | Search旧返回和AutoPage时长轮的父回调补实时Quick/Full宿主及当前数值边界核对。 |
| 替换规则 | Quick首三行在短窗/大字号无法完整到达。保留同一ForEach与原Full列表，Quick自然流使用独立有界Scroll，两端分别接管输入，沿既有inverse morph进度移交滚动。当前行数/错误参与frame缓存，换书只重置已绑定正offset，Quick隐藏第四行拒绝操作。 |
| 外观与设置 | 字体Stack复用公共按钮、selected及当前focus语义，原长按/排序/绘制保留。设置的实际父子组合、降列、自然高度与派发链已逐项审读。 |

独立审修采用跨域交叉审读与Root调用链核对。新定向回归仅选本次改变的共壳、TTS绘制/预设、共享元素准入/角色、More、搜索返回、替换滚动/隐藏行、自动翻页边界和字体格语义。共壳144次模块访问，每次3个共同进度；TTS384个transport样本和96个状态组合；替换自然流36个测量组合；共享导航16个主题/选中组合。量化结果来自显式有限测量seam及实际SDK降级Builder，原生字形、触摸和读屏另记。

本次remote Figma MCP读取原节点返回403 Token expired，local MCP端点可用但资源读取被拒。实际桌面page07同节点显示当前App7fc3af9a衍生内容且处于离线重连，保留实施参照。设计核对使用冻结原始MakeV17、2026-09-05/06原稿夹具及用户确认执行文档的后继修订，未声称新取得在线独立原稿。

逐元素清单、初次失败、最终准确日志与独审位于 `.reader-artifacts/ui-full-fix-20261113/`。本问题入口、旧帧对比、Root复核和原生最小计划位于 `.reader-artifacts/control-module-height-20261113/`。亮度辅助动作的1×1虚拟节点只提供语义投影，物理目标仍沿既有44轨道，读屏与实际焦点继续开放。旧书签原记录本轮核对与继续次数为0。


### 控制栏候选首次编译的导入缺口

冻结提交0b2de1c5的首次实际ArkTS编译失败，替换规则Quick自然流两处readerControlUnit缺少真实import。定向SDK probe注入geometry namespace，未检查这个生产导入缺口。失败发生在包发布前，Appf7c57fa0d30a没有成为安装候选，VM仍为旧App18805b。本轮保留失败日志并补实际导入与源码引用核对，原方法级准确回归继续按未变方法复用。新候选实际编译及原生结果另行追加。


## 控制栏体系审计重开（2026-11-14）

用户指出控制栏切页闪烁、全部模块比例异常，并要求联系合流重构重新审查目录。前述204项登记、局部SDK与独立审读的“全量完成”结论撤回。对应准确日志继续证明其有限属性、回调和最终回执，默认整组比例、中间装配帧及体系正确性重新开放。

根因分为两个独立实现层。测量/呈现链在新业务模块挂载时保留上一模块layout/key，新子组件私有profile尚为空，先具备authored fallback的绘制资格，下一帧登记测量后再采用新profile。普通同模块事实变更又可能替换provider，由Host generation使旧receipt立即失效。正常模块未使用minimumKey重建整棵ForEach；Home的Scroll/direct条件分支确有两棵子树。已投影的搜索临时编辑scope能保住输入，不能把每次query变化一概写成关闭键盘。原生是否合并某些中间更新保留未证。

比例问题集中在Harmony合流落地提交31536cfb。该提交将44响应下限写入多个同时承担paint、slot和下游坐标的natural字段。参考默认1×时，TTS Quick播放卡66→108、内容190→236；Settings Quick选择条30→50、内容190→238；Appearance主题步距28→48并推移字体区域；Directory原输入168×32经44工具槽分配压到132×44，chapter高亮行亦32/40→44。Search、AutoPage与Replace存在同类传递。实际523 TTS帧playback108vp和只余4.57vp可见的语速尾部与源码对应。

历史边界已核。d8ad88ef checkpoint已含测量/保留机制；5b6edd87抽取纯helper保留机制；31536cfb扩大测量覆盖并改变默认参数；6e3e4827加强代际receipt与延迟投影；0b2de1c5稳定共享shell，未原子交付模块内容。Reader-UI合流基线与当前canonical没有规定文字控制栏统一44绘制，当时书面契约已允许小paint居中44carrier。缺口同时存在于Harmony参数映射、类型语义及验收oracle。历史164输入没有原控制设计fixture，部分测试直接断言这些paint/slot字段>=44，因而未检验默认原稿比例。

705在39vp状态栏、28vp手势区的844vp窗口中可由真实约束得到；它被固化为全部环境优选比例的来源继续审查，不能把这一值直接认作当前523 Full已错。当前问题也未发现通用fp/vp二次缩放来源。

正式逐域producer→profile→paint/slot/response矩阵位于 `.reader-artifacts/ui-full-fix-20261113/control-framework-geometry-root-cause.json`，历史与字段映射分别位于 `architecture-history/control-architecture-history-independent.json` 和 `confluence-contract-mapping.json`。框架修复需先拆分这些几何职责，并使实体准入、测量请求和已提交呈现各有明确身份。新模块及其profile需共同交付，默认参考、真实字号增长、空间不足变体和callback生命周期分别验收。原稿无法同时容纳现有44槽时应显式处理冲突，继续压缩输入或扩大paint不能作为默认收口。

### 同包Tab异常的进一步定位

App52353cad4ec0的安装后首帧仍有Tab边框色扇形。其PhoneTab相关16个输入与前次188同字节，实际父盒686×238px、Row/Stack clip=false。按同64837个父材料内部样本，初始坏帧有5463点为精确边框色D0C5B4。正常进入阅读后返回书架，无源码/安装改变，后继Row的该计数为0；同包一次普通冷启动仍为0。首次私有诊断入口在任何stop前因读取appVersion嵌套字段错误而中止，已保留失败；纠正后只执行一次实际冷启动。

RenderService RSTree已读回正常返回及普通冷启节点，二者均为686×238px、四角119px、四边3px、SOLID/D0C5B4，clipBounds/Frame=false，shadowY42、native sigma57.1、fill=false。普通冷启Row编号58与首次坏帧相同，但进程不同；返回Row编号4214，属于后继挂载。当前缺少首次坏态同期RS属性与录制drawing命令，不能宣称引擎bug或仅由clip开关解释。后续必要源码候选安装时应在首次启动立即读取同态帧和RS，复用实际交付机会。本阶段已停止控制栏后续VM导航、未改生产代码，也未因这些审计再构建或重装。

## 体系性修复与代码侧独立验收（2026-11-14）

本批覆盖Home及目录、朗读、外观、设置、搜索、自动翻页、替换规则七个模块，连同独立完整目录、共享Header、IconButton、SearchField、Select、PageState和书架Tab的实际消费者。前述204项登记继续作为源库存，体系性完成结论以本节的准确范围重新建立。

### 几何职责与原稿比例

producer和profile显式区分可见paint、内容slot、文字测量、原生response和父预算。默认1×恢复原有宏观位置与比例，真实字体增长沿各模块自然流和既有Scroll支付。TTS Quick恢复66高播放卡和190内容，Settings Quick恢复30选择条及190内容，Appearance恢复24主题绘制与28步距。Search、AutoPage、Replace同步恢复原角色尺寸。完整目录恢复32/40章节行、168×32控制栏查询区、32绘制/16字形工具，工具响应按各自实际父空间单独分配。

相邻响应先选择可分离轴，再按真实间隔分配各自范围，完整保留原paint。父空间不足时记录实际约束与E2缺口。多个紧邻小控件保持原稿密度，部分实际响应小于44。目录E2继续FAIL，未用外层Common尺寸替代原生响应。漫画目录的44查询和既有工具响应作为独立消费者保留。

Full外壳恢复原736优选值，由实际安全区和视口截限。844高、39状态栏、28手势区得到705上限。原先额外的80%/87%硬比例及模块最小预算对整壳的干预已移除。各模块的内容高度仍由自身事实和自然流决定。

准确入口 `authored-allocation-sdk` 最终22记录通过。原稿端点实际读取冻结fixture，覆盖七模块默认宏观几何、84个producer profile、实际目录NavigationList各lane及锚点、共享消费者和131个受影响Builder与10个root build的SDK前端编译。测量采用有限明确端口，实际系统字号、字形和像素另行验收。冻结原稿未改写。

### 单次呈现交付与保留实例

目标模块先生成带当前业务身份的只读facts和profile，pending导航保留目标、源owner和代次。原已提交页面在候选准备期间继续持有原输入资格，目标与profile通过同一提交切换。Back、后继导航、换书和退役分别使旧请求失效。Home始终使用同一Scroll子树。相同几何的元信息在安全帧采用，保留原logical key、profile及原生actor，重复事实不再派发测量帧。

Runtime继续独占当前Quick/Full形态和既有时钟，metadata与resize回执采用当前形态，导航提交基于最新合法Runtime样本。SecondaryQuick在零时长导航时复用原可见时钟，保留正在进行的开合进度。foreground和blocked参与输入资格，几何身份只接收实际影响布局的输入。

SDK真实Watch可以发生在父render内部，当前提交避免在该阶段直接改Host响应式State。大列表facts通过捕获原不可变快照的只读函数传递，避免Prop深复制两次遍历全量行。缓存使用已采用的完整logical pair，半套新旧输入继续保留上一完整呈现，并按原owner谓词决定输入资格。

Host/Panel/Runtime的11个准确生命周期用例通过，另有owner、同实例Full形态、导航时钟和元信息零重测补充。独立审修见 `architecture-history/measurement-lifecycle-development.json` 及其owner/navigation补充、`primary-crossreview-measurement-lifecycle-final.json`。记录中的早期失败按原输入保留。

### 原生动作与消息代次

保留子组件的普通callback字段继续持有构造期函数。共享动作改为长期receiver与可观察身份交接，旧按下、拖动、取消、消息重试均核对原书籍、opening、Runtime或query scope。顶部只保留一个原生cap宿主与三个响应区域，Home章节IconButton通过actionScope刷新原生动作。旧Pan结束不能清除后继拖动。

Search原Publication的raw snapshot与resultScope在同一facts中取得，实际State代理继续承担显示依赖。formal旧结果仍显示期间保持原按钮代次，后继结果采用后才交接。同query busy/ready保留同一native ID。Directory书签Error/Empty及PageState主次动作同步采用expected代次，空catalog与书签读取失败共存时仍可重试。原未决书签记录核对与继续次数仍为0。

准确Recovery14用例使用真实SDK装饰器、保留实例及八个负控，独立审修通过。共享角色与准入共17个选定用例通过，Pan最后增量和Search admission06分别有补充回执。五个改变消息入口的选定AST登记检查5/5通过，全树消息及其余生命周期本批未重跑。消息规范已同步可观察actionGeneration与原owner核对规则。

### Tab首测量路径

代码追出独立缺陷。启动windowReady返回false仍可能进入Admission，Area前窗口事实可为0，旧Tab会创建0宽且68高的带border/radius/shadow原生材料。旧containment测试甚至要求该退化Row保留，属于错误oracle。

当前只在有限正宽时创建材料和按钮，外层透明宿主及68高占位保留。已有正常材料随宽度变化复用。App层将纯几何观察接回既有startup trace，UI组件只接收可选observer。选定first-measurement与containment第07记录通过，含非法宽、父占位、实际首个有效材料、旧Area拒绝、28个材料组合与六个负控。该代码缺陷与既有523首帧扇形的物理因果仍待同期原生回执。

下一份必要源码候选在同一安装会话内记录首次书架PNG、UI树及前后RS，诊断失败与安装结果分别保留。记录器六个本地session double通过并经独审，精确绑定run、HAP、server和target，失败后停止派发。全部开发与独立代码验收完成后才执行该候选。

### 保留的证据边界

正式control登记19→20，修正14个控件事实，四族21项登记各递增一次并消费control20。266个唯一源路径按最终字节刷新。Root随后只清理七个Content共14处尾空白，保留逐文件before/current及严格trim等价证明，64处关联pin同步更新，本批revision保持一次。既有SDK及独审按语义等价复用。最终refs03通过，register03保留39项诊断，包括21项E2与5项E3失败、13项NOT_RUN，无新增source drift、reference或query viewport错误。21项visual继续NOT_RUN。独审又将八个漫画派生登记中24处混合旧44 bundle撤出当前PASS，保留实际漫画44事实与独立准确焦点等范围。

本节代码与选定SDK已完成独立审修，新增HAP、安装和原生结果在后续单列。Source E2/E3维持原FAIL。系统大字号、读屏、全目标真实命中及用户接受维持原范围。Replace缺完整原稿的子级字号沿既有recipe，TTS颜色和pressed语义沿现有色板，均保留来源缺口。当前在线Figma授权失效及本地衍生页的边界沿上节记录，未产生新的独立设计批准。

### 首次完整ArkTS编译的类型缺口

提交8cb0c447的首次实际编译失败，尝试App为fe5b9a25b368，未发布HAP，VM仍为52353cad4ec0。ReplaceContent新增facts返回类型缺少真实type import，后继局部变量推断触发any/unknown诊断。Panel重复调用currentLayout读取可选Quick高度，编译器无法在两次读取间保留收窄。修复限定于补既有类型导入和单次读取当前layout。选定Builder/SDK前端结果继续保留其原范围，完整工程类型检查由实际编译承担。

失败日志及公开诊断位于 `control-module-height-20261113/build-framework-systemic-01-failure.json`。其中一个诊断被既有签名日志清洗器隐藏，源码缺失导入独立可见，后继完整编译核对修复结果。两处修改独审、当前源pin与准确refs/register更新后再构建后继候选，原业务SDK按未变行为复用。

类型补修只更新两份生产源码，七模块facts类型导入闭包一并只读核对。21处关联pin刷新，13个受影响登记各加一次revision，control20、facts/results/evidence保持。typefix refs01通过，register01继续准确39项开放诊断，diff检查通过。源修复及最小登记差异分别经独立接受后冻结，实际后继编译结果另记。

## 后继候选原生核对与新增组合缺口

提交3e6f0552的build02实际编译及指定证书签名通过，run为20261113T182831Z-3e6f0552-89e0ba3a，App为34ea6aa499ab，signed HAP为c55acc24726d。原Native和Core输入复用，契约业务套件本次未执行。远程现有x86_64 VM已保数据安装启动，准确回执为deploy-vm-6460677a198b-20261113T182959Z。当前原库及WAL停态字节与上份proof不同，新副本正式FFI执行一次、两项同源合成用例复用，原库备份保持原字节。

首次记录器的PNG显示系统启动动画，随后UITree已有书架，仍保持非同步边界。零点击、零重启后取得ready书架观察，Tab的64837个同quiet像素全部为正常表面色，历史5463个边框泄漏点当前为0。实际RS前后同字节，686×238px、r119、border3及shadow/clip与旧正常帧一致。PID13077的40条startup只有一次width196/painttrue记录，未观察零宽，历史扇形归因继续OPEN。独立原生读审位于 `control-module-height-20261113/native-tab-current-independent.json`。

当前实际视口1280×2832px、density3.5。Home、目录和朗读Quick的可见shell均为[43,1595][1238,2734]，content均为[89,1697][1011,2346]。Full目录真实工具32×44响应、32paint/16glyph、query原生30高已读回。一次误点Full目录隐藏导航位置没有效果，前后PNG字节相同，后续改为真实收起再使用可见导航。原记录保留。

有界Home→目录采样实际触发为3.917/467.995/1115.432/1696.028/2243.508ms。帧0为Home，帧1为已有Chapter One加加载文字，帧2–4相同。共同shell、grabber、亮度、nav及正文像素保持，内部章行从1953上移到1865px，恰88px。根因是ReaderDirectoryNavigationSurface在既有内容Stack之前插撤私有loading Row，该状态未进入父ModuleFacts。四个直接消费者共享此实现，触发链包括挂载及查询/目录刷新。该内部位移独立开放。

Full朗读另一条组合缺口已有实际tree。自定义时长Scroll宽261.43vp，双stepper加标签的Row宽310.286vp。秒数增加按钮原154px宽，只剩2px可见。原Make一组30paint分钟控件，新增秒组后四个44横槽和标签仍挤在一行。旧oracle只断言Scroll内容能容纳这些宽度，遗漏整组动作的初始可见性。该组合支付缺口独立开放。

新增问题已先记录并暂停后续VM操作。当前继续从代码侧修正嵌套异步状态、时长组合与同类producer/真实子组件扣款，全部开发、准确回归及独审完成后才产生后继候选。已通过的局部几何、安装、Tab当前帧及实际抓取范围保留原判定。连续过渡、大字号原生、读屏和用户接受仍按实际执行记账。原未决书签记录核对及继续次数为0。

历史进一步核对。目录外Column及失败行来自6705242d2，368af7f7c于2026-10-20加入保留内容loading文字。TTS分钟及秒数组来自2026-09-12的d6966fc90，31536cfb加入测量宽度及横滚，0b2de1c5恢复30paint时仍保留44横槽。前者是嵌套旧宿主进入后继几何合同后的遗漏，后者同时包含合流参数和前次修复遗漏。准确范围见 `control-module-height-20261113/native-systemic-historical-origin.json`。

### 嵌套状态与实际子组合修复

目录唯一生产修改为ReaderDirectoryNavigationSurface。已有有效内容时，其100%×100%内容Stack始终保留原列表盒。读取失败继续原短反馈，重试沿既有动作组件进入右下自然盒覆盖槽，使用外margin、Default及基本触摸停止冒泡。无内容状态继续原PageState。所有恢复动作显式交付既有generation到长期receiver，Retry核原读取输入，Clear核当前query，在debounce期间保持可清除。

准确retained Surface第12记录通过，包含真实NavigationList的同实例List ID/盒声明、PageState和RecoveryAction保留更新、新query/旧native回调、四个直接caller加wrapper共七组装配，以及Transparent与原捕获factory负控。原生手势仲裁、连续帧和新增覆盖槽命中尚待实际取证。第09旧Transparent PASS作为已被替代的历史保留，后继源码已按SDK定义修正Default。测试只收窄基本触摸诊断文案时，逐字节比对复用第12回执。

TTS完整自定义时长将30横槽、30paint和14glyph与至少44纵向载体分别支付。按实际viewport选择单行、标签独占行或分秒组分行，全部高度同步推进timerCard和后继区域。最终06准确叶通过17组Full端点与68个按钮，包含261.4286vp实际视口和320/366×1/1.3/1.6/2输入。原44横槽负例被拒。额外51个中间装配保持完整Full-only配方，原Card连续插值和timer根clip继续揭示，204个Full动作按生产端点资格禁用。完整自然内容可超过中间揭示区域，该范围未记为完整可见。

其余五模块完成16组真实组合审查，修复三处producer账差。Search按共享text RecoveryAction实际min44及两侧padding2分配消息宽度，Replace工具栏扣回native双边框2，AutoPage跟随行按真实switch44×24、间距8、padding18/12及双边框2测量。唯一准确组合第04通过Search17、Replace10组30按钮、Auto10组，分别有旧producer负控。Settings与Appearance的已列组合未发现额外可证同类账差，全部视觉状态继续各守原范围。

AutoPage默认跟随行由36调整为38，由现有AddedActor的24+12+2支付得出，2×为40。该实施决定保留既有文字、开关paint和动作。原稿的AddedActor来源缺口继续登记。目录及TTS的紧凑横向响应仍小于44，E2维持原FAIL。

上述三域已交叉独审，源码与准确测试冻结。Root补查全应用七个显式shared action factory赋值，五处已有匹配的publication、presentation/retry或source字段key，另外两处属于本批嵌套目录修复。该文字工厂搜索按具体语法记账，完整应用交互验收维持原范围。当前选定目录消息入口AST检查4/4通过。后继必要候选的同会话初始记录增加一张Tree/RS后的PNG，七个本地double和独审通过，维持非同步边界，原记录器源码与首轮动画帧保留。

本批正式登记已独立接受并冻结。control20→21只更新两项目录重试/清除的生命周期和局部放置事实，数值目标保持。21项登记各递增一次并消费control21，269个唯一输入与2311处pin核对通过。13项目录事实和八个共享依赖范围绑定准确新测试。refs本批一次PASS，register本批一次保留准确39项开放诊断，所有层、不变量和21个visual结果保持。最终正式SHA为register724446fe7381及control38daef5dcf30。后继完整编译和原生结果另记，当前安装仍为本批修复前的34ea。

### 111ab候选已证范围与物理像素预算后继

提交64ca58ca的build03实际编译及指定证书签名通过，App111ab35d6b50、signed HAP29c4461ad770，run20261113T190614Z-64ca58ca-fd840a0b已在远程现有VM保数据安装并启动。首次截图仍为启动过渡，同会话Tree/RS后的PNG已经显示ready书架，Tab同quiet mask64837点全为正常表面，边框扇形0。启动日志PID8265只记录width196/painttrue，历史扇形归因仍OPEN。取证序列3.037秒，非同步边界保留。

新Home→目录五帧中，帧1–4原PNG字节相同，章节橙条均为[149,1865,160,1977]，旧88px位移在这四帧未再出现。共同shell、正文和亮度区域各采帧保持。真实触发3.267/455.080/1056.268/1617.500/2163.021ms，间隔中的瞬间仍保持未证。Full TTS四个时长按钮实际visible bounds与orig bounds全同，均105×154px即30×44vp，paint30/glyph14。原最后加号完整显示，分钟/秒能力及当前disabled事实保持，custom无横向Scroll祖先。

Home窄竖条另经源码定位。共同Quick预算将325.438vp按最近物理像素取整到325.4286vp，fits的0.01容差与Home Scroll严格小于比较产生不同结论。原生树Scroll与内容均[89,1697][1011,2346]，Scrollable仍为true。该假溢出来源继续按共享需求和容量的像素支付语义修复，已有目录/TTS实际结果各守原范围，后续VM步骤暂停。阶段证据及独审位于 `control-module-height-20261113/native-directory-click-followup-independent.json` 和 `native-systemic-findings.json`。

### 共享物理像素支付修复

本补修仅改ReaderLayoutGeometry与Panel的Home滚动比较。高度需求向外取整、容量向内取整，preferred光学最近取整继续在已付上下界内选择。measured portrait、legacy stacked及wide/landscape的Quick/Full共同使用。Geometry高度fits与实际Home Scroll改为同一尺度化Number.EPSILON比较，宽度规则和原业务、Motion、时钟保持。

density3.5的原反例中，Home需求185.438不变，内容实际容量从185.428571改为185.714286，Quick从325.428571改为325.714286。新Scroll声明为false，旧欠付高度在新比较下仍为true，源修复处理真实支付差异。真实短窗及大字号不足仍可滚，原生scrollbar默认配置保留。

准确pixel-height-payment第03记录通过20组阈值样本及70组共享布局，包含七模块、五种窗口、两组内容高度、Full736与原Motion端点。既有home-single-owner只补真实生产helper端口并选跑一叶通过，其余方法域复用。reading已独立接受两源、两个测试及原反例，回执位于 `control-module-height-20261113/pixel-height-payment-results.json` 和 `reading-crossreview-pixel-height-payment.json`。后继只补实际变动Quick和未执行端点，111ab已证TTS自定义与嵌套目录行为按未变方法范围复用。

高度小批正式登记已独审接受。13项目录登记各20→21，刷新两源26处pin并新增13个准确pixel test输入，270唯一输入与2324处pin成立。control21、全部typed facts、层/不变量/visual结果及另八项登记结构保持。refs本批一次PASS0，register本批一次保持39项开放诊断。当前register191970bb93aa，control仍38daef5dcf30，生产、测试与正式登记再次冻结后再产生必要后继候选。
