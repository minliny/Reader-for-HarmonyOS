// OverlayHost — shell slot for generic transient overlays (dropdown / sheet /
// toast / source-switch). Reader overlays are routes now (Batch 1) — they do
// NOT come through here; they render via ViewStateRenderer(stack) as the
// reader route's body. Reads `overlay` from AppStorage. Appear/disappear uses
// the motion-duration overlay token (centralized here, never animateTo in
// pages). Backdrop derived from ColorTokens.ink + opacity (no raw hex).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { MotionDurationTokens } from '../../contract/generated/MotionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

interface BookActionEntry {
  icon: string;
  title: string;
  meta: string;
  route: RouteId;
  danger: boolean;
}

@Component
export struct OverlayHost {
  @StorageProp('reader.overlay') overlayKind: string = '';
  private bookActions: BookActionEntry[] = [
    { icon: 'check', title: '多选', meta: '选择多本书后移动或删除', route: 'book-batch-management', danger: false },
    { icon: 'people', title: '分组管理', meta: '编辑书架分组与归属', route: 'group-management', danger: false },
    { icon: 'info', title: '书籍详情', meta: '查看简介、目录和书源', route: 'book-detail', danger: false },
    { icon: 'trash', title: '删除', meta: '从书架移除当前书籍', route: 'bookshelf', danger: true },
  ];

  build() {
    if (this.overlayKind !== '') {
      Stack() {
        Column()
          .width('100%').height('100%')
          .backgroundColor(ColorTokens.ink)
          .opacity(0.4)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }))

        if (this.overlayKind === 'book-action') {
          this.renderBookActionSheet()
        } else {
          Column() {
            Text(this.overlayLabel())
              .fontSize(ReaderTypography.sectionTitle().fontSize)
              .fontColor(ColorTokens.ink)
              .fontWeight(ReaderTypography.sectionTitle().fontWeight)
            Text('关闭')
              .fontSize(ReaderTypography.bookMeta().fontSize)
              .fontColor(ColorTokens.primary)
              .margin({ top: SpacingTokens.md })
              .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
              .backgroundColor(ColorTokens.metaBg)
              .borderRadius(RadiusTokens.control)
              .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }))
          }
          .padding(SpacingTokens.lg)
          .backgroundColor(ColorTokens.floatingControlBg)
          .borderRadius(RadiusTokens.large)
          .margin({ left: SpacingTokens.lg, right: SpacingTokens.lg })
        }
      }
      .width('100%').height('100%')
      .transition(TransitionEffect.OPACITY.animation({ duration: MotionDurationTokens.overlay, curve: Curve.EaseInOut }))
    }
  }

  @Builder renderBookActionSheet() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Text('书架更多操作')
          .fontSize(18)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
        ForEach(this.bookActions, (entry: BookActionEntry, idx: number) => {
          Row() {
            Image(this.iconFor(entry.icon))
              .width(22)
              .height(22)
            Column() {
              Text(entry.title)
                .fontSize(15)
                .fontWeight(700)
                .fontColor(entry.danger ? ColorTokens.accent : ColorTokens.ink)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(entry.meta)
                .fontSize(12)
                .fontColor(ColorTokens.muted)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .margin({ top: 3 })
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
            .margin({ left: 12 })
          }
          .width('100%')
          .constraintSize({ minHeight: 58 })
          .padding({ left: 12, right: 12, top: 10, bottom: 10 })
          .borderRadius(RadiusTokens.control)
          .backgroundColor(ColorTokens.paper)
          .border({ width: 1, color: ColorTokens.border })
          .margin({ top: idx === 0 ? 12 : 8 })
          .onClick(() => this.openAction(entry))
        }, (entry: BookActionEntry, idx: number) => `${entry.title}-${idx}`)
      }
      .width('100%')
      .padding(SpacingTokens.lg)
      .backgroundColor(ColorTokens.floatingControlBg)
      .borderRadius(RadiusTokens.large)
    }
    .width('100%')
    .height('100%')
    .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, bottom: SpacingTokens.lg })
  }

  private iconFor(icon: string): Resource {
    switch (icon) {
      case 'check':
        return $r('app.media.ui_icon_check_dark');
      case 'people':
        return $r('app.media.bookshelf_icon_people_dark');
      case 'info':
        return $r('app.media.ui_icon_info_dark');
      case 'trash':
        return $r('app.media.ui_icon_trash_dark');
      default:
        return $r('app.media.reader_icon_more_dark');
    }
  }

  private openAction(entry: BookActionEntry): void {
    ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' });
    if (!entry.danger) {
      ReaderUiStore.dispatch({ type: 'route-push', id: entry.route });
    }
  }

  private overlayLabel(): string {
    switch (this.overlayKind) {
      case 'source-switch': return '换源';
      case 'book-action': return '书籍操作';
      case 'sort-filter': return '排序筛选';
      case 'group-management': return '分组管理';
      case 'local-import': return '本地导入';
      default: return '浮层';
    }
  }
}
