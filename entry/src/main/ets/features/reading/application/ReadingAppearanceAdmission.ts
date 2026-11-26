import {
  sameReaderAppearanceFont,
  setReaderAppearanceFont,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import type { ReaderAppearanceChange, ReaderAppearanceChangeGuard, ReaderAppearanceCommit } from './ReaderAppearanceStore';

export interface ReadingAppearanceStorePort {
  load(): Promise<ReaderAppearanceSnapshot>;
  current(): ReaderAppearanceSnapshot;
  update(change: ReaderAppearanceChange, guard: ReaderAppearanceChangeGuard): Promise<ReaderAppearanceCommit | undefined>;
  flush(): Promise<void>;
}

export interface ReadingAppearanceAdmissionPort {
  current(): boolean;
  prepareFont(snapshot: ReaderAppearanceSnapshot): Promise<void>;
  registerCustomFont(snapshot: ReaderAppearanceSnapshot): Promise<boolean>;
  admit(snapshot: ReaderAppearanceSnapshot): void;
  observeSave(saved: Promise<void>): void;
  loadFailed(error: Error): void;
}

/** Admit a font only while it still matches the live preference and the reading session. */
export async function loadReadingAppearance(
  store: ReadingAppearanceStorePort,
  refreshSaveState: () => void,
  host: ReadingAppearanceAdmissionPort,
): Promise<void> {
  try {
    await store.load();
    refreshSaveState();
    while (host.current()) {
      const snapshot = store.current();
      await host.prepareFont(snapshot);
      if (!host.current()) return;
      let latest = store.current();
      if (!sameReaderAppearanceFont(snapshot, latest)) continue;
      if (snapshot.font === 'custom' && snapshot.customFont !== undefined) {
        const registered = await host.registerCustomFont(snapshot);
        if (!host.current()) return;
        latest = store.current();
        if (!sameReaderAppearanceFont(snapshot, latest)) continue;
        if (!registered) {
          const commit = await store.update(
            (current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFont(current, 'serif'),
            (current: ReaderAppearanceSnapshot): boolean => host.current() && sameReaderAppearanceFont(snapshot, current),
          );
          if (commit !== undefined) host.observeSave(commit.saved);
          continue;
        }
      }
      host.admit(latest);
      host.observeSave(store.flush());
      return;
    }
  } catch (error) {
    if (host.current()) host.loadFailed(error as Error);
  }
}

export interface ReadingAppearanceMutationPort {
  sessionCurrent(): boolean;
  mutationCurrent(): boolean;
  prepareFont(snapshot: ReaderAppearanceSnapshot): Promise<void>;
  admit(snapshot: ReaderAppearanceSnapshot): void;
  observeSave(saved: Promise<void>): void;
  mutationFailed(error: Error): void;
}

export async function commitReadingAppearance(
  store: ReadingAppearanceStorePort,
  change: (current: () => boolean) => Promise<ReaderAppearanceCommit | undefined>,
  host: ReadingAppearanceMutationPort,
): Promise<ReaderAppearanceSnapshot | undefined> {
  try {
    const commit = await change(host.sessionCurrent);
    if (commit === undefined) return undefined;
    host.observeSave(commit.saved);
    const snapshot = store.current();
    await host.prepareFont(snapshot);
    if (host.mutationCurrent()) {
      const latest = store.current();
      if (sameReaderAppearanceFont(snapshot, latest)) {
        host.admit(latest);
        return latest;
      }
    }
  } catch (error) {
    if (host.mutationCurrent()) host.mutationFailed(error as Error);
  }
  return undefined;
}
