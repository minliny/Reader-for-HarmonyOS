# Search Host local production-method performance sample

Generated 2026-09-14T14:22:18.092Z; Harmony HEAD 99cdeb02e3d80f3dd73d15d6fdd80826a8ab952b. v26.0.0, darwin/arm64, Apple M5.

Node execution of unchanged production Host ordinary methods. RPC is a pre-indexed immutable fixture JSON boundary. No native Core SQLite, SDK transport, network, ArkUI observation/layout/frames, VM/device or end-user latency is measured.

20 warmups then 120 recorded samples by default; progress events reset the same empty-source completion outside timing and publish through actual SearchQueryRun/Orchestrator methods; nearest-rank percentiles; inclusive times are nested, do not sum them. hostStagesTotal = orchestratorInclusive + pageGrouping + listNotificationConstruction. Gate residuals include JS async scheduling and instrumentation. Assertions are outside timed stages except required fixture contract guards. Background shared-workspace load/GC is uncontrolled; max/outliers retained.

Rerun: `node evidence/2026-09-14-physical-review/search-flow-implementation/search-host-performance.mjs`. Source SHA256, individual samples and operation distributions are in the adjacent JSON.

## single-metadata-delta: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0028 | 0.0033 | 0.0037 | 0.0060 |
| gatewayInclusive | 120 | 0.0093 | 0.0129 | 0.0138 | 0.0144 |
| orchestratorInclusive | 120 | 0.0124 | 0.0163 | 0.0180 | 0.0207 |
| gatewayExcludingMockRpc | 120 | 0.0063 | 0.0097 | 0.0110 | 0.0113 |
| acceptanceExcludingGateway | 120 | 0.0032 | 0.0042 | 0.0053 | 0.0101 |
| pageGrouping | 120 | 0.0026 | 0.0038 | 0.0074 | 0.0170 |
| listNotificationConstruction | 120 | 0.0009 | 0.0010 | 0.0018 | 0.0035 |
| hostStagesTotal | 120 | 0.0161 | 0.0211 | 0.0247 | 0.0305 |

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
| orchestratorInclusive | 120 | 0.0004 | 0.0005 | 0.0010 | 0.0011 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0004 | 0.0005 | 0.0010 | 0.0011 |
| pageGrouping | 120 | 0.0003 | 0.0004 | 0.0007 | 0.0015 |
| listNotificationConstruction | 120 | 0.0001 | 0.0001 | 0.0002 | 0.0002 |
| hostStagesTotal | 120 | 0.0008 | 0.0010 | 0.0015 | 0.0021 |

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
| orchestratorInclusive | 120 | 0.0005 | 0.0007 | 0.0019 | 0.0020 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0005 | 0.0007 | 0.0019 | 0.0020 |
| pageGrouping | 120 | 0.0003 | 0.0005 | 0.0014 | 0.0024 |
| listNotificationConstruction | 120 | 0.0001 | 0.0001 | 0.0012 | 0.0014 |
| hostStagesTotal | 120 | 0.0009 | 0.0020 | 0.0024 | 0.0030 |

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

## single-relevance-move: query 1000, unrelated history 0

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0039 | 0.0069 | 0.0105 | 0.0125 |
| gatewayInclusive | 120 | 0.0877 | 0.1045 | 0.1327 | 0.1334 |
| orchestratorInclusive | 120 | 0.0920 | 0.1146 | 0.1405 | 0.1432 |
| gatewayExcludingMockRpc | 120 | 0.0836 | 0.0974 | 0.1209 | 0.1285 |
| acceptanceExcludingGateway | 120 | 0.0042 | 0.0090 | 0.0156 | 0.0163 |
| pageGrouping | 120 | 0.0774 | 0.1194 | 0.1608 | 0.1612 |
| listNotificationConstruction | 120 | 0.3114 | 0.3948 | 0.6412 | 1.5311 |
| hostStagesTotal | 120 | 0.4815 | 0.6327 | 0.8325 | 1.7134 |

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
| mockRpcJson | 120 | 0.0028 | 0.0033 | 0.0102 | 0.0193 |
| gatewayInclusive | 120 | 0.0811 | 0.0885 | 0.1132 | 0.1225 |
| orchestratorInclusive | 120 | 0.0845 | 0.0928 | 0.1171 | 0.1281 |
| gatewayExcludingMockRpc | 120 | 0.0782 | 0.0857 | 0.1032 | 0.1105 |
| acceptanceExcludingGateway | 120 | 0.0033 | 0.0040 | 0.0081 | 0.0082 |
| pageGrouping | 120 | 0.0028 | 0.0038 | 0.0187 | 0.0290 |
| listNotificationConstruction | 120 | 0.0006 | 0.0009 | 0.0027 | 0.0067 |
| hostStagesTotal | 120 | 0.0879 | 0.1003 | 0.1343 | 0.1378 |

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
| orchestratorInclusive | 120 | 0.0003 | 0.0003 | 0.0003 | 0.0007 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0003 | 0.0003 | 0.0003 | 0.0007 |
| pageGrouping | 120 | 0.0003 | 0.0003 | 0.0004 | 0.0007 |
| listNotificationConstruction | 120 | 0.0001 | 0.0001 | 0.0001 | 0.0001 |
| hostStagesTotal | 120 | 0.0007 | 0.0007 | 0.0010 | 0.0012 |

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
| orchestratorInclusive | 120 | 0.0003 | 0.0004 | 0.0013 | 0.0079 |
| gatewayInclusive | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| mockRpcJson | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gatewayExcludingMockRpc | 120 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| acceptanceExcludingGateway | 120 | 0.0003 | 0.0004 | 0.0013 | 0.0079 |
| pageGrouping | 120 | 0.0002 | 0.0003 | 0.0003 | 0.0010 |
| listNotificationConstruction | 120 | 0.0001 | 0.0001 | 0.0001 | 0.0002 |
| hostStagesTotal | 120 | 0.0007 | 0.0008 | 0.0016 | 0.0090 |

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

## single-relevance-move: query 1000, unrelated history 9000

| Local stage (ms) | n | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|
| mockRpcJson | 120 | 0.0037 | 0.0068 | 0.0164 | 0.0193 |
| gatewayInclusive | 120 | 0.0088 | 0.0189 | 0.0303 | 0.0364 |
| orchestratorInclusive | 120 | 0.0120 | 0.0253 | 0.0377 | 0.0404 |
| gatewayExcludingMockRpc | 120 | 0.0050 | 0.0103 | 0.0194 | 0.0328 |
| acceptanceExcludingGateway | 120 | 0.0032 | 0.0048 | 0.0120 | 0.0125 |
| pageGrouping | 120 | 0.0784 | 0.1066 | 0.1550 | 1.1684 |
| listNotificationConstruction | 120 | 0.3301 | 0.4079 | 0.5776 | 0.9009 |
| hostStagesTotal | 120 | 0.4223 | 0.5512 | 1.0016 | 1.5677 |

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
| listNotificationConstruction | 120 | 1.3140 | 1.7299 | 1.9695 | 2.0424 |

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
- Ordinary metadata rebuilds one group and emits one CHANGE; pure failure/counter progress reuses the run result array and rebuilds/emits none. A successful empty source also goes through actual run.admit([])/publishRun: after the reviewed correction its entity revision stays unchanged, with zero flattened rows/index lookups/group rebuilds/notifications. The adjacent before-empty-fix JSON/Markdown preserve the observed former 1,000-row flatten and 2,000 index lookups under the previous source hashes. Accepted book deltas still copy the current 1,000-reference query array once, so the complete Host publication path is not O(1).
- A single relevance change preserves ordering semantics with one group-order sort and one MOVE, without RELOAD. A 4,000-row arbitrary reversal builds one RELOAD batch and no row indexOf/splice loop. This measures preparation of the native notification, not its ArkUI consumption or scroll stability on a device.
- Verified source correction: successful empty completion previously incremented SearchQueryRun.revision unconditionally; the local producer now supplies its prior bucket and invalidates only when admitted or prior entries exist. A prior nonempty bucket replaced by empty still invalidates. The targeted production worker→publication→page/list test asserts 1,000 retained rows with zero flatten/index lookup/group/notice and separately verifies real deletion. No native/device acceptance is implied.
- R3 100/200 ms is a scheduling policy, not a measured device guarantee. Existing lifecycle regression fixtures cover first publication/final-stop flush and independent failed-branch retry. R7 source uses version/key validation after layout, bounded realization retry, and touch-gated cancellation; those protections are not claimed to have been frame-profiled here.
