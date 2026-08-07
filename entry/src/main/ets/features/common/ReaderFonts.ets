import { Font } from '@ohos.arkui.UIContext';

// 全局字体注册 —— 每个页面组件曾各自在 aboutToAppear 里重复注册同一批字体。
// 组件挂载时调用 `registerReaderFonts(this.getUIContext().getFont())` 即可。
// 注册未使用的字体族无害;统一注册保证任意页面引用任一字族都有字体可用。
export function registerReaderFonts(font: Font): void {
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
}
