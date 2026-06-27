// HostCommander — host-initiated command/response half of the Core protocol.
//
// Mirrors Android bindings/android/.../HostCommander.java. While HostBus
// answers Core's host.request events, a host app also SENDS commands to Core
// (e.g. runtime.ping, book.search) and must await the matching result/error
// event by requestId. HostCommander encapsulates that send-and-await flow.
//
// Charter §4 / §10.2: Core/Host boundary — HostCommander never opens sockets;
// it only calls ReaderCoreRuntime.sendCommand + readEvent through the C ABI
// handle. HTTP transport stays in HostTransport (delegated via HostAdapter
// when Core emits host.request back during a command's lifetime).
//
// Demultiplexing caveat (same as Android): if a HostBus/HostRuntime is driving
// the same runtime concurrently, its tick() would consume events this
// commander is waiting for. S6 production path folds both halves into
// ReaderCoreClient's single poll site (awaitResult). HostCommander is retained
// as a focused, testable building block for S7 concurrent command dispatch.
import { ReaderCoreRuntime } from '../cabi/ReaderCoreNapiBridge';

// Discriminated result type. ArkTS forbids union types, so use a single
// interface with a `kind` tag (same pattern as HostReply).
export interface CommandResult {
  kind: 'success' | 'error' | 'timeout';
  requestId: number;
  data?: object;        // set when kind === 'success'
  error?: object;       // set when kind === 'error'
}

export function commandResultSuccess(requestId: number, data: object): CommandResult {
  const r: CommandResult = { kind: 'success', requestId, data };
  return r;
}

export function commandResultError(requestId: number, error: object): CommandResult {
  const r: CommandResult = { kind: 'error', requestId, error };
  return r;
}

export function commandResultTimeout(requestId: number): CommandResult {
  const r: CommandResult = { kind: 'timeout', requestId };
  return r;
}

export class HostCommander {
  private runtime: ReaderCoreRuntime;
  private counter: number;

  constructor(runtime: ReaderCoreRuntime, firstRequestId: number = 2000) {
    this.runtime = runtime;
    this.counter = firstRequestId;
  }

  // Send a command and await its result/error event. Polls readEvent inline;
  // events for other requestIds are dropped (caller is responsible for
  // demultiplexing if a concurrent event loop is running).
  async sendAndAwait(method: string, params: Record<string, Object>, timeoutMs: number = 60000): Promise<CommandResult> {
    const requestId = this.counter;
    this.counter = requestId + 1;
    this.runtime.sendCommand(method, params, requestId);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.runtime.pendingEventCount() === 0) {
        await this.sleep(10);
        continue;
      }
      const raw = this.runtime.readEvent(0);
      if (raw === null) {
        continue;
      }
      const matched = matchEvent(requestId, raw);
      if (matched !== null) {
        return matched;
      }
      // Not our event; a host app with a concurrent loop would re-route it.
    }
    return commandResultTimeout(requestId);
  }

  nextRequestId(): number {
    return this.counter;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, ms);
    });
  }
}

// Match a raw event JSON against the expected requestId. Returns null if the
// event is malformed, for a different requestId, or not a result/error type.
function matchEvent(expectedRequestId: number, rawEvent: string): CommandResult | null {
  let parsed: Record<string, Object>;
  try {
    parsed = JSON.parse(rawEvent) as Record<string, Object>;
  } catch (_e) {
    return null;
  }
  const idValue = parsed['requestId'];
  if (typeof idValue !== 'number') {
    return null;
  }
  const requestId = idValue as number;
  if (requestId !== expectedRequestId) {
    return null;
  }
  const typeValue = parsed['type'];
  if (typeof typeValue !== 'string') {
    return null;
  }
  const type = typeValue as string;
  if (type === 'result') {
    const dataValue = parsed['data'];
    const data = (dataValue !== null && dataValue !== undefined && typeof dataValue === 'object')
      ? dataValue as object
      : ({} as Record<string, Object>);
    return commandResultSuccess(requestId, data);
  }
  if (type === 'error') {
    const errValue = parsed['error'];
    const error = (errValue !== null && errValue !== undefined && typeof errValue === 'object')
      ? errValue as object
      : ({} as Record<string, Object>);
    return commandResultError(requestId, error);
  }
  return null;
}
