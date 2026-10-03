import common from '@ohos.app.ability.common';
import { wantAgent } from '@kit.AbilityKit';
import { backgroundTaskManager } from '@kit.BackgroundTasksKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ReaderTtsBackgroundSessionBridge } from './HarmonyTtsHostRouter';

const LOG_DOMAIN = 0x5244;
const TTS_BACKGROUND_REQUEST_CODE = 5244;

export type ReaderTtsBackgroundCapabilityPhase = 'idle' | 'requesting' | 'admitted' | 'unavailable' |
  'denied' | 'unverified' | 'revoked' | 'releasing' | 'released' | 'release-failed';
export interface ReaderTtsBackgroundCapability {
  phase: ReaderTtsBackgroundCapabilityPhase;
  taskId: number | undefined;
  reason: string;
}

/** The native task ID is owned here. Request/ACK/retirement and revocation are
 * separate facts; a failed stop never becomes a successful release. */
export class HarmonyTtsBackgroundSession implements ReaderTtsBackgroundSessionBridge {
  private readonly context: common.UIAbilityContext;
  private static retiring: HarmonyTtsBackgroundSession[] = [];
  private operationTail: Promise<void> = Promise.resolve();
  private active: boolean = false;
  private closed: boolean = false;
  private generation: number = 0;
  private taskId: number | undefined = undefined;
  private unverifiedTask: boolean = false;
  private phase: ReaderTtsBackgroundCapabilityPhase = 'idle';
  private reason: string = '';
  private observing: boolean = false;
  private pendingCancelled: number[] = [];
  private pendingCancelOverflow: boolean = false;
  private revoked: (() => void) | undefined = undefined;
  private readonly onCancelled = (info: backgroundTaskManager.ContinuousTaskCancelInfo): void => {
    if (info.id !== this.taskId) {
      if (this.phase === 'requesting' && this.pendingCancelled.indexOf(info.id) < 0) {
        if (this.pendingCancelled.length < 16) this.pendingCancelled.push(info.id);
        else this.pendingCancelOverflow = true;
      }
      return;
    }
    const external = this.active && !this.closed && this.phase === 'admitted';
    this.taskId = undefined;
    this.active = false;
    if (this.phase !== 'releasing') {
      this.generation += 1;
      this.phase = 'revoked';
      this.reason = `native-cancel:${info.reason}`;
      if (external) this.revoked?.();
    }
  };

  constructor(context: common.UIAbilityContext) { this.context = context; }
  setRevocationListener(listener: (() => void) | undefined): void { if (!this.closed) this.revoked = listener; }
  capability(): ReaderTtsBackgroundCapability { return { phase: this.phase, taskId: this.taskId, reason: this.reason }; }

  async activate(): Promise<boolean> {
    const generation = this.generation;
    let admitted = false;
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.closed || generation !== this.generation) return;
      if (this.active) { admitted = true; return; }
      if (this.unverifiedTask) return;
      if (this.taskId !== undefined) {
        try { await this.stopOwnedTask(); } catch (_) { return; }
        if (this.closed || generation !== this.generation) return;
      }
      try {
        // Preserve exact native task ownership across RuntimeOwner replacement.
        for (const previous of HarmonyTtsBackgroundSession.retiring.slice()) await previous.close();
      } catch (error) {
        this.phase = 'denied'; this.reason = `prior-retirement:${(error as Error).message}`; return;
      }
      if (this.closed || generation !== this.generation) return;
      if (!canIUse('SystemCapability.ResourceSchedule.BackgroundTaskManager.ContinuousTask')) {
        this.phase = 'unavailable'; this.reason = 'continuous-task-unavailable'; return;
      }
      try {
        if (!this.observing) {
          backgroundTaskManager.on('continuousTaskCancel', this.onCancelled);
          this.observing = true;
        }
        this.phase = 'requesting'; this.reason = ''; this.pendingCancelled = []; this.pendingCancelOverflow = false;
        const agent = await wantAgent.getWantAgent({
          wants: [{ bundleName: this.context.abilityInfo.bundleName, abilityName: this.context.abilityInfo.name }],
          actionType: wantAgent.OperationType.START_ABILITY, requestCode: TTS_BACKGROUND_REQUEST_CODE,
          actionFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG],
        });
        if (this.closed || generation !== this.generation) return;
        // The normal SDK ACK provides its ID. A before/after native readback
        // can identify a missing-ID ACK without stopping somebody else's task.
        let before: number[] | undefined = undefined;
        try { before = (await backgroundTaskManager.getAllContinuousTasks(this.context)).map((item): number => item.continuousTaskId); }
        catch (_) { /* The ID-bearing start ACK remains authoritative. */ }
        if (this.closed || generation !== this.generation) return;
        // Once dispatched, a rejected/lost ACK cannot prove that no native task exists.
        this.unverifiedTask = true;
        const receipt = await backgroundTaskManager.startBackgroundRunning(this.context, ['audioPlayback'], agent);
        let id = receipt.continuousTaskId;
        if (id === undefined) this.unverifiedTask = true;
        if (id === undefined && before !== undefined) {
          const current = await backgroundTaskManager.getAllContinuousTasks(this.context);
          const candidates = current.filter((item): boolean => before!.indexOf(item.continuousTaskId) < 0 &&
            item.abilityName === this.context.abilityInfo.name && !item.isFromWebView && item.backgroundModes.indexOf('audioPlayback') >= 0);
          if (candidates.length === 1) id = candidates[0].continuousTaskId;
        }
        if (id === undefined || !Number.isFinite(id) || id < 0) {
          this.unverifiedTask = true; this.phase = 'unverified'; this.reason = 'native-task-identity-unverified'; return;
        }
        this.unverifiedTask = false;
        this.taskId = id;
        if (this.pendingCancelled.indexOf(id) >= 0) {
          this.taskId = undefined; this.phase = 'revoked'; this.reason = 'native-cancel-before-ack'; return;
        }
        if (this.pendingCancelOverflow) {
          try {
            const observed = await backgroundTaskManager.getAllContinuousTasks(this.context);
            if (!observed.some((item): boolean => item.continuousTaskId === id)) {
              this.taskId = undefined; this.phase = 'revoked'; this.reason = 'native-task-not-active'; return;
            }
          } catch (_) { await this.stopOwnedTask(); return; }
          if (this.taskId !== id) return;
        }
        if (this.closed || generation !== this.generation) { await this.stopOwnedTask(); return; }
        this.phase = 'admitted'; this.active = true; admitted = true;
      } catch (error) {
        if (this.unverifiedTask) { this.phase = 'unverified'; this.reason = (error as Error).message; }
        else if (this.phase !== 'release-failed') {
          this.phase = 'denied'; this.reason = (error as Error).message;
        }
        hilog.error(LOG_DOMAIN, 'Reader', 'TTS background lease failed: %{private}s', (error as Error).message);
      } finally { this.pendingCancelled = []; }
    });
    this.operationTail = task.catch((): void => {});
    await task;
    return admitted && this.isActive();
  }

  async deactivate(): Promise<void> {
    this.generation += 1;
    this.active = false;
    const task = this.operationTail.then(async (): Promise<void> => this.stopOwnedTask());
    this.operationTail = task.catch((): void => {});
    await task;
  }
  isActive(): boolean { return this.active && !this.closed && this.phase === 'admitted'; }

  async close(): Promise<void> {
    if (!this.closed) { this.closed = true; this.generation += 1; this.active = false; this.revoked = undefined; }
    if (HarmonyTtsBackgroundSession.retiring.indexOf(this) < 0) HarmonyTtsBackgroundSession.retiring.push(this);
    const task = this.operationTail.then(async (): Promise<void> => this.stopOwnedTask());
    this.operationTail = task.catch((): void => {});
    let failure: Error | undefined = undefined;
    try { await task; } catch (error) { failure = error as Error; }
    if (this.observing) {
      try { backgroundTaskManager.off('continuousTaskCancel', this.onCancelled); this.observing = false; }
      catch (error) {
        hilog.warn(LOG_DOMAIN, 'Reader', 'TTS background listener release failed: %{private}s', (error as Error).message);
        if (failure === undefined) failure = error as Error;
      }
    }
    if (failure !== undefined) throw failure;
    HarmonyTtsBackgroundSession.retiring = HarmonyTtsBackgroundSession.retiring.filter((owned): boolean => owned !== this);
  }

  private async stopOwnedTask(): Promise<void> {
    if (this.unverifiedTask) throw new Error('Reader background task has no verified native identity');
    const id = this.taskId;
    if (id === undefined) {
      if (this.phase === 'requesting') this.phase = 'released';
      return;
    }
    this.phase = 'releasing'; this.active = false;
    try {
      await backgroundTaskManager.stopBackgroundRunning(this.context, id);
      if (this.taskId === id) this.taskId = undefined;
      this.phase = 'released'; this.reason = '';
    } catch (error) {
      // A matching cancel event is independent native release evidence.
      if (this.taskId !== id) { this.phase = 'released'; this.reason = ''; return; }
      this.phase = 'release-failed'; this.reason = (error as Error).message;
      hilog.error(LOG_DOMAIN, 'Reader', 'TTS background release failed: %{private}s', this.reason);
      throw error;
    }
  }
}
