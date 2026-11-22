# Phase 1 公开搜索重试恢复夹具

夹具复用公开本地书《Reader Phase 1 公共长目录》和查询 `公共长目录`。唯一启用的公开来源通过 Reader 常规书源导入。在线恢复结果为《Reader Phase 1 公共长目录（重试恢复）》，与刷新前保留的本地行可分别核对。来源关闭发现和 Cookie Jar，沿常规 `source.import → book.search → http.execute` 使用 JSON 规则。

一轮运行只导入一次来源。来源基址为 `<已核验的 HTTPS origin>/reader-phase1/retry-recovery/<UUIDv4>/`，搜索规则为固定相对模板 `search/retry-recovery/{{page}}.json`。同一轮的首次提交和 Task 中的「重试未完成的书源」保持同一来源定义、同一查询和同一第 1 页路径。路径不携带查询文本。 [导入模板](source.json) · [字节清单](fixture-plan.json)

| 精确路由 | 同一轮的时序 | HTTP 状态 | 正文 |
| --- | --- | --- | --- |
| `search/retry-recovery/1.json` | 首次 GET | 503 | [失败正文](responses/initial-page-1.json) |
| `search/retry-recovery/1.json` | 下一次及之后的 GET | 200 | [唯一在线行](responses/recovered-page-1.json) |
| `search/retry-recovery/2.json` | 同一轮已返回成功的第 1 页 | 200 | [确认空数组](responses/recovered-page-2.json) |

三个响应均为 `application/json; charset=utf-8`，带 `Cache-Control: no-store`。当前 Core 把真正的 503 报告为 `SOURCE_HTTP_FAILED`，把新的非空第 1 页收为 `next`，把随后正常获取的空第 2 页收为 `end`。HarmonyOS 的 HTTP 层将已拿到的 503 返回 Core，当前来源也未配置请求重试。真实失败源在显式 Retry 前无法进入自动续页。第 2 页是否实际进入，以及何时完成，仍取决于当前视口与原生回执。书籍 URL 用于形成线上结果身份，本场景范围止于恢复后的搜索结果页。

## 外部 HTTPS 接入

`createRetryRecoveryFixture({ origin, runId })` 提供每轮独立的 `sourceImport`、`respond(method, rawRequestTarget)` 和计数快照。模块会先核对所有正文和来源模板的字节数与 SHA-256。普通 Node HTTPS 适配层可以将返回的状态、响应头和 Buffer 原样交给响应对象。只有当前 UUID 下精确的 GET 路由可返回夹具正文。未知方法、查询串、错路径、其他运行和过早的第 2 页返回 `null`，由外层处理未匹配请求。

待获准在受控公开 HTTPS 上实施时，为每次采集生成新的 UUID 并只创建一个常驻状态 owner。使同一 UUID 下的请求始终到达该 owner，禁用 CDN 缓存、回源自动重试和路径重写。预检和健康检查用独立路径或已废弃的试验 UUID。普通导入后、首次提交前检查该 UUID 的三个计数仍为 0。若起点已经消费，使用新 UUID 另建一轮。保留匹配请求和 HTTP 响应的实际时间、顺序、状态与正文摘要，任何重复第 1 页也会反映在计数中。只有 Reader 的当前失败与新工作代回执及原生样本能确认实际用户流程。 [响应状态实现](fixture.mjs)

当前只提供离线字节和内存状态机。公开 HTTPS 部署、正常导入、实际 HTTP 响应和当前原生用例为 `NOT_RUN`。 [定向夹具检验](../../test/search-retry-recovery-fixture.test.mjs)
