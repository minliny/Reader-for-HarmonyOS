import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { readerStandardPageContentFrame, readerStandardPageSpec } from '../../../ui/layout/ReaderPageShell';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import { isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { TYPE_APP_LOADING_BODY, TYPE_APP_ROW_DETAIL, TYPE_APP_ROW_LABEL, TYPE_APP_SMALL_LABEL,
  TYPE_CARD_SECTION_HEADING, TYPE_FORM_STATUS, TYPE_SELECT_DEFAULT_VALUE, TYPE_SECTION_HEADING,
  TYPE_SYNC_CONFLICT_META, TYPE_SYNC_HISTORY_STATUS, TYPE_SYNC_INPUT, TYPE_SYNC_ROW_LABEL } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import {
  type SyncHistoryEntry,
  type SyncRestoreConflict,
  type SyncSnapshot,
  DEFAULT_SYNC_SNAPSHOT,
} from '../application/SyncGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderCard } from '../../../ui/surfaces/ReaderCard';
import { LocalRecoveryPanel } from '../../bookshelf/ui/LocalRecoveryPanel';
import { ReaderWebDavLibraryPanel } from './ReaderWebDavLibraryPanel';
import {
  SurfaceHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
  TOK_RADIUS_PILL,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

@Component
export struct SyncPage {
  @Prop embeddedWide: boolean = false;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSnapshotChanged') snapshot: SyncSnapshot = DEFAULT_SYNC_SNAPSHOT;
  @Prop expandedLayout: boolean;
  isOpeningCurrent: () => boolean = (): boolean => true;
  onBack: () => void = (): void => {};
  onReloadConfiguration: () => void = (): void => {};
  onSaveConfig: (url: string, user: string, pass: string, backupPass: string, path: string) => void =
    (_url: string, _user: string, _pass: string, _backupPass: string, _path: string): void => {};
  onTestConnection: (url: string, user: string, pass: string, path: string) => void =
    (_url: string, _user: string, _pass: string, _path: string): void => {};
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueConfigSave: (generation: number, url: string, user: string, pass: string, backupPass: string, directory: string) => void =
    (_generation: number, _url: string, _user: string, _pass: string, _backupPass: string, _directory: string): void => {};
  onSkipBackupRetention: (generation: number) => void = (_generation: number): void => {};
  onTriggerBackup: () => void = (): void => {};
  onRestoreLatest: () => void = (): void => {};
  onResolveRestore: (overwriteLocal: boolean, transactionId: string) => void =
    (_overwriteLocal: boolean, _transactionId: string): void => {};
  @State webdavUrl: string = '';
  @State webdavUser: string = '';
  @State webdavPass: string = '';
  @State backupPass: string = '';
  @State webdavPath: string = '';
  @State private webdavUrlEdited: boolean = false;
  @State private webdavUserEdited: boolean = false;
  @State private webdavPathEdited: boolean = false;
  @State private viewportWidth: number = 0;
  @State private localRecoveryBusy: boolean = false;
  @State private libraryBackupBusy: boolean = false;
  @State private libraryRestoreRevision: number = 0;
  private appliedSnapshotIdentity: string = '';
  private acknowledgedSaveGeneration: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    // @Watch can run before this component is fully mounted. An early write to
    // the identity guard is observable even when the matching @State writes
    // are not, so force one mount-time projection of the latest snapshot.
    this.webdavUrlEdited = false;
    this.webdavUserEdited = false;
    this.webdavPathEdited = false;
    this.appliedSnapshotIdentity = '';
    this.syncSnapshotInputs();
  }

  build() {
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, editingHost: this.editingHost,
      variant: 'sync',
      header: (): void => { this.backBar(); },
      content: (): void => { this.pageContent(); },
      boundedOverlayVisible: !this.localRecoveryBusy && !this.libraryBackupBusy &&
        this.hasOriginalRecovery() && this.snapshot.restoreConflict === undefined,
      boundedOverlayContent: (): void => { this.pendingRecovery(); },
    })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
  }

  @Builder
  private pageContent() {
    LocalRecoveryPanel({ showHeading: true, editingHost: this.editingHost, externalRestoreRevision: this.libraryRestoreRevision,
      isOpeningCurrent: this.isOpeningCurrent,
      isInputAllowed: (): boolean => !this.libraryBackupBusy && this.snapshot.facts?.busy !== true &&
        this.snapshot.restoreConflict === undefined,
      onBusyChange: (busy: boolean): void => { this.localRecoveryBusy = busy; } });
    Column({ space: readerStandardPageSpec('sync').space }) {
      this.webdavSection();
      this.manualActionsSection();
      this.autoBackupSection();
      this.historySection();
    }.width('100%').alignItems(HorizontalAlign.Start).enabled(!this.localRecoveryBusy && !this.libraryBackupBusy);
    if (isReaderProductSurfaceEnabled('sync')) {
      ReaderWebDavLibraryPanel({
        configurationId: this.snapshot.configSaveOperationId ?? '',
        isInputAllowed: (): boolean => this.isOpeningCurrent() && !this.localRecoveryBusy &&
          this.snapshot.facts?.busy !== true && this.snapshot.restoreConflict === undefined && this.canMutate(),
        onBusyChange: (busy: boolean): void => {
          if (this.isOpeningCurrent()) this.libraryBackupBusy = busy;
        },
        onConfigurationChanged: (): void => {
          if (this.isOpeningCurrent()) this.onReloadConfiguration();
        },
        onRestoreStateChanged: (): void => {
          if (this.isOpeningCurrent()) this.libraryRestoreRevision += 1;
        },
      });
    }
  }


  @Builder
  private backBar() {
    PageBackBar({
      floating: true, centered: true, elevation: 'floating',
      showBack: !this.embeddedWide,
      title: '备份与同步',
      onBack: (): void => this.onBack(),
    });
  }

  @Builder
  private sectionHeadingDark(title: string) {
    Text(title)
      .width('100%')
      .fontFamily(TYPE_CARD_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_CARD_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_CARD_SECTION_HEADING.fontSizeFp)
      .lineHeight(TYPE_CARD_SECTION_HEADING.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private sectionHeadingMuted(title: string) {
    Text(title)
      .width('100%')
      .fontFamily(TYPE_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
      .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding({ left: 4, right: 4 });
  }

  @Builder
  private webdavSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('WebDAV 配置');
      ReaderCard({ specId: 'sync-config',
        cardWidth: this.contentFrame().width }) {
        Column({ space: TOK_SPACE_XS }) {
          this.sectionHeadingDark('连接信息');
          this.webdavInputRow('服务器地址', (): string => this.effectiveWebdavUrl(),
            'https://dav.example.com/reader/backup', false, (value: string): void => {
              this.webdavUrlEdited = true;
              this.webdavUrl = value;
            });
          this.webdavInputRow('账号', (): string => this.effectiveWebdavUser(),
            'reader@example.com', false, (value: string): void => {
              this.webdavUserEdited = true;
              this.webdavUser = value;
            });
          this.webdavInputRow('密码', (): string => this.webdavPass,
            '••••••••••••', true, (value: string): void => {
              this.webdavPass = value;
            });
          this.webdavInputRow('备份加密密码', (): string => this.backupPass,
            '与 WebDAV 登录密码分开保存', true, (value: string): void => {
              this.backupPass = value;
            });
          this.webdavInputRow('备份目录', (): string => this.effectiveWebdavPath(),
            '/ReaderBackup/ReaderHarmony', false, (value: string): void => {
              this.webdavPathEdited = true;
              this.webdavPath = value;
            });
          this.configActions();
        }
        .width('100%')
        .padding(TOK_SPACE_SM);
      }
    }
    .width('100%');
  }

  @Builder
  private webdavInputRow(label: string, value: () => string, placeholder: string,
    isPassword: boolean, onChange: (value: string) => void) {
    Column({ space: 5 }) {
      Text(label)
        .width('100%')
        .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
        .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
        .lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ReaderFormField({ editingHost: this.editingHost, scheme: this.appThemeScheme, specId: 'sync-credential', text: value(), placeholder, password: isPassword,
        isEditable: this.canEdit(), onTextChange: (newValue: string): void => onChange(newValue) });
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .alignItems(HorizontalAlign.Start)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }

  @Builder
  private configActions() {
    Row({ space: TOK_SPACE_XS }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-config-test', variant: 'tonal', visualSize: 'medium',
        label: '测试网络连通性', layout: 'equal', actionEnabled: this.canMutate(),
        onAction: (): void => this.onTestConnection(this.effectiveWebdavUrl().trim(), this.effectiveWebdavUser().trim(), this.webdavPass, this.effectiveWebdavPath().trim()) });
      ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-config-save', variant: 'primary', visualSize: 'medium',
        label: '保存配置', layout: 'equal', actionEnabled: this.canMutate(),
        onAction: (): void => this.onSaveConfig(this.effectiveWebdavUrl().trim(), this.effectiveWebdavUser().trim(), this.webdavPass, this.backupPass, this.effectiveWebdavPath().trim()) });
    }.width('100%');
  }

  @Builder
  private manualActionsSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('WebDAV 配置备份与恢复');
      ReaderCard({ specId: 'sync-status',
        cardWidth: this.contentFrame().width }) {
        Column({ space: TOK_SPACE_SM }) {
          if (!this.hasOriginalRecovery() && this.feedbackView().visible) {
            ForEach([this.feedbackView().generation], (generation: number): void => {
              ReaderPageState({ message: this.feedbackView().message, padded: false,
                loading: this.snapshot.facts?.busy === true,
                actionLabel: this.feedbackView().canRetry ? this.recoveryLabel() : '',
                onAction: (): void => {
                  if (!this.hasOriginalRecovery() && generation === this.feedbackView().generation) this.onReconcile(generation);
                } });
            }, (generation: number): string => `sync-read:${generation}`);
          }
          if (this.snapshot.statusMessage.length > 0 && !this.feedbackView().visible) {
            Text(this.snapshot.statusMessage)
              .width('100%')
              .fontFamily(TYPE_FORM_STATUS.fontFamily as string)
              .fontWeight(TYPE_FORM_STATUS.fontWeight as number)
              .fontSize(TYPE_FORM_STATUS.fontSizeFp)
              .lineHeight(TYPE_FORM_STATUS.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme));
          }
          Row({ space: TOK_SPACE_XS }) {
            this.manualActionButton('立即备份', true, (): void => this.onTriggerBackup());
            this.manualActionButton('恢复最新备份', false, (): void => this.onRestoreLatest());
          }
          .width('100%');
          if (this.snapshot.restoreConflict !== undefined) {
            ForEach([this.snapshot.restoreConflict as SyncRestoreConflict], (conflict: SyncRestoreConflict): void => {
              this.restoreConflictCard(conflict);
            }, (conflict: SyncRestoreConflict): string => conflict.transactionId);
          }
        }
        .width('100%')
        .padding(TOK_SPACE_CARD_PADDING);
      }
    }
    .width('100%');
  }

  private hasOriginalRecovery(): boolean {
    const operation = this.snapshot.facts?.operation;
    return operation !== undefined && !operation.completed && !operation.retentionSkipped &&
      operation.projection.receipt.confirmation !== 'undispatched';
  }

  private recoveryIdentity(): string {
    const operation = this.snapshot.facts?.operation;
    return JSON.stringify([operation?.operationId ?? '', operation?.projection.facts.generation ?? 0]);
  }

  private recoveryCurrent(identity: string): boolean {
    return this.hasOriginalRecovery() && this.snapshot.restoreConflict === undefined &&
      identity === this.recoveryIdentity() && this.snapshot.facts?.busy !== true;
  }

  @Builder
  private originalRecovery(identity: string) {
    if (this.canContinueConfigSave()) {
      ForEach(this.configSaveContinuationIdentities(), (continuationId: string): void => {
        this.originalRecoveryNotice(identity, continuationId, 'config');
      }, (continuationId: string): string => continuationId);
    } else if (this.canSkipBackupRetention()) {
      ForEach(this.backupRetentionActionIdentities(), (retentionId: string): void => {
        this.originalRecoveryNotice(identity, retentionId, 'retention');
      }, (retentionId: string): string => retentionId);
    } else {
      this.originalRecoveryNotice(identity, '', 'none');
    }
  }

  @Builder
  private originalRecoveryNotice(identity: string, secondaryIdentity: string, kind: 'config' | 'retention' | 'none') {
    ReaderRecoveryNotice({ view: this.feedbackView(), actionLabel: this.recoveryLabel(),
      retainPrimaryAction: this.snapshot.facts?.busy === true,
      actionEnabled: this.recoveryCurrent(identity) && this.feedbackView().canRetry,
      secondaryActionEnabled: this.recoveryCurrent(identity),
      secondaryActionLabel: kind === 'config' ? '继续原操作' : kind === 'retention' ? '保留备份，结束清理' : '',
      onReconcile: (generation: number): void => {
        if (this.recoveryCurrent(identity) && this.feedbackView().canRetry) this.onReconcile(generation);
      },
      onSecondaryAction: (): void => {
        if (!this.recoveryCurrent(identity)) return;
        if (kind === 'config' && this.canContinueConfigSave() &&
          this.configSaveContinuationIdentities().indexOf(secondaryIdentity) >= 0) {
          this.onContinueConfigSave(this.configSaveGeneration(secondaryIdentity), this.effectiveWebdavUrl(),
            this.effectiveWebdavUser(), this.webdavPass, this.backupPass, this.effectiveWebdavPath());
        }
        if (kind === 'retention' && this.canSkipBackupRetention() &&
          this.backupRetentionActionIdentities().indexOf(secondaryIdentity) >= 0) {
          this.onSkipBackupRetention(this.backupGeneration(secondaryIdentity));
        }
      } });
  }

  @Builder
  private pendingRecovery() {
    ForEach([this.recoveryIdentity()], (identity: string): void => { this.originalRecovery(identity); },
      (identity: string): string => identity);
  }

  @Builder
  private manualActionButton(label: string, primary: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-action', label, variant: primary ? 'primary' : 'tonal',
      visualSize: 'medium', actionEnabled: this.canMutate(), layout: 'equal', onAction: action });
  }

  @Builder
  private restoreConflictCard(conflict: SyncRestoreConflict) {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingDark('本机配置与远端备份不同');
      Text(`备份 ${conflict.backupId} · 本机 ${conflict.localChecksum.substring(0, 8)}… · 远端 ${conflict.remoteChecksum.substring(0, 8)}…`)
        .width('100%')
        .fontFamily(TYPE_SYNC_CONFLICT_META.fontFamily as string)
        .fontWeight(TYPE_SYNC_CONFLICT_META.fontWeight as number)
        .fontSize(TYPE_SYNC_CONFLICT_META.fontSizeFp)
        .lineHeight(TYPE_SYNC_CONFLICT_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Row({ space: TOK_SPACE_XS }) {
        this.manualActionButton('取消', false, (): void => this.onResolveRestore(false, conflict.transactionId));
        this.manualActionButton('恢复本机配置', true, (): void => this.onResolveRestore(true, conflict.transactionId));
      }
      .width('100%');
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(14);
  }

  @Builder
  private autoBackupSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('WebDAV 自动备份（尚未启用）');
      ReaderCard({ specId: 'sync-status',
        cardWidth: this.contentFrame().width }) {
        Column() {
          this.gatedRow('保存位置', (): string => this.snapshot.saveLocation);
          Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme));
          this.gatedRow('备份频率', (): string => this.snapshot.backupFrequency);
          Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme));
          this.scopeRow();
        }
        .width('100%');
      }
    }
    .width('100%');
  }

  @Builder
  private gatedRow(label: string, value: () => string) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily(TYPE_SYNC_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_SYNC_ROW_LABEL.fontWeight)
        .fontSize(TYPE_SYNC_ROW_LABEL.fontSizeFp)
        .lineHeight(TYPE_SYNC_ROW_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(value())
        .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily)
        .fontWeight(TYPE_APP_ROW_DETAIL.fontWeight)
        .fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp)
        .lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
    .opacity(0.72)
    .hitTestBehavior(HitTestMode.None);
  }

  // FIGMA_MULTISELECT_EXPANDED_STATE_MISSING: “N项已选”是多选触发语义，不能再用
  // ReaderSelect 的单选预制字符串冒充。展开面板与持久化契约确认前保持不可编辑。
  @Builder
  private scopeRow() {
    Row() {
      Text('备份范围')
        .layoutWeight(1)
        .fontFamily(TYPE_SYNC_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_SYNC_ROW_LABEL.fontWeight)
        .fontSize(TYPE_SYNC_ROW_LABEL.fontSizeFp)
        .lineHeight(TYPE_SYNC_ROW_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
      Row({ space: 8 }) {
        Text(this.scopeSummary())
          .fontFamily(TYPE_SELECT_DEFAULT_VALUE.fontFamily)
          .fontWeight(TYPE_SELECT_DEFAULT_VALUE.fontWeight)
          .fontSize(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp)
          .lineHeight(TYPE_SELECT_DEFAULT_VALUE.lineHeightFp ?? Math.round(TYPE_SELECT_DEFAULT_VALUE.fontSizeFp * 1.5)).halfLeading(true)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
          .textAlign(TextAlign.Start)
          .maxLines(1);
        Image((this.appThemeScheme === 'night' ? $r('app.media.sync_scope_chevron_theme_night') : $r('app.media.sync_scope_chevron'))).width(12).height(8);
      }
      .constraintSize({ minWidth: 86, minHeight: 36 })
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
      .backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
      .borderRadius(TOK_RADIUS_PILL)
      .alignItems(VerticalAlign.Center)
      .opacity(0.62)
      .hitTestBehavior(HitTestMode.None)
      .accessibilityText('备份范围')
      .accessibilityDescription('暂不支持自定义备份范围');
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private historySection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('WebDAV 备份记录');
      if (this.snapshot.history.length === 0) {
        this.emptyState();
      } else {
        Column({ space: 9 }) {
          // These read-only rows project the current ordered snapshot. The minute
          // caption is shared by distinct events, so position owns each slot.
          ForEach(this.snapshot.history, (_entry: SyncHistoryEntry, index: number) => {
            this.historyRow(index);
          }, (_entry: SyncHistoryEntry, index: number): string => `sync-history-${index}`);
        }
        .width('100%');
      }
    }
    .width('100%');
  }

  // Empty state is real app behavior (not present in the populated Figma
  // node) and is kept as-is, restyled to the new card tokens.
  @Builder
  private emptyState() {
    ReaderCard({ specId: 'sync-status',
      cardWidth: this.contentFrame().width }) {
      Column({ space: 0 }) {
        Text('暂无备份记录')
          .width('100%')
          .fontFamily(TYPE_APP_LOADING_BODY.fontFamily)
          .fontWeight(TYPE_APP_LOADING_BODY.fontWeight)
          .fontSize(TYPE_APP_LOADING_BODY.fontSizeFp)
          .lineHeight(TYPE_APP_LOADING_BODY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .padding({ top: TOK_SPACE_LG, bottom: TOK_SPACE_SM });
        ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-empty-backup', variant: 'primary', visualSize: 'large', label: '立即备份', layout: 'full',
          actionEnabled: this.canMutate(), onAction: (): void => this.onTriggerBackup() });
      }
      .width('100%')
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING, bottom: TOK_SPACE_CARD_PADDING });
    }
  }

  @Builder
  private historyRow(index: number) {
    ReaderCard({
      specId: 'sync-status',
      cardWidth: this.contentFrame().width,
    }) {
      Column() {
        Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
          space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
          Stack({ alignContent: Alignment.Center }) {
            Text(this.snapshot.history[index]?.destination ?? '')
              .fontFamily(TYPE_APP_SMALL_LABEL.fontFamily)
              .fontWeight(TYPE_APP_SMALL_LABEL.fontWeight)
              .fontSize(TYPE_APP_SMALL_LABEL.fontSizeFp)
              .fontColor(readerAppColor('app.text.syncBadge', this.appThemeScheme))
              .maxLines(1);
          }
          .constraintSize({ minWidth: 64, minHeight: 24 })
          .padding({ left: 8, right: 8 })
          .borderRadius(8)
          .backgroundColor(readerAppColor('app.sync.badgeSurface', this.appThemeScheme));

          Text(this.snapshot.history[index]?.timestamp ?? '')
            .fontFamily(TYPE_SYNC_INPUT.fontFamily)
            .fontWeight(TYPE_SYNC_INPUT.fontWeight)
            .fontSize(TYPE_SYNC_INPUT.fontSizeFp)
            .fontColor(readerAppColor('app.text.syncMeta', this.appThemeScheme))
            .maxLines(1)
            .constraintSize({ maxWidth: '100%' });
        }
        .width('100%');

        Row() {
          // Figma's scope line (e.g. "书架、分组、设置") has no backing field on
          // SyncHistoryEntry; the entry's ok flag is shown as a real status.
          Text(this.snapshot.history[index] === undefined ? '' : this.snapshot.history[index]?.ok ? '成功' : '失败')
            .layoutWeight(1)
            .fontFamily(TYPE_SYNC_HISTORY_STATUS.fontFamily)
            .fontWeight(TYPE_SYNC_HISTORY_STATUS.fontWeight)
            .fontSize(TYPE_SYNC_HISTORY_STATUS.fontSizeFp)
            .fontColor(readerAppColor('app.text.syncMeta', this.appThemeScheme))
            .maxLines(1);
          Text(`${((this.snapshot.history[index]?.size ?? 0) / 1048576).toFixed(1)} MB`)
            .fontFamily(TYPE_SYNC_INPUT.fontFamily)
            .fontWeight(TYPE_SYNC_INPUT.fontWeight)
            .fontSize(TYPE_SYNC_INPUT.fontSizeFp)
            .fontColor(readerAppColor('app.text.syncHint', this.appThemeScheme))
            .maxLines(1);
        }
        .width('100%')
        .margin({ top: 15 })
        .alignItems(VerticalAlign.Center);
      }
      .width('100%')
      .constraintSize({ minHeight: 85 })
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING, top: TOK_SPACE_SM })
      .alignItems(HorizontalAlign.Start);
    }
  }

  private scopeSummary(): string {
    if (this.snapshot.backupScope.trim() === '') {
      return '未选择';
    }
    const scopes = this.snapshot.backupScope.split('、').filter((scope: string): boolean => scope.trim() !== '');
    return `${scopes.length}项已选`;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return readerStandardPageContentFrame('sync', metrics, containerWidth);
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private canEdit(): boolean { return this.snapshot.facts?.busy !== true; }

  private canMutate(): boolean { return this.snapshot.facts?.canMutate ?? true; }

  private feedbackView(): ReaderRecoveryView {
    const facts = this.snapshot.facts;
    const read = facts?.read.fact === 'failed' || facts?.read.fact === 'refreshFailed' ? facts.read : facts?.request ?? facts?.read;
    return readerRecoveryView(facts?.request !== undefined && !this.hasOriginalRecovery() ? undefined :
      facts?.operation?.projection, read);
  }

  private canContinueConfigSave(): boolean {
    const operation = this.snapshot.facts?.operation;
    return operation?.action === 'saveConfig' && !operation.completed && operation.canContinueOriginal === true;
  }
  private configSaveContinuationIdentities(): string[] {
    const operation = this.snapshot.facts?.operation;
    return this.canContinueConfigSave() && operation?.operationId !== undefined ?
      [`${operation.operationId}:${operation.projection.facts.generation}`] : [];
  }
  private configSaveGeneration(identity: string): number {
    return Number(identity.substring(identity.lastIndexOf(':') + 1));
  }

  private canSkipBackupRetention(): boolean {
    const operation = this.snapshot.facts?.operation;
    return operation?.action === 'backup' && operation.uploadQualified && !operation.completed &&
      operation.retentionSkipped !== true;
  }

  private backupRetentionActionIdentities(): string[] {
    const operation = this.snapshot.facts?.operation;
    return operation?.operationId === undefined ? [] :
      [`${operation.operationId}:${operation.projection.facts.generation}`];
  }

  private backupGeneration(identity?: string): number {
    return identity === undefined ? this.snapshot.facts?.operation?.projection.facts.generation ?? 0 :
      Number(identity.substring(identity.lastIndexOf(':') + 1));
  }

  private recoveryLabel(): string {
    const operation = this.snapshot.facts?.operation;
    if (operation?.action === 'saveConfig' && !operation.completed) return '核对原配置保存';
    if (operation?.action === 'backup' && !operation.completed && !operation.retentionSkipped) return '核对本次备份';
    return operation !== undefined && !operation.completed &&
      (operation.action === 'restore' || operation.action === 'resolveRestore') ? '核对已有恢复' : '重新读取配置';
  }

  private effectiveWebdavUrl(): string {
    return this.webdavUrlEdited ? this.webdavUrl : this.snapshot.webdavUrl;
  }

  private effectiveWebdavUser(): string {
    return this.webdavUserEdited ? this.webdavUser : this.snapshot.webdavUser;
  }

  private effectiveWebdavPath(): string {
    return this.webdavPathEdited ? this.webdavPath : this.snapshot.webdavPath;
  }

  private onSnapshotChanged(): void {
    const operation = this.snapshot.facts?.operation;
    if (operation?.action === 'saveConfig' && operation.projection.receipt.confirmation === 'confirmed' &&
      operation.writeGeneration > this.acknowledgedSaveGeneration) {
      this.acknowledgedSaveGeneration = operation.writeGeneration;
      this.webdavPass = '';
      this.backupPass = '';
    }
    this.syncSnapshotInputs();
  }

  private syncSnapshotInputs(): void {
    const identity = `${this.snapshot.webdavUrl}\n${this.snapshot.webdavUser}\n${this.snapshot.webdavPath}`;
    if (identity === this.appliedSnapshotIdentity) {
      return;
    }
    this.appliedSnapshotIdentity = identity;
    if (!this.webdavUrlEdited) {
      this.webdavUrl = this.snapshot.webdavUrl;
    }
    if (!this.webdavUserEdited) {
      this.webdavUser = this.snapshot.webdavUser;
    }
    this.webdavPass = '';
    this.backupPass = '';
    if (!this.webdavPathEdited) {
      this.webdavPath = this.snapshot.webdavPath;
    }
  }
}
