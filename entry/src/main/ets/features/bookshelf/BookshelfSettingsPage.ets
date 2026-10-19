import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { BookshelfViewModeHost, type BookshelfViewModeSnapshot } from './BookshelfViewModeHost';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { readerRecoveryView } from '../../app/ReaderRecoveryProjection';
import type { SettingsOperationProjection } from '../settings/SettingsHost';
import { TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_LABEL, TYPE_APP_INHERITED_OPTION } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_INK,
  TOK_MUTED,
  TOK_GREEN,
  TOK_CARD_BG,
  TOK_PAPER,
  TOK_BORDER,
  TOK_SPACE_MD,
} from '../common/ReaderTokens';
import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';

/** Persistent bookshelf preferences, shared by More and the settings route. */
@Component
export struct BookshelfSettingsPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerBookshelfViewMode') private mode: string = 'cover';
  @Prop autoCheckUpdate: boolean = true;
  @Prop @Watch('onOperationChanged') operation: SettingsOperationProjection = { action: 'load' };
  @Prop navigationGeneration: number = 0;
  @State private presentationRevision: number = 0;
  onRetryAccepted: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  onReconcile: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onAutoCheckUpdate: (enabled: boolean) => void = (_enabled: boolean): void => {};
  @State private error: string = '';
  @State private viewModeSnapshot: BookshelfViewModeSnapshot = { canonical: undefined };
  private readonly viewModeHost: BookshelfViewModeHost = BookshelfViewModeHost.instance;
  private revision: number = 0;
  private confirmed: string = 'cover';
  private requestedMode: 'cover' | 'list' = 'cover';
  private mounted: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true; this.presentationRevision += 1;
    const canonical = WebDavCredentialStore.instance.currentBookshelfViewMode();
    this.confirmed = canonical ?? this.mode;
    this.mode = this.confirmed;
    const snapshot = this.viewModeHost.current();
    // Startup may acknowledge the Store before either feature consumer loads.
    // Reuse that value only for a cold page; existing recovery facts stay intact.
    this.viewModeSnapshot = canonical !== undefined && snapshot.canonical === undefined &&
      snapshot.receipt === undefined && snapshot.readFacts === undefined ? { canonical } : snapshot;
    this.error = this.viewModeRecovery().message;
    if (canonical === undefined) this.loadMode();
    this.onOperationChanged();
  }
  aboutToDisappear(): void { this.mounted = false; this.modeLoadBusy = false; this.modeReconcileBusy = false; this.revision += 1; this.presentationRevision += 1; }

  private settingsRecoveryIdentity(kind: string, generation: number): string {
    return JSON.stringify([this.navigationGeneration, this.presentationRevision, kind, generation]);
  }
  private settingsRecoveryCurrent(identity: string): boolean {
    if (!this.mounted) return false;
    const token = JSON.parse(identity) as (string | number)[];
    if (token[0] !== this.navigationGeneration || token[1] !== this.presentationRevision) return false;
    if (token[2] === 'accepted') return this.operation.canRetryAccepted === true && token[3] === this.operation.receipt?.facts.generation;
    const recovery = readerRecoveryView(this.operation.receipt, this.operation.readFacts);
    return recovery.canRetry && token[3] === recovery.generation;
  }
  private retrySettingsRecovery(identity: string): void {
    if (!this.settingsRecoveryCurrent(identity)) return;
    const token = JSON.parse(identity) as (string | number)[];
    if (token[2] === 'accepted') this.onRetryAccepted(token[3] as number, token[0] as number);
    else this.onReconcile(token[3] as number, token[0] as number);
  }

  private settingsPending(): boolean {
    return this.operation.receipt?.receipt.confirmation === 'unknown' || this.operation.receipt?.facts.blocked === true ||
      this.operation.canRetryAccepted === true;
  }
  private modePending(): boolean {
    return this.viewModeSnapshot.receipt?.receipt.confirmation === 'unknown' || this.viewModeSnapshot.receipt?.facts.blocked === true;
  }
  @Builder
  private pendingOverlay() {
    Column({ space: 8 }) {
      this.settingsRecovery();
      if (this.modePending()) {
        ReaderRecoveryNotice({ view: this.viewModeRecovery(), tag: '显示方式待确认', actionLabel: '核对显示方式',
          busy: this.modeLoadBusy || this.modeReconcileBusy || this.viewModeSnapshot.receipt?.facts.fact === 'refreshing' || this.viewModeSnapshot.readFacts?.fact === 'refreshing',
          onReconcile: (generation: number): void => this.retryMode(generation) });
      }
    }.width('100%').padding({ left: 17, right: 17, top: 64 })
      .hitTestBehavior(HitTestMode.Transparent);
  }
  @Builder
  private settingsRecovery() {
      if (this.settingsPending()) {
        ForEach([this.settingsRecoveryIdentity('read', readerRecoveryView(this.operation.receipt, this.operation.readFacts).generation)], (identity: string) => {
          ReaderRecoveryNotice({ view: readerRecoveryView(this.operation.receipt, this.operation.readFacts), tag: '设置待处理',
            actionLabel: '核对设置', busy: this.operation.receipt?.receipt.readback === 'reading',
            onReconcile: (): void => this.retrySettingsRecovery(identity),
            secondaryActionLabel: this.operation.canRetryAccepted === true ? '重试保存当前设置' : '',
            onSecondaryAction: (): void => this.retrySettingsAccepted(identity) });
        }, (identity: string): string => identity);
      }
  }
  private retrySettingsAccepted(identity: string): void {
    const token = JSON.parse(identity) as (string | number)[];
    this.retrySettingsRecovery(JSON.stringify([token[0], token[1], 'accepted', token[3]]));
  }
  private lastSettingsFeedback: string = '';
  private onOperationChanged(): void {
    if (!this.mounted || this.settingsPending()) return;
    const view = readerRecoveryView(this.operation.receipt, this.operation.readFacts);
    if (!view.visible || !view.canRetry) { this.lastSettingsFeedback = ''; return; }
    if (view.message === this.lastSettingsFeedback) return;
    this.lastSettingsFeedback = view.message;
    try { this.getUIContext().getPromptAction().showToast({ message: view.message, duration: 2000 }); } catch (_) {}
  }
  private lastModeFeedback: string = '';
  @State private modeLoadBusy: boolean = false;
  @State private modeReconcileBusy: boolean = false;
  private modeFeedback(): void {
    const view = this.viewModeRecovery();
    if (!view.visible || this.modePending()) { this.lastModeFeedback = ''; return; }
    if (this.viewModeSnapshot.canonical === undefined || view.message === this.lastModeFeedback) return;
    this.lastModeFeedback = view.message;
    try { this.getUIContext().getPromptAction().showToast({ message: view.message, duration: 2000 }); } catch (_) {}
  }

  build() {
    ReaderStandardPage({
      variant: 'settings',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
      overlayContent: (): void => { this.pendingOverlay(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '书架设置', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    Column({ space: TOK_SPACE_MD }) {
      if (this.operation.readFacts?.hasValue === false && !this.settingsPending()) {
        ReaderPageState({ title: this.operation.readFacts?.fact === 'loading' || this.operation.readFacts?.fact === 'refreshing' ? '正在读取书架设置…' :
            this.operation.readFacts?.fact === 'failed' || this.operation.readFacts?.fact === 'refreshFailed' ? '书架设置读取失败' :
            this.operation.readFacts?.fact === 'cancelled' ? '书架设置读取已取消' :
            this.operation.readFacts?.fact === 'blocked' ? '书架设置暂不可用' : '书架设置尚未读取',
          message: this.operation.readFacts?.fact === 'loading' || this.operation.readFacts?.fact === 'refreshing' ? '' : this.operation.readFacts?.message ?? '',
          loading: this.operation.readFacts?.fact === 'loading' || this.operation.readFacts?.fact === 'refreshing',
          actionLabel: this.operation.readFacts?.canRetry === true ? '重试' : '',
          onAction: (): void => this.onReconcile(this.operation.readFacts?.generation ?? 0, this.navigationGeneration) });
      } else {
      Row() {
        Text('自动检查更新').layoutWeight(1).fontSize(TYPE_APP_INHERITED_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Toggle({ type: ToggleType.Switch, isOn: this.autoCheckUpdate })
          .selectedColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).onChange((enabled: boolean): void => this.onAutoCheckUpdate(enabled));
      }.width('100%');
      Text('自动检查书架中书籍的最新章节').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%');
      }
      if (this.viewModeSnapshot.canonical !== undefined || this.modePending()) {
      Row({ space: 12 }) {
        Text('显示方式').layoutWeight(1).fontSize(TYPE_APP_INHERITED_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        this.modeOption('cover', '封面');
        this.modeOption('list', '列表');
      }.width('100%');
      } else {
        ReaderPageState({ title: this.modeLoadBusy || this.modeReconcileBusy || this.viewModeSnapshot.readFacts?.fact === 'loading' || this.viewModeSnapshot.readFacts?.fact === 'refreshing' ? '正在读取显示方式…' :
            this.viewModeSnapshot.readFacts?.fact === 'failed' || this.viewModeSnapshot.readFacts?.fact === 'refreshFailed' || this.viewModeSnapshot.receipt?.facts.fact === 'refreshFailed' ? '显示方式读取失败' :
            this.viewModeSnapshot.readFacts?.fact === 'cancelled' ? '显示方式读取已取消' :
            this.viewModeSnapshot.readFacts?.fact === 'blocked' ? '显示方式暂不可用' : '显示方式尚未读取',
          message: this.modeLoadBusy || this.modeReconcileBusy || this.viewModeSnapshot.readFacts?.fact === 'loading' || this.viewModeSnapshot.readFacts?.fact === 'refreshing' ? '' :
            this.viewModeSnapshot.readFacts?.message ?? (this.viewModeSnapshot.receipt !== undefined ? this.viewModeRecovery().message : ''),
          loading: this.modeLoadBusy || this.modeReconcileBusy || this.viewModeSnapshot.readFacts?.fact === 'loading' || this.viewModeSnapshot.readFacts?.fact === 'refreshing',
          actionLabel: this.viewModeRecovery().canRetry ? '重试' : '',
          onAction: (): void => this.retryMode(this.viewModeRecovery().generation) });
      }

    }.padding(TOK_SPACE_MD).width('100%').backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(12);
  }


  @Builder
  private modeOption(value: 'cover' | 'list', label: string) {
    Text(label).fontSize(TYPE_APP_INHERITED_OPTION.fontSizeFp).fontColor(this.mode === value ? readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme))
      .padding({ left: 14, right: 14, top: 10, bottom: 10 }).borderRadius(20)
      .backgroundColor(this.mode === value ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('TOK_PAPER', this.appThemeScheme))
      .onClick((): void => this.selectMode(value));
  }

  private viewModeRecovery(): ReaderRecoveryView {
    const view = readerRecoveryView(this.viewModeSnapshot.receipt, this.viewModeSnapshot.readFacts);
    if (this.viewModeSnapshot.receipt?.facts.blockedReason === 'BOOKSHELF_RESTORE_PENDING') {
      return { message: '请先在同步设置中重试未完成的恢复', visible: true, canRetry: false, generation: view.generation };
    }
    return view;
  }

  private applyModeSnapshot(snapshot: BookshelfViewModeSnapshot): void {
    this.viewModeSnapshot = snapshot;
    this.error = this.viewModeRecovery().message;
    this.modeFeedback();
    if (snapshot.canonical !== undefined) { this.confirmed = snapshot.canonical; this.mode = snapshot.canonical; }
  }

  private loadMode(): void {
    const revision = ++this.revision;
    this.modeLoadBusy = true;
    void this.viewModeHost.load((): boolean => this.mounted && revision === this.revision).then((snapshot): void => {
      if (snapshot !== undefined && this.mounted && revision === this.revision) this.applyModeSnapshot(snapshot);
    }).finally((): void => {
      if (this.mounted && revision === this.revision) this.modeLoadBusy = false;
    });
  }

  private retryMode(generation: number): void {
    if (!this.mounted || this.modeReconcileBusy || generation !== this.viewModeRecovery().generation) return;
    this.lastModeFeedback = '';
    const revision = this.revision;
    this.modeReconcileBusy = true;
    void this.viewModeHost.reconcile(generation, (): boolean => this.mounted && revision === this.revision).then((snapshot): void => {
      if (snapshot !== undefined && this.mounted && revision === this.revision) this.applyModeSnapshot(snapshot);
    }).finally((): void => {
      if (this.mounted && revision === this.revision) this.modeReconcileBusy = false;
    });
  }

  private async persistRequestedMode(mode: 'cover' | 'list', revision: number): Promise<boolean> {
    const snapshot = await this.viewModeHost.save(mode, (): boolean => this.mounted && revision === this.revision);
    if (snapshot === undefined) return false;
    if (snapshot.canonical !== undefined) this.confirmed = snapshot.canonical;
    if (this.mounted && revision === this.revision) this.applyModeSnapshot(snapshot);
    return snapshot.receipt?.receipt.confirmation === 'confirmed';
  }

  private selectMode(mode: 'cover' | 'list'): void {
    if (!this.mounted || !this.viewModeHost.canSave()) return;
    this.modeLoadBusy = false;
    this.modeReconcileBusy = false;
    const revision = ++this.revision;
    this.requestedMode = mode;
    this.mode = mode;
    this.error = '';
    void this.persistRequestedMode(mode, revision).catch((error: Error): void => {
      if (!this.mounted || revision !== this.revision) return;
      this.mode = this.confirmed;
      this.error = error.message === 'BOOKSHELF_RESTORE_PENDING' ?
        '请先在同步设置中重试未完成的恢复' : '显示方式保存失败，点击重试';
    });
  }
}
