import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"public-role-values": {"description": "当前公共字体role数值准入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');
const { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');

function check(name, role) {
  assert.ok(role, name + ': role exists');
  const inline = role.constructor.name === 'ReaderInlineTextStyle';
  const inherited = role.constructor.name === 'ReaderInheritedTextStyle';
  const explicitFamily = typeof role.fontFamily === 'string' && role.fontFamily.length > 0;
  assert.ok(explicitFamily || ((inline || inherited) && role.fontFamily === undefined), name + ': physical family binding');
  if (!inline) {
    assert.ok(Number.isFinite(role.fontSizeFp) && role.fontSizeFp > 0, name + ': positive finite font size');
    assert.ok(role.lineHeightFp === undefined || (Number.isFinite(role.lineHeightFp) && role.lineHeightFp > 0),
      name + ': optional finite line box');
  }
}

const selected = Object.entries(readerTypographyRoles).filter(([name]) => name.startsWith('TYPE_'));
assert.ok(selected.length > 0);
for (const [name, role] of selected) check(name, role);
assert.throws(() => check('invalid', { fontFamily: 'face', fontSizeFp: NaN }));

const expected = {
  TYPE_PAGE_TITLE: [READER_FONT_NOTO_SANS_SC_UI_BOLD, 700, 17, 24],
  TYPE_SECTION_HEADING: [READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 13, 18],
  TYPE_CARD_SECTION_HEADING: [READER_FONT_NOTO_SANS_SC_UI_BOLD, 700, 14, 20],
  TYPE_APP_ROW_LABEL: [READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 15, 21],
  TYPE_SETTINGS_DANGER_LABEL: [READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 15, 21],
  TYPE_APP_ROW_DETAIL: [READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 12, 18],
  TYPE_APP_SEGMENT_LABEL: [READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 12, 16],
  TYPE_APP_SEGMENT_LABEL_SELECTED: [READER_FONT_NOTO_SANS_SC_UI_BOLD, 700, 12, 16],
  TYPE_SELECT_SOURCE_GROUP_VALUE: [READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 500, 13, 18],
  TYPE_FORM_BODY_INPUT: [READER_FONT_NOTO_SANS_SC_UI_REGULAR, 400, 13, undefined],
};
for (const [name, tuple] of Object.entries(expected)) {
  const { fontFamily, fontWeight, fontSizeFp, lineHeightFp } = readerTypographyRoles[name];
  assert.deepEqual([fontFamily, fontWeight, fontSizeFp, lineHeightFp], tuple, name);
}

}
