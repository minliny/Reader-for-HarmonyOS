# Core full gate asynchronous host operation failure

Trigger/version: b2633fe91 official offline Core full gate, escalated (localhost sandbox excluded). Log /private/tmp/ml-proxy-core-author-final-v2.log. 2894 of 3859 tests run: 2893 passed (1 leaky), 1 failed, 965 not run after fail-fast. cache_commands::runtime_host_error_retries_the_same_chapter_then_can_succeed failed at cache_commands.rs:1314: host.error request8402 for first operation1 produced INVALID_PARAMS unknown host operationId:1 after the test had received HostRequest. Separate leak: reader-cli::fixture_vertical fixture_vertical_runs_legado_zhuishu_json_real_source_pipeline.

This record precedes repairs. Audit scope: actual Runtime pending-host registration, event delivery, request cleanup/cancel lifecycle and test synchronization; independent CLI subprocess lifecycle audit for LEAK. No HTTP/Host or device operations. A rerun pass alone will not close the recorded failure.
