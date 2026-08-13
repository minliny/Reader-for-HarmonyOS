import { describe, it, expect } from '@ohos/hypium';
import { LocalBookFormatPolicy } from '../main/ets/host/LocalBookFormatPolicy';

export default function LocalBookFormatPolicyTests(): void {
  describe('LocalBookFormatPolicy', () => {
    it('admits_only_txt_and_epub_to_current_core_import', 0, () => {
      expect(LocalBookFormatPolicy.decide('novel.TXT').admission).assertEqual('core-import');
      expect(LocalBookFormatPolicy.decide('novel.epub3').admission).assertEqual('core-import');
      expect(LocalBookFormatPolicy.decide('novel.pdf').admission).assertEqual('protocol-required');
      expect(LocalBookFormatPolicy.decide('novel.mobi').admission).assertEqual('protocol-required');
      expect(LocalBookFormatPolicy.decide('novel.umd').admission).assertEqual('protocol-required');
    });

    it('never_defaults_unknown_extensions_to_text', 0, () => {
      const unknown = LocalBookFormatPolicy.decide('archive.bin');
      expect(unknown.format).assertEqual('unsupported');
      expect(unknown.admission).assertEqual('unsupported');
      expect(LocalBookFormatPolicy.decide('book.txt?grant=1').format).assertEqual('txt');
    });

    it('keeps_picker_filters_and_mime_detection_on_the_same_five_format_policy', 0, () => {
      const filters = LocalBookFormatPolicy.supportedSuffixFilters();
      expect(filters.indexOf('.txt') >= 0).assertTrue();
      expect(filters.indexOf('.epub') >= 0).assertTrue();
      expect(filters.indexOf('.pdf') >= 0).assertTrue();
      expect(filters.indexOf('.mobi') >= 0).assertTrue();
      expect(filters.indexOf('.umd') >= 0).assertTrue();
      expect(filters.indexOf('.azw') >= 0).assertFalse();
      expect(LocalBookFormatPolicy.suffixFilterForMime('application/x-umd')).assertEqual('.umd');
    });
  });
}
