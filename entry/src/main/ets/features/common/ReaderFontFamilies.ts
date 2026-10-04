// Pure ArkTS/TS family identifiers. Both .ets presentation files and .ts
// pagination/render helpers may import this module without crossing the
// compiler's forbidden TS -> ETS boundary.
export const READER_FONT_INTER = 'ReaderInter';
export const READER_FONT_NOTO_SERIF_SC_BOLD = 'ReaderNotoSerifSCBold';
export const READER_FONT_NOTO_SERIF_SC_REGULAR = 'ReaderNotoSerifSCRegular';
export const READER_FONT_NOTO_SANS_SC = 'ReaderNotoSansSC';
// Fixed regular UI face used by compact metadata rows. Keep it distinct from
// the variable family so ArkUI does not promote a small label's weight while
// a retained shelf projection is translating or fading.
export const READER_FONT_NOTO_SANS_SC_UI_REGULAR = 'ReaderNotoSansSCUIRegular';
export const READER_FONT_NOTO_SANS_SC_UI_BOLD = 'ReaderNotoSansSCUIBold';
// Checked static faces required by manga panels, loaded only on demand.
export const READER_FONT_NOTO_SANS_SC_UI_550 = 'ReaderMangaSans550';
export const READER_FONT_NOTO_SANS_SC_UI_600 = 'ReaderMangaSans600';
export const READER_FONT_NOTO_SANS_SC_UI_900 = 'ReaderMangaSans900';
export const READER_FONT_LXGW_WENKAI_LITE = 'ReaderLXGWWenKaiLite';
export const READER_FONT_LXGW_WENKAI_GB_LITE = 'ReaderLXGWWenKaiGBLite';
export const READER_FONT_ZHUQUE_FANGSONG = 'ReaderZhuqueFangsong';
export const READER_FONT_SARASA_MONO_SC = 'ReaderSarasaMonoSC';
// Figma renders the Source Han Serif slot with Noto Serif SC. Both projects
// share the same CJK glyph source, so keep one bundled physical font instead
// of adding a second 14 MB copy solely for a different product label.
export const READER_FONT_SOURCE_HAN_SERIF = READER_FONT_NOTO_SERIF_SC_REGULAR;
export const READER_FONT_HARMONYOS_SANS = 'HarmonyOS Sans';
