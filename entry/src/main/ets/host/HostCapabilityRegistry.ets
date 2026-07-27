// HostCapabilityRegistry — capability → handler mapping for Host requests.
// Phase 2 Host scheduling layer; consumed by HostDispatcher to route host.request events.

import { HostCapability } from './types';
import { ReaderCoreHostRequestEvent, JsonObject } from '../bridge/core/sdk/reader_core';

export type HostCapabilityHandler = (
  event: ReaderCoreHostRequestEvent
) => Promise<JsonObject> | JsonObject;

export class HostCapabilityRegistry {
  private handlers = new Map<HostCapability, HostCapabilityHandler>();

  register(capability: HostCapability, handler: HostCapabilityHandler): void {
    // 验证 capability 是非空字符串，handler 是函数
    if (capability.length === 0) {
      throw new Error('capability must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('handler must be a function');
    }
    this.handlers.set(capability, handler);
  }

  unregister(capability: HostCapability): void {
    this.handlers.delete(capability);
  }

  has(capability: HostCapability): boolean {
    return this.handlers.has(capability);
  }

  get(capability: HostCapability): HostCapabilityHandler | undefined {
    return this.handlers.get(capability);
  }

  async dispatch(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const handler = this.handlers.get(event.capability as HostCapability);
    if (handler === undefined) {
      throw new Error(`No handler registered for capability: ${event.capability}`);
    }
    return handler(event);
  }

  getRegisteredCapabilities(): HostCapability[] {
    return Array.from(this.handlers.keys());
  }
}
