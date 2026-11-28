import util from '@ohos.util';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { TYPE_APP_INHERITED_BODY } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { CategorySection } from './CategorySection';

interface SettingsLicenseDocument {
  label: string;
  path: string;
}

const LICENSES: SettingsLicenseDocument[] = [
  { label: '第三方组件声明', path: 'licenses/oss-reuse-NOTICE.txt' },
  { label: '字体来源', path: 'FONT-SOURCES.txt' },
  { label: 'Inter 字体许可', path: 'Inter-OFL.txt' },
  { label: '霞鹜文楷 GB Lite 字体许可', path: 'LXGWWenKaiGBLite-OFL.txt' },
  { label: '霞鹜文楷 Lite 字体许可', path: 'LXGWWenKaiLite-OFL.txt' },
  { label: 'Noto 字体许可', path: 'Noto-OFL.txt' },
  { label: '更纱黑体字体许可', path: 'SarasaGothic-OFL.txt' },
  { label: '朱雀仿宋字体许可', path: 'ZhuqueFangsong-OFL.txt' },
  { label: 'AOSP 亮度组件许可', path: 'licenses/aosp-brightness/LICENSE.txt' },
  { label: 'AOSP 亮度组件声明', path: 'licenses/aosp-brightness/NOTICE.txt' },
  { label: 'OpenHarmony NetStack 许可', path: 'licenses/openharmony-netstack/LICENSE.txt' },
  { label: 'OpenHarmony NetStack 声明', path: 'licenses/openharmony-netstack/NOTICE.txt' },
  { label: 'libmobi 声明', path: 'licenses/libmobi-NOTICE.txt' },
  { label: 'libmobi LGPL 3.0', path: 'licenses/libmobi-LGPL-3.0.txt' },
  { label: 'libmobi GPL 3.0', path: 'licenses/libmobi-GPL-3.0.txt' },
  { label: '漫画编解码组件声明', path: 'licenses/manga-codec-headers-NOTICE.txt' },
  { label: '漫画 EXIF 组件声明', path: 'licenses/manga-exif-NOTICE.txt' },
  { label: 'Foliate 许可', path: 'reader-oss-pilot/foliate-LICENSE' },
];

@Component
export struct SettingsLicensesPage {
  @StorageProp('readerAppScheme') private scheme: string = 'day';
  @Prop current: boolean = false;
  @Prop embeddedWide: boolean = false;
  @State private selected: SettingsLicenseDocument | undefined = undefined;
  @State private content: string = '';
  @State private loading: boolean = false;
  @State private failed: boolean = false;
  private requestId: number = 0;
  private readonly scroller: Scroller = new Scroller();
  onBack: () => void = (): void => {};
  onBackHandlerChange: (handler: (() => boolean) | undefined) => void = (_handler: (() => boolean) | undefined): void => {};

  aboutToAppear(): void { this.onBackHandlerChange((): boolean => this.closeDocument()); }

  aboutToDisappear(): void {
    this.requestId++;
    this.onBackHandlerChange(undefined);
  }

  build() {
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, variant: 'settingsGeneral',
      scroller: this.scroller,
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ floating: true, centered: true, elevation: 'floating',
      title: this.selected?.label ?? '开源许可与声明', onBack: (): void => {
        if (this.current && !this.closeDocument()) this.onBack();
      } });
  }

  @Builder
  private pageContent() {
    if (this.selected === undefined) {
      CategorySection({ title: '许可文件' }) {
        ForEach(LICENSES, (entry: SettingsLicenseDocument): void => {
          ReaderFormRow({ label: entry.label, disclosure: true, actionEnabled: this.current,
            onAction: (): void => { void this.openDocument(entry); } });
        }, (entry: SettingsLicenseDocument): string => entry.path);
      }
    } else if (this.loading) {
      ReaderPageState({ loading: true, message: '正在读取许可文件' });
    } else if (this.failed) {
      ReaderPageState({ message: '许可文件暂时无法读取', actionLabel: '重试', actionEnabled: this.current,
        onAction: (): void => { if (this.selected !== undefined) void this.openDocument(this.selected); } });
    } else {
      Text(this.content).width('100%').padding(12).wordBreak(WordBreak.BREAK_WORD)
        .fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
        .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.scheme));
    }
  }

  private closeDocument(): boolean {
    if (!this.current || this.selected === undefined) return false;
    this.requestId++;
    this.selected = undefined;
    this.content = '';
    this.loading = false;
    this.failed = false;
    this.scroller.scrollEdge(Edge.Top);
    return true;
  }

  private async openDocument(entry: SettingsLicenseDocument): Promise<void> {
    if (!this.current) return;
    const requestId = ++this.requestId;
    this.selected = entry;
    this.content = '';
    this.failed = false;
    this.loading = true;
    try {
      this.scroller.scrollEdge(Edge.Top);
      const manager = this.getUIContext().getHostContext()?.resourceManager;
      if (manager === undefined) throw new Error('LICENSE_RESOURCE_UNAVAILABLE');
      const bytes = await manager.getRawFileContent(entry.path);
      if (requestId !== this.requestId) return;
      this.content = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
    } catch (_) {
      if (requestId === this.requestId) this.failed = true;
    } finally {
      if (requestId === this.requestId) this.loading = false;
    }
  }
}
