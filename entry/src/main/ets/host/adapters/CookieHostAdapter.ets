// CookieHostAdapter — scoped cookie jar for Host cookie.get / cookie.set.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.4.
// Phase 5 implementation.
//
// State is backed by SourceSessionHostStore.shared(), so a CoreRuntime/adapter
// rebuild inside the same app process does not erase login/session cookies.
import {
  HostCookieGetRequest,
  HostCookieGetResponse,
  HostCookieSetRequest,
  HostCookieSetResponse,
  HostCookieEntry,
} from '../types';
import { SourceSessionHostStore } from './SourceSessionHostStore';

export class CookieHostAdapter {
  private readonly sessionStore: SourceSessionHostStore;

  constructor(sessionStore: SourceSessionHostStore = SourceSessionHostStore.shared()) {
    this.sessionStore = sessionStore;
  }

  async get(event: HostCookieGetRequest): Promise<HostCookieGetResponse> {
    const cookies = this.sessionStore.getCookies(event);
    const result: HostCookieEntry[] = [];
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i];
      const entry: HostCookieEntry = {
        name: c.name,
        value: c.value,
      };
      if (c.domain !== undefined) {
        entry.domain = c.domain;
      }
      if (c.path !== undefined) {
        entry.path = c.path;
      }
      result.push(entry);
    }
    return { cookies: result };
  }

  async set(event: HostCookieSetRequest): Promise<HostCookieSetResponse> {
    this.sessionStore.setCookie(event.cookie, event.sessionId);
    return { stored: true };
  }

  clearSession(sessionId: string): void {
    this.sessionStore.clearCookieSession(sessionId);
  }

  clearAll(): void {
    this.sessionStore.clearAllCookies();
  }
}
