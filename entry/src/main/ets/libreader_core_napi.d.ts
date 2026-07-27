/**
 * Type declarations for the Reader-Core NAPI native module
 * (`libreader_core_napi.so`). The shared library is built from
 * `Reader-Core-Native/bindings/harmony/native/reader_napi.cpp` and exports the
 * surface below via `NAPI_MODULE(reader_core_napi, Init)`.
 */

declare module 'libreader_core_napi.so' {
  export interface ReaderCoreLastError {
    code: number;
    message: string;
  }

  export interface ReaderCoreRuntimeHandle {
    /** Opaque handle returned by `createRuntime`. Treated as opaque by TS. */
  }

  export interface ReaderCoreHostRequestEvent {
    protocolVersion: 1;
    requestId: number;
    type: 'host.request';
    operationId: number;
    capability: string;
    params: Record<string, unknown>;
  }

  export function createRuntime(
    config?: Record<string, unknown> | string
  ): ReaderCoreRuntimeHandle;

  export function releaseRuntime(runtime: ReaderCoreRuntimeHandle): void;

  export function sendCommand(
    runtime: ReaderCoreRuntimeHandle,
    command: Record<string, unknown> | string
  ): void;

  export function cancelRequest(
    runtime: ReaderCoreRuntimeHandle,
    requestId: number
  ): void;

  export function readEvent(
    runtime: ReaderCoreRuntimeHandle,
    timeoutMs?: number
  ): string | null;

  export function pendingEventCount(
    runtime: ReaderCoreRuntimeHandle
  ): number;

  export function completeHostRequest(
    runtime: ReaderCoreRuntimeHandle,
    operationId: number,
    result: Record<string, unknown> | string,
    requestId?: number
  ): void;

  export function failHostRequest(
    runtime: ReaderCoreRuntimeHandle,
    operationId: number,
    error: Record<string, unknown> | string,
    requestId?: number
  ): void;

  export function abiVersion(): number;

  export function lastError(): ReaderCoreLastError;

  export function pingSmoke(): string;

  export function hostSmoke(): string;

  export function lifecycleSmoke(iterations?: number): string;
}
