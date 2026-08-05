const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 620;

export interface SettingsSnapshot {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
}

@Component
export struct SettingsPage {
  @Prop snapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog', value: boolean) => void =
    (_key: string, _value: boolean): void => {};

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Column() {
      this.backBar();
      Scroll() {
        Column({ space: 0 }) {
          this.sectionHeader('基础偏好');
          this.row('app.theme', 'App主题', 'segmented', '日间');
          this.row('app.language', '语言', 'select', '简体中文');
          this.row('app.startup', '启动时打开', 'select', '书架');

          this.sectionHeader('行为与反馈');
          this.switchRow('autoCheckUpdate', '自动检查更新', this.snapshot.autoCheckUpdate);
          this.switchRow('tapBottomScrollTop', '点击当前底栏回顶部', this.snapshot.tapBottomScrollTop);
          this.switchRow('reduceMotion', '减少动态效果', this.snapshot.reduceMotion);
          this.switchRow('crashLog', '崩溃日志', this.snapshot.crashLog);
          this.row('app.animation', '动画效果', 'select', '跟随系统');
          this.row('app.cache', '缓存清理', 'inline', '清理');

          this.sectionHeader('系统权限');
          this.row('app.fileAccess', '文件访问', 'inline', '已授权');
          this.row('app.notification', '通知权限', 'inline', '未授权');
          this.row('app.battery', '电池优化', 'inline', '受系统管理');

          this.sectionHeader('书源');
          this.navRow('书源管理', (): void => this.onOpenSourceManagement());

          this.sectionHeader('同步');
          this.navRow('同步与备份', (): void => this.onOpenSync());

          this.sectionHeader('设置操作');
          this.dangerRow();
        }
        .width('100%')
        .padding({ top: 4, bottom: 120 });
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

      Text('通用设置')
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
  private sectionHeader(title: string) {
    Text(title)
      .width(this.contentWidth())
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(13)
      .lineHeight(18)
      .fontColor('#1F1B17')
      .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14, top: 12, bottom: 4 });
  }

  @Builder
  private row(icon: string, label: string, control: string, value: string) {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_settings')).width(16).height(16);
      }
      .width(28)
      .height(28)
      .backgroundColor('#1F2D4A3E')
      .borderRadius(14);

      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor('#1F1B17')
        .maxLines(1);

      this.controlView(control, value);
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private controlView(control: string, value: string) {
    if (control === 'switch') {
      Text('')
        .width(36)
        .height(20)
        .backgroundColor('#2D4A3E')
        .borderRadius(10);
    } else if (control === 'segmented') {
      Row({ space: 2 }) {
        Text('日间')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor('#FFFFFF')
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .backgroundColor('#2D4A3E')
          .borderRadius(8);
        Text('夜间')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor('#564D44')
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .backgroundColor('#EEE8DF')
          .borderRadius(8);
      }
      .padding(2)
      .backgroundColor('#EEE8DF')
      .borderRadius(10);
    } else {
      Text(value)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .fontColor('#756F69')
        .maxLines(1);
    }
  }

  @Builder
  private switchRow(key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    label: string, value: boolean) {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_settings')).width(16).height(16);
      }
      .width(28)
      .height(28)
      .backgroundColor('#1F2D4A3E')
      .borderRadius(14);

      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor('#1F1B17')
        .maxLines(1);

      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(32)
          .height(18)
          .backgroundColor(value ? '#2D4A3E' : '#C1C7CD')
          .borderRadius(9);
        Text('')
          .width(14)
          .height(14)
          .backgroundColor('#FFFCF8')
          .borderRadius(7)
          .position({ x: value ? 16 : 2, y: 2 });
      }
      .width(36)
      .height(22)
      .onClick((): void => this.onToggle(key, !value));
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private navRow(label: string, action: () => void) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor('#1F1B17')
        .maxLines(1);
      Image($r('app.media.rss_chevron'))
        .width(20)
        .height(20);
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center)
    .onClick((): void => action());
  }

  @Builder
  private dangerRow() {
    Row() {
      Text('重置默认设置')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(14)
        .lineHeight(20)
        .fontColor('#D62222')
        .maxLines(1);
    }
    .width(this.contentWidth())
    .height(48)
    .padding({ left: this.isTablet ? 20 : 14, right: this.isTablet ? 20 : 14 })
    .alignItems(VerticalAlign.Center);
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }
}