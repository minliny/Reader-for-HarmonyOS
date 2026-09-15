# 《鸣龙》正文准入补查与修复交接

Core 生产提交：90573a0f5。Host 提交：faefce1d。两边 owned 源码均已冻结。

## 已确认的遗漏与修前证据

- `reader-content::finalize_book_source_content` 原仍使用 Optional JS bridge 和普通文本输出：replaceRegex catch 返回对象/嵌套数组成为 JSON 正文，throw 折成空串，null 成为字符串。V1 `source.rules.chapter` DSL 字符串及 raw fallback 也绕过 Chapter 类型准入。
- `results.jsonl` 是当前生产库调用的修前结果；`host-before.jsonl` 将其送到实际 Host 分类，证明对象包装最终标 readable。
- 原 `classifyChapterBody` 对超过300字符无条件放行，432字符的既有认证探针和完整 API 错误句都判 readable。`host-test-before.log` 与 `finalization-before.log` 保留对应正式回归红灯。
- 图片存在时 Gateway 曾直接 readable，跳过认证文字检查。

## 最终修复

- 整章替换、其 JS 模板、V1 DSL 字符串、raw fallback 全部复用已有 Chapter 读取模式；最终仅字符串/扁平字符串数组，保留结构化中间结果；必要异常不吞。正常 regex、第一响应/章节变量、图片与合法字面代码保持。
- Core 新正文format3标识完整准入版本。旧format1/2普通读仍只读，升级只在显式刷新执行；存量缓存和位置不批量修改。
- 长提示仅在全部短句符合已有访问提示前缀时分类；不因小说某处提及登录/VIP而误拒。完整已复现API错误句作限定诊断识别，不做任意JSON/反斜杠/关键词清洗。纯图片及普通短配文保留，认证/验证码图片不能绕过文字准入。
- 正常旧缓存仍可离线阅读，携带cacheRefreshRequired并穿过窗口复制；每阅读会话最多提示一次“旧缓存待验证”，不发布新的候选readable证明。
- 缓存已有明确拒绝证据时，返回非源故障的RemoteChapterCacheRefreshError，不惩罚书源、不自动换源/重取。Index/LRE提供明确“刷新本章”入口；只有用户点击后forceRefresh并传原位置证明。取消不发刷新；导航/选择过期不提交；无法安全迁移时保留原文和位置并反馈。

## 验证

- reader-content 全量403通过：content-all.log。
- runtime 必要准入2项通过：runtime-required.log，包含替换错误不覆盖缓存。
- runtime format2_4项通过：runtime-format.log，其中旧format1与2都走只读→显式升级→当前缓存命中，原位置保留矩阵继续通过。
- reader-content/reader-runtime all-targets clippy通过：core-clippy.log。
- Host11个工具回归全部通过：test-remote-content-admission、test-remote-position-reader、test-bookshelf-reading-entry、test-demo-async-recovery、test-search-trial-reading-return、test-remote-reading-evidence、test-reader-control-internal-selection、test-reader-source-failure-p0、test-remote-position-migration、test-remote-reading-flow-runtime、test-search-candidate-acquisition（对应.mjs.log）。
- Gateway实际方法证明旧缓存离线可用且不发布新准入证明、坏cache不记源错、显式刷新带proof；实际LRE与Index方法证明一次提示、接受/拒绝、陈旧生命周期、保护失败反馈。
- Core格式3导致旧黄金回包期望过时，ph76 agent已用官方流程单独提交e4cd32851；该agent负责其证据。不是生产回归失败被掩盖。

## 保留边界

未抓取本次真机逐源原始响应、未连接设备、未执行Native/HAP/VM。上述是代码与受控生产回归；不能宣称线上所有源可用或用户验收通过。
普通JS显式返回字符串依然按文本处理，不仅凭JSON外观猜其不是合法代码；已确认66完整原规则仍由精确适配验证data.content。旧字面JSON缓存不自动清洗，仅标记缺少新准入证明并保留阅读能力。

## HAP compilation follow-up

Harmony `90bcfc78` fixes Index cache-refresh admission calling `openReading` without the required argument. The failure is recorded in `/private/tmp/ml-proxy-hap-complete.log`; a production-method regression reproduced an empty argument list before repair (`index-refresh-argument-before.log`). The corrected continuation resolves an exact source/book shelf snapshot or shelf projection; persisted progress passes explicit undefined to retain Core offset restoration, and a new book passes the admitted chapter index. Three production Index continuation cases plus the existing position suite pass (`index-refresh-argument-after.log`, `index-refresh-position-final.log`). Only Index and its bookshelf-entry regression changed; source is frozen for HAP rebuild.
