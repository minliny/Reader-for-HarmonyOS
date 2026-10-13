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
  @Prop operation: SettingsOperationProjection = { action: 'load' };
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
    this.viewModeSnapshot = this.viewModeHost.current();
    this.error = this.viewModeRecovery().message;
    if (canonical === undefined) this.loadMode();
  }
  aboutToDisappear(): void { this.mounted = false; this.revision += 1; this.presentationRevision += 1; }

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

  @Builder
  private settingsRecovery() {
    ForEach([this.settingsRecoveryIdentity('read', readerRecoveryView(this.operation.receipt, this.operation.readFacts).generation)], (identity: string) => {
      ReaderRecoveryNotice({ view: readerRecoveryView(this.operation.receipt, this.operation.readFacts),
        actionLabel: '刷新设置', onReconcile: (): void => this.retrySettingsRecovery(identity) });
    }, (identity: string): string => identity);
    if (this.operation.canRetryAccepted === true && this.operation.receipt !== undefined) {
      ForEach([this.settingsRecoveryIdentity('accepted', this.operation.receipt.facts.generation)], (identity: string) => {
        ReaderRecoveryAction({ label: '重试保存当前设置', generation: Number((JSON.parse(identity) as (string | number)[])[3]),
          actionEnabled: this.settingsRecoveryCurrent(identity), onReconcile: (): void => this.retrySettingsRecovery(identity) });
      }, (identity: string): string => identity);
    }
  }

  build() {
    ReaderStandardPage({
      variant: 'settings',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '书架设置', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    this.settingsRecovery();
    Column({ space: TOK_SPACE_MD }) {
      Row() {
        Text('自动检查更新').layoutWeight(1).fontSize(TYPE_APP_INHERITED_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Toggle({ type: ToggleType.Switch, isOn: this.autoCheckUpdate })
          .selectedColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).onChange((enabled: boolean): void => this.onAutoCheckUpdate(enabled));
      }.width('100%');
      Text('自动检查书架中书籍的最新章节').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%');
      Row({ space: 12 }) {
        Text('显示方式').layoutWeight(1).fontSize(TYPE_APP_INHERITED_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        this.modeOption('cover', '封面');
        this.modeOption('list', '列表');
      }.width('100%');
      if (this.error.length > 0) {
        ReaderRecoveryNotice({ view: this.viewModeRecovery(), actionLabel: '刷新显示方式',
          onReconcile: (generation: number): void => this.retryMode(generation) });
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
    if (snapshot.canonical !== undefined) { this.confirmed = snapshot.canonical; this.mode = snapshot.canonical; }
  }

  private loadMode(): void {
    const revision = ++this.revision;
    void this.viewModeHost.load((): boolean => this.mounted && revision === this.revision).then((snapshot): void => {
      if (snapshot !== undefined && this.mounted && revision === this.revision) this.applyModeSnapshot(snapshot);
    });
  }

  private retryMode(generation: number): void {
    const revision = this.revision;
    void this.viewModeHost.reconcile(generation, (): boolean => this.mounted && revision === this.revision).then((snapshot): void => {
      if (snapshot !== undefined && this.mounted && revision === this.revision) this.applyModeSnapshot(snapshot);
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
