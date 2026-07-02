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
          SettingsMotionHook({
            uiState: this.uiState,
            onToggleReducedMotion: this.onToggleReducedMotion
          })
        }
        .width('100%')
        .padding({ left: 15, right: 15, top: 8, bottom: 122 })
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4EFE8')
  }
}

@Component
struct SettingsMainSection {
  @Prop rows: SettingsMainRow[] = [];

  build() {
    Column() {
      Text('设置')
        .fontSize(16)
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
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#4DB4A697' })
      .borderRadius(8)
      .clip(true)
      .shadow({ radius: 12, color: '#34261A18', offsetX: 0, offsetY: 4 })
    }
    .width('100%')
  }
}

@Component
struct SettingsEntryRow {
  @Prop row: SettingsMainRow;
  @Prop topDivider: boolean = false;

  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: this.row.iconName, tone: 'primary', iconSize: 20 })
      }
      .width(34)
      .height(34)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#17366179')
      .borderRadius(17)

      Column() {
        Text(this.row.title)
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.row.meta.length > 0) {
          Text(this.row.meta)
            .fontSize(11)
            .fontColor('#756F69')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 2 })
        }
      }
      .layoutWeight(1)
      .margin({ left: 12, right: 12 })

      ReaderUiIcon({ iconName: 'chevron', tone: 'muted', iconSize: 18 })
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: this.topDivider ? 1 : 0 }, color: '#33B4A697' })
  }
}

@Component
struct SettingsMotionHook {
  @Prop uiState: ReaderUiState;
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};

  build() {
    Column() {
      Row() {
        Row() {
          ReaderUiIcon({ iconName: 'refresh', tone: 'primary', iconSize: 18 })
        }
        .width(32)
        .height(32)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor('#17366179')
        .borderRadius(16)

        Column() {
          Text('减少动态效果')
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#201B16')
          Text(this.uiState.reducedMotion ? '已启用即时切换验证钩子' : '保留短过渡，供首批 slice 验证')
            .fontSize(11)
            .fontColor('#756F69')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 3 })
        }
        .layoutWeight(1)
        .margin({ left: 10, right: 10 })

        Toggle({ type: ToggleType.Switch, isOn: this.uiState.reducedMotion })
          .onChange((isOn: boolean) => {
            this.onToggleReducedMotion(isOn);
          })
      }
      .width('100%')
      .height(62)
      .padding({ left: 12, right: 12 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .margin({ top: 10 })
    .backgroundColor('#FFFCF8')
    .border({ width: 1, color: '#4DB4A697' })
    .borderRadius(8)
    .shadow({ radius: 12, color: '#34261A18', offsetX: 0, offsetY: 4 })
  }
}
