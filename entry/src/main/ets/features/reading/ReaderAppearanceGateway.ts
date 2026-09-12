import { Font } from '@ohos.arkui.UIContext';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderCustomFontHost } from '../../app/ReaderCustomFontHost';
import {
  type ReaderCustomFontDescriptor,
  type ReaderAppearanceSnapshot,
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

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.store = runtimeOwner.getAppearanceStore();
    this.customFontHost = new ReaderCustomFontHost(runtimeOwner.getUIAbilityContext());
  }

  async importCustomFont(font: Font): Promise<ReaderCustomFontDescriptor | undefined> {
    return this.customFontHost.selectAndRegister(font);
  }

  async registerCustomFont(font: Font, snapshot: ReaderAppearanceSnapshot): Promise<boolean> {
    if (snapshot.font !== 'custom') {
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
    return this.store.change(change, guard);
  }

  async flush(): Promise<void> {
    await this.store.flush();
  }
}
