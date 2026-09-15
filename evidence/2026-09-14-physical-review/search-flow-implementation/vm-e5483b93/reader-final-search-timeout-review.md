# Final e548 two search timeout bounded review

Conclusion: current source does not support the hypothesis that hiding Search disables Host callbacks for an already dispatched Core request. No confirmed new gap from these two log entries; record them as two SDK/Core command timeouts with the unresolved cause, not as proven network failures or proven visibility deadlocks.

Observed evidence: /private/tmp/reader-proxy-vm-errors/reader-final-private.log:80 and :82 record request 154 and 156, both source identity readnovelfull.com, at 16:23:12.910 and 16:23:13.113, transport=none. The entries do not identify the request-start time, active host operation/capability, last worker phase, or whether the timeout occurred before/during/after Host execution. The display identity is a source label; it cannot establish duplicate dispatch of one immutable source instance.

Actual bounded chain:
- SearchOrchestrator.ets:675–676 passes isCurrentWork as query-liveness, and isCurrent separately as canDispatch. :728 query-liveness depends on sessionOpen/session/work, not page visibility. :490–496 visibility only pauses taking a new source; already awaited searchBySource remains active.
- SearchGateway.ts:195–197 / :356–357 passes shouldCancel = !query-liveness and canDispatch separately.
- BookAcquisitionCoordinator.ts:143 routes book.search to BookRequestScheduler. Scheduler:154–156 checks canDispatch only while the job is still queued. :160–170 removes and starts the job; RequestOptions sent to Core contain shouldCancel, timeoutMs/pollMs/hostRequest, and do not contain canDispatch. Scheduler:127–135 cancellation also excludes visibility/canDispatch. Queued hidden work therefore has no Core requestId or SDK deadline yet.
- ReaderRuntimeOwner.ts:180–197 calls the SDK after scheduler dispatch and defaults the whole Core request budget to 30,000ms.
- Vendored SDK reader_core.ts:365–378 sends and begins the deadline. :404–442 immediately routes host.request via awaitHostHandler. :522–529 invokes the handler; no Search route/canDispatch guard. Result goes to completeHostRequest, error to failHostRequest. SDK :431/:460/:501 use the same timeout text for multiple waiting stages, so that text alone cannot locate the bottleneck.
- ReaderHostRegistry.ts:205–209 routes http.execute directly to HttpExecuteHost.execute and binds cancellation by requestId, without Search visibility. Core runtime.rs:625–635 intercepts genuine JS host.complete/error through bridge.try_complete before ordinary worker routing; it has no page-visibility input.

Read-only source/log review only. No source changes, device operations, new broad timeout audit, or full tests were performed. The existing input cannot distinguish external response delay, a multi-step source command exhausting the total budget, or Core scheduling/processing delay for these two requests. No specific cause among those is claimed.
