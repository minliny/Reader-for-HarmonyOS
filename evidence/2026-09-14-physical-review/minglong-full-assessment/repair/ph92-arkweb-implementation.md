# ArkWeb proxy / native failure handoff — frozen

Files: ArkWebExecutor.ts, ArkWebExecutionHost.ets, test-arkweb-resource-capture.mjs, test-arkweb-network-policy.mjs. Earlier PH76 files remain part of the shared working tree; no commit/build/install by this agent.

- All document addresses, including public IP literals, call prepareNetworkTarget. Store the admitted route on the job. Domain targets on direct/systemSynthetic routes pin the exact admitted DNS address; systemProxy does not pin origin DNS.
- ProxyController is the existing platform implementation (SDK API 15, global for app Webs). Only bypassSystemProxy=true inserts a DIRECT rule. Other jobs remove any override. No source-controlled proxy, PAC evaluator, authentication implementation or process network binding.
- Before loadUrl/loadData, wait for the native proxy ACK. A single proxy lease owns configuring/ready/removing/retired/failed state. Cancellation/timeout detaches the waiter; an old late apply ACK only triggers its own restore. The next job cannot mount until previous surface retirement and proxy restoration ACK. Missing ACK bounds each wait by min(5 seconds, job deadline), without retaining expired listeners. Synchronous cleanup failure fails later jobs closed. Successful job result may return while its restore ACK is pending; this ACK gates the next job.
- Immutable surface capture also protects onErrorReceive/onHttpErrorReceive. Ignore old, pre-load, about:blank, foreign-host and subresource failures. Main-frame 407 on systemProxy and SDK WebNetErrorList explicit proxy/tunnel/auth/certificate failures become NETWORK_ERROR, retryable=true, details.category=NETWORK_ENVIRONMENT, phase=transport. Generic connect/DNS/TLS failures never become proxy errors merely from route selection. Error info is matched only as a complete explicit ERR_* name, never raw URL substring.
- SDK WebNetErrorList imported from @ohos.web.netErrorList (API 12), confirmed from installed SDK declarations. TLS uses platform certificate/handshake codes or exact ERR_* reason. No raw native message/URL goes into errors. 404 and ordinary HTTP failures retain source classification.
- Preserve interactive login and HTML challenge handling for 401/403/429. Existing CHALLENGE_REQUIRED detection runs before ordinary HTTP failure. Native detach cancels a pending proxy wait immediately.

Verification:
- node tools/test-arkweb-resource-capture.mjs: 26 PH76 + 16 PH92 + 5 challenge/detach scenario groups PASS. Log /private/tmp/ph92-arkweb-resource-capture.log. Includes actual SDK-generated immutable native callback closures, numeric -130, generic connect, exact-token false-positive guard, 407/TLS/404, same URL on new job, pending ACK cancel/timeout, cleanup lost/late ACK, failed cleanup, no expired listeners, synthetic IP pin, challenge preservation.
- test-arkweb-network-policy.mjs: 3 PASS; its cancellation fixture now uses the production cancel method instead of mutating an internal flag while an unresolving DNS Promise waits.
- test-arkweb-resource-diagnostic.mjs: 12 scenario groups + SDK callback/default/policy wiring PASS.
- test-search-native-focus.mjs PASS.
- git diff --check PASS.

Not claimed: full ArkTS build/type validation, native ACK timing or OS proxy behavior on VM/physical device. Root owns official HAP pipeline and any subsequent compiler failure routing. Native API is process-wide; only other Web found is the local-file ReaderRendererPilot, not another production network Web.

Core previous delivery remains frozen: runtime.rs + host_callback_bridge.rs. reader-runtime final 411 tests PASS (/private/tmp/source-lanes-runtime-lib-final.log). Root reported final full Core 3853/3853 gate PASS after a final full rerun; the earlier CLI LEAK was not reproduced and its root cause remains unconfirmed.
