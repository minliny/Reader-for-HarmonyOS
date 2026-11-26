import type { ReaderSettingsSnapshot } from './ReaderSettingsState';

export interface ReaderWindowSettingsCommitPort {
  current(): boolean;
  applyPolicy(settings: ReaderSettingsSnapshot): Promise<void>;
  acceptAppliedPolicy(): void;
  restorePreviousSettings(): void;
  save(settings: ReaderSettingsSnapshot): Promise<void>;
  notifySavePending(error: Error): void;
  notifyPolicyRestored(error: Error): void;
  finishPolicyRequest(): void;
}

export function completeReaderWindowSettingsCommit(
  before: ReaderSettingsSnapshot,
  requested: ReaderSettingsSnapshot,
  owner: ReaderWindowSettingsCommitPort,
): Promise<void> {
  return owner.applyPolicy(requested)
    .then((): Promise<void> => {
      if (!owner.current()) return Promise.resolve();
      owner.acceptAppliedPolicy();
      // A missing Preferences ACK must not roll back an applied native policy.
      return owner.save(requested).catch((error: Error): void => owner.notifySavePending(error)).then((): void => {});
    })
    .catch((error: Error): Promise<void> => {
      if (!owner.current()) return Promise.resolve();
      owner.restorePreviousSettings();
      const rollback = owner.applyPolicy(before).catch((_error: Error): void => {});
      owner.notifyPolicyRestored(error);
      return rollback;
    })
    .finally((): void => owner.finishPolicyRequest());
}
