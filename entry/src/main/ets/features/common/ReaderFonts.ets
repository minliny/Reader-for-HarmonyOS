import { Font } from '@ohos.arkui.UIContext';
import { loadReaderFontChecked, readerFontLoadReady } from '../../app/ReaderFontLoadHost';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  READER_FONT_INTER,
  READER_FONT_HARMONYOS_SANS,
  READER_FONT_LXGW_WENKAI_LITE,
  READER_FONT_LXGW_WENKAI_GB_LITE,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SANS_SC_UI_BOLD,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600,
  READER_FONT_NOTO_SANS_SC_UI_650,
  READER_FONT_NOTO_SANS_SC_UI_900,
  READER_FONT_NOTO_SERIF_SC_BOLD,
  READER_FONT_NOTO_SERIF_SC_REGULAR,
  READER_FONT_SARASA_MONO_SC,
  READER_FONT_ZHUQUE_FANGSONG,
} from './ReaderFontFamilies.ts';

function bundledFontSource(family: string): Resource | undefined {
  if (family === READER_FONT_INTER) return $rawfile('InterVariable.ttf');
  if (family === READER_FONT_NOTO_SERIF_SC_BOLD) return $rawfile('NotoSerifSC-Bold.ttf');
  if (family === READER_FONT_NOTO_SERIF_SC_REGULAR) return $rawfile('NotoSerifSC-Regular.ttf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_REGULAR) return $rawfile('NotoSansSC-UIRegular.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_550) return $rawfile('ReaderMangaSans550.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_600) return $rawfile('ReaderMangaSans600.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_650) return $rawfile('ReaderMangaSans650.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_900) return $rawfile('ReaderMangaSans900.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_MEDIUM) return $rawfile('NotoSansSC-UIMedium.otf');
  if (family === READER_FONT_NOTO_SANS_SC_UI_BOLD) return $rawfile('NotoSansSC-UIBold.otf');
  if (family === READER_FONT_NOTO_SANS_SC) return $rawfile('NotoSansSC-VF.otf');
  if (family === READER_FONT_LXGW_WENKAI_LITE) return $rawfile('LXGWWenKaiLite-Regular.ttf');
  if (family === READER_FONT_LXGW_WENKAI_GB_LITE) return $rawfile('LXGWWenKaiGBLite-Regular.ttf');
  if (family === READER_FONT_ZHUQUE_FANGSONG) return $rawfile('ZhuqueFangsong-Regular.ttf');
  if (family === READER_FONT_SARASA_MONO_SC) return $rawfile('SarasaMonoSC-Regular.ttf');
  return undefined;
}

/** Called by startup/configuration before admitting a new layout. System
 * families need no file load; custom faces are prepared by their file owner. */
export function prepareReaderFontFamily(family: string): Promise<void> {
  const source = bundledFontSource(family);
  return source === undefined ? Promise.resolve() : loadReaderFontChecked(family, source);
}

/** First-build admission must not mistake a submitted/custom font for ready.
 * Only the platform default needs no checked file-load receipt. */
export function readerFontFamilyReady(family: string): boolean {
  return family === READER_FONT_HARMONYOS_SANS || readerFontLoadReady(family);
}

/** Manga panels own these extra faces. No shelf startup load; admission waits
 * for every checked receipt, including dynamic current/group text roles. */
export function prepareMangaSheetFonts(): Promise<boolean> {
  const families: string[] = [READER_FONT_NOTO_SANS_SC_UI_REGULAR,
    READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
    READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600,
    READER_FONT_NOTO_SANS_SC_UI_650,
    READER_FONT_NOTO_SANS_SC_UI_900];
  return Promise.all(families.map((family: string): Promise<void> =>
    prepareReaderFontFamily(family))).then((): boolean =>
    families.every((family: string): boolean => readerFontFamilyReady(family)));
}

/** Only faces used by the initial bookshelf shell need a checked receipt
 * before its first build. Reader body and control faces retain their own
 * on-demand admission after the shelf has been mounted. */
export function prepareReaderShelfFonts(): Promise<void> {
  return Promise.all([READER_FONT_INTER, READER_FONT_NOTO_SERIF_SC_BOLD,
    READER_FONT_NOTO_SANS_SC, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD]
    .map((family: string): Promise<void> => prepareReaderFontFamily(family))).then((): void => {});
}

export function prepareReaderFonts(): Promise<void> {
  return Promise.all([
    prepareReaderShelfFonts(),
    prepareReaderFontFamily(READER_FONT_NOTO_SERIF_SC_REGULAR),
    prepareReaderFontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR),
    prepareReaderFontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM),
    prepareReaderFontFamily('ReaderNotoSansSCUIBold'),
  ]).then((): void => {});
}

function reportFontFailure(error: Error): void {
  hilog.warn(0x5244, 'Reader', 'Font preparation failed: %{private}s', error.message);
}

/** Compatibility entry for presentation-only pages. Startup owns readiness;
 * remounts merely reuse the same completed receipt, never register again. */
export function registerReaderFonts(_font: Font): void {
  void prepareReaderFonts().catch(reportFontFailure);
}

/** Initial shelf components must not start reader-only font loads while ArkUI
 * is building the first shelf frame. */
export function registerReaderShelfFonts(_font: Font): void {
  void prepareReaderShelfFonts().catch(reportFontFailure);
}

export function readerRegisteredFontFamily(_font: Font, family: string): string {
  void prepareReaderFontFamily(family).catch(reportFontFailure);
  return family;
}
