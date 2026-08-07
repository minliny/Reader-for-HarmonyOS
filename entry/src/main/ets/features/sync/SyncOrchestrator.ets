import {
  SyncGateway,
  type SyncBackupResult,
  type SyncHistoryEntry,
  type SyncSnapshot,
  type SyncTestResult,
} from './SyncGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x5244;

/**
 * Owns the Sync page's orchestration. A plain class: WebDAV plan-test logging
 * and backup history appending. Emits typed `SyncSnapshot`s derived from the
 * latest snapshot (via `read()`); Index only forwards them. No entry-time
 * load is needed — the Sync page opens directly on the already-held snapshot.
 */
export class SyncOrchestrator {
  private gateway: SyncGateway;
  private emit: (snapshot: SyncSnapshot) => void;
  private read: () => SyncSnapshot;

  constructor(
    emit: (snapshot: SyncSnapshot) => void,
    read: () => SyncSnapshot,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new SyncGateway(owner);
    this.emit = emit;
    this.read = read;
  }

  testConnection(url: string, user: string, pass: string): void {
    this.gateway.planWebdav(url, user, pass)
      .then((outcome: SyncTestResult): void => {
        if (outcome.ok) {
          // Honest: the PROPFIND plan was built (with auth when supplied),
          // but no network executed.
          hilog.info(DOMAIN, 'Reader', '%{public}s', outcome.note ?? 'webdav plan built');
        } else {
          hilog.warn(DOMAIN, 'Reader', 'sync.webdav.plan failed: %{public}s', outcome.error);
        }
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'sync.webdav.plan error: %{public}s', error.message);
      });
  }

  triggerBackup(): void {
    this.gateway.triggerBackup()
      .then((outcome: SyncBackupResult): void => {
        if (outcome.ok) {
          const entry: SyncHistoryEntry = {
            timestamp: this.formatNow(),
            destination: this.read().saveLocation,
            size: outcome.size ?? 0,
            ok: true,
          };
          this.emit(this.withHistoryEntry(entry));
        } else {
          hilog.warn(DOMAIN, 'Reader', 'sync.backup failed: %{public}s', outcome.error);
        }
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'sync.backup error: %{public}s', error.message);
      });
  }

  private withHistoryEntry(entry: SyncHistoryEntry): SyncSnapshot {
    const current = this.read();
    return {
      webdavUrl: current.webdavUrl,
      webdavUser: current.webdavUser,
      webdavPass: current.webdavPass,
      saveLocation: current.saveLocation,
      backupFrequency: current.backupFrequency,
      backupScope: current.backupScope,
      history: [entry].concat(current.history),
    };
  }

  private formatNow(): string {
    const d = new Date();
    const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
