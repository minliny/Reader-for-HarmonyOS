import preferences from '@ohos.data.preferences';
import { Font } from '@ohos.arkui.UIContext';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderCustomFontHost } from '../../app/ReaderCustomFontHost';
import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  type ReaderCustomFontDescriptor,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';

const READER_APPEARANCE_PREFERENCES_NAME = 'reader_appearance_v1';
const READER_APPEARANCE_SNAPSHOT_KEY = 'snapshot';

/**
 * App-local persistence for Reader Appearance.
 *
 * Reader Core's persistence Host is reserved for its fixed Core snapshot and
 * cannot be used as an arbitrary settings store. This gateway obtains the
 * already-owned UIAbilityContext from ReaderRuntimeOwner and writes one
 * versioned appearance snapshot through HarmonyOS Preferences.
 */
export class ReaderAppearanceGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private updateTail: Promise<void> = Promise.resolve();
  private readonly customFontHost: ReaderCustomFontHost;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
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
    await this.updateTail;
    const store = await this.ensureStore();
    return this.readSnapshot(store);
  }

  async update(snapshot: ReaderAppearanceSnapshot): Promise<ReaderAppearanceSnapshot> {
    const requestedSnapshot = normalizeReaderAppearanceSnapshot(snapshot);
    const previousUpdate = this.updateTail;
    let releaseUpdate: (() => void) | undefined = undefined;
    this.updateTail = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    await previousUpdate;

    try {
      const store = await this.ensureStore();
      await store.put(READER_APPEARANCE_SNAPSHOT_KEY, JSON.stringify(requestedSnapshot));
      await store.flush();
      return copyReaderAppearanceSnapshot(requestedSnapshot);
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
    }
  }

  private async readSnapshot(store: preferences.Preferences): Promise<ReaderAppearanceSnapshot> {
    const fallback = createDefaultReaderAppearanceSnapshot();
    const raw = (await store.get(READER_APPEARANCE_SNAPSHOT_KEY, '')) as string;
    if (raw.length === 0) {
      return fallback;
    }
    try {
      const decoded = JSON.parse(raw) as ReaderAppearanceSnapshot;
      return normalizeReaderAppearanceSnapshot(decoded);
    } catch (_) {
      return fallback;
    }
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) {
      return this.store;
    }
    this.store = await preferences.getPreferences(
      this.runtimeOwner.getUIAbilityContext(),
      READER_APPEARANCE_PREFERENCES_NAME,
    );
    return this.store;
  }
}
