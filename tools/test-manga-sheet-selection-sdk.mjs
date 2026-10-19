import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"direction": {"description": "实际retained direction选择/当前aria与asset", "resources": []}, "settings": {"description": "实际background/brightness legacy值保护与row/native Toggle一次dispatch", "resources": []}, "fit": {"description": "实际fit选择分支/retained observer与captured参数反例", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { mangaSurfaceSdkDependencies } = await import('./lib/manga-surface-sdk-probe.mjs');


const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const colors = ['inkColor', 'mutedColor', 'lineColor', 'softSurfaceColor', 'greenColor', 'accentColor', 'surfaceColor'];
const fields = ['backgroundPreference', 'horizontal', 'fitPreference', 'brightnessPercent', 'showPageNumbers'];
const choices = { vertical: '竖向连续', horizontal: '横向分页', sun: '暖纸', moon: '深墨' };
const fits = [['source', '跟随书源'], ['width', '适合屏幕'], ['contain', '完整图片']];

function mount(text, panel) {
  const properties = createArkUIPropertyRuntimeProbe();
  let observerId = -1;
  const pageUpdates = [];
  const branches = new Map();
  const names = [panel === 'mode' ? 'modePanel' : 'settingsPanel', 'sheetChoice', 'choiceIcon',
    'isSheetChoiceSelected', 'sectionTitle', 'onWindowChromeChanged', ...colors, ...fields];
  if (panel === 'settings') names.push('displayedBrightnessPercent');
  if (panel === 'mode') names.push('fitLine');
  const { owner, output } = createReaderBuilderProbe(text, names, {
    ...properties.sdk, ...mangaSurfaceSdkDependencies,
  }, {
    ...properties.hooks,
    onObserverEnter(owner, id) { observerId = id; properties.hooks.onObserverEnter(owner, id); },
    onObserverExit(owner, id) { properties.hooks.onObserverExit(owner, id); observerId = -1; },
  });
  // Observe the actual SDK-emitted If routing without pretending to remove or
  // re-create native children. The shared probe does not model branch removal.
  owner.ifElseBranchUpdateFunction = branchId => { branches.set(observerId, branchId); };
  Object.assign(owner, {
    setBackground(value) { this.backgroundPreference = value; },
    toggleDirection() { this.horizontal = !this.horizontal; },
    changeFit(value) { this.fitPreference = value; },
    setBrightness(value) { this.brightnessPercent = value; },
    setPageNumbers(value) { pageUpdates.push(value); this.showPageNumbers = value; },
    resetMangaPreferences() { return Promise.resolve(); },
  });
  owner[panel === 'mode' ? 'modePanel' : 'settingsPanel']();
  const mountedObservers = [...owner.observers];
  const mountedIds = [...owner.nodes.keys()];
  const replay = () => {
    properties.flush();
    owner.replay();
    assert.deepEqual(owner.observers, mountedObservers, 'same mounted SDK observers update without remount');
    assert.deepEqual([...owner.nodes.keys()], mountedIds, 'same mounted control actors remain');
  };
  return { owner, output, branches, replay, pageUpdates,
    nodes: type => [...owner.nodes.values()].filter(node => node.type === type) };
}

function verifyChoices(fixture, kinds) {
  const { owner } = fixture;
  const night = owner.backgroundPreference === 'ink';
  kinds.forEach((kind, index) => {
    const selected = kind === 'vertical' ? !owner.horizontal : kind === 'horizontal' ? owner.horizontal :
      kind === 'sun' ? owner.backgroundPreference === 'paper' : night;
    const label = choices[kind];
    const row = fixture.nodes('Row').find(node => node.accessibilityText?.startsWith(`${label}，`));
    const text = fixture.nodes('Text').find(node => node.create === label);
    const image = fixture.nodes('Image')[index];
    assert.ok(row && text && image, `mounted ${label} actors exist`);
    assert.equal(row.accessibilityText, `${label}，${selected ? '已选择' : '未选择'}`, `${label}: live selection semantics`);
    assert.equal(image.create, `app.media.manga_sheet_${kind}${selected ? '_active' : night ? '_theme_night' : ''}`,
      `${label}: live fixed-color icon resource`);
  });
}

function verifyMode(text) {
  const fixture = mount(text, 'mode');
  verifyChoices(fixture, ['vertical', 'horizontal']);
  for (const background of ['paper', 'ink', 'paper']) {
    fixture.owner.backgroundPreference = background;
    for (const horizontal of [true, false, true, false]) {
      fixture.owner.horizontal = horizontal; fixture.replay();
      verifyChoices(fixture, ['vertical', 'horizontal']);
    }
  }
}

function verifySettings(text) {
  const fixture = mount(text, 'settings');
  verifyChoices(fixture, ['sun', 'moon']);
  for (const background of ['ink', 'paper', 'white', 'ink', 'paper']) {
    fixture.owner.backgroundPreference = background; fixture.replay();
    verifyChoices(fixture, ['sun', 'moon']);
    const slider = fixture.nodes('Slider')[0];
    assert.equal(slider.selectedColor,slider.blockColor,'current selected track and thumb share their semantic role');
    assert.ok(Number.isFinite(slider.create.min)&&slider.create.min>=0&&slider.create.max<=100);
    for (const enabled of [false, true, false]) {
      fixture.owner.showPageNumbers = enabled; fixture.replay();
      const toggle = fixture.nodes('Toggle')[0];
      assert.deepEqual(toggle.create, { type: 'switch', isOn: enabled });
      const row=fixture.nodes('Row').find(node=>node.accessibilityText?.startsWith('常驻页码，'));
      assert.ok(row,'the whole setting row is actionable');
      assert.equal(row.hitTestBehavior,'HitTestMode.Block','row owns pointer hits and excludes child Toggle pointer duplication');
      assert.equal(row.accessibilityGroup,true);
      const before=fixture.pageUpdates.length;
      row.onClick();fixture.replay();assert.equal(fixture.owner.showPageNumbers,!enabled);assert.equal(fixture.pageUpdates.length,before+1);
      row.onClick();fixture.replay();assert.equal(fixture.owner.showPageNumbers,enabled);assert.equal(fixture.pageUpdates.length,before+2);
      toggle.onChange(!enabled);fixture.replay();assert.equal(fixture.owner.showPageNumbers,!enabled,'native switch change remains valid for non-pointer activation');
    }
  }
  fixture.owner.brightnessPercent = 8; fixture.replay();
  assert.equal(fixture.nodes('Slider')[0].create.value,fixture.nodes('Slider')[0].create.min,'legacy value below current display floor does not alter persistence');
  assert.ok(fixture.nodes('Text').some(node => node.create === '8%'), 'legacy label shows actual brightness');
  assert.equal(fixture.owner.brightnessPercent, 8, 'displaying the demo minimum does not overwrite a prior brightness preference');
  fixture.nodes('Slider')[0].onChange(37); fixture.replay();
  assert.equal(fixture.owner.brightnessPercent, 37, 'an actual user change owns the new brightness value');
}

function verifyFit(text) {
  const fixture = mount(text, 'mode');
  const ifIds = fixture.nodes('If').map(node => node.id);
  assert.equal(ifIds.length, 3, 'actual SDK emits one check-mark If observer per fit row');
  // The transformed active branch mounts the check resource, while its inactive
  // branch is empty. Branch decisions below are emitted observer results, not
  // fabricated Image node addition/removal.
  assert.match(fixture.output, /ifElseBranchUpdateFunction\(0,[\s\S]*?manga_sheet_check_theme_night/);
  assert.match(fixture.output, /ifElseBranchUpdateFunction\(1,\s*\(\)\s*=>\s*\{\s*\}\)/);
  for (const background of ['paper', 'ink', 'paper']) {
    fixture.owner.backgroundPreference = background;
    for (const fit of ['source', 'width', 'contain', 'width', 'source']) {
      fixture.owner.fitPreference = fit; fixture.replay();
      fits.forEach(([key, label], index) => {
        const row = fixture.nodes('Row').find(node => node.accessibilityText?.startsWith(`${label}，`));
        assert.equal(row.accessibilityText, `${label}，${fit === key ? '已选择' : '未选择'}`, `${label}: live fit semantics`);
        assert.equal(fixture.branches.get(ifIds[index]), fit === key ? 0 : 1, `${label}: live SDK check branch`);
      });
    }
  }
}

if(selectedCase==='direction')verifyMode(source);
if(selectedCase==='settings')verifySettings(source);
if(selectedCase==='fit')verifyFit(source);

// Regression control: change only the generic Builder boundary back to the
// previously shipped computed Resource/selected boolean parameters. No model or
// expected result is changed; the same retained-observer behavior must reject it.
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
function changeMember(text, name, mutate) {
  const tree = ts.createSourceFile(virtualFilePath('MangaSheetRegressionControl.ets'), text, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
  const component = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
  const member = component.members.find(node => node.name?.getText(tree) === name);
  assert.ok(member, `negative control production member ${name}`);
  const before = member.getText(tree), after = mutate(before);
  assert.notEqual(after, before, `negative control narrowly changes ${name}`);
  return text.slice(0, member.getStart(tree)) + after + text.slice(member.end);
}
let captured = changeMember(source, 'sheetChoice', member => member
  .replace('kind: string, label: string, action:', 'icon: Resource, label: string, selected: boolean, action:')
  .replace('Image(this.choiceIcon(kind))', 'Image(icon)')
  .replaceAll('this.isSheetChoiceSelected(kind)', 'selected'));
for (const member of ['modePanel', 'settingsPanel']) captured = changeMember(captured, member, text => text
  .replace(/this\.sheetChoice\('([^']+)', '([^']+)', /g,
    (_match, kind, label) => `this.sheetChoice(this.choiceIcon('${kind}'), '${label}', this.isSheetChoiceSelected('${kind}'), `));
captured = changeMember(captured, 'fitLine', member => member
  .replace('label: string, fit: string, action:', 'label: string, selected: boolean, action:')
  .replaceAll('this.fitPreference === fit', 'selected'));
captured = changeMember(captured, 'modePanel', member => member
  .replace(/this\.fitLine\('([^']+)', '(source|width|contain)', /g,
    (_match, label, fit) => `this.fitLine('${label}', this.fitPreference === '${fit}', `));
if(selectedCase==='direction') assert.throws(() => verifyMode(captured), /live selection semantics/, 'captured direction regression is detected');
if(selectedCase==='settings') assert.throws(() => verifySettings(captured), /live selection semantics/, 'captured theme regression is detected');
if(selectedCase==='fit') assert.throws(() => verifyFit(captured), /live fit semantics/, 'captured fit regression is detected');
const fakeWarm = changeMember(source, 'isSheetChoiceSelected', member => member.replace("this.backgroundPreference === 'paper'", "this.backgroundPreference !== 'ink'"));
if(selectedCase==='settings') assert.throws(() => verifySettings(fakeWarm), /live selection semantics/, 'legacy white cannot pretend to be warm paper');
const fakeBrightness = changeMember(source, 'settingsPanel', member => member.replace('Math.round(this.brightnessPercent)', 'Math.round(this.displayedBrightnessPercent())'));
if(selectedCase==='settings') assert.throws(() => verifySettings(fakeBrightness), /legacy label shows actual brightness/, 'legacy brightness label must report the actual value');
const doublePointer = changeMember(source,'settingsPanel',member=>member.replace('.hitTestBehavior(HitTestMode.Block)', '.hitTestBehavior(HitTestMode.Default)'));
if(selectedCase==='settings') assert.throws(()=>verifySettings(doublePointer),/excludes child Toggle pointer duplication/,'native child and row may not both own the same pointer click');

}
