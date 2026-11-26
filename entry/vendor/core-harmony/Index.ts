import readerCoreNapi from 'libreader_core_napi.so';

import {
  ReaderCoreRuntime,
  exportReaderCoreLibraryReadOnlyWithModule,
  probeReaderCoreStorageWithModule,
  readReaderCoreLibraryBackupIdentityWithModule,
  type ReaderCoreLibraryBackupIdentity,
  type ReaderCoreReadOnlyLibraryExport,
  type ReaderCoreStorageProbe,
  type JsonObject,
  type NativeReaderCoreModule,
  type ReaderCoreAssetBridge,
} from './sdk/reader_core';
import {
  assertHarmonyNapiSmokeReport,
  buildHarmonyNapiSmokeArtifact,
  buildHarmonyNapiSmokeErrorReport,
  buildHarmonyNapiSmokeReport,
  type HarmonyNapiSmokeArtifact,
  type HarmonyNapiSmokeReport,
  type HarmonyNapiSmokeResult,
} from './sdk/smoke_report';

export {
  CapabilityRouter,
  type CapabilityCancellationHandler,
  isReaderCoreTransactionPendingError,
  ReaderCoreRequestError,
  ReaderCoreRuntime,
  SOURCE_CHECK_EPHEMERAL_V1,
  SOURCE_CHECK_KEYWORD_OVERRIDE_V1,
  SOURCE_CHECK_REPORT_CLEAR_V1,
  parseReaderCoreEvent,
  type CapabilityHandler,
  type HostRequestHandler,
  type HttpFetch,
  type HttpFetchRequest,
  type JsonObject,
  type JsonValue,
  type NativeReaderCoreModule,
  type NativeRuntimeHandle,
  type ReaderCoreAssetBridge,
  type ReaderCoreCommand,
  type ReaderCoreError,
  type ReaderCoreErrorEvent,
  type ReaderCoreEvent,
  type ReaderCoreHostRequestEvent,
  type ReaderCoreLastError,
  type ReaderCoreLibraryBackupIdentity,
  type ReaderCoreReadOnlyLibraryExport,
  type ReaderCoreStorageProbe,
  type ReaderCoreResultEvent,
  type ReaderCoreTransactionKind,
  type ReaderCoreTransactionPendingDetails,
  type RequestOptions,
  type SourceCheckDebugLog,
  type SourceCheckEphemeralRunParams,
  type SourceCheckExecutionOptions,
  type SourceCheckLevel,
  type SourceCheckMode,
  type SourceCheckReport,
  type SourceCheckReportClearData,
  type SourceCheckReportClearParams,
  type SourceCheckResult,
  type SourceCheckResultData,
  type SourceCheckRunParams,
  type SourceCheckStep,
} from './sdk/reader_core';
export {
  assertHarmonyNapiSmokeReport,
  buildHarmonyNapiSmokeArtifact,
  buildHarmonyNapiSmokeErrorReport,
  buildHarmonyNapiSmokeReport,
  formatHarmonyNapiSmokeArtifact,
  formatHarmonyNapiSmokeReport,
  type HarmonyNapiSmokeArtifact,
  type HarmonyNapiSmokeError,
  type HarmonyNapiSmokeCheck,
  type HarmonyNapiSmokeCheckName,
  type HarmonyNapiSmokeReport,
  type HarmonyNapiSmokeResult,
} from './sdk/smoke_report';

const nativeReaderCore = readerCoreNapi as NativeReaderCoreModule;

export async function exportReaderCoreLibraryReadOnlyAsync(dataDirectory: string, password: string,
  isCurrent: () => boolean = () => true): Promise<ReaderCoreReadOnlyLibraryExport> {
  return exportReaderCoreLibraryReadOnlyWithModule(nativeReaderCore, dataDirectory, password, isCurrent);
}

export async function readLibraryBackupIdentityAsync(dataDirectory: string,
  isCurrent: () => boolean = () => true): Promise<ReaderCoreLibraryBackupIdentity | undefined> {
  return readReaderCoreLibraryBackupIdentityWithModule(nativeReaderCore, dataDirectory, isCurrent);
}

export async function probeReaderCoreStorageAsync(dataDirectory: string,
  isCurrent: () => boolean = () => true): Promise<ReaderCoreStorageProbe> {
  return probeReaderCoreStorageWithModule(nativeReaderCore, dataDirectory, isCurrent);
}

export function createReaderCoreRuntime(config: JsonObject = {}): ReaderCoreRuntime {
  return new ReaderCoreRuntime(nativeReaderCore, config);
}

export async function createReaderCoreRuntimeAsync(config: JsonObject = {},
  isCurrent: () => boolean = () => true): Promise<ReaderCoreRuntime> {
  return ReaderCoreRuntime.createAsync(nativeReaderCore, config, isCurrent);
}

export function readLocalEpubEntry(
  archivePath: string,
  entryPath: string,
  maxBytes: number
): Uint8Array {
  return nativeReaderCore.readEpubEntry(archivePath, entryPath, maxBytes);
}

export async function readLocalEpubEntryAsync(
  archivePath: string,
  entryPath: string,
  maxBytes: number
): Promise<Uint8Array> {
  return nativeReaderCore.readEpubEntryAsync(archivePath, entryPath, maxBytes);
}

/**
 * Encode a bounded request body with Core's shared source-charset mapping.
 * HarmonyOS owns transport bytes; Core owns the cross-platform charset truth.
 */
export function encodeSharedText(
  text: string,
  charset: string,
  maxBytes: number
): Uint8Array {
  return nativeReaderCore.encodeText(text, charset, maxBytes);
}

export async function runHarmonyNapiSmoke(
  config: JsonObject = {}
): Promise<HarmonyNapiSmokeResult> {
  const runtime = createReaderCoreRuntime(config);
  try {
    const nativeLifecycle = JSON.parse(nativeReaderCore.lifecycleSmoke(8)) as JsonObject;
    const coreInfo = await runtime.coreInfo();
    const ping = await runtime.ping();
    const hostSmoke = await runtime.hostSmoke();
    return {
      abiVersion: runtime.abiVersion,
      nativeLifecycle,
      coreInfo,
      ping,
      hostSmoke,
    };
  } finally {
    runtime.close();
  }
}

export async function captureHarmonyNapiSmokeReport(
  config: JsonObject = {}
): Promise<HarmonyNapiSmokeReport> {
  try {
    return buildHarmonyNapiSmokeReport(await runHarmonyNapiSmoke(config));
  } catch (error) {
    return buildHarmonyNapiSmokeErrorReport(error);
  }
}

export async function runHarmonyNapiSmokeReport(
  config: JsonObject = {}
): Promise<HarmonyNapiSmokeReport> {
  const report = await captureHarmonyNapiSmokeReport(config);
  assertHarmonyNapiSmokeReport(report);
  return report;
}

export async function captureHarmonyNapiSmokeArtifact(
  config: JsonObject = {}
): Promise<HarmonyNapiSmokeArtifact> {
  return buildHarmonyNapiSmokeArtifact(await captureHarmonyNapiSmokeReport(config));
}

export async function runHarmonyNapiSmokeArtifact(
  config: JsonObject = {}
): Promise<HarmonyNapiSmokeArtifact> {
  const artifact = await captureHarmonyNapiSmokeArtifact(config);
  assertHarmonyNapiSmokeReport(artifact.report);
  return artifact;
}
