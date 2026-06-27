// HostRuntime — event-loop-based host runtime: owns a single poll site that
// demultiplexes every Core event.
//
// Mirrors Android bindings/android/.../HostRuntime.java (the unified facade
// that resolves the demultiplexing caveat). One poll site routes every event
// by `type`:
//   - host.request -> HostAdapter.dispatch -> reply via completeHostRequest /
//     failHostRequest (the host.request half, inlined here — see note below).
//   - result / error -> complete the matching pending waiter from awaitResult
//     (the host-command half).
//
// NOTE on S6 wiring: the S6 production path uses ReaderCoreClient's inline
// polling (api/ReaderCoreClient.ets) rather than this event-loop runtime, to
// keep S6 serial and avoid any readEvent race. HostRuntime is retained as a
// functional S7-ready module: S7 will switch ReaderCoreClient to delegate to
// HostRuntime (single poll site + pending-waiters Map) for concurrent business
// requests. It compiles standalone and is exercised by host-adapter unit tests.
//
// The host.request handling (parse -> dispatch -> reply) is inlined here
// rather than factored into HostBus.ets, because HostBus.ets is a placeholder
// in the S6 wiring (its logic lives in ReaderCoreClient.awaitResult for the
// production path). Inlining keeps HostRuntime self-contained.

import { ReaderCoreRuntime } from '../cabi/ReaderCoreNapiBridge';
import { HostAdapter } from './HostAdapter';
import { HostTransport } from './HostTransport';
import { makeHttpExecuteHandler } from './HttpExecuteHandler';
import { HostReply } from './HostReply';
import { replyResultObject, replyErrorObject } from './HostReplyCodec';

interface PendingWaiter {
  requestId: number;
  resolve: (data: object) => void;
  reject: (error: Error) => void;
  timerId: number;
}

const HOST_RESPONSE_REQUEST_ID_BASE = 9000000000000;

export class HostRuntime {
  private runtime: ReaderCoreRuntime;
  private adapter: HostAdapter;
  private pending: Map<number, PendingWaiter> = new Map<number, PendingWaiter>();
  private nextHostResponseRequestId: number = HOST_RESPONSE_REQUEST_ID_BASE;
  private loopRunning: boolean = false;
  private loopTimerId: number = -1;
  private pollMs: number = 50;

  constructor(runtime: ReaderCoreRuntime, transport: HostTransport) {
    this.runtime = runtime;
    this.adapter = new HostAdapter();
    this.adapter.register('http.execute', makeHttpExecuteHandler(transport));
  }

  get coreRuntime(): ReaderCoreRuntime {
    return this.runtime;
  }

  get hostAdapter(): HostAdapter {
    return this.adapter;
  }

  // Start a polling event loop. Polls every pollMs for Core events.
  startEventLoop(pollMs: number = 50): void {
    if (this.loopRunning) { return; }
    this.pollMs = pollMs;
    this.loopRunning = true;
    this.scheduleTick();
  }

  private scheduleTick(): void {
    if (!this.loopRunning) { return; }
    this.loopTimerId = setTimeout(() => {
      this.tick();
    }, this.pollMs) as unknown as number;
  }

  private tick(): void {
    if (!this.loopRunning) { return; }
    try {
      this.pollOnce();
    } catch (_e) {
      // loop must not die on a single tick failure
    }
    this.scheduleTick();
  }

  // Drain all pending events without blocking, routing each by type.
  private pollOnce(): void {
    while (this.runtime.pendingEventCount() > 0) {
      const raw = this.runtime.readEvent(0);
      if (raw === null) { break; }
      this.routeEvent(raw);
    }
  }

  private routeEvent(raw: string): void {
    let parsed: Record<string, Object>;
    try {
      parsed = JSON.parse(raw) as Record<string, Object>;
    } catch (_e) {
      return;
    }
    const type = parsed['type'];
    if (type === 'host.request') {
      // Inline the HostBus logic (parse -> dispatch -> reply) so HostRuntime
      // is self-contained. Fire-and-forget; replies go via the NAPI dedicated
      // completeHostRequest / failHostRequest functions.
      this.handleHostRequest(parsed).catch((_e: Error) => {
        // best-effort; a single handler failure must not kill the loop
      });
      return;
    }
    if (type === 'result' || type === 'error') {
      const requestIdVal = parsed['requestId'];
      if (typeof requestIdVal !== 'number') { return; }
      const requestId = requestIdVal as number;
      const waiter = this.pending.get(requestId);
      if (waiter === undefined) { return; }
      clearTimeout(waiter.timerId as unknown as number);
      this.pending.delete(requestId);
      if (type === 'result') {
        const data = parsed['data'];
        waiter.resolve(data !== undefined && data !== null ? (data as object) : ({} as Record<string, Object>));
      } else {
        const errVal = parsed['error'];
        const errObj = (errVal ?? ({} as Record<string, Object>)) as Record<string, Object>;
        const code = (errObj['code'] ?? 'UNKNOWN') as string;
        const message = (errObj['message'] ?? '') as string;
        waiter.reject(new Error(`Core error: ${code} — ${message}`));
      }
    }
  }

  // Inlined host.request handler (the HostBus.handleHostRequest logic).
  private async handleHostRequest(parsed: Record<string, Object>): Promise<void> {
    const capability = parsed['capability'];
    const operationId = parsed['operationId'];
    const params = parsed['params'];
    if (typeof capability !== 'string' || typeof operationId !== 'number') {
      return;
    }
    const reply: HostReply = await this.adapter.dispatch(
      capability as string,
      (params ?? ({} as Record<string, Object>)) as Record<string, Object>
    );
    const hostResponseRequestId = this.nextHostResponseRequestId++;
    if (reply.ok) {
      this.runtime.completeHostRequest(
        operationId as number,
        replyResultObject(reply),
        hostResponseRequestId
      );
    } else {
      this.runtime.failHostRequest(
        operationId as number,
        replyErrorObject(reply),
        hostResponseRequestId
      );
    }
  }

  // Send a JSON command to Core (no wait).
  sendCommand(method: string, params: object, requestId: number): void {
    this.runtime.sendCommand(method, params, requestId);
  }

  // Register a waiter for the given requestId. The poll loop resolves/rejects
  // it when the matching result/error event arrives. Caller MUST call this
  // synchronously after sendCommand (before any setTimeout tick) so the waiter
  // is in place before the result can be polled.
  awaitResult(requestId: number, timeoutMs: number = 60000): Promise<object> {
    return new Promise<object>((resolve: (data: object) => void, reject: (error: Error) => void) => {
      const timerId = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout waiting for Core response (requestId=${requestId})`));
      }, timeoutMs) as unknown as number;

      const waiter: PendingWaiter = {
        requestId: requestId,
        resolve: resolve,
        reject: reject,
        timerId: timerId
      };
      this.pending.set(requestId, waiter);
    });
  }

  stopEventLoop(): void {
    this.loopRunning = false;
    if (this.loopTimerId !== -1) {
      clearTimeout(this.loopTimerId as unknown as number);
      this.loopTimerId = -1;
    }
  }

  close(): void {
    this.stopEventLoop();
    // Fail any pending waiters promptly so blocked callers do not wait for timeout.
    const snapshot: PendingWaiter[] = new Array<PendingWaiter>();
    this.pending.forEach((w: PendingWaiter) => { snapshot.push(w); });
    this.pending.clear();
    for (let i = 0; i < snapshot.length; i++) {
      const w = snapshot[i];
      clearTimeout(w.timerId as unknown as number);
      w.reject(new Error('HostRuntime closed'));
    }
    this.runtime.release();
  }
}
