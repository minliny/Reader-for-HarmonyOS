# 搜索结果增加书源分组筛选：评估与demo（2026-10-28）

用户要求“先别做，评估下怎么实现，做个demo”。本轮仅新增独立HTML/CSS/JS预览与本评估；不修改应用生产代码、不构建、不安装、不操作真机。现有已认可的跨页与搜索结果demo保持原样。

## 推荐交互

现有“内容／来源”两行保留，在其下加一行“书源分组 → 当前选择”。点击后在同一个底部弹层切换到分组选择页：返回、查找框、单选列表、关闭；选择即生效并返回主筛选页。分组多时只让选项列表滚动，查找框和header不随之滚走，不把大量分组挤成无限chips。

- 默认全部分组；另提供未分组和书源管理中已有的分组。只单选，暂不加入多选、分组编辑或新的搜索任务。
- 内容／来源／分组三条件共同过滤当前查询已接收的结果，不重新搜索，不改变源启用状态或原任务总进度。
- 指定分组只匹配在线来源；“全部来源+指定组”不自动切换来源类型。选择本地时原子清空分组并禁用分组行，避免产生“本地+某在线书源分组”的无效组合。
- 主弹层的重置一次清除三个条件；关闭保留条件。空态可只清分组，保留内容／来源，或重置全部。
- 分组已删除/改名时保留失效选择、零结果和清除入口，不静默恢复全部、扩大范围。

Demo入口：`docs/ui-design/demos/search-source-group-filter-demo-20261028.html`（工作区根目录）；沿用暖白色板、表面层级、现有真实书籍/封面样本，新增明确标注的本地/漫画演示项。所有分组及来源关系为fixture，计数由实际示例投影计算，不使用真机来源计数冒充筛选结果。

## 当前代码事实

| 接入点 | 当前事实与影响 |
|---|---|
| `features/search/SearchGateway.ts:77,594` | SearchSource.group来自bookSource.bookSourceGroup，仅trim。完整字符串精确匹配，没有多分组解析。 |
| `features/source/SourceManagementPage.ets:798,827`、`pages/Index.ets:2668` | 分组目录实际从sources[].group派生；宿主未传独立groups实体，没有稳定group ID。不是书架BookGroup。 |
| Core `crates/reader-domain/src/lib.rs:142` | DTO另有groups数组，但当前Host没有承接多组/CSV语义。本方案不擅自把A,B拆组；落地应复用/统一Source/Search元数据投影。 |
| `features/search/SearchPage.ets:769,846` | 当前提交会清两项结果筛选；分类/来源选择只重置结果投影。新分组应跟随同一owner生命周期，字段与现有selectedGroupName（实际本地/在线）明确区分。 |
| `features/search/SearchOrchestrator.ets:785,809` | scopeSourceIds只限远程源；local分支独立执行。不能直接把它当结果分组筛选，也不应点分组选项就取消或重搜。 |
| `features/search/SearchPage.ets:1327` | groupedResults目前用代表book.sourceId判来源，并有结果缓存；仅在此追加分组条件会漏掉其它variant匹配的书。分组目录revision需进入缓存失效条件。 |
| `features/search/SearchResultProjection.ts:140` | 复用既有代表选择与来源去重策略，先过滤variants再形成显示投影；完整原始结果不改。 |
| `features/search/SearchPage.ets:1757` | 可见卡片冻结displayedFacts。需独立filter/display revision，让显式筛选退休旧display与pressed身份；不能伪造queryRevision或破坏异步流入时的冻结。 |

## 最小应用落地范围（本轮未实施）

1. 共享的source-group metadata目录：已知源、确实未分组、未知源三者分开；目录来自完整registry，保留停用源。停用不抹掉本查询已经发现的结果。
2. SearchViewState独立的sourceGroup条件（all/ungrouped/named的结构化key）、目录revision、显式filter/display revision及清理规则。组名不是稳定ID；同名“全部分组/未分组”不能与内建项混同。
3. variants级投影：组合内容/来源/分组，去重，重选组内代表，重新计组内来源数；点击详情传匹配variants。未知sourceId在全部下保留，在指定组/未分组下不得冒认。
4. 现有ReaderSearchFilterPanel接入组名行与同一native Sheet内的选择视图；复用公共header/choice/输入与空态，不另造Popup叠Popup。查找只筛目录，不访问网络。
5. 更新结果/目录缓存与原子reset、返回详情/新查询清理；针对分组切换时的可见卡片和旧按压callback做准确SDK验证。无需改变Core搜索协议、签名或schema。

## Demo最小验证计划（执行前）

仅使用本机已有HTTP预览服务与headless Chrome的Playwright，不触发任何应用门禁、HAP或HDC。默认Playwright bundled browser版本缺失时只复用已安装Chrome，不下载安装浏览器。

- 真实DOM点击分组入口、查找/单选/返回/关闭及焦点恢复；单一modal外框、背景inert。
- 精选：首本保留，代表由qimao变free，4个来源变2；详情只呈free/paper，原始fixture不变。
- 本地：清空并禁用分组；未分组排除unknown；旧藏保留已停用源的已接收结果；结构化同名内建项不冲突。
- 内容/来源/分组共同作用、空态清除、全量reset、分组消失不静默放宽。
- 320/366/390与160%文字：无横向溢出，header/查找固定、选项可滚动到末项，主要动作至少44逻辑像素；记录原始截图与运行结果，不冒充真机像素或应用实现。

## 本地预览验证结果

独立只读代码复审与实际headless Chrome检查完成。七项分组语义/模态/焦点场景先PASS；布局检查初次误取查找框内部28px输入节点作为完整触控区而FAIL，原结果保留。完整44px外层label原本会把点击转交给输入框；改为检查正确actor并真实点击padding验证focus，只补未通过的布局/查询/资源场景，前七项标为REUSED，没有重跑或改写原批次。

- 320/366/390×100%/160%六组全部PASS：无横向溢出，header/查找不随列表滚动，末项可完整滚入，关闭/返回/输入外框至少44px，键盘End/Tab可回到header。
- 分组投影、原始数据保留、详情来源、清空/重置、本地互斥、unknown、已停用源、同名sentinel、失效选择、目录查找与Escape焦点回路均有实际DOM动作回执。
- JS页面错误0，本地资源失败0；默认Playwright browser缺失后复用已安装Chrome，未下载工具或修改浏览器缓存。
- 结果与截图：`.reader-artifacts/search-source-group-demo-20261028/result.json`、`result-attempt-1.json`、`filter-initial.png`、`group-picker.png`、`selected-group-results.png`、`narrow-large-groups.png`。仅证明本地demo，App实现/SDK/真机保持NOT_RUN。
- 已请求在本聊天浏览器面板展示新入口，工具返回queued；未把queued写成已打开。

用户反馈备注过多后，demo收掉侧边说明、重复页头/页脚、普通状态帮助及“即时生效/关闭保留”等解释文字；只留单行示例标识与失效/空态的必要提示，来源详情改为简短数量/状态。仅做删文案受影响的DOM、分组/本地切换与窄屏大字检查，PASS（note-trim-result.json）；原语义回执与旧输入hash保留，不重跑App或真机。

用户反馈按钮偏大后，仅demo内容/来源选项改为32px可见face、文字自然宽度及较小行距；透明44px真实button参与排版，未用重叠的绝对触区。160%字体可自然撑高，窄屏检查无横向溢出或相邻触控重叠，点击face之外的透明padding也能选中（compact-buttons-result.json）。分组选择仍是列表，业务投影不改；未运行App构建/设备。
