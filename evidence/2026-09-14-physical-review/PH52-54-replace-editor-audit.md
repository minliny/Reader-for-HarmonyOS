# PH52–54 替换规则与新增表单

初始用户观察来自已安装643bcaf5；本轮源码9a8ef9a1及其后其他agent并行补修不等于用户已看过。初始反馈见FOLLOWUP_48_55.md。本任务不操作设备、构建或提交，不改总账。

## 先行定位与参考边界

- PH52：`ReaderControlReplaceContent.editorText`缺输入fontColor、placeholderColor，因此应用夜间表面上仍依赖平台默认输入文字；其余规则名称/摘要/标题已绑定应用主题。新增编辑底部保存位于长Scroll的末尾，并非独立可见操作区；临时层顶部“取消”使用layoutWeight的通用textAction，语义与页面返回混在一起。
- PH53：同一TextInput依赖默认圆角，且placeholder重复上方完整标签和备注。将明确紧凑输入半径/字号、主题前景，标签保留备注、输入不复写标签。
- PH54：`createReaderControlReplaceDraft`新建scope固定空串，Core空范围即全部。当前State只有sessionKey，没有真实阅读上下文；不能解析带冒号的sessionKey来猜书源或书名。需在LRE.openQuickReplace创建State时直接传已有bookTitle/sourceId，经State传到现有Content；修改已有规则必须保留原scope及所有未改业务字段。
- 原设计依据：归档fixture `tools/fixtures/reader-control-restored-baseline-20260905.json`的replace展开1938:11606、收起1977:25429；当前组件亦明确编辑/确认/预览是业务overlay，不是已恢复的Figma演员。既有几何为工具按钮8vp、行内动作6vp、规则名称12fp；本次表单按用户明确缩小要求采用11fp与6vp，不伪称Figma提供了该新增表单的像素尺寸。`READER_CONTROL_BAR_DEVELOPMENT_PLAN_2026-09-05.md`要求完整替换留在阅读控制域、复用现有Core事务，不退出阅读去设置页冒充展开。
- Core现有范围合同：`reader-domain::scope_tokens/replace_rule_matches_scope`按`,`/`;`/`|`切分且任一书名/书源字段命中；`reader-content::ContentProcessor`保留Legado兼容内容范围语义。新增默认从实际书名及在线sourceId生成现有范围文本；不是引入书籍ID/书源ID复合精确匹配器。local通用身份不加入范围，避免默认命中所有本地书；未知字段不伪造。

本轮先补SDK真实Builder和业务回归，再定点修改。保存仍经Core校验/确认，失败保留草稿；取消不得写入；不确定写入不得重复提交；系统Back保留逐层临时层退出语义。

## 最终实现

1. PH52/53在`ReaderControlReplaceContent`中闭环：输入显式绑定应用正文/次级前景色，值由原live getter渲染；输入11fp、6vp圆角，已有标签备注保留且placeholder为空。Full规则列表既有12fp文字及Quick/Full几何不变。底部固定36vp操作行放在Scroll之后，保存/取消不随长表单滚走；顶部38vp返回只关闭临时层，不退出阅读。长表单Scroll明确TopStart；表单其他字段、开关及Core事务保留。
2. `saveEditor`仅在editor/full/ready时调用既有perform→onSave链；校验/保存失败保留草稿及失败提示，确认成功才关闭；取消和返回不写入，pending期间拒绝关闭。SDK原生属性回归确认保存对mutationPending、writeUncertain、canonicalReloadRequired及非Full端点立即禁用。保存按钮从旧textAction中移出，但未放松事务/迟到结果保障。
3. PH54在`ReaderControlReplaceState`增加defaultScope，并由所有状态复制保留。`createReaderControlReplaceState(sessionKey, bookTitle, sourceId)`使用实际字段构造默认范围，Content只对新建draft应用；既有rule.scope即便原本为空仍原样保留。原不带上下文构造保持空范围，不污染设置页独立规则管理的创建状态。设置页`RulesManagementPage`依旧用自己的replaceName/pattern/value等字段构造独立ReplaceRuleDraft，不引用阅读State，也未由本次自动加上阅读scope。
4. LRE.openQuickReplace一处真实上下文透传由同轮阅读agent负责；本任务未编辑LRE/ReaderControlPanel。实际LRE方法回归已验证新进入口及异步canonical reload均保留真实默认scope。

范围语义明确：在线默认文本为`实际书名;实际sourceId`，按现有Core的任一命中规则，可能应用于该书名的其他书源以及该书源的其他书；不是“仅当前书籍与当前源同时匹配”。本地不把共享local来源加入，只有实际书名。未改Core范围schema、未按标题猜造sourceId/bookId、未引入自研通用匹配算法。字段都未知时构造器维持原空值供独立管理使用，不伪造当前阅读身份；已知阅读入口由实际LRE props提供。

## 验证、失败记录与冻结

- 新`tools/test-reader-replace-editor-feedback.mjs`最初4组均在旧生产代码失败，修后通过；随后补充第5组真实SDK已挂载footer状态门禁、第6组真实设置页新增按钮创建回调均通过。执行的是真实SDK输出的Builder观察回调及真实State/Content/Gateway方法，不是替代UI的字符串示意。
- [修前4组失败原件](PH52-54-production-red.log)；[最终Content套件和新增6组通过原件](PH52-54-production-green.log)。覆盖主题动态变更、紧凑输入/空placeholder、固定操作区、真实上下文/独立全局创建/编辑不覆盖、失败保留/确认关闭/取消不写入、挂载后pending与不确定写入禁用。
- 六项相关套件最终全部通过：Replace State、Gateway、Host、Geometry、Quick、Content，输出见[关联记录](PH52-54-related-tests.json)。Content同时导入新回归，确保现有统一门禁覆盖本次修复。
- 保留中间失败：旧Content要求10种textAction（现在保存独立，剩9种）、旧Geometry要求文字“确认保存”、旧Content要求placeholder重复label；均属于被用户新要求替代的结构预期。修正对应断言后仍保留其真实业务禁用、来源getter、同树身份、固定12fp规则字体和迟到回执检查，新增真实footer覆盖原保存禁用保障。
- Geometry测试明确归档`replace-live-motion-context-20260905.json`不存在，跳过可选原始值对比；生产几何端点/中段/宽度与单树检查PASS，不补写Figma像素验收。恢复总fixture仅提供取得设计/动效的回执，本轮未声称亲自重读了缺失的完整原始图层。

已冻结：本任务生产仅`ReaderControlReplaceContent.ets`、`ReaderControlReplaceState.ts`；测试新增`test-reader-replace-editor-feedback.mjs`，更新`test-reader-control-replace-content.mjs`、`test-reader-control-replace-host.mjs`、`test-reader-control-replace-geometry.mjs`。没有设备、构建、提交；本地方法与SDK输出通过不等于实际像素、键盘布局或用户验收通过，交付层由root统一处理。
