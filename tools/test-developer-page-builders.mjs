import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'mounted-developer-page': {
    description: 'Actual SDK developer header/content/trailing mounts and identity-bound callbacks; old inline header reproduces class-as-function failure',
    resources: [],
  },
};

for (const id of selectContractCases(cases)) {
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const read = name => readFileSync(new URL(`../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
  const source = read('features/settings/SettingsPage.ets');
  const { ts, options } = installedEtsCompiler();
  function headerDefinition(definition) {
    const tree = ts.createSourceFile('SettingsPage.ets', definition, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, 'complete actual settings source parses');
    const page = tree.statements.find(node => node.name?.text === 'SettingsPage'); assert.ok(page);
    const entry = page.members.find(node => node.name?.getText(tree) === 'developerPage'); assert.ok(entry);
    let header;
    const visit = node => { if (node.expression?.getText(tree) === 'ReaderStandardPage' && node.arguments?.length) {
      const property = node.arguments[0].properties.find(value => value.name?.getText(tree) === 'header');
      if (property) { assert.equal(header, undefined); header = property.initializer; }
    } ts.forEachChild(node, visit); };
    visit(entry); assert.ok(header && ts.isArrowFunction(header) && ts.isBlock(header.body));
    const calls = [];
    const findCalls = node => { if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) calls.push(node); ts.forEachChild(node, findCalls); };
    findCalls(header.body); assert.equal(calls.length, 1, 'one actual delegated header Builder');
    const name = calls[0].expression.name.text;
    const method = page.members.find(node => node.name?.getText(tree) === name); assert.ok(method);
    return { tree, name, header, method };
  }
  const currentHeader = headerDefinition(source);
  const childFiles = {
    ReaderStandardPage: 'features/common/ReaderStandardPage.ets',
    PageBackBar: 'features/common/PageBackBar.ets',
    ReaderToggle: 'features/common/ReaderToggle.ets',
    CategorySection: 'features/settings/CategorySection.ets',
    CategoryRow: 'features/settings/CategoryRow.ets',
  };
  const childSources = Object.fromEntries(Object.entries(childFiles).map(([name, file]) => [name, read(file)]));

  // Constructible platform boundaries deliberately remain ES classes. Calling
  // one as an unlowered plain function must reproduce the original exception.
  class Slot {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  class StandardPageSlot extends Slot {}
  class BackBarSlot extends Slot {}
  class SectionSlot extends Slot {}
  class RowSlot extends Slot {}
  class ToggleSlot extends Slot {}
  const platform = { ReaderStandardPage: StandardPageSlot, PageBackBar: BackBarSlot,
    CategorySection: SectionSlot, CategoryRow: RowSlot, ReaderToggle: ToggleSlot };
  const members = ['developerPage', currentHeader.name, 'developerPageContent', 'navRow',
    'settingsNavigationCurrent', 'developerPageCurrent', 'messagePreviewCurrent',
    'openDeveloperPage', 'openMessagePreview', 'closeMessagePreview', 'retireDeveloperPages',
    'toggleDeveloperBoundary'];

  let legacy;
  function fixture(pageSource = source, scheme = 'day') {
    const properties = createArkUIPropertyRuntimeProbe();
    const events = [], runtimeOwner = {};
    let runtimeCurrent = true;
    const selectedMembers = pageSource === legacy ? members : members.map(name => name === currentHeader.name ? headerDefinition(pageSource).name : name);
    const { owner } = createReaderComponentProbe(pageSource, selectedMembers,
      { ...properties.sdk, ...platform, settingsSelectionGeneration: 0,
        ReaderRuntimeOwner: { isCurrent: identity => runtimeCurrent && identity === runtimeOwner } },
      { ...properties.hooks, childSources, mountChildren: true });
    Object.assign(owner, { mounted: true, activeSection: 'general', resetInFlight: false,
      themeOwner: runtimeOwner, appThemeScheme: scheme, developerModeValue: false,
      temporaryBackIdentity: 'settings-back:1', developerPageId: '', messagePreviewId: '',
      retireSelection: () => events.push(['retire-selection']),
      pendingFeedback: () => events.push(['pending-feedback']),
      operationFeedback: () => events.push(['operation-feedback']),
      settingCanToggle: identity => identity === owner.temporaryBackIdentity,
      settingToggleBusy: () => false,
      toggleSetting: (...args) => events.push(['toggle', ...args]) });
    const children = Type => [...owner.children.values()].filter(child => child instanceof Type);
    function mount() {
      owner.openDeveloperPage(owner.temporaryBackIdentity);
      const identity = owner.developerPageId;
      assert.ok(identity.startsWith('developer:'));
      owner.developerPage(identity);
      const page = children(StandardPageSlot).at(-1);
      assert.ok(page);
      assert.equal(page.params.variant, 'settingsGeneral');
      page.params.header.call(page);
      page.params.content.call(page);
      page.params.overlayContent.call(page);
      const back = children(BackBarSlot).at(-1);
      const section = children(SectionSlot).at(-1);
      assert.equal(back.params.title, '开发者模式');
      assert.equal(section.params.title, '开发工具');
      section.params.content.call(section);
      const rows = children(RowSlot).slice(-2);
      const preview = rows.find(row => row.params.label === '消息预览');
      const boundary = rows.find(row => row.params.label === '显示组件边界');
      assert.ok(preview && boundary);
      // Both trailing closures are invoked: the nav chevron and the nested
      // ReaderToggle must be lowered rather than hidden behind uncalled slots.
      preview.params.content.call(preview);
      boundary.params.content.call(boundary);
      const toggle = children(ToggleSlot).at(-1);
      assert.ok(toggle);
      assert.equal(toggle.params.inputIdentity, `${identity}:component-bounds`);
      assert.equal(toggle.params.actionEnabled, true);
      assert.equal(toggle.params.isBusy, false);
      assert.ok([...owner.nodes.values()].some(node => node.type === 'Image' &&
        node.create === `app.media.reader_chevron_right${scheme === 'night' ? '_theme_night' : ''}`));
      return { identity, page, back, section, preview, boundary, toggle };
    }
    return { owner, mount, children, events, retireRuntime: () => { runtimeCurrent = false; } };
  }

  for (const scheme of ['day', 'night']) {
    const f = fixture(source, scheme), mounted = f.mount();
    assert.deepEqual(f.events.slice(0, 3), [['retire-selection'], ['operation-feedback'], ['pending-feedback']]);
    mounted.boundary.params.onRowClick(); mounted.toggle.params.onToggle(true);
    assert.deepEqual(f.events.filter(event => event[0] === 'toggle'),
      [['toggle', 'developerMode', true], ['toggle', 'developerMode', true]]);
    mounted.preview.params.onRowClick();
    const previewId = f.owner.messagePreviewId;
    assert.ok(previewId.startsWith('message-preview:'));
    mounted.preview.params.onRowClick();
    assert.equal(f.owner.messagePreviewId, previewId, 'a mounted preview callback cannot open another preview');
    mounted.boundary.params.onRowClick(); mounted.toggle.params.onToggle(false);
    assert.equal(f.events.filter(event => event[0] === 'toggle').length, 2,
      'obscured developer callbacks cannot toggle behind message preview');
    f.owner.closeMessagePreview(previewId);
    mounted.back.params.onBack();
    assert.equal(f.owner.developerPageId, '', 'actual current header back retires the developer route');
    const next = f.mount();
    assert.notEqual(next.identity, mounted.identity);
    mounted.back.params.onBack(); mounted.preview.params.onRowClick(); mounted.toggle.params.onToggle(false);
    assert.equal(f.owner.developerPageId, next.identity);
    assert.equal(f.owner.messagePreviewId, '');
    assert.equal(f.events.filter(event => event[0] === 'toggle').length, 2,
      'callbacks captured by an older developer page cannot affect its replacement');
    next.preview.params.onRowClick();
    const nextPreview = f.owner.messagePreviewId;
    f.owner.closeMessagePreview(previewId);
    assert.equal(f.owner.messagePreviewId, nextPreview, 'old preview close cannot close a replacement');
  }

  for (const retire of ['unmount', 'section', 'reset', 'runtime']) {
    const f = fixture(), mounted = f.mount();
    if (retire === 'unmount') f.owner.mounted = false;
    if (retire === 'section') f.owner.activeSection = 'theme';
    if (retire === 'reset') f.owner.resetInFlight = true;
    if (retire === 'runtime') f.retireRuntime();
    mounted.preview.params.onRowClick(); mounted.boundary.params.onRowClick();
    mounted.toggle.params.onToggle(true); mounted.back.params.onBack();
    assert.equal(f.owner.messagePreviewId, '', `${retire}: stale preview callback is rejected`);
    assert.equal(f.events.filter(event => event[0] === 'toggle').length, 0);
    assert.equal(f.owner.developerPageId, mounted.identity, `${retire}: stale back cannot mutate retired owner state`);
  }

  // Inline only the actual current delegated header body. The fault keeps
  // the same SDK, class boundary, captured identity and delayed slot call.
  legacy = source.slice(0, currentHeader.header.body.getStart(currentHeader.tree)) +
    currentHeader.method.body.getText(currentHeader.tree) + source.slice(currentHeader.header.body.end);
  const old = fixture(legacy);
  old.owner.openDeveloperPage(old.owner.temporaryBackIdentity);
  old.owner.developerPage(old.owner.developerPageId);
  const oldPage = old.children(StandardPageSlot)[0];
  assert.ok(oldPage, 'legacy outer page is mounted before its delayed header runs');
  assert.throws(() => oldPage.params.header.call(oldPage), error =>
    error instanceof TypeError && /class constructor.*cannot be invoked without ['"]new['"]/i.test(error.message),
  'the old inline header must reproduce the SDK-lowered class-as-function crash');
  assert.equal(old.children(BackBarSlot).length, 0, 'legacy crash happens before back-bar construction');
  const edits = [];
  const rename = node => { if (ts.isIdentifier(node) && node.text === currentHeader.name)
    edits.push({ start: node.getStart(currentHeader.tree), end: node.end }); ts.forEachChild(node, rename); };
  rename(currentHeader.tree); assert.ok(edits.length >= 2);
  let equivalent = source;
  for (const edit of edits.sort((a,b) => b.start-a.start)) equivalent = equivalent.slice(0,edit.start) +
    currentHeader.name + 'Equivalent' + equivalent.slice(edit.end);
  fixture(equivalent).mount();
  console.log('actual SDK developer-page header/content/trailing mounts, callback admission and original inline-header negative control: PASS');
  recordContractCasePass(id);
}
