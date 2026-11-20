# 2026-10-23 main 消息全量接入

用户授权：全量执行，在 main；以 approved-original 原稿及 approved-scope-20261019 的后续批准边界为依据。保留现有页面与业务，胶囊仅用于自动播放、翻页；关闭功能不恢复。Harmony/UI 均在 main，保留并行 dirty WIP，未提交或清理。

## 本轮实施

| 审计项 | 已落实的源码处理 |
| --- | --- |
| F01 全局短反馈 | ReaderTransientFeedback 发布代次事实，ReaderTransientToast 自绘原稿的深色圆角横条、圆形状态标记、标题/正文。无意义的“提示”标题省略；成功/失败/普通标记显式区分，正文自然增长，独立日夜色板，键盘与安全区避让。无原生 Toast，无虚构撤回。 |
| F02 确认 | 保留框架已允许的 ReaderNativeAlertOwner 平台变体和 ReaderDialogSurface；5 个原生 Alert 桥都在 owner 的当前身份/单次决策保护内。替换规则删除及导入确认接公共 DialogSurface。 |
| F03 换源 | 无候选的加载/空/失败走 PageState；保留旧候选时读取失败走短反馈；未决事务/撤销走 RecoveryNotice，按 presentation/transaction 拒绝旧动作。意图恢复错误保留 reconcile 事实。 |
| F04 替换规则 | 列表/预览加载与无内容失败接 PageState；普通错误接短反馈；未知原写入接 Notice。规则面板关闭后阅读宿主仍保留同一原 operation 的待处理提示，查看规则只打开原入口。输入校验保留字段上下文。 |
| F05 阅读章节 | 章节加载与正文无可用内容失败接 PageState，保留纸色、32vp 加载器、reduceMotion/active、返回和原重试/换源动作。 |
| F06 漫画下载 | 局部加载/失败接 PageState、44vp RecoveryAction；独立夜间面板明确传 scheme，保留下载 owner 和原 retry。 |
| F07 目录空态 | 两个目录使用无 padding 的 PageState，保留当前目录几何/查询/清除动作和旧 view/query 失效。 |
| F08 朗读消息 | 配置写入错误由宿主按 receipt 分类；试听失败走带身份短反馈；格式校验留字段。播放错误取消固定24vp/两行裁切，沿专用播放宿主自然排版。首次配置读取加载/失败单独 PageState，不伪装为空列表；已有配置刷新失败保留列表给短反馈。 |
| F09 任务忙态 | 书架管理、书源工具、设置操作、多选移除、书架更多检查更新等保留原任务宿主，登记原 owner/范围/结束条件，复用真实 LoadingProgress/消息字体，不增加进度弹窗。 |
| F10 busy | 阅读与朗读偏好恢复使用真实开始核对/保存的独立 busy，canRetry 只表示准入。 |
| F11 TTS 未决写入 | 配置 durable/selection receipt 单独投影，不与偏好写入混用；读回成功不清掉未知写入。持续提示在阅读根部和当前配置弹层可见；安全文案与内部诊断分离，删除读回失败仍明确“已删除”。 |
| F12 覆盖边界 | 按实际调用登记全部当前可达入口；保留未消费旧面板和关闭模块的明确状态，不把它们或424个设计目标状态算作已运行验收。 |

根页、原生TTS全屏层、书籍操作Sheet、删除Dialog复用4个Toast宿主。根priority0、模态priority2，同一时刻只在当前最高层显示；模态Toast绝对定位，不撑大FIT_CONTENT。旧定时器/旧owner reset不关闭新代消息。后台或当前宿主退场不重播。

## 必要验证及限制

- 入口检查：仅 tools/check-message-entrypoints.mjs --check；嵌套为全源ETS AST解析、登记/例外一致性检查，防止本次分类迁移漏口/留下原生Toast；未挂到构建或CI。
- 定向生产方法/SDK探针：仅本次发布/去重/代次/宿主仲裁、前后台和键盘边界、TTS/偏好事实投影、同一分组原操作、阅读和目录既有动作。源码及SDK输出真实执行；平台IO、计时器与原生布局是显式边界，不声称原生像素或设备验收。
- fonts-carriers：真实静态字体表、现消息组件SDK载体，PASS。首次默认Python缺fontTools后使用本机已有venv，无安装依赖。
- detail-notice旧辅助器：FAIL/未完成，SDK属性运行时的createNewInternal warning被辅助器抛异常，未进入断言；未修改/放宽该helper。group-receipt旧fixture仍模拟系统Toast，其同一业务断言改由任务内实际adapter探针验证。
- 打包：唯一 hap-pipeline iteration / contracts none，只核验当前构建必需输入、真实ArkTS编译、Native配套、包字节和指定签名。不运行全量业务门禁。

详细探针结果与初次失败原因保存在 `.reader-artifacts/message-integration-20261023/`。构建结果另在完成后追加；安装、原生触发、真机视觉与用户验收均 OPEN。

## 最终本地交付结果

- 消息入口登记检查：147/147 PASS；0旁路原生Toast；5个受控平台Alert；4个共享Toast宿主。
- 定向root探针4组 PASS，page-state 5处探针 PASS，换源分类与旧动作拒绝 PASS；其它未完成辅助测试如上保留。
- ArkTS全项目类型检查、无增量编译、包资源身份及指定证书签名：PASS。
- HAP run：`20261023T155303Z-6b1bd753-be3ba859`；manifest：[manifest.json](../../.reader-artifacts/hap/20261023T155303Z-6b1bd753-be3ba859/manifest.json)。
- signed HAP SHA256：`cd6771df0b6153d901e603d72934237d76438ad7f3976068e1a8a49dafdf7332`。Profile：debug；证书：`3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`（minliny_HarmonyOS）。
- Harmony：`6b1bd7534b61a8ebfac10150fd308eae8430606e`，dirty=true；Core：`9131ddcfeef1922620c6867f88fe82608e51a079`，dirty=false。产物包含本次快照中的既有WIP。
- contracts=none；未执行全量业务套件。未安装、未启动或操作真机，设备应用与数据未变；VM/真机交互与用户验收 OPEN。

## 真机交付追加

2026-10-23：用户授权安装，当前连接目标只读就绪/签名身份核验 PASS；同一上轮签名 HAP 覆盖安装 PASS，启动 PASS，dataPolicy=preserve。27个消息相关生产文件当前hash与该产物输入快照一致。

部署回执：[deploy-physical-70e766f54de6-20261023T155755Z.json](../../.reader-artifacts/hap/20261023T155303Z-6b1bd753-be3ba859/deploy-physical-70e766f54de6-20261023T155755Z.json)。目标只记录脱敏引用 `70e766f54de6`。未做功能点击、截图或视觉验收；featureInteraction/userAcceptance仍OPEN。
