import {
  type SyncHistoryEntry,
  type SyncSnapshot,
  DEFAULT_SYNC_SNAPSHOT,
} from './SyncGateway';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderSelect } from '../common/ReaderSelect';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_CONTROL_INK,
  TOK_FIELD_SURFACE,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

// Sync Backup — rebuilt 2026-08-05 against live Figma nodes
// 943:4982 (Phone 390×844) / 943:5462 (Tablet 760×960).
// Structural notes: WebDAV card = #E6FFFCF8 + 1px #C1C7CD r8 with 4 labelled
// rows (28px circular blue icon + 36px r6 input) and two action buttons;
// Auto Backup / History = solid #FFFCF8 cards + #D8D0C3 r13 with muted
// 11px tracked section titles.
const CARD_BG_SOLID = '#FFFCF8';   // solid — Auto/History cards
const CARD_BORDER_SOFT = '#D8D0C3';
const ROW_BG = '#B3FFFCF8';        // rgba(255,252,248,0.7) — labelled row
const ROW_BORDER = '#4DB4A697';    // rgba(180,166,151,0.3)
const ICON_BG = '#172379A4';       // rgba(35,121,164,0.09) — row icon circle
const GHOST_BG = '#14236179';      // rgba(35,97,121,0.08) — test button
const GHOST_BORDER = '#38236179';  // rgba(35,97,121,0.22)
const SOLID_BG = '#243D30';        // save button
const BADGE_BG = '#EEE7DB';
const EXPAND_BG = '#A3EEE7DB';     // rgba(238,230,219,0.64)

@Component
export struct SyncPage {
  @Prop snapshot: SyncSnapshot = DEFAULT_SYNC_SNAPSHOT;
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onTestConnection: (url: string, user: string, pass: string) => void =
    (_url: string, _user: string, _pass: string): void => {};
  onTriggerBackup: () => void = (): void => {};
  @State webdavUrl: string = '';
  @State webdavUser: string = '';
  @State webdavPass: string = '';
  @State webdavPath: string = '';
  @State private openSelect: string = '';

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.webdavUrl = this.snapshot.webdavUrl;
    this.webdavUser = this.snapshot.webdavUser;
    this.webdavPass = this.snapshot.webdavPass;
  }

  build() {
    Column() {
      this.backBar();
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.webdavSection();
          this.autoBackupSection();
          this.historySection();
        }
        .width('100%')
        .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: 18 });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private backBar() {
    PageBackBar({
      title: '同步与备份',
      titleColor: '#1A1612',
      onBack: (): void => this.onBack(),
    });
  }

  // Section title inside the WebDAV section (dark 13px Inter Black).
  @Builder
  private sectionHeadingDark(title: string) {
    Text(title)
      .width('100%')
      .height(16)
      .fontFamily('ReaderInter')
      .fontWeight(900)
      .fontSize(13)
      .lineHeight(15.6)
      .fontColor(TOK_INK)
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM });
  }

  // Auto Backup / History section titles: muted 11px tracked caps.
  @Builder
  private sectionHeadingMuted(title: string) {
    Text(title)
      .width('100%')
      .fontFamily('ReaderInter')
      .fontWeight(900)
      .fontSize(11)
      .fontColor('#9C9488')
      .letterSpacing(1.1)
      .padding({ left: TOK_SPACE_SM });
  }

  @Builder
  private webdavSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingDark('WebDAV 配置');
      Column({ space: TOK_SPACE_XS }) {
        Text('连接信息')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor(TOK_INK);
        this.webdavInputRow($r('app.media.bookshelf_rss'), '服务器地址', this.webdavUrl,
          'https://dav.example.com/reader/backup', false, (value: string): void => {
            this.webdavUrl = value;
          });
        this.webdavInputRow($r('app.media.directory_bookmark'), '账号', this.webdavUser,
          'reader@example.com', false, (value: string): void => {
            this.webdavUser = value;
          });
        this.webdavInputRow($r('app.media.directory_bookmark_on'), '密码', this.webdavPass,
          '••••••••••••', true, (value: string): void => {
            this.webdavPass = value;
          });
        this.webdavInputRow($r('app.media.reader_directory_directory'), '同步目录', this.webdavPath,
          '/ReaderBackup/ReaderAndroid', false, (value: string): void => {
            this.webdavPath = value;
          });
        this.configActions();
      }
      .width('100%')
      .padding({ left: 11, right: 11, top: TOK_SPACE_CONTROL_INLINE, bottom: 11 })
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(8);
    }
    .width('100%');
  }

  @Builder
  private webdavInputRow(icon: Resource, label: string, value: string, placeholder: string,
    isPassword: boolean, onChange: (value: string) => void) {
    Row({ space: 9 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(icon).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(ICON_BG);

      Column({ space: 5 }) {
        Text(label)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .lineHeight(15.34)
          .fontColor(TOK_INK)
          .maxLines(1);
        if (isPassword) {
          TextInput({ text: value, placeholder: placeholder })
            .width('100%')
            .height(36)
            // Credentials must never be rendered as ordinary readable page
            // text. They remain transient page state; this does not introduce
            // a storage policy for WebDAV secrets.
            .type(InputType.Password)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(12)
            .fontColor(TOK_CONTROL_INK)
            .backgroundColor(TOK_FIELD_SURFACE)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(6)
            .padding({ left: 11, right: 11 })
            .placeholderColor('#9C9488')
            .onChange((newValue: string): void => onChange(newValue));
        } else {
          TextInput({ text: value, placeholder: placeholder })
            .width('100%')
            .height(36)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(12)
            .fontColor(TOK_CONTROL_INK)
            .backgroundColor(TOK_FIELD_SURFACE)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(6)
            .padding({ left: 11, right: 11 })
            .placeholderColor('#9C9488')
            .onChange((newValue: string): void => onChange(newValue));
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .padding({ left: 11, right: 11, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(ROW_BG)
    .border({ width: TOK_BORDER_W, color: ROW_BORDER })
    .borderRadius(8);
  }

  @Builder
  private configActions() {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('测试网络连通性')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor(TOK_PRIMARY_DARK);
      }
      .height(42)
      .layoutWeight(1)
      .backgroundColor(GHOST_BG)
      .border({ width: TOK_BORDER_W, color: GHOST_BORDER })
      .borderRadius(8)
      .onClick((): void => this.onTestConnection(this.webdavUrl.trim(), this.webdavUser.trim(), this.webdavPass));

      Stack({ alignContent: Alignment.Center }) {
        Text('保存配置')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .fontColor('#FFFFFF');
      }
      .height(42)
      .layoutWeight(1)
      .backgroundColor(SOLID_BG)
      .border({ width: TOK_BORDER_W, color: SOLID_BG })
      .borderRadius(12)
      // 保存配置 is visual-only: the host has no WebDAV-config persistence
      // callback (see coverage matrix, Sync ⊘Core阻塞), so it must NOT trigger
      // a backup or fake a save. Keep it inert until the executor/result-page
      // contract is delivered.
      .onClick((): void => {});
    }
    .width('100%');
  }

  @Builder
  private autoBackupSection() {
    Column({ space: TOK_SPACE_XS }) {
      this.sectionHeadingMuted('自动备份配置');
      Column() {
        this.autoRow('保存位置', this.snapshot.saveLocation, 'location', ['WebDAV', '本地']);
        Row().width('100%').height(1).backgroundColor(CARD_BORDER_SOFT);
        this.autoRow('备份频率', this.snapshot.backupFrequency, 'frequency', ['12h', '24h', '每周']);
        Row().width('100%').height(1).backgroundColor(CARD_BORDER_SOFT);
        this.autoRow('备份范围', this.snapshot.backupScope, 'scope', ['书架、进度', '书架、进度、设置、书源']);
      }
      .width(this.contentWidth())
      .backgroundColor(CARD_BG_SOLID)
      .border({ width: TOK_BORDER_W, color: CARD_BORDER_SOFT })
      .borderRadius(13);
    }
    .width('100%');
  }

  @Builder
  private autoRow(label: string, value: string, key: string, options: string[]) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(600)
        .fontSize(13)
        .fontColor('#1A1612')
        .maxLines(1);
      ReaderSelect({
        value: value,
        options: options,
        isOpen: this.openSelect === key,
        onToggle: (): void => {
          this.openSelect = this.openSelect === key ? '' : key;
        },
        onSelect: (opt: string): void => {
          this.openSelect = '';
        },
      });
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
    Column({ space: 0 }) {
      Text('暂无备份记录')
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(TOK_MUTED)
        .textAlign(TextAlign.Center)
        .padding({ top: TOK_SPACE_LG, bottom: TOK_SPACE_SM });
      Text('立即备份')
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(16)
        .fontColor('#FFFFFF')
        .textAlign(TextAlign.Center)
        .padding({ top: 9, bottom: 9 })
        .backgroundColor(TOK_GREEN)
        .borderRadius(999)
        .margin({ bottom: TOK_SPACE_MD, left: TOK_SPACE_MD, right: TOK_SPACE_MD })
        .onClick((): void => this.onTriggerBackup());
    }
    .width(this.contentWidth())
    .backgroundColor(CARD_BG_SOLID)
    .border({ width: TOK_BORDER_W, color: CARD_BORDER_SOFT })
    .borderRadius(13);
  }

  @Builder
  private historyRow(entry: SyncHistoryEntry) {
    Column() {
      Row() {
        Stack({ alignContent: Alignment.Center }) {
          Text(entry.destination)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .fontColor('#243D30')
            .maxLines(1);
        }
        .width(64)
        .height(24)
        .borderRadius(12)
        .backgroundColor(BADGE_BG);

        Text(entry.timestamp)
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(12)
          .fontColor('#5C564E')
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
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .fontColor('#5C564E')
          .maxLines(1);
        Text(`${(entry.size / 1048576).toFixed(1)} MB`)
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(12)
          .fontColor('#9C9488')
          .maxLines(1);
      }
      .width('100%')
      .margin({ top: 15 })
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(85)
    .padding({ left: 13, right: 13, top: TOK_SPACE_SM })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(CARD_BG_SOLID)
    .border({ width: TOK_BORDER_W, color: CARD_BORDER_SOFT })
    .borderRadius(13);
  }

  @Builder
  private expandRow() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Text('展开')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor('#2F6373');
      }
      .height(26)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
      .backgroundColor(EXPAND_BG)
      .borderRadius(8);
    }
    .width('100%')
    .height(32)
    .justifyContent(FlexAlign.End);
  }

  private contentWidth(): number {
    return this.isTablet ? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }
}
