import * as readerCoreNapi from 'libreader_core_napi.so';

import {
  ReaderCoreRuntime,
  type JsonObject,
  type NativeReaderCoreModule,
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
  ReaderCoreRequestError,
  ReaderCoreRuntime,
  parseReaderCoreEvent,
  type CapabilityHandler,
  type HostRequestHandler,
  type HttpFetch,
  type JsonObject,
  type NativeReaderCoreModule,
  type NativeRuntimeHandle,
  type ReaderCoreCommand,
  type ReaderCoreError,
  type ReaderCoreErrorEvent,
  type ReaderCoreEvent,
  type ReaderCoreHostRequestEvent,
  type ReaderCoreLastError,
  type ReaderCoreResultEvent,
  type RequestOptions,
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

export function createReaderCoreRuntime(config: JsonObject = {}): ReaderCoreRuntime {
  return new ReaderCoreRuntime(nativeReaderCore, config);
}

export function readLocalEpubEntry(
  archivePath: string,
  entryPath: string,
  maxBytes: number
): Uint8Array {
  return nativeReaderCore.readEpubEntry(archivePath, entryPath, maxBytes);
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
