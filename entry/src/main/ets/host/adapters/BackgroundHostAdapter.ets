// BackgroundHostAdapter — HarmonyOS @ohos.resourceschedule.backgroundTaskManager
// backed Host adapter for background.schedule / background.cancel.
//
// Source of truth: UI Contract host-request.schema.json — `background.schedule`
// and `background.cancel` are UI-Contract-only capabilities (NOT in the Core
// HostCapability closed set). Reducer dispatches these directly.
//
// IMPORTANT: HarmonyOS has NO `schedule(taskId, delayMs)` API. The three
// background-task types are:
//   - Short (Transient): requestSuspendDelay — keeps the app runnable for ~6min
//     after backgrounding; does NOT schedule a delayed callback.
//   - Long (Continuous): startBackgroundRunning — long-running bg mode
//     (audio/nav/download); requires ohos.permission.KEEP_BACKGROUND_RUNNING.
//   - Deferred (WorkScheduler): startWork — system-idle scheduling, ≥30min
//     minimum interval, no delayMs field, runs in a separate ExtensionAbility.
//
// None of these is a direct `setTimeout`-equivalent. The closest clean-room
// mapping for `background.schedule(taskId, delayMs)` is:
//   1. requestSuspendDelay() to keep the app runnable if it backgrounds.
//   2. setTimeout(work, delayMs) to fire the task after delayMs.
//   3. cancelSuspendDelay() on completion or on background.cancel.
//
// This is documented as a Host-side adapter decision; Core / Reducer see the
// `background.schedule` / `background.cancel` contract surface as-is.
//
// Permission: requestSuspendDelay / cancelSuspendDelay need no permission.
// startBackgroundRunning would need KEEP_BACKGROUND_RUNNING, but this adapter
// does not use it (Long tasks are out of scope for background.schedule).
import { backgroundTaskManager } from '@kit.BackgroundTasksKit';
import {
  HostBackgroundScheduleRequest,
  HostBackgroundScheduleResponse,
  HostBackgroundCancelRequest,
  HostBackgroundCancelResponse,
} from '../types';

interface ScheduledTaskEntry {
  taskId: string;
  suspendRequestId: number;
  timeoutId: number;
  work: (() => void) | null;
}

export interface HostBackgroundTaskStartResponse {
  started: boolean;
  taskId: string;
  name: string;
}

interface BackgroundTaskLease {
  taskId: string;
  name: string;
  suspendRequestId: number;
}

export class BackgroundHostAdapter {
  private tasks: Map<string, ScheduledTaskEntry> = new Map<string, ScheduledTaskEntry>();
  private leases: Map<string, BackgroundTaskLease> = new Map<string, BackgroundTaskLease>();

  /**
   * background.schedule — schedule `work` to run after delayMs.
   * If the app backgrounds before delayMs, requestSuspendDelay keeps it
   * runnable (up to ~6min). The caller passes the work callback via the
   * `work` field on the request params (added here as an extension, since the
   * UI Contract only carries taskId + delayMs — Reducer attaches the callback).
   *
   * This method is called by Reducer with the work attached; CoreRuntime never
   * sees the work callback.
   */
  schedule(request: HostBackgroundScheduleRequest, work?: () => void): HostBackgroundScheduleResponse {
    const taskId = request.taskId;
    const delayMs = request.delayMs ?? 0;

    // Cancel any existing task with the same id.
    const existing = this.tasks.get(taskId);
    if (existing !== undefined) {
      clearTimeout(existing.timeoutId);
      try {
        backgroundTaskManager.cancelSuspendDelay(existing.suspendRequestId);
      } catch (e) {
        // Best-effort — the task is being replaced.
      }
      this.tasks.delete(taskId);
    }

    // Request a short transient task so the app stays runnable if backgrounded.
    let suspendRequestId: number = 0;
    try {
      const info = backgroundTaskManager.requestSuspendDelay('reader-bg-task-' + taskId, () => {
        // About to timeout — nothing to clean here; the timeout will still fire
        // if the app is in foreground.
      });
      suspendRequestId = info.requestId;
    } catch (e) {
      // requestSuspendDelay may fail if too many transient tasks are active.
      // We still schedule the timeout — foreground execution still works.
    }

    const workFn = work ?? null;
    const timeoutId = setTimeout(() => {
      try {
        if (workFn !== null) {
          workFn();
        }
      } finally {
        try {
          backgroundTaskManager.cancelSuspendDelay(suspendRequestId);
        } catch (e) {
          // Best-effort — foreground task already completed.
        }
        this.tasks.delete(taskId);
      }
    }, delayMs);

    const entry: ScheduledTaskEntry = {
      taskId: taskId,
      suspendRequestId: suspendRequestId,
      timeoutId: timeoutId,
      work: workFn,
    };
    this.tasks.set(taskId, entry);
    return { scheduled: true };
  }

  /**
   * background.cancel — cancel a previously scheduled task by taskId.
   */
  cancel(request: HostBackgroundCancelRequest): HostBackgroundCancelResponse {
    const entry = this.tasks.get(request.taskId);
    if (entry === undefined) {
      return { cancelled: false };
    }
    clearTimeout(entry.timeoutId);
    if (entry.suspendRequestId !== 0) {
      try {
        backgroundTaskManager.cancelSuspendDelay(entry.suspendRequestId);
      } catch (e) {
        // Best-effort — the timeout is already cleared.
      }
    }
    this.tasks.delete(request.taskId);
    return { cancelled: true };
  }

  /**
   * Reader UI 2.5 background.task.start — acquire a real transient background
   * lease. Failure to obtain a suspend request is surfaced; no foreground-only
   * timeout is reported as background success.
   */
  startTask(name: string): HostBackgroundTaskStartResponse {
    let taskId = '';
    let info: backgroundTaskManager.DelaySuspendInfo;
    try {
      info = backgroundTaskManager.requestSuspendDelay('reader-ui-' + name, () => {
        if (taskId.length > 0) this.leases.delete(taskId);
      });
    } catch (e) {
      throw new Error(`BackgroundHostAdapter.startTask name=${name} failed: ${e}`);
    }
    if (!Number.isInteger(info.requestId) || info.requestId <= 0) {
      throw new Error(`BackgroundHostAdapter.startTask name=${name} returned invalid request id`);
    }
    taskId = `harmony-transient-${info.requestId}`;
    const lease: BackgroundTaskLease = {
      taskId: taskId,
      name: name,
      suspendRequestId: info.requestId,
    };
    this.leases.set(taskId, lease);
    return { started: true, taskId: taskId, name: name };
  }

  /** Reader UI 2.5 background.task.end — release exactly one live lease. */
  endTask(taskId: string): boolean {
    const lease = this.leases.get(taskId);
    if (lease === undefined) return false;
    try {
      backgroundTaskManager.cancelSuspendDelay(lease.suspendRequestId);
    } catch (e) {
      throw new Error(`BackgroundHostAdapter.endTask taskId=${taskId} failed: ${e}`);
    }
    this.leases.delete(taskId);
    return true;
  }

  /**
   * Cancel all scheduled tasks. Call on app shutdown.
   */
  cancelAll(): void {
    this.tasks.forEach((entry: ScheduledTaskEntry) => {
      clearTimeout(entry.timeoutId);
      if (entry.suspendRequestId !== 0) {
        try {
          backgroundTaskManager.cancelSuspendDelay(entry.suspendRequestId);
        } catch (e) {
          // Best-effort.
        }
      }
    });
    this.tasks.clear();
    this.leases.forEach((lease: BackgroundTaskLease) => {
      try {
        backgroundTaskManager.cancelSuspendDelay(lease.suspendRequestId);
      } catch (e) {
        // Best-effort during process shutdown only.
      }
    });
    this.leases.clear();
  }
}
