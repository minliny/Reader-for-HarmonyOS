// HostAdapter — routes host.request events to registered CapabilityHandler by
// capability string. Mirrors Android bindings/android/.../HostAdapter.java.
//
// Failure modes map to host.error:
//   - no handler registered → non-retryable INTERNAL
//   - handler returns HostReplyError → forwarded as-is
//   - handler throws → retryable INTERNAL (transient host failure)
import { CapabilityHandler } from './CapabilityHandler';
import { HostReply, hostReplyError } from './HostReply';

const CAPABILITY_INTERNAL = 'INTERNAL';

export class HostAdapter {
  private handlers: Map<string, CapabilityHandler> = new Map();

  register(capability: string, handler: CapabilityHandler): void {
    if (capability.length === 0) {
      throw new Error('HostAdapter.register: capability required');
    }
    if (handler === null || handler === undefined) {
      throw new Error('HostAdapter.register: handler required');
    }
    this.handlers.set(capability, handler);
  }

  isRegistered(capability: string): boolean {
    return this.handlers.has(capability);
  }

  async dispatch(capability: string, params: Record<string, Object>): Promise<HostReply> {
    const handler = this.handlers.get(capability);
    if (handler === undefined || handler === null) {
      return hostReplyError(CAPABILITY_INTERNAL, `unsupported capability: ${capability}`, false);
    }
    try {
      return await handler(params);
    } catch (e) {
      return hostReplyError(CAPABILITY_INTERNAL, `handler threw for ${capability}: ${e}`, true);
    }
  }
}
