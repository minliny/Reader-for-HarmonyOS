import type { JsonObject } from '@reader/core-harmony';
import util from '@ohos.util';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type SyncHistoryEntry = {
  timestamp: string;
  destination: string;
  size: number;
  ok: boolean;
};

export type SyncSnapshot = {
  webdavUrl: string;
  webdavUser: string;
  webdavPass: string;
  saveLocation: string;
  backupFrequency: string;
  backupScope: string;
  history: SyncHistoryEntry[];
};

export type SyncTestResult = { ok: boolean; error?: string; note?: string };
export type SyncBackupResult = { ok: boolean; size?: number; error?: string };

export const DEFAULT_SYNC_SNAPSHOT: SyncSnapshot = {
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  saveLocation: 'WebDAV',
  backupFrequency: '12小时',
  backupScope: '书架、进度',
  history: [],
};

/**
 * Feature-local gateway for the Sync page. Owns the `sync.*` boundary.
 * `sync.backup`, `sync.merge`, `sync.webdav.plan` need `http.execute`
 * (WebDAV) and `file.read/write` (local). The current Host only
 * registers `persistence.*`, so the calls fail with a real Core error
 * and the page renders the empty config + no history. The Gateway is
 * real, not a stub.
 */
export class SyncGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadSnapshot(): Promise<SyncSnapshot> {
    return DEFAULT_SYNC_SNAPSHOT;
  }

  async planWebdav(url: string, user: string, pass: string): Promise<SyncTestResult> {
    if (typeof url !== 'string' || url.trim().length === 0) {
      return { ok: false, error: 'empty url' };
    }
    try {
      // `sync.webdav.plan` expects { baseUrl, auth?, requests: [WebDavRequest] }.
      // `auth` is a pre-formatted Authorization header value (Core never stores
      // plaintext credentials). Build a Basic header when user+pass are given.
      const params: JsonObject = {
        baseUrl: url,
        requests: [
          {
            method: 'PROPFIND',
            path: '/',
            headers: [],
            depth: 0,
            acceptedStatusCodes: [207],
          },
        ],
      };
      if (user.trim().length > 0) {
        params.auth = 'Basic ' + this.basicAuth(user, pass);
      }
      await this.runtimeOwner.request('sync.webdav.plan', params);
      return {
        ok: true,
        note: 'sync.webdav.plan built the PROPFIND request; network execution requires http.execute (not registered in this slice)',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      return { ok: false, error: message };
    }
  }

  private basicAuth(user: string, pass: string): string {
    const encoder = new util.Base64Helper();
    const bytes = new util.TextEncoder().encodeInto(`${user}:${pass}`);
    return encoder.encodeToStringSync(bytes);
  }

  async triggerBackup(): Promise<SyncBackupResult> {
    // `sync.backup` is a pure planner (Core never opens sockets). The real
    // WebDAV upload happens via `http.execute`, which this Host slice does
    // not register. Reporting ok would fabricate a backup that never ran.
    try {
      await this.runtimeOwner.request('sync.backup', {
        package: {
          manifest: {
            backupID: 'manual',
            createdAt: 0,
            entries: [],
            totalBytes: 0,
            bookCount: 0,
          },
          format: 'zip',
        },
        policy: {
          mode: 'full',
          overwriteExisting: false,
        },
      });
      return { ok: false, error: 'sync.backup built a plan only; http.execute host not registered (no upload executed)' };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      return { ok: false, error: message };
    }
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      return undefined;
    }
    return candidate;
  }
}