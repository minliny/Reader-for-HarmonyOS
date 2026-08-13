import { Font } from '@ohos.arkui.UIContext';

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
    familyName: 'ReaderInter',
    familySrc: $rawfile('InterVariable.ttf'),
  });
  font.registerFont({
    familyName: 'ReaderNotoSerifSCBold',
    familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
  });
  font.registerFont({
    familyName: 'ReaderNotoSerifSCRegular',
    familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
  });
  font.registerFont({
    familyName: 'ReaderNotoSansSC',
    familySrc: $rawfile('NotoSansSC-VF.otf'),
  });
  font.registerFont({
    familyName: 'ReaderLXGWWenKaiLite',
    familySrc: $rawfile('LXGWWenKaiLite-Regular.ttf'),
  });
  readerFontsRegistered = true;
}
