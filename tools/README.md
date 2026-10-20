# Host tools and contract probes

Run these entry points with the workspace's supported Node.js runtime on macOS,
Linux, or Windows. Repository locations come from `import.meta.url`; temporary
files come from `node:os.tmpdir()`. Configure environment variables using your
shell or CI runner rather than copying a developer's absolute installation path.

```text
node tools/test-tool-environment.mjs
node tools/run-contract-tests.mjs --source
node tools/run-contract-tests.mjs --full
node scripts/check-local.mjs
```

The source tier needs Node and the dependencies declared by its selected tests.
The full tier also needs the host SDK, paired Native Core checkout and native
build tools. Every discovered test is classified in `contract-test-tiers.json`.
`READER_CONTRACT_TEST_WORKERS` selects 1–4 isolated workers. Logs and test-specific
temporary directories are retained under the operating system's temporary root.

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
resolver's `UNZIP` and `OPENSSL` settings. The historical `migrate-theme-consumers.cjs --environment-check` entry checks
its SDK dependency without applying a source migration. Python generators use UTF-8 explicitly
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
