# PH76 af406：初始化空白页误计为目标完成

2026-09-15，源码/安装包基于 `af406d49`。现有 VM 由根任务保留数据安装后执行 early；本切片未操作设备、未构建。原始结果保留在 [ph76-af406-early-native.log](ph76-af406-early-native.log)，不修改原 FAIL。

## 现象与代码定位

runToken `1789451540764-1`：初始化 `about:blank` 的 pageBegin 为 `1789451540817`，pageEnd 为 `1789451540824`，任务 start 为 `1789451540866`。真实 early.css resource/matcherStart 为 `1789451540927`，data-document pageBegin 为 `1789451540932`，matched/end 为 `1789451540933`。回调到匹配 6 ms，结果却为 `matchedBeforePageEnd=false`。

`ArkWebResourceDiagnostic.runEarly` 原来只按 FIRST_ID 取第一个 pageEnd，没有区分任务 start、初始化空白页和当前目标文档，因而取到了 42 ms 之前的空白页完成。这是已定位的探针判定错误，不是这份日志证明了生产需要等页面完成后才匹配。

生产 `ArkWebExecutor.onPageEnd` 先输出诊断事件，再对空地址和 `about:blank` 返回，早于 finalUrl、pageReadyAt 和初始化定时器设置。实际加载前还会清零 pageReadyAt。`onResourceLoad` 也排除 blank。独立子 agent 只读复核结论相同；本次无需修改这些生产路径。

## 修正与约束

- 所有空白页事件仍保留在原始诊断记录中，包括 start 前与 start 后迟到的 blank completion。
- 只在本次 FIRST_ID start 后读取资源、matcherStart、matched；三者必须请求归属正确、按事件顺序且时间不逆序。
- 页面生命周期新增 `currentDocument` 布尔值。只有当前 fixture 精确 HTML data 表示或当前生成的 base/history URL 才标为 true；不输出 URL、HTML 或凭据。
- 完成时若当前目标尚无 pageEnd，可以通过；若已有目标 pageEnd，匹配时间必须严格早于它，保留原标准。
- 未知非 blank 文档的 pageBegin/pageEnd 明确令本次判定失败，不能通过忽略无法确定身份的页面来得到 PASS。
- 额外输出 `observedTargetPageEnd`、`unexpectedDocument`、`orderedMatch`，避免只有一个布尔值掩盖证据缺失。

## 本地验证与复测条件

[修前回归](ph76-blank-lifecycle-before.log)准确失败于 `blank-before-start`。修正后 [探针回归](ph76-blank-lifecycle-after.log)全部通过，包括新增 11 个时序/身份场景：blank 在 start 前/后、真实 data/base pageEnd 提前、真实 pageEnd 在匹配后、其他 data/HTTP 文档、错误请求、缺资源、缺 matcher、匹配顺序颠倒。

[实际生产方法回归](ph76-blank-production-regression.log)原 47 组通过，并新增普通网页求值和资源匹配两种路径：真实 load 前/后 blank 均不设置 pageReadyAt/finalUrl、不运行源初始化，后续合法目标完成/资源仍可继续；任务和定时器清理正常。

根任务可按既有 HAP 流水线构建此修复并保留数据安装到同一 VM，先执行一次 early。要求返回 early.css、有本次 FIRST_ID 有序 resource/matcherStart/matched、当前文档身份无异常、严格满足目标 pageEnd 比较。通过后再执行既定 cancel：旧任务取消后，新任务返回 new.js，且新请求不得收到/匹配 old.js。当前本地回归不替代原生生命周期验证；af406 原结果保持 FAIL，新的 early 和 cancel 均待新包证据。
