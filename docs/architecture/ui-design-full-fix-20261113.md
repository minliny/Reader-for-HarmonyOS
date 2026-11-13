# 全应用 UI 对比修复

2026-11-13。依据 `ui-design-comparison-audit-20261113.md` 执行，开发基线 HarmonyOS `ad9e4710`、Reader-UI `09150862`。当前工作位于隔离工作区 `framework-confluence-20261112`，原工作树与应用数据保留。

## 目标与执行边界

本轮目标覆盖15个当前整改条目、1个保留代码条目，以及可在代码侧补齐的来源登记、局部宿主检查和跨书恢复引导。goal 已设为 active。15个当前整改项与1个保留项的代码开发、独立审修及选中定向回归已完成，最后候选的实际ArkTS编译、打包和指定身份签名已通过，goal继续跟踪保数据交付与原生证据评估。

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
