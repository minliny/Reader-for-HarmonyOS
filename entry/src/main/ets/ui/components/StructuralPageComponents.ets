// StructuralPageComponents — semantic page/section components for normalized
// handoff pages that should not be counted as generic scaffold.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import picker from '@ohos.file.picker';
import { ReaderEffects } from '../store/ReaderEffects';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { RssSelectionProjection } from './RssSelectionProjection';
import { isSafeRssOriginalUrl } from './RssComponents';
import { SourceCoverImage } from './SourceCoverImage';
import { SourceDetectPage } from './LibraryComponents';
import { LocalBookFormatPolicy } from '../../host/LocalBookFormatPolicy';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { RestoreBackupOverlayMotionCoordinator } from '../motion/RestoreBackupOverlayMotionCoordinator';
import {
  BookDetail,
  ChapterTocEntry,
  CoreBookmark,
  CoreSourceEntry,
  CoreBookshelfBook,
  CoreBookGroup,
  CoreRssSubscription,
  SearchResultEntry,
  TocMode,
  CoreStorageBackupInfo,
  CoreStorageBackupHistoryEntry,
} from '../store/ReaderUiState';

interface RowEntry {
  title: string;
  detail: string;
  chip: string;
}

interface SyncBackupEntry {
  source: string;
  time: string;
  content: string;
  group: string;
  local: boolean;
}

interface SelectableBookEntry {
  title: string;
  detail: string;
  group: string;
  selected: boolean;
}

@Component
struct HandoffStatusChip {
  @Prop label: string = '';

  build() {
    if (this.label.length > 0) {
      Text(this.label)
        .fontSize(12)
        .fontWeight(600)
        .fontColor(ColorTokens.primary)
        .height(24)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .border({ width: 1, color: ColorTokens.primary })
        .backgroundColor(ColorTokens.paper)
    }
  }
}

@Component
struct StructureCard {
  @Prop title: string = '标题';
  @Prop message: string = '';
  @Prop chip: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .margin({ top: 8 })
      }
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
          .margin({ top: 10 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .borderRadius(16)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct StructureRow {
  @Prop title: string = '条目';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop showChevron: boolean = true;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 4 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else if (this.showChevron) {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.controlInk)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SwitchRow {
  @Prop title: string = '条目';
  @Prop chip: string = '';
  @Prop switchOn: boolean = true;

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else {
        HandoffSwitch({ on: this.switchOn })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct PrimaryAction {
  @Prop label: string = '操作';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(700)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(40)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primary)
      .textAlign(TextAlign.Center)
  }
}

@Component
struct BookshelfToolCover {
  @Prop selected: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
      if (this.selected) {
        Column() {
          Image($r('app.media.ui_icon_check_white'))
            .width(13)
            .height(13)
        }
        .width(22)
        .height(22)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ top: 5, right: 5 })
      }
    }
    .width(46)
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusSm)
    .clip(true)
    .backgroundColor(ColorTokens.metaBg)
  }
}

@Component
struct BookshelfToolBookRow {
  @Prop title: string = '三体';
  @Prop detail: string = '刘慈欣';
  @Prop group: string = '';
  @Prop selected: boolean = false;

  build() {
    Row() {
      BookshelfToolCover({ selected: this.selected })
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12, right: 10 })

      if (this.group.length > 0) {
        HandoffStatusChip({ label: this.group })
      }
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: this.selected ? ColorTokens.primary : ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct DirectorySegmentButton {
  @Prop label: string = '目录';
  @Prop active: boolean = false;
  onSelect: () => void = () => {};

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.active ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(34)
      .layoutWeight(1)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.active ? ColorTokens.primary : DemoAliasTokens.surface)
      .textAlign(TextAlign.Center)
      .onClick(() => this.onSelect())
  }
}

@Component
struct DirectoryChapterRow {
  @Prop title: string = '第一章';
  @Prop current: boolean = false;
  onSelect: () => void = () => {};

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(this.current ? 800 : 600)
        .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.current) {
        HandoffStatusChip({ label: '当前' })
      }
      Image($r('app.media.reader_icon_chevron_chapter'))
        .width(18)
        .height(18)
        .margin({ left: 8 })
    }
    .width('100%')
    .constraintSize({ minHeight: 52 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onSelect())
  }
}

// Source Management is an exact Figma-bound surface (Page/Source Management,
// 942:29).  Its controls deliberately do not invent secondary routes: Figma
// currently has no admitted Source Detail / Import / Batch target for them.
// The only live data manipulation retained here is local query filtering over
// the persisted Core list.
@Component
struct FigmaSourceStatusFilter {
  @Prop label: string = '';
  @Prop selected: boolean = false;
  @Prop wide: boolean = false;

  build() {
    Text(this.label)
      .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
      .fontSize(ReaderUiVisualTokens.sourceManagementFilterLabelSize)
      .fontWeight(700)
      .fontColor(this.selected ? ReaderUiVisualTokens.sourceManagementOnPrimary : ReaderUiVisualTokens.sourceManagementInk)
      .width(this.wide
        ? ReaderUiVisualTokens.sourceManagementFilterWideWidth
        : ReaderUiVisualTokens.sourceManagementFilterNarrowWidth)
      .height(ReaderUiVisualTokens.sourceManagementFilterHeight)
      .textAlign(TextAlign.Center)
      .borderRadius(ReaderUiVisualTokens.sourceManagementFilterRadius)
      .backgroundColor(this.selected
        ? ReaderUiVisualTokens.sourceManagementPrimary
        : ReaderUiVisualTokens.sourceManagementInactiveControlSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.sourceManagementControlBorder })
      .accessibilityText(this.label)
  }
}

@Component
struct FigmaSourceGroupFilter {
  build() {
    Row() {
      Image($r('app.media.source_management_group_folder'))
        .width(15)
        .height(15)
      Text('分组')
        .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
        .fontSize(ReaderUiVisualTokens.sourceManagementGroupLabelSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.sourceManagementInk)
        .margin({ left: 11 })
      Blank().layoutWeight(1)
      Row() {
        Text('全部分组')
          .fontFamily(ReaderUiVisualTokens.sourceManagementControlFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementGroupValueSize)
          .fontColor(ReaderUiVisualTokens.sourceManagementInk)
        Text('⌄')
          .fontFamily(ReaderUiVisualTokens.sourceManagementControlFontFamily)
          .fontSize(16)
          .fontColor(ReaderUiVisualTokens.sourceManagementInk)
          .margin({ left: 8, right: 10 })
      }
      .height(ReaderUiVisualTokens.sourceManagementGroupHeight)
      .padding({ left: 14 })
      .borderRadius(ReaderUiVisualTokens.sourceManagementGroupRadius)
      .backgroundColor(ReaderUiVisualTokens.sourceManagementFieldSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.sourceManagementControlBorder })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.sourceManagementGroupHeight)
    .alignItems(VerticalAlign.Center)
    .accessibilityText('分组：全部分组')
  }
}

@Component
struct FigmaSourceEnabledSwitch {
  @Prop on: boolean = false;

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row() {
        if (this.on) {
          Blank().layoutWeight(1)
        }
        Row()
          .width(ReaderUiVisualTokens.sourceManagementSwitchThumbSize)
          .height(ReaderUiVisualTokens.sourceManagementSwitchThumbSize)
          .borderRadius(ReaderUiVisualTokens.sourceManagementSwitchThumbSize)
          .backgroundColor(ReaderUiVisualTokens.sourceManagementSwitchThumb)
        if (!this.on) {
          Blank().layoutWeight(1)
        }
      }
      .width(ReaderUiVisualTokens.sourceManagementSwitchWidth)
      .height(ReaderUiVisualTokens.sourceManagementSwitchHeight)
      .padding(2)
      .borderRadius(ReaderUiVisualTokens.sourceManagementSwitchWidth)
      .backgroundColor(this.on ? ReaderUiVisualTokens.sourceManagementPrimary : ReaderUiVisualTokens.sourceManagementFieldSurface)
      .border({ width: this.on ? 0 : 1, color: ReaderUiVisualTokens.sourceManagementControlBorder })
      .alignItems(VerticalAlign.Center)
    }
    .width(ReaderUiVisualTokens.sourceManagementSwitchWidth)
    .height(ReaderUiVisualTokens.sourceManagementMoreHitSize)
    .accessibilityText(this.on ? '书源已启用' : '书源未启用')
  }
}

@Component
struct FigmaSourceManagementRow {
  @Prop title: string = '';
  @Prop meta: string = '';
  @Prop sourceEnabled: boolean = false;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementRowTitleSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.sourceManagementInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.meta)
          .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementRowMetaSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.sourceManagementMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text('检测')
        .fontFamily(ReaderUiVisualTokens.sourceManagementCjkFontFamily)
        .fontSize(ReaderUiVisualTokens.sourceManagementDetectLabelSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.sourceManagementInk)
        .width(ReaderUiVisualTokens.sourceManagementDetectWidth)
        .height(ReaderUiVisualTokens.sourceManagementDetectHeight)
        .textAlign(TextAlign.Center)
        .borderRadius(ReaderUiVisualTokens.sourceManagementDetectRadius)
        .backgroundColor(ReaderUiVisualTokens.sourceManagementFieldSurface)
        .border({ width: 1, color: ReaderUiVisualTokens.sourceManagementControlBorder })

      Stack({ alignContent: Alignment.Center }) {
        Circle()
          .width(7)
          .height(7)
          .fill(this.sourceEnabled ? ReaderUiVisualTokens.sourceManagementStatusDot : ReaderUiVisualTokens.sourceManagementMuted)
      }
      .width(20)
      .height(20)
      .borderRadius(10)
      .backgroundColor(ReaderUiVisualTokens.sourceManagementStatusBadgeSurface)
      .margin({ left: 2 })

      FigmaSourceEnabledSwitch({ on: this.sourceEnabled })
        .margin({ left: 10 })

      Stack({ alignContent: Alignment.Center }) {
        Row({ space: 3 }) {
          Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
          Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
          Circle().width(ReaderUiVisualTokens.sourceManagementMoreDotSize).height(ReaderUiVisualTokens.sourceManagementMoreDotSize).fill(ReaderUiVisualTokens.sourceManagementInk)
        }
      }
      .width(ReaderUiVisualTokens.sourceManagementMoreHitSize)
      .height(ReaderUiVisualTokens.sourceManagementMoreHitSize)
      .margin({ left: 16 })
    }
    .width('100%')
    .height(ReaderUiVisualTokens.sourceManagementRowHeight)
    .padding({ left: ReaderUiVisualTokens.sourceManagementRowHorizontalInset })
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.sourceManagementRowDivider })
    .alignItems(VerticalAlign.Center)
    .accessibilityText(`${this.title}，${this.sourceEnabled ? '已启用' : '未启用'}`)
  }
}

@Component
struct SourceDetailHeader {
  @Prop title: string = '';
  @Prop baseUrl: string = '';
  @Prop sourceId: string = '';
  @Prop isSourceEnabled: boolean = false;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(16)
          .fontWeight(900)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.baseUrl.length > 0 ? this.baseUrl : 'Core 未提供书源地址')
          .fontSize(12)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.sourceId)
          .fontSize(10)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ right: 12 })
      Text(this.isSourceEnabled ? '已启用' : '已停用')
        .fontSize(12)
        .fontWeight(850)
        .fontColor(this.isSourceEnabled ? ColorTokens.statusGood : ColorTokens.muted)
        .padding({ left: 10, right: 10, top: 6, bottom: 6 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SearchBox {
  @Prop label: string = '搜索书名或作者';

  build() {
    Row() {
      Image($r('app.media.bookshelf_icon_search_dark'))
        .width(20)
        .height(20)
      Text(this.label)
        .fontSize(14)
        .fontColor(ColorTokens.controlInk)
        .margin({ left: 8 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(44)
    .padding({ left: 12, right: 12 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(ColorTokens.metaBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SectionTitle {
  @Prop title: string = '标题';

  build() {
    Text(this.title)
      .fontSize(15)
      .fontWeight(700)
      .fontColor(ColorTokens.controlInk)
  }
}

@Component
struct FormField {
  @Prop placeholder: string = '输入内容';
  @Prop value: string = '';

  build() {
    TextInput({ text: this.value, placeholder: this.placeholder })
      .fontSize(14)
      .fontColor(ColorTokens.ink)
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(14)
      .backgroundColor(ColorTokens.metaBg)
      .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct HandoffSwitch {
  @Prop on: boolean = true;

  build() {
    Row() {
      if (this.on) {
        Blank()
          .layoutWeight(1)
      }
      Row()
        .width(20)
        .height(20)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.paper)
      if (!this.on) {
        Blank()
          .layoutWeight(1)
      }
    }
    .width(42)
    .height(24)
    .padding(2)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.metaBg)
  }
}

@Component
struct ProgressSummaryCard {
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop chip: string = '';
  @Prop progress: number = 0;

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message, chip: this.chip })
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      }
      .width('100%')
      .height(4)
      .margin({ top: 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

interface RestoreStepEntry {
  title: string;
  detail: string;
  chip: string;
  progress: number;
  done: boolean;
  active: boolean;
}

@Component
struct SecondaryAction {
  @Prop label: string = '操作';
  @Prop primary: boolean = false;
  @Prop route: RouteId = 'settings';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .padding({ left: 12, right: 12 })
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.primary ? 0 : 1, color: ColorTokens.border })
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

@Component
struct WebDavInputRow {
  @Prop title: string = '服务器地址';
  @Prop value: string = '';
  @Prop kind: string = 'server';
  @Prop field: string = '';

  private iconResource(): Resource {
    if (this.kind === 'account') return $r('app.media.webdav_account');
    if (this.kind === 'password') return $r('app.media.webdav_password');
    if (this.kind === 'folder') return $r('app.media.webdav_folder');
    return $r('app.media.webdav_server');
  }

  build() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.iconResource())
          .width(15)
          .height(15)
      }
      .width(ReaderUiVisualTokens.webdavFieldIconShellSize)
      .height(ReaderUiVisualTokens.webdavFieldIconShellSize)
      .borderRadius(ReaderUiVisualTokens.webdavFieldIconShellSize / 2)
      .backgroundColor(ReaderUiVisualTokens.webdavIconShellSurface)

      Column() {
        Text(this.title)
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.webdavFieldLabelSize)
          .fontWeight(800)
          .fontColor(ReaderUiVisualTokens.webdavInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        TextInput({ text: this.value, placeholder: '请输入' + this.title })
          .type(this.field === 'password' ? InputType.Password : InputType.Normal)
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.webdavInputTextSize)
          .fontWeight(600)
          .fontColor(ReaderUiVisualTokens.webdavMuted)
          .width('100%')
          .height(ReaderUiVisualTokens.webdavInputHeight)
          .padding({ left: 10, right: 10 })
          .textAlign(TextAlign.Start)
          .borderRadius(6)
          .backgroundColor(ReaderUiVisualTokens.webdavInputSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.webdavInputBorder })
          .margin({ top: 4 })
          .onChange((v: string) => {
            if (this.field.length > 0) {
              ReaderUiStore.dispatch({ type: 'webdav-field-update', field: this.field, settingsValue: v });
            }
          })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 9 })
    }
    .width('100%')
    .height(ReaderUiVisualTokens.webdavFieldHeight)
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .borderRadius(ReaderUiVisualTokens.webdavPanelRadius)
    .backgroundColor(ReaderUiVisualTokens.webdavFieldSurface)
    .border({ width: 1, color: ReaderUiVisualTokens.webdavFieldBorder })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct WebDavSectionAction {
  @Prop label: string = '测试网络连通性';
  @Prop kind: string = 'refresh';
  @Prop actionType: string = '';   // P1.3：'test' | 'save'
  @Prop disabled: boolean = false;

  private iconResource(): Resource {
    return this.kind === 'save' ? $r('app.media.webdav_save') : $r('app.media.webdav_test');
  }

  build() {
    Row() {
      Image(this.iconResource())
        .width(18)
        .height(18)
      Text(this.label)
        .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
        .fontSize(ReaderUiVisualTokens.webdavActionLabelSize)
        .fontWeight(800)
        .fontColor(this.kind === 'save' ? ReaderUiVisualTokens.webdavActionOnPrimary : ReaderUiVisualTokens.webdavActionInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 8 })
    }
    .layoutWeight(1)
    .height(ReaderUiVisualTokens.webdavActionHeight)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .borderRadius(this.kind === 'save' ? 12 : ReaderUiVisualTokens.webdavPanelRadius)
    .backgroundColor(this.kind === 'save'
      ? ReaderUiVisualTokens.webdavActionPrimary
      : ReaderUiVisualTokens.webdavSoftActionSurface)
    .border({ width: this.kind === 'save' ? 0 : 1, color: ReaderUiVisualTokens.webdavSoftActionBorder })
    .opacity(this.disabled ? 0.5 : 1)
    .enabled(!this.disabled)
    .onClick(() => {
      if (this.disabled) return;
      if (this.actionType === 'test') {
        ReaderUiStore.dispatch({ type: 'webdav-test' });
      } else if (this.actionType === 'save') {
        ReaderUiStore.dispatch({ type: 'webdav-save' });
      }
    })
  }
}

@Component
struct WebDavMetricCard {
  @Prop icon: Resource = $r('app.media.webdav_metric_status');
  @Prop value: string = '—';
  @Prop label: string = '';

  build() {
    Row({ space: 14 }) {
      Image(this.icon)
        .width(20)
        .height(20)
      Column({ space: 2 }) {
        Text(this.value)
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.webdavInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.label)
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(11)
          .fontColor(ReaderUiVisualTokens.webdavMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .height(ReaderUiVisualTokens.webdavMetricsCardHeight)
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .borderRadius(ReaderUiVisualTokens.webdavPanelRadius)
    .backgroundColor(ReaderUiVisualTokens.webdavPanelSurface)
    .border({ width: 1, color: ReaderUiVisualTokens.webdavMetricBorder })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct WebDavStaticSwitch {
  @Prop on: boolean = true;

  build() {
    Row() {
      Circle()
        .width(20)
        .height(20)
        .fill(ReaderUiVisualTokens.webdavSwitchKnob)
    }
    .width(44)
    .height(24)
    .padding(2)
    .justifyContent(this.on ? FlexAlign.End : FlexAlign.Start)
    .borderRadius(999)
    .backgroundColor(this.on ? ReaderUiVisualTokens.webdavActionInk : ReaderUiVisualTokens.webdavSwitchOff)
  }
}

@Component
struct WebDavAdvancedRow {
  @Prop icon: Resource = $r('app.media.webdav_password');
  @Prop title: string = '';
  @Prop stepper: boolean = false;

  build() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.icon).width(15).height(15)
      }
      .width(ReaderUiVisualTokens.webdavFieldIconShellSize)
      .height(ReaderUiVisualTokens.webdavFieldIconShellSize)
      .borderRadius(ReaderUiVisualTokens.webdavFieldIconShellSize / 2)
      .backgroundColor(ReaderUiVisualTokens.webdavIconShellSurface)
      Text(this.title)
        .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
        .fontSize(ReaderUiVisualTokens.webdavFieldLabelSize)
        .fontWeight(800)
        .fontColor(ReaderUiVisualTokens.webdavInk)
        .layoutWeight(1)
        .margin({ left: 10 })
      if (this.stepper) {
        Row({ space: 4 }) {
          Text('−').fontFamily(ReaderUiVisualTokens.webdavControlFontFamily).fontSize(13).fontWeight(800).fontColor(ReaderUiVisualTokens.webdavMuted)
          Text('15 秒').fontFamily(ReaderUiVisualTokens.webdavControlFontFamily).fontSize(11).fontWeight(800).fontColor(ReaderUiVisualTokens.webdavMuted)
          Text('+').fontFamily(ReaderUiVisualTokens.webdavControlFontFamily).fontSize(13).fontWeight(800).fontColor(ReaderUiVisualTokens.webdavMuted)
        }
        .height(24)
        .padding({ left: 7, right: 7 })
        .borderRadius(999)
        .backgroundColor(ReaderUiVisualTokens.webdavStepperSurface)
        .alignItems(VerticalAlign.Center)
      } else {
        WebDavStaticSwitch({ on: true })
      }
    }
    .width('100%')
    .height(ReaderUiVisualTokens.webdavAdvancedRowHeight)
    .padding({ left: 12, right: 12 })
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.webdavRowDivider })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct WebDavConnectionCard {
  @StorageProp('reader.webdavServerUrl') serverUrl: string = '';
  @StorageProp('reader.webdavUsername') username: string = '';
  @StorageProp('reader.webdavPassword') password: string = '';
  @StorageProp('reader.webdavSyncDir') syncDir: string = '/reader/backup';
  @StorageProp('reader.webdavTestStatus') testStatus: string = 'idle';
  @StorageProp('reader.webdavSaveStatus') saveStatus: string = 'idle';

  build() {
    Column({ space: 8 }) {
      Text('连接信息')
        .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
        .fontSize(ReaderUiVisualTokens.webdavSectionTitleSize)
        .fontWeight(900)
        .fontColor(ReaderUiVisualTokens.webdavInk)
      WebDavInputRow({ title: '服务器地址', value: this.serverUrl, kind: 'server', field: 'serverUrl' })
      WebDavInputRow({ title: '账号', value: this.username, kind: 'account', field: 'username' })
      WebDavInputRow({ title: '密码', value: this.password, kind: 'password', field: 'password' })
      WebDavInputRow({ title: '同步目录', value: this.syncDir, kind: 'folder', field: 'syncDir' })
      Row({ space: 8 }) {
        WebDavSectionAction({
          label: this.testStatus === 'testing' ? '正在测试…' : '测试网络连通性',
          kind: 'test', actionType: 'test', disabled: this.testStatus === 'testing' || this.saveStatus === 'saving',
        })
        WebDavSectionAction({
          label: this.saveStatus === 'saving' ? '正在保存…' : '保存配置',
          kind: 'save', actionType: 'save', disabled: this.testStatus === 'testing' || this.saveStatus === 'saving',
        })
      }
      .width('100%')
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 9, bottom: 10 })
    .borderRadius(ReaderUiVisualTokens.webdavPanelRadius)
    .backgroundColor(ReaderUiVisualTokens.webdavPanelSurface)
    .border({ width: 1, color: ReaderUiVisualTokens.webdavPanelBorder })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct WebDavConfigSection {
  @StorageProp('reader.webdavServerUrl') serverUrl: string = '';
  @StorageProp('reader.webdavUsername') username: string = '';
  @StorageProp('reader.webdavPassword') password: string = '';
  @StorageProp('reader.webdavSyncDir') syncDir: string = '/reader/backup';
  @StorageProp('reader.webdavTestStatus') testStatus: string = 'idle';
  @StorageProp('reader.webdavTestMessage') testMessage: string = '';
  @StorageProp('reader.webdavSaveStatus') saveStatus: string = 'idle';
  @StorageProp('reader.webdavSaveMessage') saveMessage: string = '';
  @StorageProp('reader.localCoreBackupHistory') localBackupHistory: CoreStorageBackupHistoryEntry[] = [];

  private connectionValue(): string {
    if (this.testStatus === 'success') return '已连接';
    if (this.testStatus === 'testing') return '测试中';
    if (this.testStatus === 'error') return '连接失败';
    return '未测试';
  }

  private latestTestValue(): string {
    if (this.testStatus === 'success') return '已完成';
    if (this.testStatus === 'testing') return '进行中';
    if (this.testStatus === 'error') return '失败';
    return '—';
  }

  build() {
    Column() {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        WebDavMetricCard({ icon: $r('app.media.webdav_metric_status'), value: this.connectionValue(), label: '连接状态' })
          .width('48.85%')
        WebDavMetricCard({ icon: $r('app.media.webdav_metric_time'), value: this.latestTestValue(), label: '最近测试' })
          .width('48.85%')
        WebDavMetricCard({ icon: $r('app.media.webdav_metric_backups'), value: this.localBackupHistory.length > 0 ? `${this.localBackupHistory.length} 个` : '—', label: '本机备份' })
          .width('48.85%')
          .margin({ top: 8 })
        WebDavMetricCard({ icon: $r('app.media.webdav_metric_folder'), value: this.syncDir, label: '同步目录' })
          .width('48.85%')
          .margin({ top: 8 })
      }
      .width('100%')

      WebDavConnectionCard()
        .margin({ top: 12 })

      Column() {
        Text('高级')
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.webdavSectionTitleSize)
          .fontWeight(900)
          .fontColor(ReaderUiVisualTokens.webdavInk)
          .width('100%')
          .padding({ left: 12 })
          .margin({ bottom: 5 })
        WebDavAdvancedRow({ icon: $r('app.media.webdav_password'), title: 'SSL 证书校验' })
        WebDavAdvancedRow({ icon: $r('app.media.webdav_metric_time'), title: '连接超时', stepper: true })
        WebDavAdvancedRow({ icon: $r('app.media.webdav_metric_status'), title: '仅 Wi-Fi 同步' })
        WebDavAdvancedRow({ icon: $r('app.media.webdav_test'), title: '自动同步' })
      }
      .width('100%')
      .margin({ top: 12 })
      .padding({ top: 9 })
      .borderRadius(ReaderUiVisualTokens.webdavPanelRadius)
      .backgroundColor(ReaderUiVisualTokens.webdavPanelSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.webdavPanelBorder })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct ActionPair {
  @Prop left: string = '取消';
  @Prop right: string = '确认';
  @Prop leftRoute: RouteId = 'settings';
  @Prop rightRoute: RouteId = 'settings';

  build() {
    Row() {
      SecondaryAction({ label: this.left, route: this.leftRoute })
      SecondaryAction({ label: this.right, route: this.rightRoute, primary: true })
        .margin({ left: 10 })
    }
    .width('100%')
  }
}

@Component
struct RestoreSummaryGrid {
  private rows: RowEntry[] = [
    { title: '备份来源', detail: 'WebDAV · 2026-06-23 08:00', chip: '' },
    { title: '恢复范围', detail: '书架与分组、阅读进度、设置、书源配置', chip: '' },
    { title: '预计影响', detail: '128 本书 · 96 条阅读进度 等 4 项', chip: '' },
    { title: '可回退点', detail: '恢复前自动生成本地快照', chip: '' },
  ];

  build() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(this.rows, (entry: RowEntry, idx: number) => {
        Column() {
          Text(entry.title)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
          Text(entry.detail)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .margin({ top: 5 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('48%')
        .padding(10)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ bottom: 8 })
        .alignItems(HorizontalAlign.Start)
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
  }
}

@Component
struct RestoreStageRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop progress: number = 0;
  @Prop done: boolean = false;
  @Prop active: boolean = false;

  build() {
    Column() {
      Row() {
        Circle()
          .width(9)
          .height(9)
          .fill(this.done || this.active ? ColorTokens.primary : ColorTokens.border)
        Column() {
          Text(this.title)
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
          Text(this.detail)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        HandoffStatusChip({ label: this.chip })
      }
      .width('100%')
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.active ? ColorTokens.primary : ColorTokens.border)
      }
      .width('100%')
      .height(4)
      .margin({ top: 9 })
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(this.active ? ColorTokens.surfaceSoft : ColorTokens.floatingControlBg)
    .border({ width: 1, color: this.active ? ColorTokens.primary : ColorTokens.border })
  }
}

@Component
struct SyncBackupRecordRow {
  @Prop source: string = '';
  @Prop time: string = '';
  @Prop content: string = '';
  @Prop groupStart: string = '';
  @Prop local: boolean = false;

  private iconResource(): Resource {
    return this.local ? $r('app.media.ui_icon_bookmark_dark') : $r('app.media.ui_icon_sync_dark');
  }

  build() {
    Column() {
      if (this.groupStart.length > 0) {
        Text(this.groupStart)
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ColorTokens.muted)
          .margin({ left: 2, bottom: 6 })
      }
      Row() {
        Stack() {
          Image(this.iconResource())
            .width(17)
            .height(17)
        }
          .width(34)
          .height(34)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Column() {
          Text(this.source)
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.controlInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.time)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.content)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 2 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        Image($r('app.media.ui_icon_chevron_dark'))
          .width(18)
          .height(18)
      }
      .width('100%')
      .constraintSize({ minHeight: 72 })
      .padding({ left: 11, right: 11, top: 10, bottom: 10 })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'restore-confirm' }))
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct StatePanel {
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';
  @Prop variant: string = 'empty';

  build() {
    Column() {
      if (this.variant === 'loading') {
        LoadingProgress()
          .width(34)
          .height(34)
          .color(ColorTokens.primary)
          .margin({ bottom: 12 })
      }
      Text(this.title)
        .fontSize(20)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .textAlign(TextAlign.Center)
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .textAlign(TextAlign.Center)
          .margin({ top: 8 })
      }
      // `StatePanel` is shared by generated empty/error routes.  It has no
      // route-specific callback contract, so rendering a labelled button here
      // would create a dead control (for example “重试”/“添加订阅”).  Concrete
      // pages add their own actionable control only after wiring a real
      // Core/Host event.
    }
    .width('100%')
    .constraintSize({ minHeight: 640 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({ left: 12, right: 12, top: 32, bottom: 32 })
  }
}

@Component
export struct AppShellStructure {
  @Prop title: string = 'Reader for HarmonyOS';
  @Prop message: string = '兼容路由：主导航承载书架、发现、RSS 与设置，阅读页只从实际书籍流程进入。';
  private entries: RowEntry[] = [
    { title: '书架', detail: '主书架与继续阅读', chip: '' },
    { title: '发现', detail: '书源发现与分类浏览', chip: '' },
    { title: 'RSS', detail: '订阅与文章阅读', chip: '' },
    { title: '设置', detail: '全局设置、同步与书源', chip: '' },
    { title: '搜索入口', detail: '按书名、作者与书源搜索', chip: '' },
    { title: '书源管理入口', detail: '维护搜索、目录与正文规则', chip: '' },
    { title: '阅读页入口', detail: '进入阅读器与控制层', chip: '' },
    { title: 'WebDAV / 同步入口', detail: '备份、恢复与阅读进度同步', chip: '' },
  ];

  build() {
    Column() {
      // The generated compatibility route still contains an old Android title.
      // Do not let that upstream demo prop leak into the HarmonyOS application.
      StructureCard({
        title: this.title === 'Reader for Android' ? 'Reader for HarmonyOS' : this.title,
        message: '兼容路由：请使用底部导航进入书架、发现、RSS 或设置；阅读页只从实际书籍流程进入。',
      })
      SectionTitle({ title: '核心入口' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        // This compatibility summary has no independent callbacks.  Removing
        // the chevron prevents it from posing as a second navigation surface.
        StructureRow({ title: entry.title, detail: entry.detail, showChevron: false })
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct MainTabsStructure {
  @Prop title: string = '主导航';
  @Prop message: string = '兼容路由：请使用下方真实底部导航切换书架、发现、RSS 和设置。';

  build() {
    Column() {
      StructureCard({
        title: this.title,
        message: '兼容路由：请使用下方真实底部导航切换书架、发现、RSS 和设置。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct FigmaSearchResultRow {
  @Prop result: SearchResultEntry;

  private title(): string {
    return this.result.title.trim().length > 0 ? this.result.title : '未命名书籍';
  }

  private latest(): string {
    const chapter = this.result.latestChapter ?? '';
    return chapter.trim().length > 0 ? `最新：${chapter}` : '';
  }

  private openResult(): void {
    if (this.result.bookId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
    ReaderUiStore.dispatch({
      type: 'book-detail-load',
      bookId: this.result.bookId,
      sourceId: this.result.sourceId ?? '',
    });
  }

  build() {
    Row({ space: ReaderUiVisualTokens.searchResultGap }) {
      Stack({ alignContent: Alignment.Center }) {
        SourceCoverImage({
          sourceId: this.result.sourceId ?? '',
          coverUrl: this.result.coverUrl ?? '',
          // The Figma result-card master supplies this exact gradient when a
          // Core result has no cover URI.  The title stays live data in the
          // layer above, so the static Figma sample label is intentionally not
          // carried into the app.
          fallback: $r('app.media.figma_search_result_cover_placeholder'),
        })
        if ((this.result.coverUrl ?? '').trim().length === 0) {
          Text(this.title())
            .fontFamily(ReaderUiVisualTokens.searchSerifFontFamily)
            .fontSize(9)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.searchOnPrimary)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .textAlign(TextAlign.Center)
            .padding(6)
        }
      }
      .width(ReaderUiVisualTokens.searchResultCoverWidth)
      .height(ReaderUiVisualTokens.searchResultCoverHeight)
      .borderRadius(ReaderUiVisualTokens.searchResultCoverRadius)
      .clip(true)

      Column() {
        Text(this.title())
          .fontFamily(ReaderUiVisualTokens.searchSerifFontFamily)
          .fontSize(ReaderUiVisualTokens.searchResultTitleSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.searchInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
        if (this.result.author.trim().length > 0) {
          Text(this.result.author)
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(ReaderUiVisualTokens.searchResultAuthorSize)
            .fontColor(ReaderUiVisualTokens.searchMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
            .margin({ top: 5 })
        }
        if (this.latest().length > 0) {
          Text(this.latest())
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(ReaderUiVisualTokens.searchResultLatestSize)
            .fontColor(ReaderUiVisualTokens.searchMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
            .margin({ top: 5 })
        }
        if ((this.result.intro ?? '').trim().length > 0) {
          Text(this.result.intro ?? '')
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(ReaderUiVisualTokens.searchResultIntroSize)
            .fontColor(ReaderUiVisualTokens.searchIntro)
            .lineHeight(18)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
            .margin({ top: 5 })
        }
        if (this.result.sourceName.trim().length > 0) {
          Text(this.result.sourceName)
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(ReaderUiVisualTokens.searchResultSourceSize)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.searchPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
            .margin({ top: 5 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.searchResultRowHeight)
    .padding({
      left: ReaderUiVisualTokens.searchResultHorizontalInset,
      right: ReaderUiVisualTokens.searchResultHorizontalInset,
      top: 14,
      bottom: 14,
    })
    .alignItems(VerticalAlign.Top)
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.searchBorder })
    .onClick(() => this.openResult())
  }
}

@Component
struct FigmaSearchPage {
  @Prop requestedState: string = 'initial';
  @StorageProp('reader.searchQuery') submittedQuery: string = '';
  @StorageProp('reader.searchResults') searchResults: SearchResultEntry[] = [];
  @StorageProp('reader.searchHistory') history: string[] = [];
  @StorageProp('reader.searchHistoryLoaded') historyLoaded: boolean = false;
  @StorageProp('reader.searchHistoryLoading') historyLoading: boolean = false;
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.pageState') pageState: string = 'default';
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];
  @StorageProp('reader.displayedRouteId') routeId: string = 'book-search';
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  @State private queryText: string = '';

  aboutToAppear(): void {
    this.syncQueryFromStore();
  }

  private syncQueryFromStore(): void {
    if (this.queryText.length === 0 || this.queryText === this.submittedQuery) {
      this.queryText = this.submittedQuery;
    }
  }

  private isTablet(): boolean {
    return this.viewportClass === 'tablet';
  }

  private headerHeight(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.searchTabletHeaderHeight
      : ReaderUiVisualTokens.searchPhoneHeaderHeight;
  }

  private headerContentWidth(): string | number {
    return this.isTablet() ? ReaderUiVisualTokens.searchTabletHeaderWidth : '100%';
  }

  private headerInset(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.searchTabletHeaderInset
      : ReaderUiVisualTokens.searchPhoneHeaderInset;
  }

  private fieldHeight(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.searchHeaderFieldTabletHeight
      : ReaderUiVisualTokens.searchHeaderFieldPhoneHeight;
  }

  private actionWidth(): number {
    if (this.loading && !this.isTablet()) return ReaderUiVisualTokens.searchHeaderLoadingPhoneActionWidth;
    return this.isTablet()
      ? ReaderUiVisualTokens.searchHeaderTabletActionWidth
      : ReaderUiVisualTokens.searchHeaderPhoneActionWidth;
  }

  private bodyWidth(): string | number {
    return this.isTablet() ? ReaderUiVisualTokens.searchContentTabletWidth : '100%';
  }

  private bodyInset(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.searchContentTabletInset
      : ReaderUiVisualTokens.searchContentPhoneInset;
  }

  private resolvedState(): string {
    if (this.loading || this.requestedState === 'loading') return 'loading';
    if (this.errorCode.length > 0 || this.pageState === 'error' || this.requestedState === 'error') return 'error';
    if (this.searchResults.length > 0) return 'results';
    if (this.pageState === 'empty' || this.requestedState === 'empty') return 'empty';
    return 'initial';
  }

  private canSubmit(): boolean {
    return !this.loading && this.queryText.trim().length > 0;
  }

  private submit(): void {
    const query = this.queryText.trim();
    if (query.length === 0 || this.loading) return;
    ReaderUiStore.dispatch({ type: 'search-submit', query });
  }

  private clearDraft(): void {
    if (this.loading) return;
    this.queryText = '';
  }

  private clearHistory(): void {
    if (!this.historyLoaded || this.historyLoading || this.history.length === 0 || this.routeId !== 'book-search') return;
    // Figma exposes one direct “清空记录” control. The existing Core reducer
    // still receives its two guarded events synchronously, so no local-only
    // deletion is ever presented as persisted data.
    ReaderUiStore.dispatch({ type: 'search-history-clear-request' });
    ReaderUiStore.dispatch({ type: 'search-history-clear-confirm' });
  }

  private visibleHistory(): string[] {
    return this.history.slice(0, 5);
  }

  private visibleSourceNames(): string[] {
    const names: string[] = [];
    for (let index = 0; index < this.availableSources.length && names.length < 4; index += 1) {
      const source = this.availableSources[index];
      if (!source.enabled || source.name.trim().length === 0) continue;
      names.push(source.name);
    }
    return names;
  }

  private retry(): void {
    this.submit();
  }

  @Builder renderHeader() {
    Column() {
      Row({ space: ReaderUiVisualTokens.searchHeaderGap }) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.search_page_back')).width(20).height(20)
        }
        .width(ReaderUiVisualTokens.searchBackHitSize)
        .height(ReaderUiVisualTokens.searchBackHitSize)
        .accessibilityText('返回')
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

        Row({ space: 8 }) {
          Image($r('app.media.search_page_magnifier')).width(14).height(14)
          Stack({ alignContent: Alignment.Start }) {
            if (this.queryText.length === 0) {
              Text('搜索书名、作者...')
                .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
                .fontSize(14)
                .fontColor(ReaderUiVisualTokens.searchInputPlaceholder)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .width('100%')
            }
            TextInput({ text: this.queryText, placeholder: '' })
              .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
              .fontSize(14)
              .fontColor(ReaderUiVisualTokens.searchInk)
              .backgroundColor(Color.Transparent)
              .width('100%')
              .height(this.fieldHeight())
              .padding(0)
              .onChange((value: string) => { this.queryText = value; })
              .onSubmit(() => this.submit())
          }
          .layoutWeight(1)
          .height(this.fieldHeight())
          if (this.queryText.length > 0) {
            Image($r('app.media.search_page_clear')).width(14).height(14)
              .accessibilityText('清空搜索词')
              .onClick(() => this.clearDraft())
          }
        }
        .layoutWeight(1)
        .height(this.fieldHeight())
        .padding({ left: 12, right: 12 })
        .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
        .backgroundColor(ReaderUiVisualTokens.searchInputSurface)
        .alignItems(VerticalAlign.Center)

        Row({ space: this.loading ? 6 : 0 }) {
          if (this.loading) {
            LoadingProgress()
              .width(13)
              .height(13)
              .color(ReaderUiVisualTokens.searchOnPrimary)
          }
          Text('搜索')
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(this.isTablet() ? 14 : 13)
            .fontWeight(800)
            .fontColor(ReaderUiVisualTokens.searchOnPrimary)
        }
        .width(this.actionWidth())
        .height(this.fieldHeight())
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
        .backgroundColor(this.canSubmit() ? ReaderUiVisualTokens.searchPrimary : ReaderUiVisualTokens.searchPrimaryDisabled)
        .enabled(this.canSubmit())
        .onClick(() => this.submit())
      }
      .width(this.headerContentWidth())
      .height(this.headerHeight())
      .padding({ left: this.headerInset(), right: this.headerInset() })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(this.headerHeight() + 1)
    .alignItems(HorizontalAlign.Center)
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.searchBorder })
  }

  @Builder renderSourceTabs() {
    Column() {
      Scroll() {
        Row({ space: ReaderUiVisualTokens.searchSourceChipGap }) {
          Text('全部')
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.searchOnPrimary)
            .height(ReaderUiVisualTokens.searchSourceChipHeight)
            .padding({ left: 12, right: 12 })
            .textAlign(TextAlign.Center)
            .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
            .backgroundColor(ReaderUiVisualTokens.searchPrimary)
          ForEach(this.visibleSourceNames(), (name: string, index: number) => {
            Text(name)
              .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
              .fontSize(12)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.searchMuted)
              .height(ReaderUiVisualTokens.searchSourceChipHeight)
              .padding({ left: 12, right: 12 })
              .textAlign(TextAlign.Center)
              .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
              .backgroundColor(ReaderUiVisualTokens.searchChipSurface)
              .border({ width: 1, color: ReaderUiVisualTokens.searchBorder })
          }, (name: string, index: number) => `${name}-${index}`)
        }
        .height(ReaderUiVisualTokens.searchSourceTabsHeight)
        .padding({ left: this.headerInset(), right: this.headerInset() })
        .alignItems(VerticalAlign.Center)
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width(this.headerContentWidth())
      .height(ReaderUiVisualTokens.searchSourceTabsHeight)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.searchSourceTabsHeight + 1)
    .alignItems(HorizontalAlign.Center)
    .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.searchBorder })
  }

  @Builder renderInitial() {
    Column() {
      Row() {
        Text('最近搜索')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.searchInk)
          .layoutWeight(1)
        if (this.visibleHistory().length > 0 && !this.historyLoading && this.routeId === 'book-search') {
          Text('清空记录')
            .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
            .fontSize(12)
            .fontWeight(500)
            .fontColor(ReaderUiVisualTokens.searchMuted)
            .height(26)
            .onClick(() => this.clearHistory())
        }
      }
      .width('100%')
      .height(26)
      .alignItems(VerticalAlign.Center)

      if (this.visibleHistory().length > 0) {
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
          ForEach(this.visibleHistory(), (keyword: string, index: number) => {
            Text(keyword)
              .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
              .fontSize(13)
              .fontWeight(500)
              .fontColor(ReaderUiVisualTokens.searchInk)
              .height(ReaderUiVisualTokens.searchHistoryChipHeight)
              .padding({ left: 14, right: 14 })
              .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
              .backgroundColor(ReaderUiVisualTokens.searchChipSurface)
              .border({ width: 1, color: ReaderUiVisualTokens.searchBorder })
              .margin({ right: ReaderUiVisualTokens.searchHistoryChipGap, bottom: 8 })
              .onClick(() => { this.queryText = keyword; })
          }, (keyword: string, index: number) => `${keyword}-${index}`)
        }
        .width('100%')
        .margin({ top: 14 })
      }
    }
    .width(this.bodyWidth())
    .padding({ left: this.bodyInset(), right: this.bodyInset(), top: ReaderUiVisualTokens.searchHistoryTopInset })
    .alignItems(HorizontalAlign.Start)
  }

  @Builder renderLoading() {
    Column({ space: 8 }) {
      LoadingProgress()
        .width(36)
        .height(36)
        .color(ReaderUiVisualTokens.searchPrimary)
      Text('正在搜索所有书源…')
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(13)
        .fontColor(ReaderUiVisualTokens.searchMuted)
    }
    .width(this.bodyWidth())
    .height(194)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder renderResults() {
    Column() {
      Text(`找到 ${this.searchResults.length} 本相关书籍`)
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(11)
        .fontColor(ReaderUiVisualTokens.searchMuted)
        .width('100%')
        .height(ReaderUiVisualTokens.searchResultStatusHeight)
        .padding({ left: ReaderUiVisualTokens.searchResultHorizontalInset })
        .align(Alignment.Start)
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.searchBorder })
      ForEach(this.searchResults, (result: SearchResultEntry, index: number) => {
        FigmaSearchResultRow({ result })
      }, (result: SearchResultEntry, index: number) => `${result.sourceId ?? ''}-${result.bookId}-${index}`)
    }
    .width(this.bodyWidth())
  }

  @Builder renderEmpty() {
    Column() {
      Text('?')
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(18)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.searchMuted)
        .margin({ top: 68 })
      Text('没有找到相关书籍')
        .fontFamily(ReaderUiVisualTokens.searchSerifFontFamily)
        .fontSize(ReaderUiVisualTokens.searchEmptyTitleSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.searchInk)
        .margin({ top: 102 })
      Text(`所有书源均未搜索到\n「${this.submittedQuery}」\n的相关结果`)
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(13)
        .fontColor(ReaderUiVisualTokens.searchMuted)
        .textAlign(TextAlign.Center)
        .lineHeight(20)
        .margin({ top: 10 })
      Column({ space: 4 }) {
        Text('搜索建议')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(12)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.searchInk)
        Text('·  检查书名拼写是否正确')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(12)
          .fontColor(ReaderUiVisualTokens.searchMuted)
        Text('·  尝试更短的关键词或作者名')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(12)
          .fontColor(ReaderUiVisualTokens.searchMuted)
        Text('·  前往发现页手动添加书源')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(12)
          .fontColor(ReaderUiVisualTokens.searchMuted)
      }
      .margin({ top: 32 })
      .alignItems(HorizontalAlign.Start)
      Row({ space: 10 }) {
        Text('添加书源')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ReaderUiVisualTokens.searchOnPrimary)
          .width(88)
          .height(36)
          .textAlign(TextAlign.Center)
          .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
          .backgroundColor(ReaderUiVisualTokens.searchPrimary)
        Text('重新搜索')
          .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.searchMuted)
          .width(89)
          .height(36)
          .textAlign(TextAlign.Center)
          .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
          .backgroundColor(ReaderUiVisualTokens.searchChipSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.searchBorder })
          .onClick(() => this.retry())
      }
      .margin({ top: 28 })
    }
    .width(this.bodyWidth())
    .alignItems(HorizontalAlign.Center)
  }

  @Builder renderError() {
    Column() {
      Text('搜索失败')
        .fontFamily(ReaderUiVisualTokens.searchSerifFontFamily)
        .fontSize(ReaderUiVisualTokens.searchEmptyTitleSize)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.searchInk)
        .margin({ top: 196 })
      Text('请检查网络后重试')
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(13)
        .fontColor(ReaderUiVisualTokens.searchMuted)
        .margin({ top: 8 })
      Text('重新搜索')
        .fontFamily(ReaderUiVisualTokens.searchControlFontFamily)
        .fontSize(14)
        .fontWeight(800)
        .fontColor(ReaderUiVisualTokens.searchOnPrimary)
        .width(112)
        .height(ReaderUiVisualTokens.searchStateActionHeight)
        .textAlign(TextAlign.Center)
        .borderRadius(ReaderUiVisualTokens.searchHeaderRadius)
        .backgroundColor(ReaderUiVisualTokens.searchPrimary)
        .margin({ top: 28 })
        .onClick(() => this.retry())
    }
    .width(this.bodyWidth())
    .alignItems(HorizontalAlign.Center)
  }

  build() {
    Column() {
      this.renderHeader()
      if (this.resolvedState() === 'initial') {
        this.renderInitial()
      } else {
        this.renderSourceTabs()
        if (this.resolvedState() === 'loading') {
          this.renderLoading()
        } else if (this.resolvedState() === 'results') {
          this.renderResults()
        } else if (this.resolvedState() === 'empty') {
          this.renderEmpty()
        } else {
          this.renderError()
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(ReaderUiVisualTokens.searchPageSurface)
  }
}

@Component
export struct SearchHomePage {
  build() {
    FigmaSearchPage({ requestedState: 'initial' })
  }
}

@Component
export struct SearchResultsPage {
  build() {
    FigmaSearchPage({ requestedState: 'results' })
  }
}

@Component
export struct SearchStatePage {
  @Prop variant: string = 'empty';

  build() {
    FigmaSearchPage({ requestedState: this.variant })
  }
}

@Component
export struct BookTocPreviewPage {
  @Prop title: string = '目录预览';
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.loading') loading: boolean = false;

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  private openChapter(chapter: ChapterTocEntry): void {
    const book = this.currentBook;
    if (book === null || chapter.chapterId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: chapter.chapterId, bookId: book.bookId, chapterTitle: chapter.title,
    });
  }

  build() {
    Column() {
      SectionTitle({ title: this.title })
      if (this.currentBook === null || this.chapterToc.length === 0) {
        Text(this.statusMessage())
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .lineHeight(19)
          .width('100%')
          .padding({ top: 14, bottom: 14 })
      } else {
        ForEach(this.chapterToc, (chapter: ChapterTocEntry, idx: number) => {
          DirectoryChapterRow({
            title: chapter.title,
            current: this.isCurrent(chapter),
            onSelect: () => this.openChapter(chapter),
          })
            .margin({ top: idx === 0 ? 10 : 8 })
        }, (chapter: ChapterTocEntry, idx: number) => `${chapter.chapterId}-${idx}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookshelfEmptyPage {
  @Prop title: string = '书架还是空的';
  @Prop message: string = '导入本地书籍或通过搜索加入书架。';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: '导入本地书' })
    }
    .width('100%')
  }
}

@Component
export struct BookMoreMenuPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private canRemoveFromShelf(): boolean {
    return this.currentBook !== null && this.currentBook.bookId.length > 0
      && (this.currentBook.sourceId ?? '').length > 0;
  }

  private openDetail(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
  }

  private openDirectory(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' });
  }

  private removeFromShelf(): void {
    if (!this.canRemoveFromShelf()) return;
    ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'delete' });
  }

  private openGroupManagement(): void {
    if (!this.canRemoveFromShelf()) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'group-management' });
  }

  build() {
    Column() {
      if (this.currentBook === null) {
        StructureCard({
          title: '未选择书籍',
          message: '请先从书架、搜索或发现结果打开一本实际 Core 书籍后，再使用更多操作。',
        })
      } else {
        StructureCard({
          title: this.currentBook.title.length > 0 ? this.currentBook.title : '未命名书籍',
          message: this.currentBook.author.length > 0 ? this.currentBook.author : 'Core 未提供作者信息。',
        })
        StructureRow({ title: '书籍详情', detail: '查看当前 Core 书籍的简介、书源与目录' })
          .margin({ top: 12 })
          .onClick(() => this.openDetail())
        StructureRow({ title: '章节目录', detail: '查看当前书籍的 Core 章节目录' })
          .margin({ top: 8 })
          .onClick(() => this.openDirectory())
        if (this.canRemoveFromShelf()) {
          StructureRow({ title: '书架分组', detail: '在 Core 分组管理中为当前书架书籍分配或清空分组' })
            .margin({ top: 8 })
            .onClick(() => this.openGroupManagement())
          StructureRow({ title: '移出书架', detail: '从 Core 书架移除当前书籍', chip: '移除', showChevron: false })
            .margin({ top: 8 })
            .onClick(() => this.removeFromShelf())
        } else {
          Text('当前书籍缺少可用于移出书架的 Core 书源标识。')
            .fontSize(12)
            .lineHeight(18)
            .fontColor(ColorTokens.muted)
            .width('100%')
            .margin({ top: 12 })
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct BookshelfGroupAssignmentRow {
  @Prop book: CoreBookshelfBook;
  @Prop groups: CoreBookGroup[] = [];
  @Prop disabled: boolean = false;
  @StorageProp('reader.pendingBookGroupClearSourceId') pendingClearSourceId: string = '';
  @StorageProp('reader.pendingBookGroupClearBookId') pendingClearBookId: string = '';

  private currentGroup(): string {
    return this.book.group.trim().length > 0 ? this.book.group : '未分组';
  }

  private assign(group: string): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-assign',
      sourceId: this.book.sourceId,
      bookId: this.book.bookId,
      // `bookshelf.group.assign` treats empty string as an explicit clear.
      bookshelfGroup: group,
    });
  }

  private isClearPending(): boolean {
    return this.pendingClearSourceId === this.book.sourceId &&
      this.pendingClearBookId === this.book.bookId;
  }

  private requestClear(): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-clear-request', sourceId: this.book.sourceId, bookId: this.book.bookId,
    });
  }

  private confirmClear(): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-clear-confirm', sourceId: this.book.sourceId, bookId: this.book.bookId,
    });
  }

  build() {
    Column({ space: 7 }) {
      Text(this.book.title)
        .fontSize(14).fontWeight(750).fontColor(ColorTokens.ink)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Text(`${this.book.author} · 当前分组：${this.currentGroup()}`)
        .fontSize(12).fontColor(ColorTokens.muted)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      if (this.groups.length === 0) {
        Text('Core 中尚无可分配的分组；可先在上方创建分组。')
          .fontSize(12).fontColor(ColorTokens.muted).lineHeight(18).width('100%')
      } else {
        ForEach(this.groups, (group: CoreBookGroup, idx: number) => {
          Text(`分配到「${group.groupName}」`)
            .fontSize(12).fontWeight(750)
            .fontColor(this.disabled ? ColorTokens.muted : DemoAliasTokens.onPrimary)
            .height(32).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.disabled ? ColorTokens.metaBg : ColorTokens.primary)
            .opacity(this.disabled ? 0.58 : 1)
            .enabled(!this.disabled)
            .onClick(() => this.assign(group.groupName))
            .margin({ right: 6, bottom: 5 })
        }, (group: CoreBookGroup, idx: number) => `${group.groupId}-${idx}`)
      }
      if (this.book.group.trim().length > 0) {
        if (this.isClearPending()) {
          Row({ space: 8 }) {
            Text('取消')
              .fontSize(12).fontWeight(750)
              .fontColor(ColorTokens.primary)
              .height(32).layoutWeight(1).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'book-group-clear-cancel' }))
            Text('确认清空分组')
              .fontSize(12).fontWeight(750)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(32).layoutWeight(1).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => this.confirmClear())
          }
          .width('100%')
        } else {
          Text('清空分组')
            .fontSize(12).fontWeight(750)
            .fontColor(this.disabled ? ColorTokens.muted : ColorTokens.accent)
            .height(32).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .border({ width: 1, color: ColorTokens.border })
            .opacity(this.disabled ? 0.58 : 1)
            .enabled(!this.disabled)
            .onClick(() => this.requestClear())
        }
      }
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct BookGroupCreateForm {
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @State private groupName: string = '';

  private submit(): void {
    if (this.loading) return;
    const normalized = this.groupName.trim();
    if (normalized.length === 0) return;
    ReaderUiStore.dispatch({ type: 'book-group-create', bookGroupName: normalized });
    this.groupName = '';
  }

  build() {
    Column({ space: 8 }) {
      Text('新建分组')
        .fontSize(15)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
      Row({ space: 8 }) {
        TextInput({ text: this.groupName, placeholder: '输入分组名称' })
          .fontSize(14)
          .fontColor(ColorTokens.ink)
          .height(42)
          .layoutWeight(1)
          .padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .onChange((value: string) => { this.groupName = value; })
        Text(this.loading ? '处理中' : '创建')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(42)
          .padding({ left: 16, right: 16 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
          .textAlign(TextAlign.Center)
          .onClick(() => this.submit())
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct BookGroupEditorRow {
  @Prop group: CoreBookGroup = {
    groupId: 0, groupName: '', cover: '', order: 0, enableRefresh: true, show: true,
  };
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.pendingBookGroupDeleteId') pendingDeleteId: number = 0;
  @State private nameDraft: string = '';

  aboutToAppear(): void {
    this.nameDraft = this.group.groupName;
  }

  private save(): void {
    if (this.loading || this.pendingDeleteId !== 0) return;
    ReaderUiStore.dispatch({
      type: 'book-group-update', bookGroupId: this.group.groupId, bookGroupName: this.nameDraft,
    });
  }

  private remove(): void {
    if (this.loading || this.pendingDeleteId !== 0) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-request', bookGroupId: this.group.groupId });
  }

  private awaitingDeleteConfirmation(): boolean {
    return this.pendingDeleteId === this.group.groupId;
  }

  private cancelDelete(): void {
    if (!this.awaitingDeleteConfirmation() || this.loading) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-cancel' });
  }

  private confirmDelete(): void {
    if (!this.awaitingDeleteConfirmation() || this.loading) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-confirm', bookGroupId: this.group.groupId });
  }

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(`分组 #${this.group.groupId}`)
          .fontSize(11)
          .fontWeight(700)
          .fontColor(ColorTokens.muted)
          .layoutWeight(1)
        HandoffStatusChip({ label: this.group.show ? '显示' : '隐藏' })
        HandoffStatusChip({ label: this.group.enableRefresh ? '自动刷新' : '不自动刷新' })
          .margin({ left: 6 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
      TextInput({ text: this.nameDraft, placeholder: '分组名称' })
        .fontSize(14)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(40)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.nameDraft = value; })
      Text(`排序 ${this.group.order}`)
        .fontSize(11)
        .fontColor(ColorTokens.muted)
      if (this.awaitingDeleteConfirmation()) {
        Column({ space: 8 }) {
          Text(`确认删除“${this.group.groupName}”？此操作会请求 Core 删除该分组。`)
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ColorTokens.accent)
            .lineHeight(18)
            .width('100%')
          Row({ space: 10 }) {
            Text(this.loading ? '处理中' : '取消')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.primaryDark)
              .height(34)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => this.cancelDelete())
            Text('确认删除')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(34)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => this.confirmDelete())
          }
          .width('100%')
        }
        .width('100%')
        .padding(10)
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.surfaceSoft)
      } else {
        Row({ space: 10 }) {
          Text(this.loading ? '处理中' : '保存名称')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(34)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primary)
            .onClick(() => this.save())
          Text(this.pendingDeleteId !== 0 ? '请先处理删除确认' : '删除')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.pendingDeleteId !== 0 ? ColorTokens.muted : ColorTokens.accent)
            .height(34)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => this.remove())
        }
        .width('100%')
      }
    }
    .width('100%')
    .padding(12)
    .margin({ bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct BookGroupManagementPage {
  @Prop title: string = '分组';
  @StorageProp('reader.bookGroups') groups: CoreBookGroup[] = [];
  @StorageProp('reader.bookGroupsLoaded') loaded: boolean = false;
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.bookGroupsError') errorMessage: string = '';

  build() {
    Column({ space: 10 }) {
      SectionTitle({ title: this.title })
      BookGroupCreateForm()
      Text('分组列表')
        .fontSize(15)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 4 })
      if (this.loading) {
        Text('正在从 Core 读取分组…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      }
      if (this.errorMessage.length > 0) {
        Text(`分组操作失败：${this.errorMessage}`)
          .fontSize(13)
          .fontColor(ColorTokens.accent)
          .width('100%')
          .padding(12)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      if (this.loaded && !this.loading && this.groups.length === 0 && this.errorMessage.length === 0) {
        Text('Core 中尚无书架分组。创建后会直接持久化到 Core。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.groups, (entry: CoreBookGroup, idx: number) => {
        BookGroupEditorRow({ group: entry })
      }, (entry: CoreBookGroup, idx: number) => `${entry.groupId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GroupManagementPage {
  @Prop variant: string = 'group-flow';
  @StorageProp('reader.bookGroups') groups: CoreBookGroup[] = [];
  @StorageProp('reader.bookGroupsLoaded') loaded: boolean = false;
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.bookGroupsError') errorMessage: string = '';
  @StorageProp('reader.bookshelfBooks') books: CoreBookshelfBook[] = [];
  @StorageProp('reader.bookshelfLoaded') booksLoaded: boolean = false;

  build() {
    Column({ space: 10 }) {
      SectionTitle({ title: this.variant === 'group-flow' ? '分组列表' : '分组管理' })
      BookGroupCreateForm()
      if (this.loading) {
        Text('正在从 Core 读取分组…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      }
      if (this.errorMessage.length > 0) {
        Text(`分组操作失败：${this.errorMessage}`)
          .fontSize(13)
          .fontColor(ColorTokens.accent)
          .width('100%')
          .padding(12)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      if (this.loaded && !this.loading && this.groups.length === 0 && this.errorMessage.length === 0) {
        Text('Core 中尚无书架分组。创建后会直接持久化到 Core。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.groups, (entry: CoreBookGroup, idx: number) => {
        BookGroupEditorRow({ group: entry })
      }, (entry: CoreBookGroup, idx: number) => `${entry.groupId}-${idx}`)

      SectionTitle({ title: '书籍归属' })
        .margin({ top: 8 })
      Text('书籍归属通过 Core bookshelf.group.assign 逐本更新。可分配到当前 Core 分组或清空分组；批量操作仍未接入。')
        .fontSize(12)
        .lineHeight(18)
        .fontColor(ColorTokens.muted)
        .width('100%')
      if (this.booksLoaded && this.books.length === 0) {
        Text('书架为空。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.books, (entry: CoreBookshelfBook, idx: number) => {
        BookshelfGroupAssignmentRow({
          book: entry,
          groups: this.groups,
          disabled: this.loading,
        })
          .margin({ top: idx === 0 ? 2 : 0 })
      }, (entry: CoreBookshelfBook, idx: number) => `${entry.sourceId}-${entry.bookId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookBatchManagementPage {
  @StorageProp('reader.bookshelfBooks') books: CoreBookshelfBook[] = [];
  @StorageProp('reader.bookshelfLoaded') loaded: boolean = false;

  private detail(book: CoreBookshelfBook): string {
    return book.lastChapter.length > 0 ? `${book.author} · ${book.lastChapter}` : book.author;
  }

  build() {
    Column() {
      StructureCard({
        title: '批量操作未接入',
        message: '当前 Core 书架支持真实读取、单本移除和单本归组；没有可验证的批量选择或批量归组命令，因此不显示固定的选中数量、示例书籍或伪操作。',
      })

      SectionTitle({ title: '书架书籍' })
        .margin({ top: 14 })
      if (!this.loaded) {
        Text('正在读取 Core 书架…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      } else if (this.books.length === 0) {
        Text('Core 书架为空。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.books, (entry: CoreBookshelfBook, idx: number) => {
        BookshelfToolBookRow({
          title: entry.title,
          detail: this.detail(entry),
          group: entry.group,
          selected: false,
        })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: CoreBookshelfBook, idx: number) => `${entry.sourceId}-${entry.bookId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct DirectoryBookmarkRow {
  @Prop bookmark: CoreBookmark;
  @StorageProp('reader.pendingBookmarkDeleteTime') pendingBookmarkDeleteTime: number = -1;

  private chapterLabel(): string {
    const name = this.bookmark.chapterName.trim();
    return name.length > 0 ? name : `第 ${this.bookmark.chapterIndex + 1} 章`;
  }

  private contentLabel(): string {
    const note = this.bookmark.content.trim();
    if (note.length > 0) return note;
    const original = this.bookmark.bookText.trim();
    return original.length > 0 ? original : 'Core 书签未保存原文片段或批注。';
  }

  private awaitingDeleteConfirmation(): boolean {
    return this.pendingBookmarkDeleteTime === this.bookmark.time;
  }

  build() {
    Column({ space: 6 }) {
      Row({ space: 8 }) {
        Text(this.chapterLabel())
          .fontSize(14).fontWeight(750).fontColor(ColorTokens.ink)
          .layoutWeight(1).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`Core #${this.bookmark.time}`)
          .fontSize(10).fontColor(ColorTokens.muted)
      }
      .width('100%')
      Text(this.contentLabel())
        .fontSize(12).fontColor(ColorTokens.muted).lineHeight(18)
        .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Row({ space: 8 }) {
        Text('跳转')
          .fontSize(11).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
          .height(30).padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-open', bookmarkTime: this.bookmark.time }))
        Text('删除')
          .fontSize(11).fontWeight(800).fontColor(ColorTokens.accent)
          .height(30).padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill).border({ width: 1, color: ColorTokens.border })
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-request', bookmarkTime: this.bookmark.time }))
      }
      .width('100%')
      if (this.awaitingDeleteConfirmation()) {
        Column({ space: 7 }) {
          Text('确认删除这条 Core 书签？')
            .fontSize(11).fontWeight(800).fontColor(ColorTokens.accent).width('100%')
          Row({ space: 8 }) {
            Text('取消')
              .fontSize(11).fontWeight(800).fontColor(ColorTokens.primaryDark)
              .height(30).padding({ left: 12, right: 12 })
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-cancel' }))
            Text('确认删除')
              .fontSize(11).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
              .height(30).padding({ left: 12, right: 12 })
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.accent)
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-confirm', bookmarkTime: this.bookmark.time }))
          }
          .width('100%')
        }
        .width('100%')
        .padding(8)
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.surfaceSoft)
      }
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct BookDirectoryPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.tocMode') tocMode: TocMode = 'directory';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.bookmarks') bookmarks: CoreBookmark[] = [];
  @StorageProp('reader.bookmarksLoaded') bookmarksLoaded: boolean = false;
  @StorageProp('reader.bookmarksLoading') bookmarksLoading: boolean = false;
  @StorageProp('reader.bookmarksError') bookmarksError: string = '';

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  private openChapter(chapter: ChapterTocEntry): void {
    const book = this.currentBook;
    if (book === null || chapter.chapterId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: chapter.chapterId, bookId: book.bookId, chapterTitle: chapter.title,
    });
  }

  private summaryMessage(): string {
    if (this.currentBook === null) return '请选择一本实际书籍后再查看目录。';
    if (this.loading) return '正在读取本书章节目录。';
    return this.chapterToc.length > 0 ? `共 ${this.chapterToc.length} 章` : '暂无章节目录';
  }

  build() {
    Column() {
      StructureCard({
        title: this.currentBook === null ? '未选择书籍' : this.currentBook.title,
        message: this.currentBook === null ? this.summaryMessage() : `${this.currentBook.author} · ${this.summaryMessage()}`,
      })
      if (this.currentBook !== null) {
        Row({ space: 8 }) {
          DirectorySegmentButton({
            label: '目录',
            active: this.tocMode === 'directory',
            onSelect: () => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }),
          })
          DirectorySegmentButton({
            label: '书签',
            active: this.tocMode === 'bookmark',
            onSelect: () => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }),
          })
        }
        .width('100%')
        .padding(4)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ top: 12 })

        if (this.tocMode === 'bookmark') {
          if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Text('正在从 Core 读取当前书的书签…')
              .fontSize(13).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else if (this.bookmarksError.length > 0) {
            Text(`书签操作失败：${this.bookmarksError}`)
              .fontSize(13).fontColor(ColorTokens.accent).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else if (this.bookmarks.length === 0) {
            Text('当前书在 Core 中还没有书签。可在阅读器控制栏添加当前位置书签。')
              .fontSize(13).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else {
            ForEach(this.bookmarks, (bookmark: CoreBookmark, idx: number) => {
              DirectoryBookmarkRow({ bookmark: bookmark })
                .margin({ top: idx === 0 ? 12 : 8 })
            }, (bookmark: CoreBookmark, idx: number) => `${bookmark.time}-${idx}`)
          }
        } else if (this.chapterToc.length === 0) {
          Text(this.statusMessage())
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .lineHeight(19)
            .width('100%')
            .padding({ top: 16, bottom: 16 })
        } else {
          ForEach(this.chapterToc, (chapter: ChapterTocEntry, idx: number) => {
            DirectoryChapterRow({
              title: chapter.title,
              current: this.isCurrent(chapter),
              onSelect: () => this.openChapter(chapter),
            })
              .margin({ top: idx === 0 ? 12 : 8 })
          }, (chapter: ChapterTocEntry, idx: number) => `${chapter.chapterId}-${idx}`)
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceManagementPage {
  // The canonical view-state title is consumed as the semantic label for this
  // body; the visible Figma title remains shell-owned by BackTopBar.
  @Prop title: string = '书源管理';
  @StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = [];
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  @State query: string = '';

  aboutToAppear(): void {
    // The Figma screen is a projection of persisted sources.  Reading that
    // projection remains an Effects-owned refresh, rather than a visual-only
    // sample list.
    ReaderUiStore.dispatch({ type: 'source-management-refresh' });
  }

  private enabledCount(): number {
    let count = 0;
    for (let i = 0; i < this.coreSources.length; i++) {
      if (this.coreSources[i].enabled) count += 1;
    }
    return count;
  }

  private isTablet(): boolean {
    return this.viewportClass === 'tablet';
  }

  private sourceSummary(): string {
    return `${this.coreSources.length} 个书源 · ${this.enabledCount()} 个启用`;
  }

  private filteredSources(): CoreSourceEntry[] {
    const normalized = this.query.trim().toLowerCase();
    if (normalized.length === 0) return this.coreSources;
    const filtered: CoreSourceEntry[] = [];
    for (let index = 0; index < this.coreSources.length; index++) {
      const source = this.coreSources[index];
      const name = source.name.toLowerCase();
      const address = source.baseUrl.toLowerCase();
      if (name.indexOf(normalized) >= 0 || address.indexOf(normalized) >= 0) {
        filtered.push(source);
      }
    }
    return filtered;
  }

  @Builder renderFilters() {
    Row({ space: ReaderUiVisualTokens.sourceManagementFilterGap }) {
      FigmaSourceStatusFilter({ label: '全部', selected: true })
      FigmaSourceStatusFilter({ label: '启用' })
      FigmaSourceStatusFilter({ label: '异常' })
      FigmaSourceStatusFilter({ label: '未检测', wide: true })
      FigmaSourceStatusFilter({ label: '自定义', wide: true })
    }
    .width(350)
    .height(ReaderUiVisualTokens.sourceManagementFilterHeight)
  }

  build() {
    Column() {
      Stack({ alignContent: Alignment.TopStart }) {
        TextInput({ text: this.query, placeholder: '搜索书源名称或域名' })
          .fontFamily(ReaderUiVisualTokens.sourceManagementControlFontFamily)
          .fontSize(ReaderUiVisualTokens.sourceManagementSearchTextSize)
          .fontColor(ReaderUiVisualTokens.sourceManagementInk)
          .width('100%')
          .height(ReaderUiVisualTokens.sourceManagementSearchHeight)
          .padding({ left: 42, right: 12 })
          .borderRadius(ReaderUiVisualTokens.sourceManagementSearchRadius)
          .backgroundColor(ReaderUiVisualTokens.sourceManagementSearchSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.sourceManagementFieldBorder })
          .onChange((value: string) => { this.query = value; })
        Stack({ alignContent: Alignment.TopStart }) {
          Image($r('app.media.source_management_search_ring'))
            .width(13)
            .height(13)
          Image($r('app.media.source_management_search_handle'))
            .width(6)
            .height(6)
            .margin({ left: 11, top: 8 })
        }
        .width(17)
        .height(17)
        .margin({ left: 13, top: 10 })
      }
      .width('100%')
      .height(ReaderUiVisualTokens.sourceManagementSearchHeight)

      Text(this.sourceSummary())
        .fontFamily(ReaderUiVisualTokens.sourceManagementControlFontFamily)
        .fontSize(ReaderUiVisualTokens.sourceManagementStatsTextSize)
        .fontColor(ReaderUiVisualTokens.sourceManagementMuted)
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 8 })

      if (this.isTablet()) {
        Row({ space: ReaderUiVisualTokens.sourceManagementTabletFilterGroupGap }) {
          Column() {
            this.renderFilters()
          }
          .width(350)
          .height(ReaderUiVisualTokens.sourceManagementFilterHeight)
          FigmaSourceGroupFilter().width(350)
        }
        .width('100%')
        .height(ReaderUiVisualTokens.sourceManagementGroupHeight)
        .alignItems(VerticalAlign.Center)
        .margin({ top: 6 })
      } else {
        Column() {
          this.renderFilters()
        }
          .width(350)
          .height(ReaderUiVisualTokens.sourceManagementFilterHeight)
          .margin({ top: 8 })
        FigmaSourceGroupFilter()
          .margin({ top: 8 })
      }

      Column() {
        ForEach(this.filteredSources(), (entry: CoreSourceEntry, idx: number) => {
          FigmaSourceManagementRow({
              title: entry.name,
              meta: entry.baseUrl,
              sourceEnabled: entry.enabled,
            })
        }, (entry: CoreSourceEntry, idx: number) => entry.sourceId)
      }
      .width('100%')
      .margin({ top: this.isTablet() ? 12 : 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .accessibilityText(this.title)
  }
}

@Component
export struct SourceDetailPage {
  // Kept only for generated ViewStateRenderer compatibility. The rendered
  // title always comes from the Core-selected source below.
  @Prop title: string = '';
  @StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = [];
  @StorageProp('reader.selectedSourceId') selectedSourceId: string = '';

  private selectedSource(): CoreSourceEntry | null {
    for (let i = 0; i < this.coreSources.length; i++) {
      const source = this.coreSources[i];
      if (source.sourceId === this.selectedSourceId) return source;
    }
    return null;
  }

  private selectedName(): string {
    const source = this.selectedSource();
    return source === null ? '' : source.name;
  }

  private selectedBaseUrl(): string {
    const source = this.selectedSource();
    return source === null ? '' : source.baseUrl;
  }

  private selectedEnabled(): boolean {
    const source = this.selectedSource();
    return source !== null && source.enabled;
  }

  build() {
    Column() {
      if (this.selectedSource() === null) {
        StructureCard({
          title: '未选择有效书源',
          message: '该书源已被删除或尚未由 Core 返回。请返回书源管理后重新选择。',
        })
        Text('返回书源管理')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .padding({ left: 16, right: 16 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .margin({ top: 12 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      } else {
        SourceDetailHeader({
          title: this.selectedName(),
          baseUrl: this.selectedBaseUrl(),
          sourceId: this.selectedSourceId,
          isSourceEnabled: this.selectedEnabled(),
        })
        Text(this.selectedEnabled()
          ? '该启用书源可进入真实调测：Core 会通过 Host 执行 L1–L5，并只将短生命周期响应回放给 source.debug。规则编辑和启停仍需对应契约。'
          : '该书源已停用；不会启动网络调测或显示模拟成功。规则编辑和启停仍需对应契约。')
          .fontSize(12)
          .fontWeight(650)
          .fontColor(ColorTokens.muted)
          .lineHeight(18)
          .margin({ top: 12 })
        Row({ space: 10 }) {
          Text('返回管理')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.controlInk)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          Text('导出')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.primaryDark)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-export', sourceId: this.selectedSourceId }))
          Text('删除')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.statusWarn)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-delete-request', sourceId: this.selectedSourceId }))
        }
        .width('100%')
        .margin({ top: 16 })
        if (this.selectedEnabled()) {
          Text('运行真实调测')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(40)
            .width('100%')
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primary)
            .margin({ top: 10 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-debug' }))
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceImportOptionsPage {
  @Prop title: string = '导入书源';
  @StorageProp('reader.sourceImportRunning') importing: boolean = false;
  @State private jsonPayload: string = '';
  @State private packageUrl: string = '';

  private importManualJson(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-json',
      sourceImportPayload: this.jsonPayload,
      sourceImportOrigin: '手动 JSON',
    });
  }

  private importFromUrl(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-url',
      sourceImportUrl: this.packageUrl,
      sourceImportOrigin: '网络 URL',
    });
  }

  private importFromClipboard(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-clipboard',
      sourceImportOrigin: '剪贴板',
    });
  }

  build() {
    Column({ space: 12 }) {
      Text(this.title)
        .fontSize(18)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
      Text('粘贴一个 Legado BookSource JSON 对象或对象数组。每一项都会单独交给 Core 校验和写入。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(ColorTokens.muted)
      TextArea({
        text: this.jsonPayload,
        placeholder: '{"bookSourceName":"示例书源","bookSourceUrl":"https://example.com"}',
      })
        .fontSize(13)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(132)
        .padding(12)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.jsonPayload = value; })
      Row({ space: 10 }) {
        Text(this.importing ? '正在导入…' : '导入粘贴的 JSON')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.importing ? ColorTokens.border : ColorTokens.primary)
          .onClick(() => this.importManualJson())
        Text('从剪贴板导入')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => this.importFromClipboard())
      }
      .width('100%')
      Text('网络书源包')
        .fontSize(15)
        .fontWeight(850)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 4 })
      TextInput({ text: this.packageUrl, placeholder: 'https://example.com/book-source.json' })
        .fontSize(14)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(42)
        .padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.packageUrl = value; })
      Text(this.importing ? '正在下载或写入…' : '从 URL 下载并导入')
        .fontSize(13)
        .fontWeight(850)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(40)
        .width('100%')
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(this.importing ? ColorTokens.border : ColorTokens.primary)
        .onClick(() => this.importFromUrl())
      Text('结果页显示 Core 已导入、已跳过和失败的真实计数；不提供 Core 尚未定义的连通性检测或启停操作。')
        .fontSize(11)
        .lineHeight(17)
        .fontColor(ColorTokens.muted)
        .margin({ top: 2 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDisabledState {
  @Prop title: string = '书源已停用';
  @Prop message: string = '该书源 disabled / error，请在书源详情中修复。';
  @Prop action: string = '查看详情';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct SourceFormPage {
  @Prop action: string = '保存';
  @Prop editing: boolean = false;

  build() {
    Column() {
      StatePanel({
        title: '书源表单编辑未接入',
        message: 'Core source.import 接受完整的 BookSource 原始契约。当前页面没有可验证的字段级更新 DTO，因此不显示固定名称、URL 或无效的“保存”按钮。请使用书源管理中的 JSON、URL 或剪贴板导入。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '书源设置', message: '管理搜索、目录和正文规则。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceTestResultPage {
  @Prop title: string = '测试结果';

  build() {
    Column() {
      SectionTitle({ title: this.title })
        .margin({ bottom: 10 })
      // Both contract routes project the same Core-owned L1–L5 verdict.
      // Keeping this route as a real view of SourceDetectPage prevents the
      // historical “test result” screen from drifting into a static success
      // or a second, stale diagnostic state.
      SourceDetectPage()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncSettingsEntryPage {
  @Prop title: string = '同步设置';

  build() {
    Column() {
      StructureCard({ title: this.title, message: '管理 WebDAV、备份和阅读进度同步。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct SyncSectionHeading {
  @Prop title: string = '';

  build() {
    Text(this.title)
      .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
      .fontSize(ReaderUiVisualTokens.syncSectionTitleSize)
      .fontWeight(900)
      .fontColor(ReaderUiVisualTokens.webdavInk)
      .width('100%')
      .padding({ left: 12 })
  }
}

@Component
struct SyncAutoBackupRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop last: boolean = false;

  build() {
    Column() {
      Row() {
        Text(this.label)
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.syncRowLabelSize)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.webdavInk)
          .layoutWeight(1)
        Row({ space: 8 }) {
          Text(this.value)
            .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
            .fontSize(ReaderUiVisualTokens.syncRowLabelSize)
            .fontWeight(650)
            .fontColor(ReaderUiVisualTokens.syncValue)
          Text('⌄')
            .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
            .fontSize(16)
            .fontColor(ReaderUiVisualTokens.syncValue)
        }
        .alignItems(VerticalAlign.Center)
      }
      .height(ReaderUiVisualTokens.syncAutoRowHeight)
      .width('100%')
      .padding({ left: 14, right: 14 })
      .alignItems(VerticalAlign.Center)
      if (!this.last) {
        Column()
          .width('100%')
          .height(1)
          .backgroundColor(ReaderUiVisualTokens.syncPanelBorder)
      }
    }
    .width('100%')
  }
}

@Component
struct SyncBackupHistoryCard {
  @Prop entry: CoreStorageBackupHistoryEntry = {
    path: '', fileName: '', source: '', schemaVersion: 0, bytes: 0, checksum: '', exportedAt: 0,
  };
  @StorageProp('reader.coreBackupStatus') status: string = 'idle';

  private pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  private exportedAtLabel(): string {
    const date = new Date(this.entry.exportedAt);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  private sourceLabel(): string {
    return this.entry.source.toLowerCase().indexOf('webdav') >= 0 ? 'WebDAV' : '本地';
  }

  private byteLabel(): string {
    if (this.entry.bytes < 1024 * 1024) return `${Math.max(1, Math.round(this.entry.bytes / 1024))} KB`;
    return `${(this.entry.bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private busy(): boolean {
    return this.status === 'loading' || this.status === 'creating' || this.status === 'restoring';
  }

  build() {
    Column() {
      Row({ space: 14 }) {
        Text(this.sourceLabel())
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.syncHistoryTextSize)
          .fontWeight(800)
          .fontColor(ReaderUiVisualTokens.webdavInk)
          .height(ReaderUiVisualTokens.syncHistoryBadgeHeight)
          .padding({ left: 10, right: 10 })
          .borderRadius(999)
          .backgroundColor(ReaderUiVisualTokens.syncBadgeSurface)
        Text(this.exportedAtLabel())
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.syncHistoryTextSize)
          .fontColor(ReaderUiVisualTokens.syncValue)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
      Row() {
        Text('完整 Core 数据')
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.syncHistoryTextSize)
          .fontColor(ReaderUiVisualTokens.syncValue)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.byteLabel())
          .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
          .fontSize(ReaderUiVisualTokens.syncHistoryTextSize)
          .fontColor(ReaderUiVisualTokens.syncValue)
      }
      .width('100%')
      .margin({ top: 11 })
    }
    .width('100%')
    .height(ReaderUiVisualTokens.syncHistoryRowHeight)
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .borderRadius(ReaderUiVisualTokens.syncAutoPanelRadius)
    .backgroundColor(ReaderUiVisualTokens.syncPanelSurface)
    .border({ width: 1, color: ReaderUiVisualTokens.syncPanelBorder })
    .opacity(this.busy() ? 0.56 : 1)
    .enabled(!this.busy())
    .onClick(() => {
      if (!this.busy()) {
        ReaderUiStore.dispatch({ type: 'core-backup-prepare-local', coreBackupPath: this.entry.path });
      }
    })
  }
}

@Component
export struct SyncBackupPage {
  // `variant` remains only for generated ViewState compatibility.  The page
  // itself is the current Figma composition; every backup row comes from the
  // Core-validated local history projection, never from the design sample.
  @Prop variant: string = 'default';
  @StorageProp('reader.displayedRouteId') routeId: string = 'sync-backup';
  @StorageProp('reader.localCoreBackupHistory') localBackupHistory: CoreStorageBackupHistoryEntry[] = [];
  @State historyExpanded: boolean = false;

  private visibleHistory(): CoreStorageBackupHistoryEntry[] {
    return this.historyExpanded ? this.localBackupHistory : this.localBackupHistory.slice(0, 5);
  }

  build() {
    if (this.routeId === 'webdav-config') {
      WebDavConfigSection()
    } else {
      Column({ space: ReaderUiVisualTokens.syncSectionGap }) {
        Column({ space: 8 }) {
          SyncSectionHeading({ title: 'WebDAV 配置' })
          WebDavConnectionCard()
        }
        .width('100%')

        Column({ space: 8 }) {
          SyncSectionHeading({ title: '自动备份配置' })
          Column() {
            // These values are the admitted Figma static configuration view.
            // There is no Core owner for editing them yet, so rows stay inert
            // instead of claiming native scheduling or scope behavior.
            SyncAutoBackupRow({ label: '保存位置', value: 'WebDAV' })
            SyncAutoBackupRow({ label: '备份频率', value: '12h' })
            SyncAutoBackupRow({ label: '备份范围', value: '2 项已选', last: true })
          }
          .width('100%')
          .borderRadius(ReaderUiVisualTokens.syncAutoPanelRadius)
          .backgroundColor(ReaderUiVisualTokens.syncPanelSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.syncPanelBorder })
        }
        .width('100%')

        Column({ space: ReaderUiVisualTokens.syncHistoryRowGap }) {
          SyncSectionHeading({ title: '历史备份' })
          ForEach(this.visibleHistory(), (entry: CoreStorageBackupHistoryEntry, index: number) => {
            SyncBackupHistoryCard({ entry: entry })
          }, (entry: CoreStorageBackupHistoryEntry, index: number) => `${entry.path}-${entry.exportedAt}-${index}`)
          if (this.localBackupHistory.length > 5) {
            Text(this.historyExpanded ? '收起' : '展开')
              .fontFamily(ReaderUiVisualTokens.webdavControlFontFamily)
              .fontSize(ReaderUiVisualTokens.syncHistoryTextSize)
              .fontWeight(800)
              .fontColor(ReaderUiVisualTokens.syncValue)
              .height(ReaderUiVisualTokens.syncHistoryExpandHeight)
              .width('100%')
              .textAlign(TextAlign.Center)
              .borderRadius(ReaderUiVisualTokens.syncAutoPanelRadius)
              .backgroundColor(ReaderUiVisualTokens.syncPanelSurface)
              .border({ width: 1, color: ReaderUiVisualTokens.syncPanelBorder })
              .onClick(() => this.historyExpanded = !this.historyExpanded)
          }
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct RestoreBackupOverlay {
  @StorageProp('reader.displayedRouteId') @Watch('syncPresentation') routeId: string = 'sync-backup';
  @StorageProp('reader.coreBackupStatus') @Watch('syncPresentation') status: string = 'idle';
  @StorageProp('reader.pendingCoreRestore') pending: CoreStorageBackupInfo | null = null;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(RestoreBackupOverlayMotionCoordinator.K_PHASE) presentationPhase: string = 'idle';

  aboutToAppear(): void {
    this.syncPresentation();
  }

  private isRestoreRoute(): boolean {
    return this.routeId === 'restore-confirm' || this.routeId === 'restore-running' ||
      this.routeId === 'restore-result';
  }

  private isLoading(): boolean {
    return this.routeId === 'restore-running' || this.status === 'restoring' ||
      this.presentationPhase === 'dissolving' || this.presentationPhase === 'loading';
  }

  private isComplete(): boolean {
    return this.routeId === 'restore-result' && this.status === 'success';
  }

  private syncPresentation(): void {
    if (this.routeId === 'restore-confirm' && this.pending !== null && this.status !== 'restoring') {
      RestoreBackupOverlayMotionCoordinator.prepareConfirm();
      return;
    }
    if (this.isComplete()) {
      RestoreBackupOverlayMotionCoordinator.beginComplete((): void => {
        ReaderUiStore.dispatch({ type: 'route-replace', id: 'sync-backup' });
      });
    }
  }

  private cancel(): void {
    RestoreBackupOverlayMotionCoordinator.cancel();
    ReaderUiStore.dispatch({ type: 'core-restore-apply-cancel' });
    ReaderUiStore.dispatch({ type: 'route-replace', id: 'sync-backup' });
  }

  private confirm(): void {
    const sequence = RestoreBackupOverlayMotionCoordinator.beginConfirmToLoading(this.reducedMotion);
    ReaderUiStore.dispatch({ type: 'core-restore-apply-request' });
    if (!this.reducedMotion) {
      setTimeout((): void => RestoreBackupOverlayMotionCoordinator.finishConfirmToLoading(sequence),
        RestoreBackupOverlayMotionCoordinator.CONFIRM_TO_LOADING_DURATION_MS);
    }
  }

  build() {
    if (!this.isRestoreRoute() ||
      (this.routeId === 'restore-confirm' && this.pending === null && !this.isLoading())) {
      Column().width(0).height(0)
    } else {
      Stack({ alignContent: Alignment.Center }) {
        if (this.isComplete()) {
          Row({ space: 8 }) {
            Image($r('app.media.restore_backup_check'))
              .width(16)
              .height(16)
            Text('恢复完成')
              .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
              .fontSize(ReaderUiVisualTokens.restoreToastLabelSize)
              .fontWeight(800)
              .fontColor(ReaderUiVisualTokens.restoreToastText)
          }
          .width(ReaderUiVisualTokens.restoreToastWidth)
          .height(ReaderUiVisualTokens.restoreToastHeight)
          .padding({ left: 14, right: 14 })
          .borderRadius(ReaderUiVisualTokens.restoreToastRadius)
          .backgroundColor(ReaderUiVisualTokens.restoreToastSurface)
          .alignItems(VerticalAlign.Center)
        } else if (this.isLoading()) {
          Column({ space: 9 }) {
            Image($r('app.media.restore_backup_refresh'))
              .width(28)
              .height(28)
            Text('正在恢复')
              .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
              .fontSize(ReaderUiVisualTokens.restoreLoadingTitleSize)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.webdavInk)
            Text('正在从备份恢复数据，请稍候。')
              .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
              .fontSize(ReaderUiVisualTokens.restoreLoadingBodySize)
              .fontColor(ReaderUiVisualTokens.syncValue)
          }
          .width(ReaderUiVisualTokens.restoreLoadingWidth)
          .height(ReaderUiVisualTokens.restoreLoadingHeight)
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .borderRadius(ReaderUiVisualTokens.restoreDialogRadius)
          .backgroundColor(ReaderUiVisualTokens.restoreDialogSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.restoreDialogBorder })
        } else {
          Column() {
            Text('恢复此备份？')
              .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
              .fontSize(ReaderUiVisualTokens.restoreDialogTitleSize)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.webdavInk)
            Text('将使用所选备份恢复数据。确认后开始恢复。')
              .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
              .fontSize(ReaderUiVisualTokens.restoreDialogBodySize)
              .fontColor(ReaderUiVisualTokens.syncValue)
              .lineHeight(20)
              .margin({ top: 12 })
            Row({ space: 10 }) {
              Text('取消')
                .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
                .fontSize(13)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.webdavInk)
                .height(ReaderUiVisualTokens.restoreDialogActionHeight)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .borderRadius(8)
                .backgroundColor(ReaderUiVisualTokens.restoreDialogCancelSurface)
                .onClick(() => this.cancel())
              Text('确认')
                .fontFamily(ReaderUiVisualTokens.restoreFontFamily)
                .fontSize(13)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.webdavActionOnPrimary)
                .height(ReaderUiVisualTokens.restoreDialogActionHeight)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .borderRadius(8)
                .backgroundColor(ReaderUiVisualTokens.restoreDialogPrimary)
                .onClick(() => this.confirm())
            }
            .width('100%')
            .margin({ top: 16 })
          }
          .width(ReaderUiVisualTokens.restoreDialogConfirmWidth)
          .height(ReaderUiVisualTokens.restoreDialogConfirmHeight)
          .padding(18)
          .borderRadius(ReaderUiVisualTokens.restoreDialogRadius)
          .backgroundColor(ReaderUiVisualTokens.restoreDialogSurface)
          .border({ width: 1, color: ReaderUiVisualTokens.restoreDialogBorder })
          .alignItems(HorizontalAlign.Start)
        }
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Block)
    }
  }
}

// Generated compatibility components for withdrawn full-page restore routes.
// The admitted restore flow is rendered only by RestoreBackupOverlay in
// SettingsShell, so these cannot revive generic substitute pages.
@Component
export struct RestoreConfirmPage {
  @Prop variant: string = 'default';
  build() { Column().width(0).height(0) }
}

@Component
export struct RestoreProgressPage {
  @Prop variant: string = 'default';
  build() { Column().width(0).height(0) }
}

@Component
export struct RestoreConflictPage {
  build() { Column().width(0).height(0) }
}

@Component
export struct RestoreResultPage {
  build() { Column().width(0).height(0) }
}

@Component
export struct GlobalSettingsPage {
  @Prop title: string = '设置入口';
  private entries: RowEntry[] = [
    { title: '阅读设置入口', detail: '阅读页内显示、行为与控制设置', chip: '' },
    { title: '书源设置入口', detail: '已持久化书源的导入与管理', chip: '' },
    { title: '同步设置入口', detail: 'Core 快照与恢复操作', chip: '' },
    { title: 'WebDAV 设置入口', detail: '配置并测试 WebDAV 传输', chip: '' },
    { title: '备份恢复入口', detail: '本机或 WebDAV Core 快照', chip: '' },
    { title: '关于与反馈', detail: '仅展示当前已接入的信息', chip: '' },
  ];

  private routeFor(title: string): RouteId {
    switch (title) {
      case '阅读设置入口': return 'reader-full-settings';
      case '书源设置入口': return 'source-management';
      case '同步设置入口': return 'sync-backup';
      case 'WebDAV 设置入口': return 'webdav-config';
      case '备份恢复入口': return 'sync-backup';
      case '关于与反馈': return 'about-feedback';
      default: return 'settings';
    }
  }

  build() {
    Column() {
      SectionTitle({ title: this.title })
        .margin({ bottom: 10 })
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.routeFor(entry.title) }))
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BackupSettingsPage {
  @Prop title: string = '备份';

  build() {
    Column() {
      StatePanel({
        title: `${this.title}策略未接入`,
        message: '当前可用的是同步页中的手动 Core 快照导出、本机恢复与已配置 WebDAV 上传下载。没有后台调度、保留策略或“已开启”的真实状态投影。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncErrorPage {
  @Prop title: string = '同步操作未完成';
  @Prop message: string = '请返回同步页查看 Core 与 Host 返回的具体错误。';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message })
    }
    .width('100%')
  }
}

@Component
export struct SyncProgressPage {
  build() {
    Column() {
      StatePanel({
        title: '同步状态未接入',
        message: '当前没有由 Core 或 Host 返回的书籍级同步进度投影，不能显示固定书籍、百分比或同步成功。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RemoteWebDavBooksPage {
  @Prop title: string = '远端书籍';

  build() {
    Column() {
      StatePanel({
        title: `${this.title}目录未接入`,
        message: '当前 WebDAV 链路传输的是完整 Core 存储快照，不提供按书列举或下载协议，因此不显示伪造的远端书籍。',
      })
    }
    .width('100%')
  }
}

@Component
export struct RssDetailPage {
  @StorageProp(RssSelectionProjection.K_TITLE) selectedTitle: string = '';
  @StorageProp(RssSelectionProjection.K_DESCRIPTION) selectedDescription: string = '';
  @StorageProp(RssSelectionProjection.K_AUTHOR) selectedAuthor: string = '';
  @StorageProp(RssSelectionProjection.K_DATE) selectedDate: string = '';
  @StorageProp(RssSelectionProjection.K_LINK) selectedLink: string = '';
  @StorageProp(RssSelectionProjection.K_SUBSCRIPTION_ID) selectedSubscriptionId: string = '';

  private hasSelection(): boolean {
    return this.selectedTitle.length > 0 || this.selectedDescription.length > 0 || this.selectedLink.length > 0;
  }

  private titleText(): string {
    return this.selectedTitle.length > 0 ? this.selectedTitle : '未命名 RSS 条目';
  }

  private fieldValue(value: string, fallback: string): string {
    return value.length > 0 ? value : fallback;
  }

  build() {
    Column() {
      if (!this.hasSelection()) {
        StructureCard({
          title: '未选择 RSS 条目',
          message: '请从由 Core 返回的 RSS 条目列表选择一项后查看标题、摘要和原文链接。',
        })
      } else {
        Column({ space: 10 }) {
          Text(this.titleText())
            .fontSize(20)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.serifFamily())
            .maxLines(3)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.fieldValue(this.selectedDescription, 'Core 未返回本条目的摘要。'))
            .fontSize(14)
            .lineHeight(22)
            .fontColor(ColorTokens.muted)
          Column({ space: 5 }) {
            Text(`作者：${this.fieldValue(this.selectedAuthor, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
            Text(`日期：${this.fieldValue(this.selectedDate, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
            Text(`订阅：${this.fieldValue(this.selectedSubscriptionId, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
          }
          .width('100%')
          if (this.selectedLink.length > 0) {
            Text('原文链接')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.controlInk)
              .margin({ top: 4 })
            Text(this.selectedLink)
              .fontSize(12)
              .fontColor(ColorTokens.primaryDark)
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (isSafeRssOriginalUrl(this.selectedLink)) {
              Text('在应用内打开原文')
                .fontSize(13)
                .fontWeight(800)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(38)
                .padding({ left: 16, right: 16 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.primary)
                .margin({ top: 10 })
                .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-original' }))
            } else {
              Text('Core 返回的原文链接不是可加载的 http(s) 地址。')
                .fontSize(12)
                .lineHeight(18)
                .fontColor(ColorTokens.statusWarn)
                .margin({ top: 8 })
            }
          } else {
            Text('Core 未提供原文链接。')
              .fontSize(12)
              .fontColor(ColorTokens.muted)
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(14)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.floatingControlBg)
        .border({ width: 1, color: ColorTokens.border })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RssEmptyState {
  @Prop title: string = '暂无订阅';
  @Prop message: string = '添加 RSS 源后会在这里显示最新文章。';
  @Prop action: string = '添加订阅';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssErrorState {
  @Prop title: string = '刷新失败';
  @Prop message: string = '订阅源暂时无法访问。';
  @Prop action: string = '重试';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssSubscriptionManagementPage {
  @Prop title: string = '订阅源';
  @StorageProp('reader.rssSubscriptions') subscriptions: CoreRssSubscription[] = [];
  @State private newTitle: string = '';
  @State private newFeedUrl: string = '';

  build() {
    Column({ space: 10 }) {
      SectionTitle({ title: this.title })
      Text('添加订阅')
        .fontSize(15).fontWeight(800).fontColor(ColorTokens.controlInk)
      TextInput({ text: this.newTitle, placeholder: '名称（可选）' })
        .width('100%').height(42).padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.newTitle = value; })
      TextInput({ text: this.newFeedUrl, placeholder: 'Feed URL' })
        .width('100%').height(42).padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.newFeedUrl = value; })
      Text('添加订阅')
        .fontSize(13).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
        .height(40).width('100%').textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
        .onClick(() => {
          ReaderUiStore.dispatch({ type: 'rss-subscription-add', rssTitle: this.newTitle, rssFeedUrl: this.newFeedUrl });
          this.newTitle = '';
          this.newFeedUrl = '';
        })
      Text('订阅列表')
        .fontSize(15).fontWeight(800).fontColor(ColorTokens.controlInk).margin({ top: 6 })
      if (this.subscriptions.length === 0) {
        Text('暂无订阅，添加 Feed URL 后将在此由 Core 持久化管理。')
          .fontSize(13).fontColor(ColorTokens.muted).width('100%').padding(14)
          .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.subscriptions, (entry: CoreRssSubscription, idx: number) => {
        RssSubscriptionEditorRow({ subscription: entry })
      }, (entry: CoreRssSubscription, idx: number) => `${entry.subscriptionId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct RssSubscriptionEditorRow {
  @Prop subscription: CoreRssSubscription = { subscriptionId: '', feedUrl: '', title: '', enabled: true, unreadCount: 0 };
  @State private titleDraft: string = '';
  @State private feedDraft: string = '';

  aboutToAppear(): void {
    this.titleDraft = this.subscription.title;
    this.feedDraft = this.subscription.feedUrl;
  }

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(this.subscription.subscriptionId).fontSize(10).fontColor(ColorTokens.muted).layoutWeight(1)
        Text(`${this.subscription.unreadCount} 未读`).fontSize(11).fontColor(ColorTokens.primary)
        Toggle({ type: ToggleType.Switch, isOn: this.subscription.enabled })
          .selectedColor(ColorTokens.primary)
          .margin({ left: 8 })
          .onChange((enabled: boolean) => ReaderUiStore.dispatch({
            type: 'rss-subscription-update', rssSubscriptionId: this.subscription.subscriptionId, rssEnabled: enabled,
          }))
      }.width('100%').alignItems(VerticalAlign.Center)
      TextInput({ text: this.titleDraft, placeholder: '订阅名称' })
        .width('100%').height(38).padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(ColorTokens.metaBg)
        .onChange((value: string) => { this.titleDraft = value; })
      TextInput({ text: this.feedDraft, placeholder: 'Feed URL' })
        .width('100%').height(38).padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(ColorTokens.metaBg)
        .onChange((value: string) => { this.feedDraft = value; })
      Row({ space: 10 }) {
        Text('保存')
          .fontSize(12).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
          .height(34).layoutWeight(1).textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
          .onClick(() => ReaderUiStore.dispatch({
            type: 'rss-subscription-update', rssSubscriptionId: this.subscription.subscriptionId,
            rssTitle: this.titleDraft, rssFeedUrl: this.feedDraft,
          }))
        Text('删除')
          .fontSize(12).fontWeight(800).fontColor(ColorTokens.accent)
          .height(34).layoutWeight(1).textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill).border({ width: 1, color: ColorTokens.border })
          .onClick(() => ReaderUiStore.dispatch({
            type: 'rss-subscription-delete-request', rssSubscriptionId: this.subscription.subscriptionId,
          }))
      }.width('100%')
    }
    .width('100%').padding(12).margin({ bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct RssSubscriptionDeleteConfirmPage {
  @StorageProp('reader.rssSubscriptions') subscriptions: CoreRssSubscription[] = [];
  @StorageProp('reader.pendingRssSubscriptionDeleteId') pendingSubscriptionId: string = '';

  private target(): CoreRssSubscription | null {
    for (let i = 0; i < this.subscriptions.length; i++) {
      if (this.subscriptions[i].subscriptionId === this.pendingSubscriptionId) return this.subscriptions[i];
    }
    return null;
  }

  private targetLabel(): string {
    const target = this.target();
    if (target === null) return '';
    const title = target.title.trim();
    return title.length > 0 ? title : target.feedUrl;
  }

  private cancel(): void {
    ReaderUiStore.dispatch({ type: 'rss-subscription-delete-cancel' });
  }

  private confirm(): void {
    const target = this.target();
    if (target === null) return;
    ReaderUiStore.dispatch({
      type: 'rss-subscription-delete-confirm', rssSubscriptionId: target.subscriptionId,
    });
  }

  build() {
    if (this.target() === null) {
      Column({ space: 12 }) {
        StructureCard({
          title: '没有可确认的订阅删除操作',
          message: '该订阅已不在当前 Core 列表中，或没有从订阅管理页明确选择目标；不会执行删除。',
          chip: '已阻止',
        })
        Text('返回订阅管理')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .width('100%')
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .onClick(() => this.cancel())
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    } else {
      Column({ space: 12 }) {
        StructureCard({
          title: `删除“${this.targetLabel()}”？`,
          message: `subscriptionId: ${this.target()!.subscriptionId}。确认后才会调用 Core rss.subscription.delete。`,
          chip: '需要确认',
        })
        Text('Core 当前没有“删除并保留/清除缓存文章和阅读记录”的独立选项；本页不会虚构该语义。')
          .fontSize(13)
          .lineHeight(19)
          .fontColor(ColorTokens.muted)
          .width('100%')
        Row({ space: 10 }) {
          Text('取消')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.primaryDark)
            .height(42)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .onClick(() => this.cancel())
          Text('确认删除')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(42)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.accent)
            .onClick(() => this.confirm())
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct GlobalStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';

  build() {
    Column() {
      StatePanel({ variant: this.variant, title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct OfflineStatePage {
  @Prop title: string = '当前离线';
  @Prop message: string = '可继续阅读已缓存书籍。';

  build() {
    Column() {
      StatePanel({ variant: 'offline', title: this.title, message: this.message })
    }
    .width('100%')
  }
}

@Component
export struct PermissionRequiredPage {
  @Prop title: string = '需要存储权限';
  @Prop message: string = '授予权限后可导入本地书籍。';
  @Prop action: string = '授予权限';

  build() {
    Column() {
      StatePanel({ variant: 'permission', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct AboutVersionPage {
  build() {
    Column() {
      StatePanel({
        title: '版本信息未接入',
        message: '当前页面未接入应用包版本或发布渠道查询，不能显示固定版本号。',
      })
    }
    .width('100%')
  }
}

@Component
export struct AboutFeedbackPage {
  build() {
    Column() {
      StructureCard({
        title: '关于与反馈未接入',
        message: '当前没有由 Host 或 Core 提供的更新检查、反馈提交、源码链接或许可信息契约，因此不显示“已是最新”或可点击的伪链接。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct LocalBookImportPage {
  @Prop title: string = '本地导入';
  @StorageProp('reader.importPreviewFormat') previewFormat: string = '';
  @StorageProp('reader.importPreviewEncoding') previewEncoding: string = '';
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;
  @StorageProp('reader.loading') loading: boolean = false;
  @State selectedFileName: string = '';

  // This is a presentation-only normalization of Core's detected encoding;
  // there is deliberately no UI-selected charset parameter. GBK and GB18030
  // overlap for most Chinese text, so the host must not claim a precision that
  // Core's compatibility detector cannot promise.
  private encodingLabel(detected: string): string {
    const normalized = detected.trim().toLowerCase().replace(/[_\s-]/g, '');
    if (normalized === 'gbk' || normalized === 'gb18030' || normalized === 'gb2312' ||
      normalized === 'windows936' || normalized === 'cp936') {
      return 'GBK/GB18030（自动识别）';
    }
    if (normalized === 'utf8' || normalized === 'utf8bom') {
      return normalized === 'utf8bom' ? 'UTF-8（BOM）' : 'UTF-8';
    }
    if (normalized === 'utf16le') return 'UTF-16LE';
    if (normalized === 'utf16be') return 'UTF-16BE';
    return detected.length > 0 ? detected : 'Core 未返回编码';
  }

  // Section 1: file picker trigger. Opens DocumentViewPicker, reads the
  // selected file via ReaderEffects.runLocalImport (which calls Core
  // local_book.parse). Hardcoded preview text is replaced with real parse
  // results dispatched back to the store.
  private async selectFile(): Promise<void> {
    try {
      const documentPicker = new picker.DocumentViewPicker();
      const options = new picker.DocumentSelectOptions();
      options.maxSelectNumber = 1;
      options.fileSuffixFilters = LocalBookFormatPolicy.supportedSuffixFilters();
      const uris: string[] = await documentPicker.select(options);
      if (uris.length === 0) return;
      const uri = uris[0];
      // Extract file name from URI for display.
      const slashIdx = uri.lastIndexOf('/');
      this.selectedFileName = slashIdx >= 0 ? uri.substring(slashIdx + 1) : uri;
      ReaderEffects.runLocalImport(uri, this.selectedFileName);
    } catch (e) {
      // Picker cancel or permission denied — silent, no state change.
    }
  }

  build() {
    // LibraryShell already owns the route-level Scroll. Keep this page
    // wrap-content so percentage height/layoutWeight cannot create a second
    // viewport and push the first card below the fold.
    Column({ space: 16 }) {
          SectionTitle({ title: this.title })
          // ── Section 1: 导入卡（文件选择触发区） ──
          Column({ space: 10 }) {
            Row({ space: 8 }) {
              Text('📚')
                .fontSize(24)
              Text('选择本地文件')
                .fontSize(18)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)
            }
            .width('100%')

            Text('支持识别 TXT、EPUB、PDF、MOBI、UMD；当前仅 TXT/EPUB 可进入 Core 导入。其余格式会明确说明缺失协议，不会回退为文本。')
              .fontSize(13)
              .fontColor(ColorTokens.muted)
              .lineHeight(18)

            Text(this.selectedFileName.length > 0 ? this.selectedFileName : '未选择文件')
              .fontSize(13)
              .fontColor(this.selectedFileName.length > 0 ? ColorTokens.controlInk : ColorTokens.muted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
              .padding({ top: 8, bottom: 8 })

            Text('选择文件')
              .fontSize(13)
              .fontWeight(700)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(40)
              .padding({ left: 24, right: 24 })
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.primary)
              .textAlign(TextAlign.Center)
              .onClick(() => { this.selectFile(); })
          }
          .width('100%')
          .padding(16)
          .backgroundColor(ColorTokens.surface)
          .borderRadius(12)

          // ── Section 2: 导入设置（格式、编码） ──
          if (this.previewFormat.length > 0) {
            Column({ space: 10 }) {
              Text('导入设置')
                .fontSize(15)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)

              Row({ space: 12 }) {
                Text('格式')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
                  .width(48)
                Text(this.previewFormat.toUpperCase())
                  .fontSize(13)
                  .fontWeight(600)
                  .fontColor(ColorTokens.controlInk)
              }
              .width('100%')

              Row({ space: 12 }) {
                Text('编码')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
                  .width(48)
                Text(this.encodingLabel(this.previewEncoding))
                  .fontSize(13)
                  .fontWeight(600)
                  .fontColor(ColorTokens.controlInk)
              }
              .width('100%')
            }
            .width('100%')
            .padding(16)
            .backgroundColor(ColorTokens.surface)
            .borderRadius(12)
          }

          // ── Section 3: 待导入列表（解析结果预览） ──
          if (this.previewFormat.length > 0) {
            Column({ space: 10 }) {
              Text('解析结果')
                .fontSize(15)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)

              if (this.loading) {
                Text('正在解析…')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
              } else {
                Row({ space: 8 }) {
                  Text('📄')
                    .fontSize(16)
                  Text(`已解析 ${this.previewCount} 章`)
                    .fontSize(13)
                    .fontColor(ColorTokens.controlInk)
                }
                .width('100%')
              }
            }
            .width('100%')
            .padding(16)
            .backgroundColor(ColorTokens.surface)
            .borderRadius(12)
          }
      // ── Section 4: 操作区（由 LibraryShell 一并滚动） ──
      Row({ space: 12 }) {
        Text('取消')
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .height(44)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

        Text('导入')
          .fontSize(14)
          .fontWeight(700)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(44)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(
            this.previewFormat.length > 0 && !this.loading
              ? ColorTokens.primaryDark : ColorTokens.border
          )
          .textAlign(TextAlign.Center)
          .onClick(() => {
            if (this.previewFormat.length > 0 && !this.loading) {
              ReaderUiStore.dispatch({
                type: 'source.import.apply',
                importCount: this.previewCount,
              });
            }
          })
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 12, bottom: 16 })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 16 })
  }
}

@Component
export struct ReadingSettingsEntryPage {
  @Prop title: string = '阅读设置';

  build() {
    Column() {
      StructureCard({ title: this.title, message: '进入阅读页内的显示、行为与控制层设置。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
