# Core full gate follow-up

- Runtime production race fixed and frozen in c28f0f792: see [RUNTIME_RACE_HANDOFF.md](RUNTIME_RACE_HANDOFF.md), deterministic before failure and targeted after evidence retained.
- Independent CLI/nextest LEAK isolation: see [CLI_LEAK_HANDOFF.md](CLI_LEAK_HANDOFF.md), including exact version, 3 Reader + 1 zero-Reader reproductions, scripts, FD evidence and explicit limits. No application fix claimed for tool-level leakage.
- Parent reports c28 official full gate exit0:3860/3860 tests,210 conformance,C/C++ABI allPASS, noLEAK in that run. All source is frozen for parent Native/HAP work; no remaining background probes.
