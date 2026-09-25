# External grouped-directory fixture

Self-authored, no user content. Reuses `../test-reading-text-source-server.mjs` and normal Reader source import; no application test entry point or device modification.

## Start

```sh
node tools/test-reading-text-source-server.mjs 18084
```

Default bind is **127.0.0.1**. For an already authorized, known VM-to-Host network route, explicitly select the exact Host interface IP and independently set the address advertised to the VM:

```sh
node tools/test-reading-text-source-server.mjs 18084 --listen <Host-interface-IP> --base-ip <VM-reachable-Host-IP> > <fixture-request-log.jsonl>
```

`--base-ip` only changes links; it does not open an interface. `--listen` accepts explicit IPv4/IPv6 addresses. Do not use a wildcard bind unless deliberately authorized. This fixture has no authentication and serves only self-authored test data. Port `0` is available to local automated tests; the ready line reports the allocated URL.

## Normal import and interaction

1. Import `<base>/reading-directory-sources.json` using the existing source import UI. Search the fixture book, open detail, then catalog.
2. Expected canonical rows: volume 1, chapter 1, volume 2, chapter 2. Each row has a URL; `span.volume@text` yields explicit `true,false,true,false`. Core readable chapter indexes must be `[1,3]`; v2 node kinds must be `group,target,group,target`.
3. After setup, reset counters with `<base>/reset`. In Reader expand/collapse volume rows, jump among real chapters, exercise adjacent preparation/download only on this fixture book.
4. Save `<base>/export-evidence.json` and stdout JSON request lines. Both volume URL counts and `directoryVolumeRequests` must be zero during the product scenario. Real chapter counts must be positive for the body actions actually exercised. The negative-control automated test deliberately requests a volume once and then resets; do not mistake its output for VM behavior.

## Observability

- `/directory/volume/1` and `/directory/volume/2`: HTTP **409**, body `DIRECTORY_GROUP_MUST_NOT_FETCH_BODY`.
- `/directory/chapter/1` and `/directory/chapter/2`: HTTP 200, self-authored text.
- `/status` and `/export-evidence.json`: `pathCounts` keyed by HTTP method and pathname, separate volume/chapter totals, `omittedPathCount` (must be zero for evidence completeness). Counts retain at most 256 distinct keys; query strings are not retained. Stdout emits request method, pathname, source and online state.
- `/reset`: resets counters and returns to online mode; `/mode?online=0`: existing offline control.

## Gate

`READER_CORE_CLI=<current-reader-cli> node tools/test-reading-directory-fixture.mjs`

This is included automatically in `scripts/check-local.sh` (376 scripts after this addition). It needs permission to bind a temporary loopback listener. The test uses only a freshly created temporary Core data directory, removes it afterwards, and checks actual stored-source import, Core `book.toc` readability, v2 group projection, counters, HTTP negative control and reset. Existing pure offline gates do not require new permissions, but this combined gate requires local networking. No VM acceptance is inferred.
