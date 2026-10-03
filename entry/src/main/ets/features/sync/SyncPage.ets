import { ReaderButton } from '../common/ReaderButton';
import { ReaderFormField } from '../common/ReaderFormField';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { TYPE_APP_COMPACT_BADGE, TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_LOADING_BODY, TYPE_APP_ROW_LABEL, TYPE_APP_SMALL_LABEL, TYPE_FORM_ACTION, TYPE_FORM_LABEL_ACTION, TYPE_FORM_STATUS, TYPE_SECTION_HEADING, TYPE_SYNC_BACKUP_ACTION, TYPE_SYNC_CONFLICT_META, TYPE_SYNC_HISTORY_STATUS, TYPE_SYNC_INPUT, TYPE_SYNC_MUTED_HEADING, TYPE_SYNC_ROW_LABEL } from '../common/ReaderTypography';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from '../common/ReaderFloatingBarMetrics';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  type SyncHistoryEntry,
  type SyncRestoreConflict,
  type SyncSnapshot,
  DEFAULT_SYNC_SNAPSHOT,
} from './SyncGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderCard } from '../common/ReaderCard';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_READ_PRIMARY,
  TOK_SCREEN_INSET,
  TOK_SETTING_ICON_BG,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

// Sync Backup — rebuilt 2026-08-05 against live Figma nodes
// 943:4982 (Phone 390×844) / 943:5462 (Tablet 760×960).
// Structural notes: WebDAV card = #E6FFFCF8 + 1px #C1C7CD r8 with 4 labelled
// rows (28px circular blue icon + 36px r6 input) and two action buttons;
// Auto Backup / History = solid #FFFCF8 cards + #D8D0C3 r13 with muted
// 11px tracked section titles.

@Component
export struct SyncPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSnapshotChanged') snapshot: SyncSnapshot = DEFAULT_SYNC_SNAPSHOT;
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
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
  onResolveRestore: (overwriteLocal: boolean) => void = (_overwriteLocal: boolean): void => {};
  @State webdavUrl: string = '';
  @State webdavUser: string = '';
  @State webdavPass: string = '';
  @State backupPass: string = '';
  @State webdavPath: string = '';
  @State private webdavUrlEdited: boolean = false;
  @State private webdavUserEdited: boolean = false;
  @State private webdavPathEdited: boolean = false;
  @State private viewportWidth: number = 0;
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
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.webdavSection();
          this.manualActionsSection();
          this.autoBackupSection();
          this.historySection();
        }
        .width('100%')
        .padding({
          left: this.contentFrame().left,
          right: this.contentFrame().right,
          top: READER_FLOATING_TOP_BAR_HEIGHT + TOK_SPACE_XS,
          bottom: this.bottomContentInset(),
        });
      }
      .height('100%')
      .width('100%')
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off);
      this.backBar();
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
    .clip(true)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }


  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 18;
    return readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), 18);
  }
  @Builder
  private backBar() {
    PageBackBar({
      title: '同步与备份',
      titleColor: readerAppColor('app.SyncPage.backBar.paint.FF1A1612', this.appThemeScheme),
      onBack: (): void => this.onBack(),
    });
  }

  // Section title inside the WebDAV section (dark 13px Inter Black).
  @Builder
  private sectionHeadingDark(title: string) {
    Text(title)
      .width('100%')
      .height(16)
      .fontFamily(TYPE_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
      .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM });
  }

  // Auto Backup / History section titles: muted 11px tracked caps.
  @Builder
  private sectionHeadingMuted(title: string) {
    Text(title)
      .width('100%')
      .fontFamily(TYPE_SYNC_MUTED_HEADING.fontFamily)
      .fontWeight(TYPE_SYNC_MUTED_HEADING.fontWeight)
      .fontSize(TYPE_SYNC_MUTED_HEADING.fontSizeFp)
      .fontColor(readerAppColor('app.SyncPage.sectionHeadingMuted.fontColor.FF9C9488', this.appThemeScheme))
      .letterSpacing(TYPE_SYNC_MUTED_HEADING.letterSpacingFp as number)
      .padding({ left: TOK_SPACE_SM });
  }

  @Builder
  private webdavSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingDark('WebDAV 配置');
      ReaderCard({ specId: 'sync-config',
        cardWidth: this.contentFrame().width }) {
        Column({ space: TOK_SPACE_XS }) {
          Text('连接信息')
            .width('100%')
            .fontFamily(TYPE_SECTION_HEADING.fontFamily)
            .fontWeight(TYPE_SECTION_HEADING.fontWeight)
            .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
            .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          this.webdavInputRow((this.appThemeScheme === 'night' ? $r('app.media.sync_server_theme_night') : $r('app.media.sync_server')), '服务器地址', this.effectiveWebdavUrl(),
            'https://dav.example.com/reader/backup', false, (value: string): void => {
              this.webdavUrlEdited = true;
              this.webdavUrl = value;
            });
          this.webdavInputRow((this.appThemeScheme === 'night' ? $r('app.media.sync_account_theme_night') : $r('app.media.sync_account')), '账号', this.effectiveWebdavUser(),
            'reader@example.com', false, (value: string): void => {
              this.webdavUserEdited = true;
              this.webdavUser = value;
            });
          this.webdavInputRow((this.appThemeScheme === 'night' ? $r('app.media.sync_password_theme_night') : $r('app.media.sync_password')), '密码', this.webdavPass,
            '••••••••••••', true, (value: string): void => {
              this.webdavPass = value;
            });
          this.webdavInputRow((this.appThemeScheme === 'night' ? $r('app.media.sync_backup_password_theme_night') : $r('app.media.sync_backup_password')), '备份加密密码', this.backupPass,
            '与 WebDAV 登录密码分开保存', true, (value: string): void => {
              this.backupPass = value;
            });
          this.webdavInputRow((this.appThemeScheme === 'night' ? $r('app.media.sync_folder_theme_night') : $r('app.media.sync_folder')), '同步目录', this.effectiveWebdavPath(),
            '/ReaderBackup/ReaderAndroid', false, (value: string): void => {
              this.webdavPathEdited = true;
              this.webdavPath = value;
            });
          this.configActions();
        }
        .width('100%')
        .padding({ left: 11, right: 11, top: TOK_SPACE_CONTROL_INLINE, bottom: 11 });
      }
    }
    .width('100%');
  }

  @Builder
  private webdavInputRow(icon: Resource, label: string, value: string, placeholder: string,
    isPassword: boolean, onChange: (value: string) => void) {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(icon).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.appThemeScheme));

      Column({ space: 5 }) {
        Text(label)
          .width('100%')
          .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
          .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
          .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
          .lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
        // Credential masking remains the original native password policy.
        ReaderFormField({ scheme: this.appThemeScheme, specId: 'sync-credential', text: value, placeholder, password: isPassword,
          isEditable: this.canEdit(), onTextChange: (newValue: string): void => onChange(newValue) });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .padding({ left: 11, right: 11, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(readerAppColor('app.SyncPage.ROW_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.SyncPage.ROW_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private configActions() {
    Row({ space: TOK_SPACE_XS }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-config-test', label: '测试网络连通性', layout: 'equal', actionEnabled: this.canMutate(),
        onAction: (): void => this.onTestConnection(this.effectiveWebdavUrl().trim(), this.effectiveWebdavUser().trim(), this.webdavPass, this.effectiveWebdavPath().trim()) });
      ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-config-save', label: '保存配置', primary: true, layout: 'equal', actionEnabled: this.canMutate(),
        onAction: (): void => this.onSaveConfig(this.effectiveWebdavUrl().trim(), this.effectiveWebdavUser().trim(), this.webdavPass, this.backupPass, this.effectiveWebdavPath().trim()) });
    }.width('100%');
  }

  @Builder
  private manualActionsSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('前台手动备份');
      ReaderCard({ specId: 'sync-status',
        cardWidth: this.contentFrame().width }) {
        Column({ space: TOK_SPACE_SM }) {
          ReaderRecoveryNotice({ view: this.feedbackView(), actionLabel: this.recoveryLabel(),
            onReconcile: (generation: number): void => this.onReconcile(generation) });
          if (this.canContinueConfigSave()) {
            ForEach(this.configSaveContinuationIdentities(), (identity: string): void => {
              ReaderRecoveryAction({ label: '继续原操作', generation: this.configSaveGeneration(identity),
                actionEnabled: this.snapshot.facts?.busy !== true,
                onReconcile: (generation: number): void => this.onContinueConfigSave(generation,
                  this.effectiveWebdavUrl(), this.effectiveWebdavUser(), this.webdavPass, this.backupPass, this.effectiveWebdavPath()) });
            }, (identity: string): string => identity);
          }
          if (this.canSkipBackupRetention()) {
            // This mutating consent actor belongs to one exact receipt identity.
            // V1 callback fields are construction-only; rebuild only this action
            // when its receipt changes so an old physical callback keeps old ID.
            ForEach(this.backupRetentionActionIdentities(), (_identity: string): void => {
              ReaderRecoveryAction({ label: '保留备份，结束清理', generation: this.backupGeneration(_identity),
                actionEnabled: this.snapshot.facts?.busy !== true,
                onReconcile: (generation: number): void => this.onSkipBackupRetention(generation) });
            }, (identity: string): string => identity);
          }
          if (this.snapshot.statusMessage.length > 0 && !this.feedbackView().visible) {
            Text(this.snapshot.statusMessage)
              .width('100%')
              .fontFamily(TYPE_FORM_STATUS.fontFamily as string)
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
            this.restoreConflictCard(this.snapshot.restoreConflict as SyncRestoreConflict);
          }
        }
        .width('100%')
        .padding(TOK_SPACE_CARD_PADDING);
      }
    }
    .width('100%');
  }

  @Builder
  private manualActionButton(label: string, primary: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-action', label, primary, actionEnabled: this.canMutate(), layout: 'equal', onAction: action });
  }

  @Builder
  private restoreConflictCard(conflict: SyncRestoreConflict) {
    Column({ space: TOK_SPACE_XS }) {
      Text('检测到本机与远端完整备份不同')
        .width('100%')
        .fontFamily(TYPE_FORM_LABEL_ACTION.fontFamily)
        .fontWeight(TYPE_FORM_LABEL_ACTION.fontWeight)
        .fontSize(TYPE_FORM_LABEL_ACTION.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(`备份 ${conflict.backupId} · 本机 ${conflict.localChecksum.substring(0, 8)}… · 远端 ${conflict.remoteChecksum.substring(0, 8)}…`)
        .width('100%')
        .fontFamily(TYPE_SYNC_CONFLICT_META.fontFamily as string)
        .fontSize(TYPE_SYNC_CONFLICT_META.fontSizeFp)
        .lineHeight(TYPE_SYNC_CONFLICT_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Row({ space: TOK_SPACE_XS }) {
        this.manualActionButton('取消', false, (): void => this.onResolveRestore(false));
        this.manualActionButton('覆盖本机', true, (): void => this.onResolveRestore(true));
      }
      .width('100%');
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private autoBackupSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('自动备份（尚未启用）');
      ReaderCard({ specId: 'sync-status',
        cardWidth: this.contentFrame().width }) {
        Column() {
          this.gatedRow('保存位置', this.snapshot.saveLocation);
          Row().width('100%').height(1).backgroundColor(readerAppColor('app.SyncPage.CARD_BORDER_SOFT', this.appThemeScheme));
          this.gatedRow('备份频率', this.snapshot.backupFrequency);
          Row().width('100%').height(1).backgroundColor(readerAppColor('app.SyncPage.CARD_BORDER_SOFT', this.appThemeScheme));
          this.scopeRow();
        }
        .width('100%');
      }
    }
    .width('100%');
  }

  @Builder
  private gatedRow(label: string, value: string) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily(TYPE_SYNC_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_SYNC_ROW_LABEL.fontWeight)
        .fontSize(TYPE_SYNC_ROW_LABEL.fontSizeFp)
        .fontColor(readerAppColor('app.SyncPage.gatedRow.fontColor.FF1A1612', this.appThemeScheme));
      Text(value)
        .fontFamily(TYPE_FORM_ACTION.fontFamily)
        .fontWeight(TYPE_FORM_ACTION.fontWeight)
        .fontSize(TYPE_FORM_ACTION.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width('100%')
    .height(50)
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
        .fontColor(readerAppColor('app.SyncPage.scopeRow.fontColor.FF1A1612', this.appThemeScheme))
        .maxLines(1);
      Row({ space: 8 }) {
        Text(this.scopeSummary())
          .layoutWeight(1)
          .fontFamily(TYPE_FORM_ACTION.fontFamily)
          .fontWeight(TYPE_FORM_ACTION.fontWeight)
          .fontSize(TYPE_FORM_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
          .textAlign(TextAlign.Start)
          .maxLines(1);
        Image((this.appThemeScheme === 'night' ? $r('app.media.sync_scope_chevron_theme_night') : $r('app.media.sync_scope_chevron'))).width(12).height(8);
      }
      .width(86)
      .height(36)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(6)
      .alignItems(VerticalAlign.Center)
      .opacity(0.62)
      .hitTestBehavior(HitTestMode.None)
      .accessibilityText('备份范围')
      .accessibilityDescription('多选展开设计和持久化契约待确认，当前不可编辑');
    }
    .width('100%')
    .height(50)
    .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private historySection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('历史备份');
      if (this.snapshot.history.length === 0) {
        this.emptyState();
      } else {
        Column({ space: 9 }) {
          ForEach(this.snapshot.history, (entry: SyncHistoryEntry) => {
            this.historyRow(entry);
          }, (entry: SyncHistoryEntry): string => `sync-history-${entry.timestamp}`);
          this.expandRow();
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
        ReaderButton({ scheme: this.appThemeScheme, specId: 'sync-empty-backup', label: '立即备份', layout: 'full',
          actionEnabled: this.canMutate(), onAction: (): void => this.onTriggerBackup() });
      }
      .width('100%');
    }
  }

  @Builder
  private historyRow(entry: SyncHistoryEntry) {
    ReaderCard({
      specId: 'sync-status',
      cardWidth: this.contentFrame().width,
    }) {
      Column() {
        Row() {
          Stack({ alignContent: Alignment.Center }) {
            Text(entry.destination)
              .fontFamily(TYPE_APP_SMALL_LABEL.fontFamily)
              .fontWeight(TYPE_APP_SMALL_LABEL.fontWeight)
              .fontSize(TYPE_APP_SMALL_LABEL.fontSizeFp)
              .fontColor(readerAppColor('app.SyncPage.historyRow.fontColor.FF243D30', this.appThemeScheme))
              .maxLines(1);
          }
          .width(64)
          .height(24)
          .borderRadius(12)
          .backgroundColor(readerAppColor('app.SyncPage.BADGE_BG', this.appThemeScheme));

          Text(entry.timestamp)
            .fontFamily(TYPE_SYNC_INPUT.fontFamily)
            .fontWeight(TYPE_SYNC_INPUT.fontWeight)
            .fontSize(TYPE_SYNC_INPUT.fontSizeFp)
            .fontColor(readerAppColor('app.SyncPage.historyRow.fontColor.FF5C564E', this.appThemeScheme))
            .maxLines(1)
            .margin({ left: TOK_SPACE_CONTROL_INLINE });
        }
        .width('100%')
        .alignItems(VerticalAlign.Center);

        Row() {
          // Figma's scope line (e.g. "书架、分组、设置") has no backing field on
          // SyncHistoryEntry; the entry's ok flag is shown as a real status.
          Text(entry.ok ? '成功' : '失败')
            .layoutWeight(1)
            .fontFamily(TYPE_SYNC_HISTORY_STATUS.fontFamily)
            .fontWeight(TYPE_SYNC_HISTORY_STATUS.fontWeight)
            .fontSize(TYPE_SYNC_HISTORY_STATUS.fontSizeFp)
            .fontColor(readerAppColor('app.SyncPage.historyRow.fontColor.FF5C564E', this.appThemeScheme))
            .maxLines(1);
          Text(`${(entry.size / 1048576).toFixed(1)} MB`)
            .fontFamily(TYPE_SYNC_INPUT.fontFamily)
            .fontWeight(TYPE_SYNC_INPUT.fontWeight)
            .fontSize(TYPE_SYNC_INPUT.fontSizeFp)
            .fontColor(readerAppColor('app.SyncPage.historyRow.fontColor.FF9C9488', this.appThemeScheme))
            .maxLines(1);
        }
        .width('100%')
        .margin({ top: 15 })
        .alignItems(VerticalAlign.Center);
      }
      .width('100%')
      .height(85)
      .padding({ left: 13, right: 13, top: TOK_SPACE_SM })
      .alignItems(HorizontalAlign.Start);
    }
  }

  @Builder
  private expandRow() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Text('展开')
          .fontFamily(TYPE_APP_COMPACT_BADGE.fontFamily)
          .fontWeight(TYPE_APP_COMPACT_BADGE.fontWeight)
          .fontSize(TYPE_APP_COMPACT_BADGE.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      }
      .height(26)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(8);
    }
    .width('100%')
    .height(32)
    .justifyContent(FlexAlign.End);
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
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
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
    return readerRecoveryView(facts?.operation?.projection, read);
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
