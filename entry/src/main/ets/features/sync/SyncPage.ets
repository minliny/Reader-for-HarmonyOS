import {
  type SyncHistoryEntry,
  type SyncSnapshot,
  DEFAULT_SYNC_SNAPSHOT,
} from './SyncGateway';

const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 620;

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

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
    this.webdavUrl = this.snapshot.webdavUrl;
    this.webdavUser = this.snapshot.webdavUser;
    this.webdavPass = this.snapshot.webdavPass;
  }

  build() {
    Column() {
      this.backBar();
      Scroll() {
        Column({ space: 0 }) {
          this.webdavSection();
          this.autoBackupSection();
          this.historySection();
        }
        .width('100%')
        .padding({ bottom: 120 });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private backBar() {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.search_back')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text('同步与备份')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor('#1F1B17')
        .maxLines(1)
        .layoutWeight(1);
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sectionTitle(title: string) {
    Text(title)
      .width(this.contentWidth())
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(13)
      .lineHeight(18)
      .fontColor('#1F1B17')
      .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14, top: 16, bottom: 8 });
  }

  @Builder
  private webdavSection() {
    this.sectionTitle('WebDAV 配置');
    Column({ space: 0 }) {
      this.inputRow('服务器地址', this.webdavUrl, (value: string): void => {
        this.webdavUrl = value;
      });
      this.inputRow('用户名', this.webdavUser, (value: string): void => {
        this.webdavUser = value;
      });
      this.passwordRow();
      this.rowValue('连接测试', '测试', (): void => this.onTestConnection(this.webdavUrl.trim(), this.webdavUser.trim(), this.webdavPass));
    }
    .width(this.contentWidth())
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .backgroundColor('#E6FFFCF8')
    .border({ width: 0.5, color: '#C1C7CD' })
    .borderRadius(8);
  }

  @Builder
  private inputRow(label: string, value: string, onChange: (value: string) => void) {
    Column({ space: 0 }) {
      Text(label)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(18)
        .fontColor('#1F1B17')
        .maxLines(1);
      TextInput({ text: value })
        .width('100%')
        .height(32)
        .margin({ top: 4 })
        .fontFamily('ReaderInter')
        .fontSize(13)
        .fontColor('#1F1B17')
        .backgroundColor('#1A1F1B17')
        .borderRadius(8)
        .placeholderColor('#801F1B17')
        .onChange((newValue: string): void => onChange(newValue));
    }
    .width('100%')
    .padding({ top: 8, bottom: 8 })
    .border({ width: { bottom: 0.5 }, color: { bottom: '#C1C7CD' } })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private passwordRow() {
    Column({ space: 0 }) {
      Text('密码')
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(18)
        .fontColor('#1F1B17')
        .maxLines(1);
      TextInput({ text: this.webdavPass })
        .width('100%')
        .height(32)
        .margin({ top: 4 })
        // Credentials must never be rendered as ordinary readable page text.
        // They remain transient page state; this does not introduce a storage
        // policy for WebDAV secrets.
        .type(InputType.Password)
        .fontFamily('ReaderInter')
        .fontSize(13)
        .fontColor('#1F1B17')
        .backgroundColor('#1A1F1B17')
        .borderRadius(8)
        .placeholderColor('#801F1B17')
        .onChange((value: string): void => {
          this.webdavPass = value;
        });
    }
    .width('100%')
    .padding({ top: 8, bottom: 8 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private rowValue(label: string, value: string, action?: () => void) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor('#1F1B17')
        .maxLines(1);
      Text(value)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor('#2D4A3E')
        .maxLines(1)
        .onClick((): void => {
          if (action !== undefined) {
            action();
          }
        });
    }
    .width('100%')
    .height(48)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private autoBackupSection() {
    this.sectionTitle('自动备份配置');
    Column({ space: 0 }) {
      this.rowValue('保存位置', 'WebDAV');
      this.rowValue('备份频率', '12小时');
      this.rowValue('备份范围', '书架、进度');
    }
    .width(this.contentWidth())
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .backgroundColor('#E6FFFCF8')
    .border({ width: 0.5, color: '#C1C7CD' })
    .borderRadius(8);
  }

  @Builder
  private historySection() {
    this.sectionTitle('历史备份');
    if (this.snapshot.history.length === 0) {
      Column({ space: 0 }) {
        Text('暂无备份记录')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(20)
          .fontColor('#756F69')
          .textAlign(TextAlign.Center)
          .padding({ top: 24, bottom: 12 });
        Text('立即备份')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16)
          .fontColor('#FFFFFF')
          .textAlign(TextAlign.Center)
          .padding({ top: 9, bottom: 9 })
          .backgroundColor('#2D4A3E')
          .borderRadius(999)
          .margin({ bottom: 16, left: 16, right: 16 })
          .onClick((): void => this.onTriggerBackup());
      }
      .width(this.contentWidth())
      .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
      .backgroundColor('#E6FFFCF8')
      .border({ width: 0.5, color: '#C1C7CD' })
      .borderRadius(8);
    } else {
      Column({ space: 0 }) {
        ForEach(this.snapshot.history, (entry: SyncHistoryEntry) => {
          this.historyRow(entry);
        }, (entry: SyncHistoryEntry): string => `sync-history-${entry.timestamp}`);
      }
      .width(this.contentWidth())
      .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
      .backgroundColor('#E6FFFCF8')
      .border({ width: 0.5, color: '#C1C7CD' })
      .borderRadius(8);
    }
  }

  @Builder
  private historyRow(entry: SyncHistoryEntry) {
    Row() {
      Column({ space: 3 }) {
        Text(entry.timestamp)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(18)
          .fontColor('#1F1B17')
          .maxLines(1);
        Text(`${entry.destination} · ${(entry.size / 1024).toFixed(1)} KB`)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(14)
          .fontColor('#756F69')
          .maxLines(1);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text(entry.ok ? '成功' : '失败')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(entry.ok ? '#2D4A3E' : '#D62222')
        .maxLines(1);
    }
    .width('100%')
    .height(48)
    .border({ width: { bottom: 0.5 }, color: { bottom: '#C1C7CD' } })
    .alignItems(VerticalAlign.Center);
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }
}
