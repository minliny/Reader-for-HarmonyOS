// HostBus — handles host.request events emitted by Core and replies via
// host.complete / host.error.
//
// Mirrors Android bindings/android/.../HostBus.java in responsibility, but the
// polling loop lives in HostRuntime (single poll site that demultiplexes every
// Core event by type). HostBus owns only the host.request half:
//   - parse the raw event JSON
//   - dispatch params to HostAdapter by capability
//   - encode the HostReply as host.complete (ok) or host.error (failure) via
//     ReaderCoreRuntime.completeHostRequest / failHostRequest
//
// Per charter §4 / §10.2: Core/Host boundary — HostBus never opens sockets; it
// only routes host.request to HostAdapter (which delegates to HostTransport)
// and writes the reply back through the C ABI runtime handle.
import { ReaderCoreRuntime } from '../cabi/ReaderCoreNapiBridge';
import { HostAdapter } from './HostAdapter';
import { HostReply } from './HostReply';
import { replyResultObject, replyErrorObject } from './HostReplyCodec';

interface HostRequestEvent {
  capability: string | null;
  operationId: number | null;
  params: Record<string, Object> | null;
}

export class HostBus {
  private runtime: ReaderCoreRuntime;
  private adapter: HostAdapter;

  constructor(runtime: ReaderCoreRuntime, adapter: HostAdapter) {
    this.runtime = runtime;
    this.adapter = adapter;
  }

  // Handle a single host.request event. Returns when the reply has been sent
  // (or the event was malformed and dropped). Never throws — the caller
  // (HostRuntime.tick) relies on this to keep the poll loop alive.
  async handleHostRequest(rawEvent: string): Promise<void> {
    const parsed = parseHostRequest(rawEvent);
    if (parsed === null) {
      return; // malformed event, drop
    }
    if (parsed.capability === null || parsed.operationId === null) {
      return; // missing required fields, drop
    }
    const params = (parsed.params ?? ({} as Record<string, Object>)) as Record<string, Object>;
    let reply: HostReply;
    try {
      reply = await this.adapter.dispatch(parsed.capability, params);
    } catch (e) {
      // HostAdapter.dispatch already catches handler exceptions, but defend
      // against unexpected errors in the dispatch path itself.
      reply = {
        ok: false,
        code: 'INTERNAL',
        message: `HostBus dispatch threw for ${parsed.capability}: ${e}`,
        retryable: true
      } as HostReply;
    }
    if (reply.ok) {
      const result = replyResultObject(reply);
      this.runtime.completeHostRequest(parsed.operationId, result);
    } else {
      const errorObj = replyErrorObject(reply);
      this.runtime.failHostRequest(parsed.operationId, errorObj);
    }
  }
}

function parseHostRequest(rawEvent: string): HostRequestEvent | null {
  let parsed: Record<string, Object>;
  try {
    parsed = JSON.parse(rawEvent) as Record<string, Object>;
  } catch (_e) {
    return null;
  }
  const typeValue = parsed['type'];
  if (typeof typeValue !== 'string') {
    return null;
  }
  const type = typeValue as string;
  if (type !== 'host.request') {
    return null;
  }
  const capabilityValue = parsed['capability'];
  const operationIdValue = parsed['operationId'];
  const paramsValue = parsed['params'];
  const event: HostRequestEvent = {
    capability: typeof capabilityValue === 'string' ? (capabilityValue as string) : null,
    operationId: typeof operationIdValue === 'number' ? (operationIdValue as number) : null,
    params: (paramsValue !== null && paramsValue !== undefined && typeof paramsValue === 'object')
      ? paramsValue as Record<string, Object>
      : null
  };
  return event;
}
