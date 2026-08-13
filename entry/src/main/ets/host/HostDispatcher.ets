// HostDispatcher — polls ReaderCoreRuntime event queue and routes host.request
// events to HostCapabilityRegistry. Completes or fails each request via the runtime.
// Phase 2 Host scheduling layer.

import {
  ReaderCoreRuntime,
  ReaderCoreHostRequestEvent,
  ReaderCoreError,
} from '../bridge/core/sdk/reader_core';
import { HostCapabilityRegistry } from './HostCapabilityRegistry';

export interface HostDispatcherConfig {
  runtime: ReaderCoreRuntime;
  registry: HostCapabilityRegistry;
  pollIntervalMs?: number;
}

export class HostDispatcher {
  private readonly runtime: ReaderCoreRuntime;
  private readonly registry: HostCapabilityRegistry;
  private readonly pollIntervalMs: number;
  private timer: number | null = null;
  private running = false;

  constructor(config: HostDispatcherConfig) {
    this.runtime = config.runtime;
    this.registry = config.registry;
    this.pollIntervalMs = config.pollIntervalMs ?? 10;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.schedulePoll();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedulePoll(): void {
    this.timer = setTimeout(() => this.pollLoop(), this.pollIntervalMs);
  }

  private pollLoop(): void {
    if (!this.running) {
      return;
    }

    try {
      const event = this.runtime.readEvent(0);
      if (event !== null && event.type === 'host.request') {
        this.handleHostRequest(event);
      }
      // 其他事件类型（result/error）忽略，不推回队列：
      // HostDispatcher 不负责 result/error 分发。
    } catch (e) {
      // 读取事件失败时继续轮询，不中断调度循环。
    }

    if (this.running) {
      this.schedulePoll();
    }
  }

  private async handleHostRequest(event: ReaderCoreHostRequestEvent): Promise<void> {
    try {
      const result = await this.registry.dispatch(event);
      this.runtime.completeHostRequest(event, result);
    } catch (error) {
      let normalized: ReaderCoreError;
      if (error instanceof Error) {
        normalized = this.normalizeError(error, event.capability);
      } else {
        // 非 Error 抛出值：使用通用 INTERNAL 错误码，不带 details。
        normalized = {
          code: 'INTERNAL',
          message: 'host request failed',
          retryable: false,
        };
      }
      this.runtime.failHostRequest(event, normalized);
    }
  }

  private normalizeError(error: Error, capability: string): ReaderCoreError {
    const message = error.message;
    // "No handler registered" → CAPABILITY_UNAVAILABLE，不可重试。
    if (message.includes('No handler registered')) {
      return {
        code: 'CAPABILITY_UNAVAILABLE',
        message: message,
        retryable: false,
      };
    }
    // 其他 Error → INTERNAL，不可重试，details 含 name 和 capability。
    return {
      code: 'INTERNAL',
      message: message,
      retryable: false,
      details: { name: error.name, capability: capability },
    };
  }
}
