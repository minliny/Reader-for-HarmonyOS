import { ReaderRecoveryGroup } from '../../../ui/feedback/ReaderRecoveryGroup';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderDirectoryRecoverySurface } from './ReaderDirectoryRecoverySurface';

const EMPTY_NOTICE: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };

/** A floating recovery surface inside the reading stage. The reading owner supplies the current actions. */
@Component
export struct ReaderRecoveryOverlay {
  @Prop overlayId: string = '';
  @Prop widthVp: number = 0;
  @Prop maxHeightVp: number = 0;
  @Prop leftVp: number = 0;
  @Prop topVp: number = 0;
  @Prop interactionEnabled: boolean = false;
  @Prop bookmarkRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  @Prop bookmarkIdentity: string = '';
  @Prop offlineIdentity: string = '';
  @Prop readerNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop readerNoticeActionLabel: string = '';
  @Prop settingsNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop settingsNoticeBusy: boolean = false;
  @Prop appearanceNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop appearanceNoticeBusy: boolean = false;
  @Prop ttsPreferencesNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop ttsPreferencesNoticeBusy: boolean = false;
  @Prop ttsConfigurationNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop replaceNotice: ReaderRecoveryView = EMPTY_NOTICE;
  @Prop replaceNoticeVisible: boolean = false;

  // Action-time reads stay with the live reading owner. A painted prop can
  // still be on screen after a control open, or after a new operation arrived.
  inputCurrent: () => boolean = (): boolean => false;
  bookmarkCurrent: (identity: string) => boolean = (_identity: string): boolean => false;
  offlineCurrent: (identity: string) => boolean = (_identity: string): boolean => false;
  onBookmarkAction: (identity: string, continuing: boolean) => void = (_identity: string, _continuing: boolean): void => {};
  onOfflineAction: (identity: string, generation: number, presentation: string, continuing: boolean) => void =
    (_identity: string, _generation: number, _presentation: string, _continuing: boolean): void => {};
  onReaderNoticeAction: (generation: number) => void = (_generation: number): void => {};
  onPreferenceNoticeAction: (domain: 'settings' | 'tts', generation: number) => void =
    (_domain: 'settings' | 'tts', _generation: number): void => {};
  onAppearanceNoticeAction: (generation: number) => void = (_generation: number): void => {};
  onTtsConfigurationNoticeAction: (generation: number) => void = (_generation: number): void => {};
  onReplaceNoticeAction: (generation: number) => void = (_generation: number): void => {};

  build() {
    Scroll() {
      Column({ space: 8 }) {
        this.readerRecoveryOverlayItems();
      }.width('100%');
    }
    .width(this.widthVp)
    .constraintSize({ maxHeight: this.maxHeightVp })
    .position({ x: this.leftVp, y: this.topVp })
    .id(this.overlayId)
    // Keep recovery touches within the overlay so they do not dismiss controls.
    .onTouch((event: TouchEvent): void => event.stopPropagation())
    .opacity(this.interactionEnabled ? 1 : 0)
    .enabled(this.interactionEnabled)
    .accessibilityLevel(this.interactionEnabled ? 'auto' : 'no-hide-descendants')
    .zIndex(8)
    .hitTestBehavior(this.interactionEnabled ? HitTestMode.Default : HitTestMode.None);
  }

  private readerOfflineRecoveryVisible(): boolean {
    return this.bookmarkRecovery.offline.visible && this.bookmarkRecovery.offlineKind !== 'result';
  }

  private readerOfflinePending(): boolean {
    return this.readerOfflineRecoveryVisible() && (this.bookmarkRecovery.offlineKind ?? 'pending') === 'pending';
  }

  @Builder
  private readerRecoveryOverlayItems() {
    if (this.bookmarkRecovery.bookmarks.visible && (this.bookmarkRecovery.bookmarksKind ?? 'pending') !== 'pending') {
      this.readerBookmarkRecoveryContent(false);
    }
    if (this.readerOfflineRecoveryVisible() && (this.bookmarkRecovery.offlineKind ?? 'pending') !== 'pending') {
      this.readerOfflineRecoveryContent(false);
    }
    if (this.hasReaderPendingGroup()) {
      ReaderRecoveryGroup({ content: (): void => { this.readerRecoveryItems(); } });
    }
  }

  private readerBookmarkPending(): boolean {
    return this.bookmarkRecovery.originalBookmarks !== undefined ||
      (this.bookmarkRecovery.bookmarks.visible && (this.bookmarkRecovery.bookmarksKind ?? 'pending') === 'pending');
  }

  private hasReaderPendingGroup(): boolean {
    return this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible || this.settingsNotice.visible || this.appearanceNotice.visible ||
      this.ttsPreferencesNotice.visible || this.ttsConfigurationNotice.visible ||
      this.replaceNoticeVisible;
  }

  @Builder
  private readerBookmarkRecoveryContent(grouped: boolean) {
    ForEach([this.bookmarkIdentity], (identity: string): void => {
      ReaderDirectoryRecoverySurface({ grouped, recovery: {
        presentationId: this.bookmarkRecovery.presentationId,
        bookmarks: grouped && (this.bookmarkRecovery.bookmarksKind ?? 'pending') !== 'pending' ?
          EMPTY_READING_DIRECTORY_RECOVERY.bookmarks : this.bookmarkRecovery.bookmarks,
        originalBookmarks: grouped ? this.bookmarkRecovery.originalBookmarks : undefined,
        bookmarksKind: this.bookmarkRecovery.bookmarksKind, bookmarksReadbackFailed: this.bookmarkRecovery.bookmarksReadbackFailed,
        bookmarksBusy: this.bookmarkRecovery.bookmarksBusy, canContinueBookmarks: this.bookmarkRecovery.canContinueBookmarks,
        bookmarksRecoveryAction: this.bookmarkRecovery.bookmarksRecoveryAction,
        bookmarkWriteEnabled: this.bookmarkRecovery.bookmarkWriteEnabled,
        offline: EMPTY_READING_DIRECTORY_RECOVERY.offline, canContinueOffline: false,
      }, presentationActive: this.interactionEnabled,
        isPresentationCurrent: (): boolean => this.inputCurrent() && this.bookmarkCurrent(identity),
        onReconcileBookmarks: (): void => this.onBookmarkAction(identity, false),
        onContinueBookmarks: (): void => this.onBookmarkAction(identity, true) });
    }, (identity: string): string => `bookmark:${identity}`);
  }

  @Builder
  private readerOfflineRecoveryContent(grouped: boolean) {
    ForEach([this.offlineIdentity], (identity: string): void => {
      ReaderDirectoryRecoverySurface({ grouped, recovery: {
        presentationId: this.bookmarkRecovery.presentationId,
        bookmarks: EMPTY_READING_DIRECTORY_RECOVERY.bookmarks, canContinueBookmarks: false, bookmarkWriteEnabled: false,
        offline: this.bookmarkRecovery.offline, offlineKind: this.bookmarkRecovery.offlineKind,
        offlineReadbackFailed: this.bookmarkRecovery.offlineReadbackFailed, offlineBusy: this.bookmarkRecovery.offlineBusy,
        offlineRecoveryAction: this.bookmarkRecovery.offlineRecoveryAction, canContinueOffline: this.bookmarkRecovery.canContinueOffline,
      }, presentationActive: this.interactionEnabled,
        isPresentationCurrent: (): boolean => this.inputCurrent() && this.offlineCurrent(identity),
        onReconcileOffline: (generation: number, presentation: string): void =>
          this.onOfflineAction(identity, generation, presentation, false),
        onContinueOffline: (generation: number, presentation: string): void =>
          this.onOfflineAction(identity, generation, presentation, true) });
    }, (identity: string): string => `offline:${identity}`);
  }

  @Builder
  private readerRecoveryItems() {
    if (this.readerBookmarkPending()) { this.readerBookmarkRecoveryContent(true); }
    if (this.readerOfflinePending()) { this.readerOfflineRecoveryContent(true); }
    if (this.readerNotice.visible) {
      ForEach([this.readerNotice.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp, follows: this.readerBookmarkPending() || this.readerOfflinePending(), view: this.readerNotice, actionLabel: this.readerNoticeActionLabel,
          onReconcile: (): void => { if (this.inputCurrent()) this.onReaderNoticeAction(generation); } });
      }, (generation: number): string => `recovery:${generation}`);
    }
    if (this.settingsNotice.visible) {
      ForEach([this.settingsNotice.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp, follows: this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible, view: this.settingsNotice, tag: '阅读设置',
          busy: this.settingsNoticeBusy, actionLabel: '重试保存',
          onReconcile: (): void => { if (this.inputCurrent()) this.onPreferenceNoticeAction('settings', generation); } });
      }, (generation: number): string => `settings:${generation}`);
    }
    if (this.appearanceNotice.visible) {
      ForEach([this.appearanceNotice.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp,
          follows: this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible || this.settingsNotice.visible,
          view: this.appearanceNotice, tag: '外观设置', actionLabel: '重试保存',
          actionEnabled: this.appearanceNotice.canRetry, retainPrimaryAction: true, busy: this.appearanceNoticeBusy,
          onReconcile: (): void => this.onAppearanceNoticeAction(generation) });
      }, (generation: number): string => `appearance:${generation}`);
    }
    if (this.ttsPreferencesNotice.visible) {
      ForEach([this.ttsPreferencesNotice.generation], (generation: number): void => {
        ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp, follows: this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible || this.settingsNotice.visible || this.appearanceNotice.visible, view: this.ttsPreferencesNotice, tag: '朗读设置',
          busy: this.ttsPreferencesNoticeBusy, actionLabel: '重试保存',
          onReconcile: (): void => { if (this.inputCurrent()) this.onPreferenceNoticeAction('tts', generation); } });
      }, (generation: number): string => `tts:${generation}`);
    }
    if (this.ttsConfigurationNotice.visible) {
      ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp, follows: this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible || this.settingsNotice.visible || this.appearanceNotice.visible || this.ttsPreferencesNotice.visible, view: this.ttsConfigurationNotice, tag: '朗读配置', actionLabel: '查看设置',
        onReconcile: (generation: number): void => { if (this.inputCurrent()) this.onTtsConfigurationNoticeAction(generation); } });
    }
    if (this.replaceNoticeVisible) {
      ReaderRecoveryNotice({ grouped: true, layoutWidthVp: this.widthVp, follows: this.readerBookmarkPending() || this.readerOfflinePending() || this.readerNotice.visible || this.settingsNotice.visible || this.appearanceNotice.visible || this.ttsPreferencesNotice.visible || this.ttsConfigurationNotice.visible, view: this.replaceNotice, tag: '替换规则', actionLabel: '查看规则',
        onReconcile: (generation: number): void => { if (this.inputCurrent()) this.onReplaceNoticeAction(generation); } });
    }
  }
}
