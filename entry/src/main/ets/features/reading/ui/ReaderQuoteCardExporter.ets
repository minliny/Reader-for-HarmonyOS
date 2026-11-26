import { common } from '@kit.AbilityKit';
import { ComponentContent } from '@kit.ArkUI';
import { fileIo } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { createReaderShareCopy, removeReaderShareCopy, READER_QUOTE_CARD_MAX_BYTES } from '../../../platform/share/ReaderSystemShareHost';
import { prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderQuoteCardCopy } from '../application/ReaderShareActions';
import { readerAppearanceSnapshotFontFamily, readerAppearanceThemeStyle, type ReaderAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';

const CARD_WIDTH_VP = 400;
const CARD_HEIGHT_VP = 620;
const MAX_PIXEL_EDGE = 1440;

function boundedText(text: string, maximum: number): string {
  const slices: string[] = [];
  for (const scalar of text.trim()) {
    if (slices.length === maximum) return `${slices.join('').trimEnd()}…`;
    slices.push(scalar);
  }
  return slices.join('');
}

class ReaderQuoteCardModel {
  text: string;
  title: string;
  author: string;
  style: ReaderAppearanceThemeStyle;
  font: string;

  constructor(text: string, title: string, author: string, appearance: ReaderAppearanceSnapshot) {
    this.text = boundedText(text, 260);
    this.title = boundedText(title, 70) || '未命名书籍';
    this.author = boundedText(author, 40);
    this.style = readerAppearanceThemeStyle(appearance.activeTheme);
    this.font = readerAppearanceSnapshotFontFamily(appearance);
  }
}

@Builder
function readerQuoteCard(model: ReaderQuoteCardModel) {
  Column() {
    Text('“').fontFamily(model.font).fontSize('42vp').lineHeight('44vp').fontColor(model.style.ink);
    Text(model.text)
      .width('100%').fontFamily(model.font).fontSize('18vp').lineHeight('27vp')
      .fontColor(model.style.ink).maxLines(15).textOverflow({ overflow: TextOverflow.Ellipsis });
    Blank().constraintSize({ minHeight: 16 });
    Text(model.title)
      .width('100%').fontFamily(model.font).fontSize('16vp').lineHeight('23vp')
      .fontWeight(FontWeight.Medium).fontColor(model.style.ink)
      .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
    if (model.author.length > 0) {
      Text(model.author)
        .width('100%').fontFamily(model.font).fontSize('14vp').lineHeight('21vp')
        .fontColor(model.style.ink).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    }
  }
  .width(CARD_WIDTH_VP).height(CARD_HEIGHT_VP).padding(32)
  .alignItems(HorizontalAlign.Start)
  .linearGradient({ direction: GradientDirection.Bottom, colors: [[model.style.paperStart, 0], [model.style.paperEnd, 1]] });
}

export async function exportReaderQuoteCard(ui: UIContext, text: string, title: string, author: string,
  appearance: ReaderAppearanceSnapshot, current: () => boolean): Promise<ReaderQuoteCardCopy | undefined> {
  const context = ui.getHostContext() as common.UIAbilityContext | undefined;
  if (context === undefined || !current() || text.trim().length === 0) return undefined;
  const nativeHeight = ui.vp2px(CARD_HEIGHT_VP);
  if (!Number.isFinite(nativeHeight) || nativeHeight <= 0) return undefined;
  const model = new ReaderQuoteCardModel(text, title, author, appearance);
  await prepareReaderFontFamily(model.font);
  if (!current()) return undefined;
  const content = new ComponentContent<ReaderQuoteCardModel>(ui, wrapBuilder(readerQuoteCard), model);
  let pixels: image.PixelMap | undefined;
  let packer: image.ImagePacker | undefined;
  let directory: string | undefined;
  let retained = false;
  try {
    pixels = await ui.getComponentSnapshot().createFromComponent(content, 0, true,
      { scale: Math.min(1, MAX_PIXEL_EDGE / nativeHeight), waitUntilRenderFinished: true });
    if (!current()) return undefined;
    const info = await pixels.getImageInfo();
    if (info.size.width <= 0 || info.size.width > MAX_PIXEL_EDGE ||
      info.size.height <= 0 || info.size.height > MAX_PIXEL_EDGE) return undefined;
    const ownedDirectory = await createReaderShareCopy(context, 'quote', current);
    directory = ownedDirectory;
    if (ownedDirectory === undefined || !current()) return undefined;
    const path = `${ownedDirectory}/quote.png`;
    const file = await fileIo.open(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.NOFOLLOW);
    try {
      packer = image.createImagePacker();
      await packer.packToFile(pixels, file.fd, { format: 'image/png', quality: 100 });
      const stat = await fileIo.stat(file.fd);
      if (stat.size <= 0 || stat.size > READER_QUOTE_CARD_MAX_BYTES || !current()) return undefined;
      await fileIo.fsync(file.fd);
    } finally {
      await fileIo.close(file);
    }
    retained = current();
    return retained ? { path, release: (): Promise<void> => removeReaderShareCopy(ownedDirectory) } : undefined;
  } finally {
    // The share action owns a completed copy. Everything else stays with the exporter.
    if (directory !== undefined && !retained) await removeReaderShareCopy(directory);
    if (packer !== undefined) void packer.release().catch((): void => {});
    if (pixels !== undefined) void pixels.release().catch((): void => {});
    try { content.dispose(); } catch (_) { /* Cleanup does not replace the export result. */ }
  }
}
