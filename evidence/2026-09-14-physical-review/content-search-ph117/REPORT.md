# PH117 正文搜索处理空间与阅读不一致

日期：2026-09-17。用户在PH116真机安装后反馈搜索页出现`text processing setting changed`，随后明确是“阅读控制栏里，搜索正文时”。最近真机run为`20260916T165029Z-5fb96de4-1d4e16c4`，signed HAP SHA `4d730cb32fcce99f1ddc2d590b311007456fdf14c6fd928a0abefa7956b2b837`；安装/启动通过不代表本项通过。

## 代码发现

- Core `remote/content_search.rs`自行按搜索快照构造处理后的正文，再调用`ensure_document_compatible`。该路径遗漏阅读`remote_content_positions::visible`已有的历史换源canonical书名恢复，也缺未入架远程书的`source_books.title`处理作用域回退；同一原文和规则可得到不同投影，错误触发`PROCESSING_CONTEXT_STALE`。
- 现有正文搜索须保留缓存本地搜索、16章分批、处理期间不持有publication/SQLite长锁、最终快照再验证和真实positionScope。不能通过删除封存校验、清空缓存、替换进度或伪造零偏移修复。
- Host实际入口是`ReadingSessionFlowGateway.searchContentPage`，直接请求`search.content`，没有套用既有远程错误适配；LRE初次搜索与加载更多都将`Error.message`直接呈现，因此英文到达界面。
- 全局搜书不直接走该路径；本次范围以用户确认的正文搜索为准。

## 修复方向与证据边界

Core复用已有ContentProcessor、阅读可见正文投影和同一历史换源只读恢复条件，补齐搜索快照中的canonical/journal/进度时钟事实及再校验。Host复用既有错误类型、原错误cause与取消语义，对真正的搜索中快照变更给出中文重新搜索提示。没有新搜索引擎、缓存或数据迁移。

最小红绿回归、相邻检查、原生库与HAP身份见下文。本轮没有占用设备或读取现场；设备具体书籍/状态未观察，代码复现与用户真机验收分别记录。

## 修前复现

Core代理以当前生产方法取得两条明确红灯：历史换源alias夹具中`chapter.content`正文读取成功，同章`search.content`失败；未入架但已有canonical detail与封存正文的远程夹具也表现相同。两者未修改任何正文处理设置，错误均为`PROCESSING_CONTEXT_STALE`。因此本次不能将英文提示解释为用户改设置。原始红灯日志由Core子任务保存并在最终记录绑定。

## Host与跳转专项

Host错误适配及真实Gateway→LRE回归已通过，见HOST_ERRORS.md（原始证据仅本地保留）。包含首批、加载更多、手动重试、已有结果/offset保留、原错误cause与明确取消、旧查询晚到隔离；相邻2000条/40页分页检查仍通过。

独立只读实际Host方法探针验证搜索结果选择→锚点→章节加载：异书源/书籍忽略、非零偏移缺scope拒跳、Core的body/processing版本与偏移原样传递、不同proof绕过旧章节窗口、同proof允许复用、零偏移无proof仍可选章首。此层只证明既有接线，Core新返回的正文/positionScope一致性由真实存储回归另证。

Host开发全量首轮在`test-reader-book-turn-event-dispatch`调用Apple工具时因缺少本机CommandLineTools环境覆盖而遇到Xcode许可选择错误，退出69，尚未进入业务断言。保留`host-preflight-environment-failure.log`；改用工作区既有`DEVELOPER_DIR`/`SDKROOT`/PATH后重跑，不更改系统许可、不修改生产或测试以绕过。

上述Host错误适配阶段的全量重跑294项PASS，见`host-preflight.log`；此记录早于随后增加的设置变更后旧搜索结果失效修复，不冒充最终源码冻结检查。最终统一HAP流程已在源码冻结后重新执行294项检查，全部PASS，见`hap-build.log`。

## 相邻失效状态

独立实际方法探针还确认：同一次打开控制栏内，从搜索切到简繁/替换，成功更改后再回搜索，旧结果未清空，加载更多会把新处理状态的结果接在旧结果后。完整关闭控制栏已有清理。修复仅在本实例成功的简繁ACK和替换成功回执时，复用既有searchGeneration/idle状态立即撤销旧结果及晚到请求，保留关键词供重搜；失败、过期ACK不清空。不新增跨页快照协议，最终专项另记。

该修复已落地LRE的3行状态发布，实际方法红绿回归通过。覆盖成功ACK、失败/旧ACK、翻页结算延期时立即失效、在途加载更多取消/晚到不能发表、保留关键词重搜从第一页开始；相关replace-host/internal-selection/replace-quick检查通过，详见HOST_ERRORS.md（原始证据仅本地保留）。

## 最终源码检查

- Core：storage完整315项PASS；runtime lib 441项PASS、1项既有性能探针ignored；实际runtime integration 640项PASS，3项与本次修改无关且当前沙箱禁止loopback的WebDAV smoke显式skip；Clippy `-D warnings` PASS。每项原始日志及9个dirty源码输入收据见`core/`，不将skip算作通过。
- 新回归对照两条修前错误、阅读与搜索body/processing版本相等、emoji/图片占位符scalar偏移、搜索前后完整存储快照不变；同书名不同source隔离、canonical/shelf/journal变化和非法clock拒绝，合法progress更新保持可搜索。
- 复用现有processor与锁外可见投影，每请求仍只建两种processor、每批16章；最终快照包含恢复所用的规范名称/换源事实。时钟只先验证合法性，再用归一元信息参与比较，正常阅读保存不会造成错误失效。
- 独立审查见INDEPENDENT_REVIEW.md（原始证据仅本地保留）。Core/Host已冻结，正式native与统一HAP如下绑定；未操作设备。

## 最终产物与独立校验

- 正式原生库构建及SDK检查51项、416断言PASS，见Core记录（原始证据仅本地保留）。Core构建、打包及Host输入SO的SHA均为`71c84f7d172a18b0d2a92be219f7a325209ba51dbcb75495013b44c70506abd5`。9个dirty源码输入在构建前后以及最终交付校验时一致。
- 官方HAP run：`20260917T005752Z-5fb96de4-4643d531`；不可变manifest（原始证据仅本地保留）。源码指纹`4643d5313baaefc862666d0a37b3f72374bd0a1b3b6f3d89ec80d63130491913`；294项Harmony检查、隔离非增量ArkTS编译/打包/签名PASS。
- signed HAP SHA：`37abad8dfc2fd46afe71bce605e92678ba154352f83ce030ba2b051384905b91`。debug签名已验证；包内裁剪SO SHA：`8510666f3586adf09a8b59f6d315c42560f6b45cbad90a7ae1851abdf62134d0`，已从上述原始SO可复现裁剪并逐字节匹配。
- 2026-09-17 09:00:24北京时间完成独立manifest verify和Core→Host→HAP溯源校验，全部PASS。见最终校验收据（原始证据仅本地保留）、`hap-verify.log`、`iteration-provenance.json`及`iteration-provenance.log`。
- 本包为`iteration`，`acceptanceEligible=false`；保留两个仓库已有dirty改动。本轮未安装/启动/抓取真机或VM，真机仍是此前PH116安装包。本项代码与本地回归完成，真机正文搜索及用户验收仍OPEN，不据构建结果关闭设备层问题。
