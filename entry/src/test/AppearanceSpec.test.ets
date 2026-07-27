import { describe, it, expect } from '@ohos/hypium';
import { ReaderAppearanceSpecRegistry } from '../main/ets/contract/reader_ui/Appearance';
import { ReaderThemeResolver } from '../main/ets/ui/tokens/ReaderThemeResolver';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

export default function AppearanceSpecTests(): void {
  describe('AppearanceSpec', () => {
    it('drivesReader2ThemeFontAndControlDefaults', 0, () => {
      expect(ReaderAppearanceSpecRegistry.source.path).assertEqual('Reader 2/Full/AppearanceContent');
      expect(ReaderAppearanceSpecRegistry.themes.length).assertEqual(8);
      expect(ReaderAppearanceSpecRegistry.fonts.length).assertEqual(9);
      expect(ReaderAppearanceSpecRegistry.selects.length).assertEqual(4);
      expect(ReaderAppearanceSpecRegistry.steppers.length).assertEqual(4);
      expect(ReaderThemeResolver.ALL_OPTIONS.map((item) => item.label).join('|'))
        .assertEqual('日间|暖白|夜间|暖夜|纸纹|青叶纹|夜纹|林夜纹');
      expect(ReaderThemeResolver.QUICK_OPTIONS.map((item) => item.value).join('|'))
        .assertEqual('paper|warm|green|blue');
      expect(ReaderThemeResolver.scheme('paper-night', 'light')).assertEqual('night');
      expect(ReaderThemeResolver.scheme('paper', 'dark')).assertEqual('day');
      expect(ReaderThemeResolver.optionFor('paper-night', 'day').value).assertEqual('paper-night');
      expect(ReaderAppearanceSpecRegistry.fonts.map((item) => item.label).join('|'))
        .assertEqual('系统|宋体|黑体|楷体|仿宋|等宽|思源宋体|霞鹜文楷|+ 导入');
      expect(ReaderAppearanceSpecRegistry.stepper('lineHeight')!.defaultValue).assertEqual(1.96);
      expect(ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue).assertEqual('slide');
      expect(ReaderAppearanceSpecRegistry.select('pageAnimation')!.options.map((item) => item.label).join('|'))
        .assertEqual('覆盖|滑动|仿真|滚动|无动画');
      const state = DemoUiState.initial();
      expect(state.fontSize).assertEqual(ReaderAppearanceSpecRegistry.stepper('fontSize')!.defaultValue);
      expect(state.lineHeight).assertEqual(ReaderAppearanceSpecRegistry.stepper('lineHeight')!.defaultValue);
      expect(state.paragraphGap).assertEqual(ReaderAppearanceSpecRegistry.stepper('paragraphGap')!.defaultValue);
      expect(state.letterSpacing).assertEqual(ReaderAppearanceSpecRegistry.stepper('letterSpacing')!.defaultValue);
      expect(state.fontFamily).assertEqual(
        ReaderAppearanceSpecRegistry.font(ReaderAppearanceSpecRegistry.defaults.fontId)!.arktsValue
      );
      expect(state.readerTheme).assertEqual(ReaderAppearanceSpecRegistry.defaults.dayThemeId);
      expect(state.readerSettingOptions.pageAnimation).assertEqual('slide');
      expect(state.readerSettingOptions.paragraphIndentMode).assertEqual('none');
      expect(state.readerSettingOptions.textConversion).assertEqual('simplified');
      expect(state.readerSettingOptions.textAlignment).assertEqual('justify');
    });
  });
}
