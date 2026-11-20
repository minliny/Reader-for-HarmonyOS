# Host tools and contract probes

Run these entry points with the workspace's supported Node.js runtime on macOS,
Linux, or Windows. Repository locations come from `import.meta.url`; temporary
files come from `node:os.tmpdir()`. Configure environment variables using your
shell or CI runner rather than copying a developer's absolute installation path.

```text
node tools/gate-index.mjs --need "具体修改涉及的行为"
node tools/gate-index.mjs --id H-contract-registry#pending-admission
node scripts/check-local.mjs
```

Queries and no-argument local commands do not run tests. Execute only exact
reviewed IDs with an item-specific reason; see the workspace `GATE_INDEX.md`.
The source tier needs Node and the dependencies declared by its selected tests.
Integration consumers may need the host SDK, paired Native Core checkout and
native build tools. The legacy full directory is not a release test plan.

`tools/contract-registry.json` is the canonical reviewed metadata input.
`gate-index.json`, `contract-test-tiers.json` and `contract-case-manifest.json`
are generated descriptors, read through `lib/contract-registry.mjs`; do not
hand-maintain their former expanded arrays. `generate-contract-views.mjs --check`
only checks metadata projections and never imports tests or loads the SDK.
Reviewed `(path, SHA)` inputs and their ordered definition sets are referenced
once; storage migration does not refresh expected hashes or approve a case.

The canonical registry schema 2 owns test identity/tier/source review in `tests`,
published case qualifications/resources in `caseDefinitions`, and immutable
definition inputs in `inputs`/`inputSets`. `catalogCases` uses those test/case
references; gate IDs, filenames, case selections, focused lists and summaries
are projections. `inheritedParentFields` explicitly shares equal family facts.
Different historical hashes or review claims remain local overrides, including
unpublished claims, and cannot publish a case. Do not add a second copy of an
inherited field. `generate-contract-views.mjs --normalize-identities` upgrades
the prior canonical representation only after comparing all three complete
views; it does not inspect current test hashes or requalify an entry.

Discovered files awaiting review are explicit `pending` registrations. They are
omitted from legacy tier dispatch, rejected by exact selection, and cannot be
added to a scope. `pending` is an unresolved admission state, not a test PASS or
a claim that the new entry is unnecessary. Missing unknown files, duplicates,
and retirement conflicts still fail selection. Synthetic schema-1 fixture
metadata remains supported without a second dispatcher.
`READER_CONTRACT_TEST_WORKERS` selects 1–4 isolated workers. Logs and test-specific
temporary directories are retained under the operating system's temporary root.

Catalog qualification counts and inventory totals are derived from canonical entries.
Historical baseline counts retain their historical meaning. Optimization proposal
annotations are read only with `--include-proposals` on a lookup; that option
cannot participate in `--run`, and ordinary lookup/dispatch does not depend on
the proposal file.

`lib/ets-builder-probe.mjs` owns SDK lowering and platform recording, without
Reader business imports. Component families explicitly supply their properties,
children and Reader globals through `reader-component-probe.mjs`; page-level
Reader composition remains in `reader-control-builder-probe.mjs`. These probes
record SDK closures and property behavior, not native scheduling or rendered
pixels.

`ets-compiler-runtime.mjs` owns installed SDK loading and parse/emit; pure-module
and ordinary declaration selectors retain their own execution/dependency seams.
Ordinary method execution, Builder lowering, actual property classes and complete
App `CompileArkTS` are different evidence layers. Optional product and diagnostic
fixtures are explicit `reader-extended-product-surface-probe.mjs` and
`reader-entry-diagnostics-probe.mjs` consumers. Focused test files import them
only inside selected cases; `--list` must still work without an installed SDK.

Historical duplicates under `docs/history/worktrees` use `CONTENT_INDEX.json`
and SHA-addressed payloads. Original manifests retain provenance and source
hashes; `contentObject` identifies exact original bytes behind an inert logical
path. `node tools/history-artifacts.mjs --verify` checks only those indexed
objects/references; `--export <new directory>` reconstructs original files and
refuses to overwrite an existing destination. Neither command executes archived
code or adds it to ordinary test discovery.

## Shared environment discovery

`lib/tool-environment.mjs` is a thin consumer of the production
`scripts/lib/harmony-toolchain.mjs` resolver. Add new discovery rules there instead
of introducing a second SDK location in a probe. Explicit invalid configuration
fails with a diagnostic; it never silently selects another SDK.

| Setting | Purpose |
| --- | --- |
| `READER_HARMONY_SDK_HOME` | SDK root or its `openharmony` directory; legacy SDK aliases remain accepted by the production resolver |
| `READER_DEVECO_HOME` | DevEco installation, when automatic discovery does not apply |
| `READER_ETS_LOADER_ROOT` | Explicit ETS loader for SDK compiler probes |
| `READER_ES2ABC` | Host bytecode frontend override |
| `READER_ARKUI_PREVIEW_RUNTIME` | Host SDK library containing the real ArkUI property runtime |
| `READER_CORE_CLI` | Native CLI override; otherwise the sibling Core checkout, `CARGO_TARGET_DIR`, and host executable suffix are used |
| `READER_PLAYWRIGHT_MODULE` | Installed Playwright package directory or module-resolution anchor |
| `READER_NODE_MODULES` | Additional installed Node dependency directory |
| `READER_NPM_CLI` / `NPM_CLI_JS` | npm's JavaScript entry point; Windows runs it with Node rather than through a shell |
| `CXX` | Clang/GNU-compatible C++ compiler for host renderer mocks |
| `READER_LOCK_DIR` | Shared lock parent; the default is the OS temporary root |
| `READER_HDC_LEASE_ROOT` | Optional explicit HDC lease directory; use the same value for every participant |

SDK probes choose host frontend/runtime variants rather than assuming a macOS
binary. A missing SDK component remains a missing prerequisite. Tool-path tests
simulate host layouts; they do not establish native execution on those hosts.
ZIP and OpenSSL tools must be installed or configured with the production
resolver's `UNZIP` and `OPENSSL` settings. The retired `migrate-theme-consumers.cjs --environment-check` entry checks
its SDK dependency without applying a source migration. Other invocations reject
before SDK loading or writes. Exact mutation source is preserved as inactive
text under `docs/history/worktrees/theme-consumer-migration/`, with its SHA and
historical replay boundary. Python generators use UTF-8 explicitly
and retain their pinned upstream dependencies.

## Platform and evidence boundaries

Windows link-security tests need Developer Mode or an account permitted to create
symbolic links. POSIX FIFO cases are reported as skipped on Windows; the remaining
regular-file, link and copy checks still run. Do not replace an unavailable
security test with an unconditional pass.

Paths inside captured `evidence/`, historical fixtures, in-memory compiler input
names and HarmonyOS device paths describe their original evidence or test
contract. They are not host installation defaults. Keep captured evidence intact.

HDC probes require an explicit target and the existing device-readiness and lease
rules. Running a host test is not an authorization to connect, install, clear
application data or operate a device. Packaging and deployment continue through
the canonical HAP pipeline.

## HDC preflight (one-shot readiness check)

`reader-hdc-preflight.mjs` is a **read-only** gate that turns the 2026-10-27 /
2026-10-28 field lessons into a fixed checklist, so a device call is attempted
"right the first time". It never starts, kills, restarts, retargets, changes
ports, rewrites proxies, or retries. Every HDC call it makes still goes through
`reader-hdc-lease.mjs`. Environment-variable stripping is reported as a caveat,
never as proof that no system TUN proxy exists.

```text
node tools/reader-hdc-preflight.mjs \
  --hdc <absolute hdc path> \
  --target <exact target> \
  [--server-key 127.0.0.1:8710] [--json]
```

Order: input validation → server TCP reachability → local listener ownership →
proxy-env caveat → target/server consistency → `checkserver` → `list targets -v`
→ stale `foreground.json` advisory. Exit codes: `0` READY, `1` NEEDS_ACTION,
`2` STOP, `3` usage error. `STOP` at the TCP step means a server/address
problem, not an unauthorized phone. `Offline`/`Unknown` is reported as
NEEDS_ACTION, never as "phone denied authorization".
