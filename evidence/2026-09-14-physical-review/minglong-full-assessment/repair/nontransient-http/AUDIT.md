# Native HTTP reject required-result attribution

Trigger: root final VM observed native 2300023 and 2300060. Source before repair: Core 5052ce7a68a6e5e87e91656aad2d6c5bd4b8a81f. Host previously wrapped only seven retryable platform failures; the parallel Host fix preserves all actual request.request rejects as SOURCE_HTTP_FAILED/transport, preserving retryability separately.

Current Core callback_failure_explains admits typed mandatory-result recovery only when latest actual http.execute evidence is SOURCE_HTTP_FAILED/transport/transient=true. Consequently a source JS catch after TLS/2300023/no-code transport failures can return an invalid required result and be relabeled SOURCE_RULE_FAILED, even though original typed transport evidence exists. Fix is limited to removing transient=true as attribution prerequisite; no change to retry policy, cancellation, environment mapping, independent JS errors, or later successful HTTP callbacks.

Before/after targeted production Runtime/QuickJS tests below cover TLS 2300060, 2300023, and absent code through generic JS and the actual original 66 source adapter; error code remains INTERNAL and retryable=false. All logs and probes are local, not new device evidence.

Before probe /private/tmp/reader-nontransient-http-cause/before.log: two actual Runtime+QuickJS tests fail. Both generic JS catch and original 66 catch turn non-retryable TLS into SOURCE_RULE_FAILED/retryable=true; typed cause disappears. Host agreed existing details.transient field, code=INTERNAL; no protocol enum change.

After: /private/tmp/reader-nontransient-http-cause/after.log, 2 tests / 18 production subcases PASS. Existing plus new transport controls: /private/tmp/reader-nontransient-http-cause/transport-regressions.log, 7/7 PASS. The generic JS matrix covers propagated error, caught required-result error, independent throw, successful source fallback, and later successful HTTP followed by a parse failure. All TLS/2300023/no-code required paths retain INTERNAL, retryable=false, full typed cause, and http.execute identity; no-code case omits platformCode. Original 66 uses the repository original JS file, no adapter duplication.

Commit: cfb0208f462d05588a37492cdc124c429546c65f. Files: crates/reader-runtime/src/host_callback_bridge.rs (production predicate/docs) and crates/reader-runtime/src/runtime.rs (two real Runtime/QuickJS tests). Source frozen. Root owns combined full gate and Native/HAP rebuild.
