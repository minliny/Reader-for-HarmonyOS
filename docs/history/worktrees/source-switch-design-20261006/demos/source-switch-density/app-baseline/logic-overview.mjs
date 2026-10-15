// Overview complements the generated routes, parameters and citations for every module.
export const overview = `# Reader · 逻辑稿

本稿依据当前已接通的应用源码重建，配套 [UI 稿](index.html)。书名、正文、封面和书源数据是演示夹具。逐模块路线、参数和源码引用由同一份登记生成；画布显示应用内容，审阅说明放在画布外。

__HOST_BASELINE__ 输入文件及指纹见 [baseline.json](baseline.json)。本次修复核对了审计后更新的源码，旧审计版本与旧参考图不能代表当前应用。登记 __MODULE_COUNT__ 个界面/组件；数量不代表原生视觉、业务或设备验收。

## 入口与页面关系

矩形表示界面、弹窗或阅读模块；圆角节点表示原位反馈或内部处理；菱形表示条件。箭头标明动作与去向。逐模块规格为每个模块另附路线图。当前主导航是书架、设置；发现、RSS、同步等受产品开关关闭。仅有定义、没有当前可达调用的页面不进入登记。

\`\`\`mermaid
flowchart LR
  Shelf[书架] --> Search[搜索]
  Shelf --> Actions[书籍操作]
  Shelf --> Import[本地导入弹窗]
  Shelf --> Batch[批量管理]
  Actions --> Detail[书籍详情]
  Search --> Detail
  Detail --> Directory[独立完整目录]
  Shelf --> Reader[阅读页]
  Detail --> Reader
  Reader --> Kind{内容类型}
  Kind -->|小说| Novel[小说正文及控制层]
  Kind -->|漫画| Manga[漫画正文及控制面板]
  Novel --> Switch[更换书源整页]
  Manga --> Switch
  Detail --> Switch
  Settings[设置] --> General[通用设置]
  Settings --> Sources[书源管理]
  Settings --> ShelfSettings[书架设置]
  Shelf --> ShelfSettings
  Search --> Sources
  Sources --> Tools[书源工具]
  Sources --> SourceImport[书源导入弹窗]
  Sources --> Login[Host 登录容器]
\`\`\`

## 书架、搜索与书籍上下文

封面、列表、继续阅读卡和搜索结果携带所选书籍的稳定身份、内容类型与来源。操作菜单、详情、目录和阅读沿用该书籍；返回保留原页面筛选、视图、滚动和草稿。长按后多选预选所按书籍。

书架按内容类型（全部 / 小说 / 漫画）与来源（全部 / 本地 / 在线）组合筛选。搜索同时提供来源和内容类型筛选，保留简介、进度与来源反馈。清除条件不改变封面 / 列表显示方式。空书架、无匹配、加载与读取失败保留原有结构及入口。

书架更多菜单锚定触发按钮。书籍操作采用用户指定的旧漫画 demo 浮层样式，动作和去向依据当前应用。书架设置返回各自进入来源。移除、刷新和保存的未知结果、待确认结果与恢复动作承载在原书架的公共恢复组件中。

本地导入由应用弹窗进入系统文件选择，再在同一弹窗显示进度和逐文件结果。提交与书架重读分别记账，重读失败保留真实提交结果。长结果滚动列表，完成按钮保留在可操作区域。

\`\`\`mermaid
flowchart LR
  Shelf[书架] -->|搜索| Search[搜索结果]
  Shelf -->|长按 / 更多| Actions[书籍操作]
  Actions --> Detail[所选书籍详情]
  Actions --> Batch[预选该书的批量管理]
  Actions --> Group[分组选择]
  Actions --> Remove[移除确认]
  Shelf --> More[锚定更多菜单]
  More --> Import[本地导入]
  Import --> File[系统文件选择]
  File --> Result[原弹窗导入结果]
  Remove --> Recovery(原书架恢复提示及动作)
  Search --> Detail
  Detail --> Reader[所选书籍阅读]
  Detail --> Directory[独立完整目录]
\`\`\`

## 小说与漫画目录

小说阅读内目录属于小说控制层，支持 Quick / Full、目录与书签标签、章节层级的独立展开。内容搜索保留搜索框、结果数量、章节与内容片段；选择结果跳转对应位置。

漫画阅读内目录由 MangaReadingSurface 承载：窄窗口用目录面板，宽窗口用侧栏，不套用小说的 Quick / Full 变形或听书模块。漫画常用目录没有书签标签；空目录经现有 guarded 回调打开 ReaderFullDirectory 的兼容入口时，使用该独立组件自己的书签与离线菜单，不改造成普通漫画面板。详情完整目录由 BookDirectoryPage 承载，依据小说 / 漫画走实际分支。各入口和返回关系分别登记。

\`\`\`mermaid
flowchart LR
  Detail[书籍详情] -->|完整目录| FullPage[BookDirectoryPage]
  FullPage --> Content{内容类型}
  Content --> NovelPage[小说独立目录]
  Content --> MangaPage[漫画独立目录]
  Novel[小说阅读] --> Quick[阅读内 Quick 目录]
  Quick -->|展开| Full[同模块 Full 目录]
  Full -->|收起| Quick
  Manga[漫画阅读] --> Width{窗口宽度}
  Width --> Narrow[漫画目录面板]
  Width --> Wide[漫画目录侧栏]
  Narrow -->|空目录兼容入口| Fallback[ReaderFullDirectory]
\`\`\`

## 小说阅读控制与反馈

控制首页及目录、听书、外观、阅读设置、搜索、自动翻页、替换模块复用应用资产、选中图标、头部、亮度区与导航结构。抓手使用应用已有的会话、手势策略和动效采样，支持连续拖动、展开、收起、关闭与取消恢复。切换形态保留模块值；返回按临时选择层、Full、Quick、控制首页、正文的实际层级消费。

自动翻页保留模式、速度、计时和运行状态，停止留在原模块。听书区分系统 / 在线、未配置、准备、播放、暂停与失败条件；下拉锚定触发项，在线管理保留编辑字段及保存条件。主题、字体排序、替换规则与草稿独立保存，禁用项沿用源码门禁。

本地书籍按实际能力禁用在线换源、刷新和在线下载。退出失败、刷新失败复用实际公共弹窗；取消恢复原阅读状态及控制模块，恢复动作按原回调执行。更多菜单执行动作前关闭自身；提交内部过程不新增产品页面。

\`\`\`mermaid
flowchart LR
  Reading[小说正文] --> Home[控制首页 Quick]
  Home --> Module[目录 / 听书 / 外观 / 设置 / 搜索 / 自动翻页 / 替换]
  Module -->|抓手展开| Full[当前模块 Full]
  Full -->|收起| Module
  Module -->|返回| Home
  Home -->|关闭| Reading
  Module --> More[锚定更多菜单]
  More --> Refresh[刷新 / 下载动作]
  Refresh --> Feedback(原位置进度或公共失败提示)
  Feedback -->|取消| Module
\`\`\`

## 漫画阅读与换源

漫画正文由真实 MangaReadingSurface 承载，保留页面位置、方向、适配、页码、亮度和背景的配置。模式、设置、更多、下载使用漫画自己的面板；宽窗口目录侧栏依据实际布局条件显示。下载采用当前接通的章节任务、暂停以及保留 / 清理动作。

小说换源沿当前候选提交路径。漫画换源由原网关匹配章节：匹配成功直接提交，需要选择目标章节时复用 BookDirectoryPage 的漫画选择分支。选择期间忙碌禁止关闭，取消恢复原漫画位置；没有首图验证步骤。

\`\`\`mermaid
flowchart LR
  Manga[漫画正文] --> Controls[漫画控制栏]
  Controls --> Mode[模式面板]
  Controls --> Settings[漫画设置]
  Controls --> More[漫画更多]
  More --> Downloads[漫画下载]
  More --> Switch[换源候选]
  Switch --> Match{目标章节匹配}
  Match -->|成功| Commit(原换源提交)
  Match -->|需选择| Select[复用独立目录选择目标章]
  Select -->|选择| Commit
  Select -->|取消| Manga
  Commit --> Manga
\`\`\`

## 设置与书源

主题、自动更新、减少动态效果、缓存与重置任务各有独立状态；切换主题不清除其他偏好，任务结果不覆盖配置。忙碌、未知结果与读回失败使用原页面门禁和公共恢复组件；选择值及恢复动作见逐模块规格。

书源查询、类型、状态、分组、滚动和选择独立。检测、启停和登录作用于实际所选书源。分组弹层按源码触发位置定位；遮罩或系统返回先收起弹层。宽窗口与平板类型是不同输入，不以窗口宽度代替平板分支。

编辑、调试、批量检测与操作各自保存草稿和选择。当前 JSON 导入组件只拦截空白输入，非空提交 Host 解析；演示不增加不同于应用的前置协议规则。提交后关闭原弹窗，原书源页面保留回执、读回失败和重试。在线登录为 Host 容器的映射，demo 不模拟真实认证完成。

\`\`\`mermaid
flowchart LR
  Home[设置首页] --> General[通用设置]
  Home --> Sources[书源管理]
  Home --> ShelfConfig[书架设置]
  General --> Reset[恢复默认确认]
  Reset --> HomeRecovery(原页面重置进度及恢复动作)
  Sources --> Group[锚定分组选择]
  Sources --> Import[JSON / URL / 文件导入]
  Sources --> Tools[书源工具]
  Sources --> Login[Host 登录容器]
  Tools --> Editor[编辑]
  Tools --> Debug[调试]
  Tools --> Check[批量检测]
  Tools --> Operation[启停 / 导出 / 删除]
  Import --> Recovery(原书源页面回执及恢复动作)
  Operation --> Recovery
\`\`\`

## 演示与验收边界

外部状态按钮选择夹具，画布内入口遵守身份、上下文、返回与交互条件。演示状态仅服务本地预览；网络、解析、提交回执、系统文件选择、在线认证与真实语音由应用 Host 实现。

源码定位、模板结构回归、浏览器视觉与原生验收分别记录。离线回归见 [修复验证](coverage-evidence/repair-verification.json)，原审计与处置见 [审计记录](AUDIT.md)。旧 PNG 保留作历史证据；源码或设计指纹不一致时不能用于本版还原验收。

小说抓手演示复用源码策略与动效采样；漫画抓手按源码拖动阈值关闭、取消回原面板，浏览器释放时直接呈现稳定端点。漫画原生弹簧时序需依照规格实现并验收，不能用该预览证明曲线一致。
`;
