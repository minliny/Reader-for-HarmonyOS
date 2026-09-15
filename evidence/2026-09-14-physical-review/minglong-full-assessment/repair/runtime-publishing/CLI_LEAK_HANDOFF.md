# CLI LEAK isolation handoff

No Reader source change, no commit, no Native/HAP/device operation. Repository remained clean; root has separately reported the current c28f0f792 full gate clean (3860 tests + 210 conformance + ABI). That later run does not erase this tool-level reproduction.

## Versions

- Installed cargo-nextest: 0.9.138, commit fc97e97bbe0a3927482a694247da00c099f4269e, aarch64-apple-darwin, release date 2026-06-21.
- Binary: /Users/minliny/.cargo/bin/cargo-nextest
- Binary SHA256: a06c1b4ce8995492668e0815c8a0a9f9b656db6538bfe4a36ace3e0695f82db2
- Core toolchain observed: rustc 1.97.1 (8bab26f4f, 2026-07-14), LLVM 22.1.6.
- Reader source at investigation start: b2633fe91158ce27db9ab17b8f7fa8a404c6a4d1. Do not interpret monitoring as acceptance for subsequent c28 builds.

## Original and fresh reproduction

Original: /private/tmp/ml-proxy-core-author-final-v2.log:187, fixture_vertical_runs_legado_zhuishu_json_real_source_pipeline, LEAK at 2.110s. Preserved excerpt: official-leak-excerpt.txt.

Fresh unchanged-code current monitor: 110 executions across fixture_vertical and host_replay, 3 LEAKs:
- current-nextest.log:55: fixture_vertical_runs_full_pipeline, iteration 4, 0.234s.
- current-nextest.log:115: host_record_outputs_replayable_single_step_fixture, iteration 8, 0.323s.
- current-nextest.log:141: host_replay_roundtrips_request_session_contract_fields, iteration 10, 0.265s.
- Script: monitor_current.py; raw FD snapshots: current-snapshots.jsonl (657); extracted current-cross-fd.json and current-pipe-fds.json.

Direct 40-run reader fixture exit/EOF probe: exit-pipe-before.json, probe_exit_pipes.py. Four concurrent processes, zero failures or retained output observed; maximum measured process-exit to final EOF 0.122ms. This is an exclusion probe, not proof the original LEAK never happened.

## Independent minimal reproduction: no Reader, no subprocess

no-reader/Cargo.toml and no-reader/src/lib.rs contain no dependency on Reader or any external crate. Each test only prints its name/PID and sleeps 10ms or 700ms. No subprocess creation, network, files, FD manipulation or watcher thread exists in these tests.

Same installed nextest produced 1 LEAK in 256 executions:
- no-reader-nextest.log:2176: tests::case_011, iteration 7, PID 48501, 0.227s total, test assertion/runtime itself 0.01s and passed.
- Nextest run ID: 2ad3a155-5e8a-485b-9ff6-aa1c70cbe393.
- no-reader-snapshots.jsonl retained. The 10ms original holder exited too quickly for the approximately 55ms lsof cadence to capture a same-frame cross-owner pipe pair, so no-reader-cross-fd.json is empty; do not claim it proves absence of inherited FDs.

Exact command used (from /private/tmp/ml-core-runtime-race/no-reader):

```sh
CARGO_TARGET_DIR=target/check NEXTEST_HIDE_PROGRESS_BAR=1 cargo nextest run --offline --stress-count 8 --success-output immediate --failure-output immediate-final --final-status-level fail
```

For the same run plus lsof monitoring:

```sh
python3 /private/tmp/ml-core-runtime-race/monitor_no_reader.py
```

Reproduction is intermittent; preserve failures rather than rerunning until green.

## Confirmed FD evidence and limits

In current-snapshots.jsonl, sibling tests sharing parent 35656 hold each other's output pipes at extra descriptor numbers before Reader CLI spawning:
- t=11.341179542: host_replay PID36491 stdout fd1 has peer ->0x57db0be5b8165f59; sibling fixture_vertical PID36489 owns the same writer at fd37; its CLI child PID36497 inherits fd37. Sibling+CLI still retain it at t=11.537515 after the output owner disappears from lsof samples.
- t=25.75713025 and25.811486084: host_replay PID37623 stderr fd2 has peer ->0xdaff84cbdfbaca3d; sibling fixture_vertical PID37619 owns it at fd53 and CLI PID37632 also inherits fd53. At t=25.870428334,25.935364209,25.990811709 only the sibling and CLI remain.
- There are 8 sampled cross-owner pipe pairs, not 8 separate leaks.

This proves output-FD inheritance across runner siblings and further inheritance into the CLI. The maximum last-owner to last-extra observation is196.3ms, but owner exit is only bracketed by samples; an exact >=200ms original-owner retention interval and mapping each reader PID to a test name are not established. Kernel pipe pointer names may be reused over time; compare exact PID/fd identities within the same interval only.

Success-path source audit: fixture_vertical/helper waits for the CLI process with wait_with_output, so it reaps that child and reads both of its redirected outputs to EOF; host_replay additionally joins its watchdog. CLI fixture/replay route creates Runtime threads, not external subprocesses. fixture_vertical does leave its 50ms-poll watchdog detached; that is a separate cleanup inconsistency, not a demonstrated explanation for output handles surviving process exit. No join-only patch was made, and the existing host_replay comment claiming nextest leakage from the thread alone should not be cited as established cause.

The zero-Reader minimal reproduction excludes Reader's Runtime/CLI child lifecycle as a necessary cause of this class of LEAK. The precise nextest/Rust/macOS source-line defect is still not proved. macOS non-atomic pipe + CLOEXEC setup is a strong compatible hypothesis, supported by upstream Duct's explicit global pipe/spawn-lock comments, but not asserted as the exact installed runner cause.

## Supported isolation option, not a timeout change

The official existing scripts/check-local.sh inherits NEXTEST_TEST_THREADS and passes no overriding --test-threads. nextest officially supports NEXTEST_TEST_THREADS=1, equivalent to --test-threads 1. Therefore a future full gate can use:

```sh
NEXTEST_TEST_THREADS=1 bash scripts/check-local.sh
```

This retains all tests and checks, full output capture, current leak-timeout and failure behavior; it prevents overlap between sibling test execution/spawn. It is a tool-level isolation, not a claimed permanent upstream fix. Do not blanket-close inherited FDs in Reader or raise leak-timeout.

The serial minimal-probe check already in flight when investigation was stopped completed: no-reader-serial-nextest.log,64 executions,0LEAK,251 lsof snapshots, serial-summary.json. No additional matrix was started after stop.

Official references used:
- https://nexte.st/docs/features/leaky-tests/ : detection concerns inherited stdout/stderr handles after the test process exits, not heap leaks.
- https://nexte.st/docs/configuration/env-vars/ : NEXTEST_TEST_THREADS and command-line precedence.
- https://nexte.st/rustdoc/src/duct/lib.rs : upstream Duct pipe_and_spawn_lock_guard comments explain macOS pipe/CLOEXEC race and why external caller-created pipes need their own coordination.
- https://docs.rs/nextest-runner/latest/src/nextest_runner/test_command.rs.html : observed upstream latest TestCommand delegates spawn to imp and uses tokio::process::Command for list capture. This is NOT a version-pinned installed implementation and does not establish the precise line defect in fc97e97.

No local installed nextest source tree was found. The pinned upstream source retrieval did not succeed; direct source retrieval encountered the currently stopped local proxy endpoint, while indexed source results were available. No global proxy or nextest installation was modified. Investigation ended at root's request with the evidence above and no Reader source changes.
