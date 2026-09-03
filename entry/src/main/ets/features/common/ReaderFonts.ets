import { Font } from '@ohos.arkui.UIContext';
import {
  READER_FONT_INTER,
  READER_FONT_LXGW_WENKAI_LITE,
  READER_FONT_LXGW_WENKAI_GB_LITE,
  READER_FONT_NOTO_SANS_SC,
  READER_FONT_NOTO_SERIF_SC_BOLD,
  READER_FONT_NOTO_SERIF_SC_REGULAR,
  READER_FONT_SARASA_MONO_SC,
  READER_FONT_ZHUQUE_FANGSONG,
} from './ReaderFontFamilies.ts';

// All Reader pages share one main ArkUI context. Page components keep the
// small, local `aboutToAppear` call, while this module-level latch prevents a
// route remount (and the nested reader panels) from reopening and registering
// the same five bundled font files dozens of times in one process.
let readerFontsRegistered: boolean = false;

export function registerReaderFonts(font: Font): void {
  if (readerFontsRegistered) {
    return;
  }
  font.registerFont({
    familyName: READER_FONT_INTER,
    familySrc: $rawfile('InterVariable.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_NOTO_SERIF_SC_BOLD,
    familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_NOTO_SERIF_SC_REGULAR,
    familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_NOTO_SANS_SC,
    familySrc: $rawfile('NotoSansSC-VF.otf'),
  });
  font.registerFont({
    familyName: READER_FONT_LXGW_WENKAI_LITE,
    familySrc: $rawfile('LXGWWenKaiLite-Regular.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_LXGW_WENKAI_GB_LITE,
    familySrc: $rawfile('LXGWWenKaiGBLite-Regular.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_ZHUQUE_FANGSONG,
    familySrc: $rawfile('ZhuqueFangsong-Regular.ttf'),
  });
  font.registerFont({
    familyName: READER_FONT_SARASA_MONO_SC,
    familySrc: $rawfile('SarasaMonoSC-Regular.ttf'),
  });
  readerFontsRegistered = true;
}
