import {
  SyncGateway,
  type SyncBackupResult,
  type SyncHistoryEntry,
  type SyncRestoreConflict,
  type SyncRestoreResult,
  type SyncSaveResult,
  type SyncSnapshot,
  type SyncTestResult,
} from './SyncGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

/** Foreground-only WebDAV orchestration; automatic/background work is gated. */
export class SyncOrchestrator {
  private gateway: SyncGateway;
  private emit: (snapshot: SyncSnapshot) => void;
  private read: () => SyncSnapshot;
  private operationInFlight: boolean = false;

  constructor(
    emit: (snapshot: SyncSnapshot) => void,
    read: () => SyncSnapshot,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new SyncGateway(owner);
    this.emit = emit;
    this.read = read;
  }

  open(): void {
    this.gateway.loadSnapshot()
      .then((snapshot: SyncSnapshot): void => this.emit(snapshot))
      .catch((_error: Error): void => this.emit(this.withStatus('安全配置读取失败')));
  }

  saveConfig(url: string, user: string, pass: string, backupPass: string, directory: string): void {
    if (!this.beginOperation()) {
      return;
    }
    this.gateway.saveConfig(url, user, pass, backupPass, directory)
      .then((outcome: SyncSaveResult): void => {
        this.operationInFlight = false;
        if (outcome.ok && outcome.snapshot !== undefined) {
          const current = this.read();
          this.emit(this.snapshotWith(
            outcome.snapshot, current.history, outcome.snapshot.statusMessage, undefined));
        } else {
          this.emit(this.withStatus(outcome.error ?? '配置保存失败'));
        }
      })
      .catch((_error: Error): void => {
        this.operationInFlight = false;
        this.emit(this.withStatus('配置保存失败'));
      });
  }

  testConnection(url: string, user: string, pass: string, directory: string): void {
    if (!this.beginOperation()) {
      return;
    }
    this.emit(this.withStatus('正在测试 WebDAV 连接…'));
    this.gateway.testConnection(url, user, pass, directory)
      .then((outcome: SyncTestResult): void => {
        this.operationInFlight = false;
        if (outcome.ok) {
          this.emit(this.withStatus(outcome.note ?? 'WebDAV 连接成功'));
        } else {
          this.emit(this.withStatus(outcome.error ?? 'WebDAV 连接失败'));
        }
      })
      .catch((_error: Error): void => {
        this.operationInFlight = false;
        this.emit(this.withStatus('WebDAV 连接失败'));
      });
  }

  triggerBackup(): void {
    if (!this.beginOperation()) {
      return;
    }
    this.emit(this.withStatus('正在创建完整 Core 备份…'));
    this.gateway.triggerBackup()
      .then((outcome: SyncBackupResult): void => {
        this.operationInFlight = false;
        if (outcome.ok) {
          const entry: SyncHistoryEntry = {
            timestamp: this.formatNow(),
            destination: 'WebDAV',
            size: outcome.size ?? 0,
            ok: true,
          };
          this.emit(this.withHistoryEntry(entry, '备份已上传'));
        } else {
          this.emit(this.withStatus(outcome.error ?? '备份失败'));
        }
      })
      .catch((_error: Error): void => {
        this.operationInFlight = false;
        this.emit(this.withStatus('备份失败'));
      });
  }

  restoreLatest(): void {
    if (!this.beginOperation()) {
      return;
    }
    this.emit(this.withStatus('正在检查最新备份…'));
    this.gateway.restoreLatest()
      .then((outcome: SyncRestoreResult): void => {
        this.operationInFlight = false;
        this.publishRestore(outcome);
      })
      .catch((_error: Error): void => {
        this.operationInFlight = false;
        this.emit(this.withStatus('恢复失败'));
      });
  }

  resolveRestore(overwriteLocal: boolean): void {
    if (!this.beginOperation()) {
      return;
    }
    this.emit(this.withStatus(overwriteLocal ? '正在原子恢复备份…' : '已取消恢复'));
    this.gateway.resolveRestore(overwriteLocal)
      .then((outcome: SyncRestoreResult): void => {
        this.operationInFlight = false;
        this.publishRestore(outcome);
      })
      .catch((_error: Error): void => {
        this.operationInFlight = false;
        this.emit(this.withStatus('恢复失败'));
      });
  }

  private publishRestore(outcome: SyncRestoreResult): void {
    if (outcome.conflict !== undefined) {
      const current = this.read();
      this.emit(this.snapshotWith(
        current, current.history, '检测到本机与远端备份冲突，请确认', outcome.conflict));
      return;
    }
    if (outcome.ok && outcome.applied) {
      this.emit(this.withStatus('恢复已原子提交；重新进入页面后读取新状态', true));
    } else if (outcome.ok && !outcome.cancelled) {
      this.emit(this.withStatus('本机数据与最新备份一致，无需重复写入', true));
    } else if (outcome.ok && outcome.cancelled) {
      this.emit(this.withStatus('已取消恢复', true));
    } else {
      this.emit(this.withStatus(outcome.error ?? '恢复失败', true));
    }
  }

  private withHistoryEntry(entry: SyncHistoryEntry, statusMessage: string): SyncSnapshot {
    const current = this.read();
    return this.snapshotWith(current, [entry].concat(current.history), statusMessage, undefined);
  }

  private withStatus(statusMessage: string, clearConflict: boolean = false): SyncSnapshot {
    const current = this.read();
    return this.snapshotWith(
      current, current.history, statusMessage, clearConflict ? undefined : current.restoreConflict);
  }

  private snapshotWith(
    source: SyncSnapshot,
    history: SyncHistoryEntry[],
    statusMessage: string,
    restoreConflict: SyncRestoreConflict | undefined,
  ): SyncSnapshot {
    return {
      webdavUrl: source.webdavUrl,
      webdavUser: source.webdavUser,
      webdavPass: '',
      backupPass: '',
      webdavPath: source.webdavPath,
      saveLocation: source.saveLocation,
      backupFrequency: source.backupFrequency,
      backupScope: source.backupScope,
      history,
      statusMessage,
      restoreConflict,
    };
  }

  private beginOperation(): boolean {
    if (this.operationInFlight) {
      this.emit(this.withStatus('已有 WebDAV 操作正在进行'));
      return false;
    }
    this.operationInFlight = true;
    return true;
  }

  private formatNow(): string {
    const d = new Date();
    const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
