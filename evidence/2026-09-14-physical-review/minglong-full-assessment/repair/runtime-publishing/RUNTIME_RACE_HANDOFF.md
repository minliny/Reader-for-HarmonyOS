# Core Host publication race

Fixed and frozen commit: c28f0f792, parent b2633fe91. Two files only: runtime.rs and runtime integration cache_commands.rs.

Original official gate /private/tmp/ml-proxy-core-author-final-v2.log ran 2894/3859: 2893 passed (1 leaky), 1 failed, 965 not run. cache host.error request8402 for first operation1 got INVALID_PARAMS unknown host operationId:1 after receiving HostRequest. Preserved original failure is not overridden by rerun success.

Production root cause: register_host_operation_parts changes Pending to Publishing before EventSink::emit and back only after return. A Host can receive and reply during emit; another worker then claims while Publishing. Previously claim_host_operation_inner accepted Pending only and wrongly rejected this live operation. Independent ph76 code review confirmed it. This is the ordinary Host operation registry, not the JS callback bridge.

Deterministic regression: real Runtime prefetch test channel sink first sends HostRequest then blocks emit return with a Condvar. A release guard unblocks it during unwind too. publishing-before.log reproduces exact unknown1 on pre-fix code. The repair permits Pending or Publishing to be claimed atomically under active→cancelled→operations locks; Completing still rejects duplicates, cancellation wins before claim, and the existing publisher handshake changes only still-Publishing entries so it cannot revive consumed/replaced operations.

cache-after.log:14/14 cache integration checks pass, including bounded host.error retry in this fixed window and immediate host.complete success; duplicate response rejects; prior cancellation rejects late response without chapter cache write. lifecycle-after.log:3/3 existing publication/cancel/status checks pass. clippy-after.log:runtime all-targets -D warnings passes. Diff check passed.

Parent subsequently reported official c28 gate exit0:3860/3860 tests,210 conformance,C/C++ABI allPASS and noLEAK. Parent owns Native/HAP/VM evidence. Earlier attempt to build a diagnostic HAP concurrently was stopped by clean→dirty Core identity protection with no HAP published; parent recorded this as orchestration, not app failure.

The separate intermittent nextest LEAK is documented in CLI_LEAK_HANDOFF.md, with a zero-Reader reproduction and original/fresh failures retained. It was not patched or counted as production-acceptance success.
