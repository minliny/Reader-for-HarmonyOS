# Search Host local production-method performance sample

Generated 2026-09-14T14:20:09.799Z; Harmony HEAD 99cdeb02e3d80f3dd73d15d6fdd80826a8ab952b. v26.0.0, darwin/arm64, Apple M5.

Node execution of unchanged production Host ordinary methods. RPC is a pre-indexed immutable fixture JSON boundary. No native Core SQLite, SDK transport, network, ArkUI observation/layout/frames, VM/device or end-user latency is measured.

20 warmups then 120 recorded samples by default; progress events reset the same empty-source completion outside timing and publish through actual SearchQueryRun/Orchestrator methods; nearest-rank percentiles; inclusive times are nested, do not sum them. hostStagesTotal = orchestratorInclusive + pageGrouping + listNotificationConstruction. Gate residuals include JS async scheduling and instrumentation. Assertions are outside timed stages except required fixture contract guards. Background shared-workspace load/GC is uncontrolled; max/outliers retained.

Rerun: `node evidence/2026-09-14-physical-review/search-flow-implementation/search-host-performance.mjs`. Source SHA256, individual samples and operation distributions are in the adjacent JSON.

## single-metadata-delta: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0035 | 0.0065 | 0.0198 | 0.0203 |
| gatewayInclusive | 120 | 0.0112 | 0.0326 | 0.0466 | 0.0497 |
| orchestratorInclusive | 120 | 0.0152 | 0.0374 | 0.0553 | 0.0581 |
| gatewayExcludingMockRpc | 120 | 0.0077 | 0.0229 | 0.0310 | 0.0385 |
| acceptanceExcludingGateway | 120 | 0.0040 | 0.0065 | 0.0095 | 0.0101 |
| pageGrouping | 120 | 0.0035 | 0.0083 | 0.0209 | 0.0325 |
| listNotificationConstruction | 120 | 0.0010 | 0.0022 | 0.0094 | 0.0253 |
| hostStagesTotal | 120 | 0.0197 | 0.0509 | 0.0743 | 0.0963 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 1 | 1 | 1 | 1 | 1 |
| batchCalls | 1 | 1 | 1 | 1 | 1 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 1 | 1 | 1 | 1 | 1 |
| returnedBooks | 1 | 1 | 1 | 1 | 1 |
| responseBytes | 370 | 370 | 371 | 371 | 371 |
| mockIndexLookups | 1 | 1 | 1 | 1 | 1 |
| projectedBooks | 1 | 1 | 1 | 1 | 1 |
| capturedIdentities | 1 | 1 | 1 | 1 | 1 |
| deltaUpserts | 1 | 1 | 1 | 1 | 1 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 1 | 1 | 1 | 1 | 1 |
| changedGroups | 1 | 1 | 1 | 1 | 1 |
| rowUpdateCalls | 1 | 1 | 1 | 1 | 1 |
| nativeBatches | 1 | 1 | 1 | 1 | 1 |
| nativeOperations | 1 | 1 | 1 | 1 | 1 |
| nativeChange | 1 | 1 | 1 | 1 | 1 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 1 | 1 | 1 | 1 | 1 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 1 | 1 | 1 | 1 | 1 |
| orchestratorResultIndexLookups | 1 | 1 | 1 | 1 | 1 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## progress-only: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| orchestratorInclusive | 120 | 0.0005 | 0.0007 | 0.0014 | 0.0015 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0005 | 0.0007 | 0.0014 | 0.0015 |
| pageGrouping | 120 | 0.0004 | 0.0004 | 0.0009 | 0.0021 |
| listNotificationConstruction | 120 | 0.0001 | 0.0002 | 0.0002 | 0.0002 |
| hostStagesTotal | 120 | 0.0010 | 0.0013 | 0.0021 | 0.0028 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 0 | 0 | 0 | 0 | 0 |
| batchCalls | 0 | 0 | 0 | 0 | 0 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 0 | 0 | 0 | 0 | 0 |
| returnedBooks | 0 | 0 | 0 | 0 | 0 |
| responseBytes | 0 | 0 | 0 | 0 | 0 |
| mockIndexLookups | 0 | 0 | 0 | 0 | 0 |
| projectedBooks | 0 | 0 | 0 | 0 | 0 |
| capturedIdentities | 0 | 0 | 0 | 0 | 0 |
| deltaUpserts | 0 | 0 | 0 | 0 | 0 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 0 | 0 | 0 | 0 | 0 |
| changedGroups | 0 | 0 | 0 | 0 | 0 |
| rowUpdateCalls | 0 | 0 | 0 | 0 | 0 |
| nativeBatches | 0 | 0 | 0 | 0 | 0 |
| nativeOperations | 0 | 0 | 0 | 0 | 0 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 0 | 0 | 0 | 0 | 0 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 0 | 0 | 0 | 0 | 0 |
| orchestratorResultIndexLookups | 0 | 0 | 0 | 0 | 0 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## empty-source-completion: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| orchestratorInclusive | 120 | 0.2765 | 0.3962 | 0.4791 | 1.2524 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.2765 | 0.3962 | 0.4791 | 1.2524 |
| pageGrouping | 120 | 0.0003 | 0.0013 | 0.0026 | 0.0055 |
| listNotificationConstruction | 120 | 0.0002 | 0.0005 | 0.0012 | 0.0014 |
| hostStagesTotal | 120 | 0.2770 | 0.3977 | 0.4817 | 1.2535 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 0 | 0 | 0 | 0 | 0 |
| batchCalls | 0 | 0 | 0 | 0 | 0 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 0 | 0 | 0 | 0 | 0 |
| returnedBooks | 0 | 0 | 0 | 0 | 0 |
| responseBytes | 0 | 0 | 0 | 0 | 0 |
| mockIndexLookups | 0 | 0 | 0 | 0 | 0 |
| projectedBooks | 0 | 0 | 0 | 0 | 0 |
| capturedIdentities | 0 | 0 | 0 | 0 | 0 |
| deltaUpserts | 0 | 0 | 0 | 0 | 0 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 0 | 0 | 0 | 0 | 0 |
| changedGroups | 0 | 0 | 0 | 0 | 0 |
| rowUpdateCalls | 0 | 0 | 0 | 0 | 0 |
| nativeBatches | 0 | 0 | 0 | 0 | 0 |
| nativeOperations | 0 | 0 | 0 | 0 | 0 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 0 | 0 | 0 | 0 | 0 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 0 | 0 | 0 | 0 | 0 |
| orchestratorResultIndexLookups | 2000 | 2000 | 2000 | 2000 | 2000 |
| runFlattenedRows | 1000 | 1000 | 1000 | 1000 | 1000 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## single-relevance-move: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0041 | 0.0074 | 0.0116 | 0.0142 |
| gatewayInclusive | 120 | 0.0090 | 0.0170 | 0.0308 | 0.0362 |
| orchestratorInclusive | 120 | 0.0131 | 0.0242 | 0.0405 | 0.0469 |
| gatewayExcludingMockRpc | 120 | 0.0049 | 0.0097 | 0.0195 | 0.0220 |
| acceptanceExcludingGateway | 120 | 0.0041 | 0.0072 | 0.0098 | 0.0106 |
| pageGrouping | 120 | 0.0828 | 0.1192 | 0.1418 | 0.1474 |
| listNotificationConstruction | 120 | 0.3278 | 0.4058 | 0.5144 | 0.8982 |
| hostStagesTotal | 120 | 0.4262 | 0.5580 | 0.6307 | 0.9929 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 1 | 1 | 1 | 1 | 1 |
| batchCalls | 1 | 1 | 1 | 1 | 1 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 1 | 1 | 1 | 1 | 1 |
| returnedBooks | 1 | 1 | 1 | 1 | 1 |
| responseBytes | 365 | 366 | 371 | 371 | 371 |
| mockIndexLookups | 1 | 1 | 1 | 1 | 1 |
| projectedBooks | 1 | 1 | 1 | 1 | 1 |
| capturedIdentities | 1 | 1 | 1 | 1 | 1 |
| deltaUpserts | 1 | 1 | 1 | 1 | 1 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 1 | 1 | 1 | 1 | 1 |
| changedGroups | 1 | 1 | 1 | 1 | 1 |
| rowUpdateCalls | 1000 | 1000 | 1000 | 1000 | 1000 |
| nativeBatches | 1 | 1 | 1 | 1 | 1 |
| nativeOperations | 1 | 1 | 1 | 1 | 1 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 1 | 1 | 1 | 1 | 1 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 5 | 5 | 5 | 5 | 5 |
| fullGroupSortCalls | 1 | 1 | 1 | 1 | 1 |
| pageSortCalls | 2 | 2 | 2 | 2 | 2 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 1 | 1 | 1 | 1 | 1 |
| orchestratorResultIndexLookups | 1 | 1 | 1 | 1 | 1 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## single-metadata-delta: query 1000, unrelated history 9000

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0030 | 0.0034 | 0.0080 | 0.0103 |
| gatewayInclusive | 120 | 0.0066 | 0.0080 | 0.0141 | 0.0149 |
| orchestratorInclusive | 120 | 0.0102 | 0.0153 | 0.0180 | 0.0187 |
| gatewayExcludingMockRpc | 120 | 0.0037 | 0.0045 | 0.0087 | 0.0106 |
| acceptanceExcludingGateway | 120 | 0.0035 | 0.0040 | 0.0088 | 0.0089 |
| pageGrouping | 120 | 0.0030 | 0.0037 | 0.0083 | 0.0197 |
| listNotificationConstruction | 120 | 0.0006 | 0.0007 | 0.0008 | 0.0032 |
| hostStagesTotal | 120 | 0.0138 | 0.0199 | 0.0260 | 0.0318 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 1 | 1 | 1 | 1 | 1 |
| batchCalls | 1 | 1 | 1 | 1 | 1 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 1 | 1 | 1 | 1 | 1 |
| returnedBooks | 1 | 1 | 1 | 1 | 1 |
| responseBytes | 370 | 370 | 371 | 371 | 371 |
| mockIndexLookups | 1 | 1 | 1 | 1 | 1 |
| projectedBooks | 1 | 1 | 1 | 1 | 1 |
| capturedIdentities | 1 | 1 | 1 | 1 | 1 |
| deltaUpserts | 1 | 1 | 1 | 1 | 1 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 1 | 1 | 1 | 1 | 1 |
| changedGroups | 1 | 1 | 1 | 1 | 1 |
| rowUpdateCalls | 1 | 1 | 1 | 1 | 1 |
| nativeBatches | 1 | 1 | 1 | 1 | 1 |
| nativeOperations | 1 | 1 | 1 | 1 | 1 |
| nativeChange | 1 | 1 | 1 | 1 | 1 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 1 | 1 | 1 | 1 | 1 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 1 | 1 | 1 | 1 | 1 |
| orchestratorResultIndexLookups | 1 | 1 | 1 | 1 | 1 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## progress-only: query 1000, unrelated history 9000

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| orchestratorInclusive | 120 | 0.0003 | 0.0003 | 0.0003 | 0.0003 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0003 | 0.0003 | 0.0003 | 0.0003 |
| pageGrouping | 120 | 0.0003 | 0.0003 | 0.0003 | 0.0004 |
| listNotificationConstruction | 120 | 0.0001 | 0.0001 | 0.0001 | 0.0006 |
| hostStagesTotal | 120 | 0.0007 | 0.0008 | 0.0008 | 0.0012 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 0 | 0 | 0 | 0 | 0 |
| batchCalls | 0 | 0 | 0 | 0 | 0 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 0 | 0 | 0 | 0 | 0 |
| returnedBooks | 0 | 0 | 0 | 0 | 0 |
| responseBytes | 0 | 0 | 0 | 0 | 0 |
| mockIndexLookups | 0 | 0 | 0 | 0 | 0 |
| projectedBooks | 0 | 0 | 0 | 0 | 0 |
| capturedIdentities | 0 | 0 | 0 | 0 | 0 |
| deltaUpserts | 0 | 0 | 0 | 0 | 0 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 0 | 0 | 0 | 0 | 0 |
| changedGroups | 0 | 0 | 0 | 0 | 0 |
| rowUpdateCalls | 0 | 0 | 0 | 0 | 0 |
| nativeBatches | 0 | 0 | 0 | 0 | 0 |
| nativeOperations | 0 | 0 | 0 | 0 | 0 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 0 | 0 | 0 | 0 | 0 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 0 | 0 | 0 | 0 | 0 |
| orchestratorResultIndexLookups | 0 | 0 | 0 | 0 | 0 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## empty-source-completion: query 1000, unrelated history 9000

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| orchestratorInclusive | 120 | 0.2247 | 0.2415 | 0.7788 | 1.5806 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.2247 | 0.2415 | 0.7788 | 1.5806 |
| pageGrouping | 120 | 0.0004 | 0.0007 | 0.0017 | 0.0021 |
| listNotificationConstruction | 120 | 0.0001 | 0.0002 | 0.0004 | 0.0005 |
| hostStagesTotal | 120 | 0.2252 | 0.2423 | 0.7802 | 1.5818 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 0 | 0 | 0 | 0 | 0 |
| batchCalls | 0 | 0 | 0 | 0 | 0 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 0 | 0 | 0 | 0 | 0 |
| returnedBooks | 0 | 0 | 0 | 0 | 0 |
| responseBytes | 0 | 0 | 0 | 0 | 0 |
| mockIndexLookups | 0 | 0 | 0 | 0 | 0 |
| projectedBooks | 0 | 0 | 0 | 0 | 0 |
| capturedIdentities | 0 | 0 | 0 | 0 | 0 |
| deltaUpserts | 0 | 0 | 0 | 0 | 0 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 0 | 0 | 0 | 0 | 0 |
| changedGroups | 0 | 0 | 0 | 0 | 0 |
| rowUpdateCalls | 0 | 0 | 0 | 0 | 0 |
| nativeBatches | 0 | 0 | 0 | 0 | 0 |
| nativeOperations | 0 | 0 | 0 | 0 | 0 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 0 | 0 | 0 | 0 | 0 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 0 | 0 | 0 | 0 | 0 |
| orchestratorResultIndexLookups | 2000 | 2000 | 2000 | 2000 | 2000 |
| runFlattenedRows | 1000 | 1000 | 1000 | 1000 | 1000 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## single-relevance-move: query 1000, unrelated history 9000

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0037 | 0.0078 | 0.0123 | 0.0183 |
| gatewayInclusive | 120 | 0.0084 | 0.0185 | 0.0305 | 0.0366 |
| orchestratorInclusive | 120 | 0.0115 | 0.0275 | 0.0346 | 0.0444 |
| gatewayExcludingMockRpc | 120 | 0.0047 | 0.0105 | 0.0188 | 0.0260 |
| acceptanceExcludingGateway | 120 | 0.0031 | 0.0048 | 0.0096 | 0.0150 |
| pageGrouping | 120 | 0.0814 | 0.1194 | 0.8415 | 1.0567 |
| listNotificationConstruction | 120 | 0.3304 | 0.3783 | 0.4497 | 0.5987 |
| hostStagesTotal | 120 | 0.4250 | 0.5167 | 1.2088 | 1.5182 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 1 | 1 | 1 | 1 | 1 |
| batchCalls | 1 | 1 | 1 | 1 | 1 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 1 | 1 | 1 | 1 | 1 |
| returnedBooks | 1 | 1 | 1 | 1 | 1 |
| responseBytes | 365 | 366 | 371 | 371 | 371 |
| mockIndexLookups | 1 | 1 | 1 | 1 | 1 |
| projectedBooks | 1 | 1 | 1 | 1 | 1 |
| capturedIdentities | 1 | 1 | 1 | 1 | 1 |
| deltaUpserts | 1 | 1 | 1 | 1 | 1 |
| emittedPresentations | 1 | 1 | 1 | 1 | 1 |
| newGroups | 1 | 1 | 1 | 1 | 1 |
| changedGroups | 1 | 1 | 1 | 1 | 1 |
| rowUpdateCalls | 1000 | 1000 | 1000 | 1000 | 1000 |
| nativeBatches | 1 | 1 | 1 | 1 | 1 |
| nativeOperations | 1 | 1 | 1 | 1 | 1 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 1 | 1 | 1 | 1 | 1 |
| nativeReload | 0 | 0 | 0 | 0 | 0 |
| localeNormalizations | 5 | 5 | 5 | 5 | 5 |
| fullGroupSortCalls | 1 | 1 | 1 | 1 | 1 |
| pageSortCalls | 2 | 2 | 2 | 2 | 2 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 1 | 1 | 1 | 1 | 1 |
| orchestratorResultIndexLookups | 1 | 1 | 1 | 1 | 1 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 1000 | 1000 | 1000 | 1000 | 1000 |

## arbitrary-reverse-reorder: query 4000, unrelated history not applicable

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| listNotificationConstruction | 120 | 1.3053 | 1.5418 | 1.9606 | 2.0640 |

| Per-sample count / return | min | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| rpcCalls | 0 | 0 | 0 | 0 | 0 |
| batchCalls | 0 | 0 | 0 | 0 | 0 |
| relatedCalls | 0 | 0 | 0 | 0 | 0 |
| requestedIdentities | 0 | 0 | 0 | 0 | 0 |
| returnedBooks | 0 | 0 | 0 | 0 | 0 |
| responseBytes | 0 | 0 | 0 | 0 | 0 |
| mockIndexLookups | 0 | 0 | 0 | 0 | 0 |
| projectedBooks | 0 | 0 | 0 | 0 | 0 |
| capturedIdentities | 0 | 0 | 0 | 0 | 0 |
| deltaUpserts | 0 | 0 | 0 | 0 | 0 |
| emittedPresentations | 0 | 0 | 0 | 0 | 0 |
| newGroups | 0 | 0 | 0 | 0 | 0 |
| changedGroups | 0 | 0 | 0 | 0 | 0 |
| rowUpdateCalls | 4000 | 4000 | 4000 | 4000 | 4000 |
| nativeBatches | 1 | 1 | 1 | 1 | 1 |
| nativeOperations | 1 | 1 | 1 | 1 | 1 |
| nativeChange | 0 | 0 | 0 | 0 | 0 |
| nativeMove | 0 | 0 | 0 | 0 | 0 |
| nativeReload | 1 | 1 | 1 | 1 | 1 |
| localeNormalizations | 0 | 0 | 0 | 0 | 0 |
| fullGroupSortCalls | 0 | 0 | 0 | 0 | 0 |
| pageSortCalls | 0 | 0 | 0 | 0 | 0 |
| listIndexOfScannedSlots | 0 | 0 | 0 | 0 | 0 |
| listSpliceCalls | 0 | 0 | 0 | 0 | 0 |
| queryReferenceArrayCopies | 0 | 0 | 0 | 0 | 0 |
| orchestratorResultIndexLookups | 0 | 0 | 0 | 0 | 0 |
| runFlattenedRows | 0 | 0 | 0 | 0 | 0 |
| outputCount | 4000 | 4000 | 4000 | 4000 | 4000 |

## Interpretation and read-only boundary

- Increasing fixture history from 0 to 9,000 never changes the exact-identity RPC return count or projection/group update count. This proves Host consumption is bounded for these scenarios; native Core index performance is covered by the separate R5 evidence, not by the fixture Map. Timing differences between fixture sizes are not a speedup claim.
- Ordinary metadata rebuilds one group and emits one CHANGE; pure failure/counter progress reuses the run result array and rebuilds/emits none. A successful empty source goes through actual run.admit([])/publishRun: it flattens 1,000 query rows and performs 2,000 result-index lookups even though UI grouping and notification remain zero. Accepted book deltas still copy the current 1,000-reference query array once, so the complete Host publication path is not O(1).
- A single relevance change preserves ordering semantics with one group-order sort and one MOVE, without RELOAD. A 4,000-row arbitrary reversal builds one RELOAD batch and no row indexOf/splice loop. This measures preparation of the native notification, not its ArkUI consumption or scroll stability on a device.
- R3 100/200 ms is a scheduling policy, not a measured device guarantee. Existing lifecycle regression fixtures cover first publication/final-stop flush and independent failed-branch retry. R7 source uses version/key validation after layout, bounded realization retry, and touch-gated cancellation; those protections are not claimed to have been frame-profiled here.
