import type { UIContext } from '@ohos.arkui.UIContext';
import { readerRegisteredFontFamily } from '../../../ui/foundation/ReaderFonts';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { hasKnownReadingImageGeometry, type ReadingSessionImage } from '../application/ReadingChapterWindow';
import { readerAppearanceLineHeight, readerAppearanceParagraphIndent, readerAppearanceSnapshotFontFamily,
  readerAppearanceThemeStyle, readerAppearanceUsesJustify } from './ReaderAppearanceRenderStyle';
import { readerNativeParagraphKey, type ReaderNativeParagraphRecipe } from './ReaderNativeParagraph';
import { READER_CHAPTER_TITLE_FONT_SIZE_FP } from './ReaderNativeTextMeasurement';
import { ReadingSurfacePageFragment } from './ReadingSurface';

export class ReaderContinuousTextStyleContext {
  readonly measurementWidth: () => number;
  readonly uiContext: () => UIContext;

  constructor(measurementWidth: () => number, uiContext: () => UIContext) {
    this.measurementWidth = measurementWidth;
    this.uiContext = uiContext;
  }
}

export function materializeReaderContinuousText(id: string, text: string, startScalar: number, endScalar: number,
  appearance: ReaderAppearanceSnapshot, context: ReaderContinuousTextStyleContext,
  measured: () => ReaderNativeParagraphRecipe | undefined): ReadingSurfacePageFragment {
  const fragment = new ReadingSurfacePageFragment(id, text, true, startScalar, endScalar);
  // A semantic paragraph remains whole. ArkUI owns wrapping and exact line coordinates.
  fragment.nativeParagraph = { key: measured()?.key ?? readerNativeParagraphKey(), text: fragment.text,
    startScalar: startScalar, firstLine: 0, lastLine: 0, wholeParagraph: true,
    style: { widthVp: context.measurementWidth(),
      fontFamily: readerAppearanceSnapshotFontFamily(appearance),
      fontSize: appearance.fontSize, fontWeight: FontWeight.Regular,
      lineHeight: readerAppearanceLineHeight(appearance), letterSpacing: appearance.letterSpacing,
      color: readerAppearanceThemeStyle(appearance.activeTheme).ink,
      alignment: readerAppearanceUsesJustify(appearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
      breakAll: false, bookBody: true, indentVp: context.uiContext().px2vp(context.uiContext().fp2px(
        readerAppearanceParagraphIndent(appearance.fontSize, appearance.indent))) } };
  fragment.nativeParagraphFirst = true;
  return fragment;
}

export function materializeReaderContinuousTitle(title: string, measured: ReaderNativeParagraphRecipe | undefined,
  appearance: ReaderAppearanceSnapshot, context: ReaderContinuousTextStyleContext,
  titleLineHeight: () => number): ReaderNativeParagraphRecipe {
  return measured?.text === title ? measured : {
    key: readerNativeParagraphKey(), text: title, startScalar: 0,
    firstLine: 0, lastLine: 0, wholeParagraph: true,
    style: { widthVp: context.measurementWidth(), color: readerAppearanceThemeStyle(appearance.activeTheme).ink,
      fontFamily: readerRegisteredFontFamily(context.uiContext().getFont(),
        readerAppearanceSnapshotFontFamily(appearance)), fontWeight: FontWeight.Bold,
      fontSize: READER_CHAPTER_TITLE_FONT_SIZE_FP, lineHeight: titleLineHeight(),
      letterSpacing: 0, alignment: TextAlign.Center, breakAll: true },
  };
}

export function materializeReaderContinuousImage(id: string, image: ReadingSessionImage,
  appearance: ReaderAppearanceSnapshot, bodyHeight: () => number,
  scaledImageHeight: (image: ReadingSessionImage, capacity: number) => number): ReadingSurfacePageFragment {
  const capacity = Math.max(readerAppearanceLineHeight(appearance), bodyHeight());
  const imageHeight = image.state === 'ready' || hasKnownReadingImageGeometry(image) ?
    scaledImageHeight(image, capacity) : readerAppearanceLineHeight(appearance);
  return new ReadingSurfacePageFragment(id, '', true, image.startScalar, image.endScalar,
    image.state === 'ready' ? image.pixelMap : undefined, imageHeight,
    image.state === 'ready' ? image.fileUri : undefined, imageHeight, image.imageWidthBasisPoints);
}
