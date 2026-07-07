// BookshelfPage — standalone page (kept for direct navigation / tests).
// Production path uses BookshelfViewModel (Rust Core 'bookshelf.list').
// Legacy readerHomeDashboard fixture retained as fallback (S7 removal).
//
// Host capability wiring (Task 3):
//   - file/local_book: "导入本地书" entry → FilePickerAdapter (real @ohos.file.picker)
//     → ImportPipeline.importPicked → TXTParser/EPUBParserAdapter (real parse).
//     Manual path fallback uses FileAccessAdapter (real @ohos.file.fs) for
//     environments where the picker is unavailable.
import { BookshelfViewModel, BookshelfRow } from '../viewmodel/BookshelfViewModel';
import { HomeBookRow, readerHomeDashboard } from '../services/HomeDashboardService';
import { ImportPipeline } from '../services/ImportPipeline';
import { BookshelfService } from '../services/BookshelfService';
import { MockBookshelfRepository } from '../repository/BookshelfRepository';
import { EPUBParserAdapter } from '../adapters/LocalBookPlatformAdapters';
import { FileAccessAdapter, FileAccessResult } from '../adapters/FileAccessAdapter';
import { FilePickerAdapter, PickerResult, PickedFile } from '../platform/FilePickerAdapter';
import { LocalBookImportResult } from '../models/LocalBook';
import { router } from '@kit.ArkUI';

@Entry
@Component
struct BookshelfPage {
  @State books: BookshelfRow[] = [];
  @State loading: boolean = true;
  @State error: string = '';
  @State useRustCore: boolean = true;
  @State showImportPanel: boolean = false;
  @State localBookPath: string = '';
  @State importing: boolean = false;
  @State importMessage: string = '';
  private vm: BookshelfViewModel | null = null;
  private picker: FilePickerAdapter = new FilePickerAdapter();
  private fileAccess: FileAccessAdapter = new FileAccessAdapter();

  aboutToAppear() {
    this.reload();
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.vm = new BookshelfViewModel();
      this.books = await this.vm.loadBooks();
      this.useRustCore = true;
      if (this.books.length === 0) {
        // Strangler fallback: if Rust Core returns empty, surface legacy fixture.
        this.books = this.toRows(readerHomeDashboard.getBookshelfSnapshot().rows);
        this.useRustCore = false;
      }
    } catch (e) {
      this.books = this.toRows(readerHomeDashboard.getBookshelfSnapshot().rows);
      this.useRustCore = false;
      this.error = `Rust Core 异常,回退 fixture: ${e}`;
    }
    this.loading = false;
  }

  private toRows(rows: HomeBookRow[]): BookshelfRow[] {
    const out: BookshelfRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      out.push({
        id: r.id,
        title: r.title,
        author: r.author,
        format: r.format,
        progressText: r.progressText,
        isReading: r.isReading,
        sourceId: ''
      });
    }
    return out;
  }

  // Build a fresh ImportPipeline bound to an in-memory bookshelf. The EPUB
  // parser is the production-shape EPUBParserAdapter (ZipArchiveAdapter backed).
  private buildPipeline(): ImportPipeline {
    const repo = new MockBookshelfRepository(false);
    const bookshelf = new BookshelfService(repo);
    const epubParser = new EPUBParserAdapter();
    return new ImportPipeline(bookshelf, epubParser);
  }

  private extractDisplayName(path: string): string {
    const slash = path.lastIndexOf('/');
    const name = slash >= 0 ? path.substring(slash + 1) : path;
    const q = name.indexOf('?');
    return q >= 0 ? name.substring(0, q) : name;
  }

  // Picker-based import: opens the real @ohos.file.picker DocumentViewPicker,
  // reads the picked file via FileAccessAdapter, and hands the bytes to
  // ImportPipeline.importPicked which infers format from the display name.
  private async pickAndImport(): Promise<void> {
    this.importing = true;
    this.importMessage = '正在选择文件...';
    try {
      const result: PickerResult = await this.picker.pickDocument();
      if (result.denied || !result.picked) {
        this.importMessage = result.errorClass === 'cancelled' ? '已取消选择' : `选择失败: ${result.errorClass}`;
        this.importing = false;
        return;
      }
      const picked: PickedFile = result.picked;
      this.importMessage = `正在导入 ${picked.displayName}...`;
      const pipeline = this.buildPipeline();
      const importResult: LocalBookImportResult = await pipeline.importPicked(
        picked.displayName, picked.data, picked.mimeType
      );
      this.reportImportResult(importResult);
    } catch (e) {
      this.importMessage = `导入异常: ${e}`;
    }
    this.importing = false;
  }

  // Manual path import: reads the file at the given path via FileAccessAdapter
  // (real @ohos.file.fs), then hands the bytes to ImportPipeline.importPicked.
  // Fallback for environments where the picker is unavailable.
  private async importByPath(): Promise<void> {
    const path = this.localBookPath.trim();
    if (path.length === 0) {
      this.importMessage = '请输入文件路径';
      return;
    }
    this.importing = true;
    this.importMessage = `正在读取 ${this.extractDisplayName(path)}...`;
    try {
      const fileResult: FileAccessResult = await this.fileAccess.readFile(path);
      const displayName = this.extractDisplayName(path);
      this.importMessage = `正在导入 ${displayName}...`;
      const pipeline = this.buildPipeline();
      const importResult: LocalBookImportResult = await pipeline.importPicked(
        displayName, fileResult.data, fileResult.mimeType ?? 'application/octet-stream'
      );
      this.reportImportResult(importResult);
    } catch (e) {
      this.importMessage = `导入异常: ${e}`;
    }
    this.importing = false;
  }

  private reportImportResult(importResult: LocalBookImportResult): void {
    const warnings = importResult.warnings;
    if (warnings.length > 0) {
      const codes = warnings.map((w) => w.code).join(', ');
      this.importMessage = `导入完成(有警告): ${importResult.book.title} [${codes}]`;
    } else {
      this.importMessage = `导入成功: ${importResult.book.title} (${importResult.toc.length} 章)`;
    }
  }

  build() {
    Column() {
      Text('书架')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .margin({ top: 16, bottom: 16 })

      Row() {
        Button('搜索')
          .layoutWeight(1)
          .height(40)
          .backgroundColor('#007AFF')
          .fontColor('#FFFFFF')
          .onClick(() => {
            router.pushUrl({ url: 'pages/SearchPage' });
          })
        Blank().width(12)
        Button('设置')
          .layoutWeight(1)
          .height(40)
          .backgroundColor('#6A6F7A')
          .fontColor('#FFFFFF')
          .onClick(() => {
            router.pushUrl({ url: 'pages/SettingsPage' });
          })
      }
      .width('100%')
      .margin({ bottom: 8 })

      Row() {
        Button('导入本地书')
          .layoutWeight(1)
          .height(40)
          .backgroundColor('#2E7D68')
          .fontColor('#FFFFFF')
          .onClick(() => {
            this.showImportPanel = !this.showImportPanel;
            this.importMessage = '';
          })
      }
      .width('100%')
      .margin({ bottom: 8 })

      if (this.showImportPanel) {
        Column() {
          Text('本地书导入 (file/local_book)')
            .fontSize(13)
            .fontColor('#555555')
            .margin({ bottom: 8 })

          Button('选择文件 (TXT/EPUB)')
            .width('100%')
            .height(38)
            .backgroundColor('#FFFFFF')
            .fontColor('#007AFF')
            .border({ width: 1, color: '#007AFF' })
            .borderRadius(8)
            .margin({ bottom: 8 })
            .onClick(() => {
              this.pickAndImport();
            })

          Text('或输入文件路径:')
            .fontSize(12)
            .fontColor('#777777')
            .margin({ bottom: 4 })
          TextInput({ placeholder: '如 /data/storage/.../book.txt', text: this.localBookPath })
            .height(38)
            .backgroundColor('#FFFFFF')
            .borderRadius(8)
            .onChange((value: string) => {
              this.localBookPath = value;
            })
          Button('按路径导入')
            .width('100%')
            .height(38)
            .backgroundColor('#007AFF')
            .fontColor('#FFFFFF')
            .borderRadius(8)
            .margin({ top: 8, bottom: 8 })
            .onClick(() => {
              this.importByPath();
            })

          if (this.importing) {
            Text(this.importMessage)
              .fontSize(13)
              .fontColor('#007AFF')
              .margin({ top: 4 })
          } else if (this.importMessage.length > 0) {
            Text(this.importMessage)
              .fontSize(13)
              .fontColor(this.importMessage.indexOf('成功') >= 0 ? '#1B7F4A' : '#B3261E')
              .margin({ top: 4 })
          }
        }
        .width('100%')
        .padding(12)
        .backgroundColor('#E8F5E9')
        .borderRadius(8)
        .margin({ bottom: 8 })
      }

      Row() {
        Text(this.useRustCore ? 'Rust Core' : 'FIXTURE')
          .fontSize(12)
          .fontColor(this.useRustCore ? '#1B7F4A' : '#999999')
        Blank()
        Text(this.books.length.toString())
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')
      .margin({ bottom: 8 })

      if (this.loading) {
        Text('加载中')
          .fontSize(14)
          .fontColor('#777777')
          .margin({ top: 24 })
      } else if (this.error.length > 0 && this.books.length === 0) {
        Text(this.error)
          .fontSize(14)
          .fontColor('#B3261E')
          .margin({ top: 24 })
      } else {
        List({ space: 8 }) {
          ForEach(this.books, (item: BookshelfRow) => {
            ListItem() {
              Row() {
                Column() {
                  Text(item.format)
                    .fontSize(12)
                    .fontColor('#FFFFFF')
                }
                .width(48)
                .height(56)
                .justifyContent(FlexAlign.Center)
                .alignItems(HorizontalAlign.Center)
                .backgroundColor(item.isReading ? '#2E7D68' : '#6A6F7A')
                .borderRadius(8)
                .margin({ right: 12 })

                Column() {
                  Text(item.title)
                    .fontSize(16)
                    .fontWeight(FontWeight.Medium)
                    .fontColor('#1A1A1A')
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(item.author)
                    .fontSize(13)
                    .fontColor('#666666')
                    .margin({ top: 4 })
                }
                .layoutWeight(1)

                Text(item.progressText)
                  .fontSize(13)
                  .fontColor(item.isReading ? '#007AFF' : '#999999')
              }
              .width('100%')
              .padding(12)
              .backgroundColor('#FFFFFF')
              .borderRadius(8)
            }
          }, (item: BookshelfRow) => item.id)
        }
        .layoutWeight(1)
        .width('100%')
      }
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}
