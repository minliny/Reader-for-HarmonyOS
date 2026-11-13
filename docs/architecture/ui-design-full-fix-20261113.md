# 全应用 UI 对比修复

2026-11-13。依据 `ui-design-comparison-audit-20261113.md` 执行，开发基线 HarmonyOS `ad9e4710`、Reader-UI `09150862`。当前工作位于隔离工作区 `framework-confluence-20261112`，原工作树与应用数据保留。

## 目标与执行边界

本轮目标覆盖15个当前整改条目、1个保留代码条目，以及可在代码侧补齐的来源登记、局部宿主检查和跨书恢复引导。goal 已设为 active。15个当前整改项与1个保留项的代码开发、独立审修及选中定向回归已完成，goal继续跟踪最后候选编译与交付评估。

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
