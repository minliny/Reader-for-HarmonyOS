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
import { CoreBookshelfBook } from '../store/ReaderUiState';

interface BookActionEntry {
  icon: string;
  title: string;
  meta: string;
  route: RouteId;
}

@Component
export struct OverlayHost {
  @StorageProp('reader.overlay') overlayKind: string = '';
  @StorageProp('reader.bookshelfBooks') bookshelfBooks: CoreBookshelfBook[] = [];
  @StorageProp('reader.pendingBookshelfRemovalSourceId') pendingBookshelfRemovalSourceId: string = '';
  @StorageProp('reader.pendingBookshelfRemovalBookId') pendingBookshelfRemovalBookId: string = '';
  private bookActions: BookActionEntry[] = [
    { icon: 'check', title: '多选', meta: '查看 Core 支持范围，不执行伪批量操作', route: 'book-batch-management' },
    { icon: 'people', title: '分组管理', meta: '编辑书架分组与归属', route: 'group-management' },
    { icon: 'info', title: '书籍详情', meta: '查看当前已选择书籍的简介、目录和书源', route: 'book-detail' },
  ];

  build() {
    // sort-filter 由 BookshelfShelfSection 内部渲染筛选浮层（契约 fixture view-state 设计），不在此全局浮层显示
    if (this.overlayKind !== '' && this.overlayKind !== 'sort-filter') {
      Stack() {
        Column()
          .width('100%').height('100%')
          .backgroundColor(ColorTokens.ink)
          .opacity(0.4)
          .onClick(() => this.dismiss())

        if (this.overlayKind === 'book-action') {
          this.renderBookActionSheet()
        } else if (this.overlayKind === 'dialog') {
          this.renderBookshelfRemovalConfirm()
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
              .onClick(() => this.dismiss())
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
                .fontColor(ColorTokens.ink)
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
    ReaderUiStore.dispatch({ type: 'route-push', id: entry.route });
  }

  private pendingBookshelfBook(): CoreBookshelfBook | null {
    const sourceId = this.pendingBookshelfRemovalSourceId;
    const bookId = this.pendingBookshelfRemovalBookId;
    if (sourceId.length === 0 || bookId.length === 0) return null;
    for (let i = 0; i < this.bookshelfBooks.length; i++) {
      const book = this.bookshelfBooks[i];
      if (book.sourceId === sourceId && book.bookId === bookId) return book;
    }
    return null;
  }

  private dismiss(): void {
    if (this.overlayKind === 'dialog') {
      ReaderUiStore.dispatch({ type: 'bookshelf-remove-cancel' });
      return;
    }
    ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' });
  }

  @Builder renderBookshelfRemovalConfirm() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column({ space: 10 }) {
        if (this.pendingBookshelfBook() === null) {
          Text('没有可确认的书架移除操作')
            .fontSize(18)
            .fontWeight(800)
            .fontColor(ColorTokens.ink)
          Text('目标已不在当前 Core 书架列表中；不会执行删除。')
            .fontSize(13)
            .lineHeight(19)
            .fontColor(ColorTokens.muted)
            .width('100%')
          Text('关闭')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.primaryDark)
            .height(40)
            .width('100%')
            .textAlign(TextAlign.Center)
            .borderRadius(RadiusTokens.control)
            .backgroundColor(ColorTokens.metaBg)
            .onClick(() => this.dismiss())
        } else {
          Text(`移出“${this.pendingBookshelfBook()!.title}”？`)
            .fontSize(18)
            .fontWeight(800)
            .fontColor(ColorTokens.ink)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(`书源：${this.pendingBookshelfBook()!.sourceId}。确认后只会调用 Core bookshelf.remove，不会删除正文缓存或书源。`)
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
              .borderRadius(RadiusTokens.control)
              .backgroundColor(ColorTokens.metaBg)
              .onClick(() => this.dismiss())
            Text('确认移出')
              .fontSize(13)
              .fontWeight(800)
              .fontColor(ColorTokens.paper)
              .height(42)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(RadiusTokens.control)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => {
                const target = this.pendingBookshelfBook();
                if (target === null) return;
                ReaderUiStore.dispatch({
                  type: 'bookshelf-remove-confirm', sourceId: target.sourceId, bookId: target.bookId,
                });
              })
          }
          .width('100%')
        }
      }
      .width('100%')
      .padding(SpacingTokens.lg)
      .backgroundColor(ColorTokens.floatingControlBg)
      .borderRadius(RadiusTokens.large)
      .shadow({ radius: 46, color: '#29594632', offsetX: 0, offsetY: 18 })
    }
    .width('100%')
    .height('100%')
    .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, bottom: SpacingTokens.lg })
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
