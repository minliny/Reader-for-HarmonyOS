import { ReaderUiState } from '../ReaderUiState';
import { MainTabTitleBar, ReaderUiIcon } from './SharedComponents';

class SettingsMainRow {
  iconName: string = '';
  title: string = '';
  meta: string = '';
}

@Component
export struct SettingsTab {
  @Prop uiState: ReaderUiState;
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};
  private rows: SettingsMainRow[] = [
    { iconName: 'gear', title: '通用设置', meta: '' },
    { iconName: 'bookshelf', title: '书架与搜索设置', meta: '' },
    { iconName: 'source-stack', title: '书源管理', meta: '' },
    { iconName: 'sync', title: '同步与备份', meta: '' },
    { iconName: 'info', title: '关于与反馈', meta: '' }
  ];

  build() {
    Column() {
      MainTabTitleBar({ title: '设置' })

      Scroll() {
        Column() {
          SettingsMainSection({ rows: this.rows })
        }
        .width('100%')
        .constraintSize({ minHeight: '100%' })
        .padding({ left: 19, right: 19, top: 8, bottom: 116 })
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF8F4')
  }
}

@Component
struct SettingsMainSection {
  @Prop rows: SettingsMainRow[] = [];

  build() {
    Column() {
      Text('设置')
        .fontSize(13)
        .lineHeight(15.6)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#201B16')
        .width('100%')
        .padding({ left: 12, right: 12, top: 9, bottom: 5 })

      Column() {
        ForEach(this.rows, (row: SettingsMainRow, index: number) => {
          SettingsEntryRow({ row, topDivider: index > 0 })
        }, (row: SettingsMainRow) => row.title)
      }
      .width('100%')
      .clip(true)
    }
    .width('100%')
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 })
  }
}

@Component
struct SettingsEntryRow {
  @Prop row: SettingsMainRow;
  @Prop topDivider: boolean = false;

  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: this.row.iconName, tone: 'primary', iconSize: 15 })
      }
      .width(28)
      .height(28)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#17366179')
      .borderRadius(14)

      Column() {
        Text(this.row.title)
          .fontSize(13)
          .lineHeight(15.34)
          .fontWeight(FontWeight.Bolder)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        if (this.row.meta.length > 0) {
          Text(this.row.meta)
            .fontSize(11)
            .fontColor('#756F69')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 2 })
            .width('100%')
        }
      }
      .layoutWeight(1)
      .margin({ left: 10, right: 10 })
      .alignItems(HorizontalAlign.Start)

      ReaderUiIcon({ iconName: 'chevron', tone: 'muted', iconSize: 20 })
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: this.topDivider ? 1 : 0 }, color: '#33B4A697' })
  }
}
