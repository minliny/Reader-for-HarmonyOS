import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "capsule-leading-roles": {
    "description": "Actual SDK leading/countdown consumes real registry roles and relative square/center geometry; exact 16/24 spec not asserted",
    "resources": []
  },
  "search-field-action": {
    "description": "Actual SDK native field/action theme icons and injected current frame bounds",
    "resources": []
  }
};

async function case_capsule_leading_roles() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { readerContentSearchFieldProbe } = await import('./lib/reader-content-search-field-probe.mjs');
const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');
const capsule = read('ReaderSessionCapsule');
for (const type of ['autoPage', 'tts']) {
  const { owner } = createReaderBuilderProbe(capsule, ['build', 'effectiveTextColor', 'effectivePrimaryColor', 'effectiveOnPrimaryColor'], {
    ...readerTypographyRoles, readerSessionCapsuleMinimumWidth: () => 96,
  }, {componentName:'ReaderSessionCapsuleLeading'});
  Object.assign(owner, { type, countdown: 8, capsuleWidth: 96, textColor: '', themeScheme: 'day',
    primaryColor: 'primary', onPrimaryColor: 'onPrimary' });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  const row = nodes.find(n => n.type === 'Row');
  assert.ok(row.height>0,'current leading row has a positive native extent; no historical 24vp design claim');
  assert.equal(row.alignItems, 'VerticalAlign.Center');
  const actor = nodes.find(n => n.type === 'Stack');
  assert.ok(actor.width>0);assert.equal(actor.width,actor.height,'leading actor keeps square bounds');assert.ok(row.height>=actor.height);
  const label = nodes.find(n => n.type === 'Text' && n.create === (type === 'autoPage' ? '自动翻页' : '朗读'));
  assert.equal(label.height, actor.height,'label and leading actor share the centre lane');assert.equal(label.fontFamily,readerTypographyRoles.TYPE_READER_SESSION_LABEL.fontFamily);assert.equal(label.fontSize,readerTypographyRoles.TYPE_READER_SESSION_LABEL.fontSizeFp);
  if (type === 'autoPage') {
    const digit = nodes.find(n => n.type === 'Text' && n.create === '8');
    assert.equal(digit.width,actor.width);assert.equal(digit.height,actor.height);assert.equal(digit.fontFamily,readerTypographyRoles.TYPE_READER_SESSION_COUNTDOWN.fontFamily);assert.equal(digit.fontSize,readerTypographyRoles.TYPE_READER_SESSION_COUNTDOWN.fontSizeFp);
    assert.equal(digit.textAlign, 'TextAlign.Center');
    assert.ok(actor.borderRadius>=actor.width/2,'square countdown actor has circular clipping');
  }
}

}

async function case_search_field_action() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { readerContentSearchFieldProbe } = await import('./lib/reader-content-search-field-probe.mjs');
const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
for (const scheme of ['day', 'night']) for (const size of [24, 32]) {
  const { owner, nodes: nativeNodes } = readerContentSearchFieldProbe();
  Object.assign(owner, { appThemeScheme: scheme, query: '鸣龙', frame: () => ({
    field: { width: 240, height: size, x: 10, y: 9 }, action: { width: size, height: size, x: 260, y: 9 },
  }), presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), canSearch: () => true });
  owner.searchField();
  assert.equal(nativeNodes(owner).filter(n => n.type === 'Image').length, 0, 'input has no redundant search icon');
  assert.equal(nativeNodes(owner).filter(n => n.type === 'TextInput').length, 1);
  owner.searchAction();
  const icons = nativeNodes(owner).filter(n => n.type === 'Image');
  assert.equal(icons.length, 1);
  assert.equal(icons[0].create, `app.media.reader_directory_search${scheme === 'night' ? '_theme_night' : ''}`);
  const action = nativeNodes(owner).find(n => n.accessibilityText === '搜索正文');
  assert.equal(action.width, size); assert.equal(action.height, size);
  assert.equal(action.border.color, readerAppColor('TOK_LINE', scheme));
  assert.equal(action.backgroundColor, readerAppColor('TOK_SURFACE_PANEL_SOFT', scheme));
}

}

const implementations = {'capsule-leading-roles':case_capsule_leading_roles,'search-field-action':case_search_field_action};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
