import { Font } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import { ReaderCustomFontHost } from '../../../app/ReaderCustomFontHost';
import {
  type ReaderCustomFontDescriptor,
  type ReaderAppearanceSnapshot,
  setReaderAppearanceCustomFont,
} from './ReaderAppearanceState';
import {
  ReaderAppearanceStore,
  ReaderAppearanceCommit,
  type ReaderAppearanceChange,
  type ReaderAppearanceChangeGuard,
} from './ReaderAppearanceStore';

/**
 * App-local persistence for Reader Appearance.
 *
 * Each page keeps its own font registration context while every instance uses
 * the RuntimeOwner's shared appearance state and ordered Preferences writes.
 */
export class ReaderAppearanceGateway {
  private readonly store: ReaderAppearanceStore;
  private readonly customFontHost: ReaderCustomFontHost;
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
    this.store = runtimeOwner.getAppearanceStore();
    this.customFontHost = new ReaderCustomFontHost(runtimeOwner.getUIAbilityContext());
  }

  async importCustomFont(font: Font, guard?: ReaderAppearanceChangeGuard): Promise<ReaderAppearanceCommit | undefined> {
    let commit: ReaderAppearanceCommit | undefined;
    await this.customFontHost.selectAndRegister(font, async (descriptor: ReaderCustomFontDescriptor): Promise<void> => {
      await ReaderThemeHost.prepareUserChange();
      commit = await this.update((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
        setReaderAppearanceCustomFont(current, descriptor), guard);
    });
    // A rejected import is not a durable replacement. Only update's saved
    // replacement path can retire a previously persisted private font.
    return commit;
  }

  async registerCustomFont(font: Font, snapshot: ReaderAppearanceSnapshot): Promise<boolean> {
    if (snapshot.customFont === undefined) {
      return true;
    }
    return this.customFontHost.registerPersisted(font, snapshot.customFont);
  }

  async load(): Promise<ReaderAppearanceSnapshot> {
    return this.store.load();
  }

  current(): ReaderAppearanceSnapshot {
    return this.store.current();
  }

  currentRevision(): number {
    return this.store.currentRevision();
  }

  hasUnsavedChanges(): boolean {
    return this.store.hasUnsavedChanges();
  }

  async update(change: ReaderAppearanceChange, guard?: ReaderAppearanceChangeGuard):
    Promise<ReaderAppearanceCommit | undefined> {
    let retired: ReaderCustomFontDescriptor | undefined;
    const commit = await this.store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => {
      const next = change(current);
      if (current.customFont !== undefined && current.customFont.filePath !== next.customFont?.filePath) {
        retired = current.customFont;
      }
      return next;
    }, guard);
    if (commit !== undefined && retired !== undefined) {
      const oldFont = retired;
      // Never delete a previously saved face before its replacement is durable.
      // A later change can select it again while the write is queued. The
      // file owner rechecks the live shared choice inside its mutation lane.
      void commit.saved.then(async (): Promise<void> => {
        try {
          await this.store.flush();
          await this.customFontHost.retireUnusedFont(oldFont, (): boolean =>
            ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && this.store.current().customFont?.filePath !== oldFont.filePath);
        } catch (error) {
          hilog.warn(0x5244, 'Reader', 'Unused font cleanup deferred: %{private}s', `${error}`);
        }
      }, (): void => {});
    }
    return commit;
  }

  async flush(): Promise<void> {
    await this.store.flush();
  }
}
