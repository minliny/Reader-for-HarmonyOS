// Type declarations for libreader_core_napi.so — mirrors reader_napi.cpp Init()
// exports. Source of truth:
//   /Users/minliny/Documents/Reader-Core-Native/bindings/harmony/native/reader_napi.cpp
// Aligned with:
//   /Users/minliny/Documents/Reader-Core-Native/bindings/harmony/sdk/reader_core.ts
//     (NativeReaderCoreModule type)
//
// ArkTS note: handle/JSON values use ESObject (not unknown) to satisfy
// arkts-no-unknown-unknown; signatures match the local ReaderCoreNapiRaw
// interface in ../../ets/cabi/ReaderCoreNapiBridge.ets to avoid union-type
// rejections (arkts-no-union-types). The previous declaration only exposed
// abiVersion/pingSmoke/sendJsonCommand — sendJsonCommand was an early POC
// residue that never existed in the C++ module, and 9 of the real exports
// were missing, so ArkTS calls to createRuntime/sendCommand/readEvent/etc
// failed at runtime with "not a function".

// Opaque runtime handle returned by createRuntime. Treated as an external
// ESObject; pass it straight back to the native API without inspecting shape.
export type NativeRuntimeHandle = ESObject;

export const abiVersion: () => number;
export const createRuntime: (config?: object) => NativeRuntimeHandle;
export const releaseRuntime: (runtime: NativeRuntimeHandle) => void;
export const sendCommand: (runtime: NativeRuntimeHandle, command: string) => void;
export const cancelRequest: (runtime: NativeRuntimeHandle, requestId: number) => void;
export const readEvent: (runtime: NativeRuntimeHandle, timeoutMs?: number) => string | null;
export const pendingEventCount: (runtime: NativeRuntimeHandle) => number;
export const completeHostRequest: (
  runtime: NativeRuntimeHandle,
  operationId: number,
  result: object,
  requestId?: number
) => void;
export const failHostRequest: (
  runtime: NativeRuntimeHandle,
  operationId: number,
  error: object,
  requestId?: number
) => void;
export const pingSmoke: () => string;
export const hostSmoke: () => string;
export const lifecycleSmoke: (iterations?: number) => string;
