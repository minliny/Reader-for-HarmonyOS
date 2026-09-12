import common from '@ohos.app.ability.common';
import { wantAgent } from '@kit.AbilityKit';
import { backgroundTaskManager } from '@kit.BackgroundTasksKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ReaderTtsBackgroundSessionBridge } from './HarmonyTtsHostRouter';

const LOG_DOMAIN = 0x5244;
const TTS_BACKGROUND_REQUEST_CODE = 5244;

/** Platform-only lease for HarmonyOS audio playback continuous running. */
export class HarmonyTtsBackgroundSession implements ReaderTtsBackgroundSessionBridge {
  private readonly context: common.UIAbilityContext;
  private operationTail: Promise<void> = Promise.resolve();
  private active: boolean = false;
  private closed: boolean = false;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async activate(): Promise<boolean> {
    let admitted = false;
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.closed) {
        return;
      }
      if (this.active) {
        admitted = true;
        return;
      }
      if (!canIUse('SystemCapability.ResourceSchedule.BackgroundTaskManager.ContinuousTask')) {
        hilog.warn(LOG_DOMAIN, 'Reader', 'TTS background playback is unavailable on this device');
        return;
      }
      try {
        const notificationWantAgent = await wantAgent.getWantAgent({
          wants: [{
            bundleName: this.context.abilityInfo.bundleName,
            abilityName: this.context.abilityInfo.name,
          }],
          actionType: wantAgent.OperationType.START_ABILITY,
          requestCode: TTS_BACKGROUND_REQUEST_CODE,
          actionFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG],
        });
        await backgroundTaskManager.startBackgroundRunning(
          this.context,
          ['audioPlayback'],
          notificationWantAgent,
        );
        this.active = true;
        admitted = true;
      } catch (error) {
        this.active = false;
        hilog.error(LOG_DOMAIN, 'Reader', 'TTS background playback lease failed: %{private}s',
          (error as Error).message);
      }
    });
    this.operationTail = task.catch((): void => {});
    await task;
    return admitted;
  }

  async deactivate(): Promise<void> {
    const task = this.operationTail.then(async (): Promise<void> => this.stopIfActive());
    this.operationTail = task.catch((): void => {});
    await task;
  }

  isActive(): boolean {
    return this.active && !this.closed;
  }

  async close(): Promise<void> {
    if (this.closed) {
      await this.operationTail;
      return;
    }
    this.closed = true;
    const task = this.operationTail.then(async (): Promise<void> => this.stopIfActive());
    this.operationTail = task.catch((): void => {});
    await task;
  }

  private async stopIfActive(): Promise<void> {
    if (!this.active) {
      return;
    }
    try {
      await backgroundTaskManager.stopBackgroundRunning(this.context);
    } catch (error) {
      hilog.error(LOG_DOMAIN, 'Reader', 'TTS background playback release failed: %{private}s',
        (error as Error).message);
    } finally {
      this.active = false;
    }
  }
}
