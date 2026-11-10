import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"manga-action-eligibility": {"description": "实际漫画iconAction到共享按钮name/eligible/retired", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');


const source = readFileSync('entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', 'utf8');
let checks = 0;
for (const scheme of ['day', 'night']) {
  for (const label of ['返回', '更多']) {
    const actual = iconButtonControls(); let taps = 0;
    const owner = actual.consumer(source, ['iconAction']);
    owner.appThemeScheme = scheme; owner.iconAction('manga-icon', label, () => taps++);
    const actor = actual.walk(owner).find(child => child instanceof actual.icon.Component); assert.ok(actor);
    assert.equal(actor.specId, 'manga-reader-action'); assert.equal(actor.accessibilityLabel, label);
    const hit = actual.nodes(actor).find(node => node.onClick), image = actual.nodes(actor).find(node => node.type === 'Image');
    assert.equal(hit.enabled, true); assert.equal(hit.focusable, true); assert.equal(hit.accessibilityText, label);
    assert.equal(hit.accessibilityRole, 'AccessibilityRoleType.BUTTON'); hit.onClick(); assert.equal(taps, 1);
    actor.aboutToDisappear(); hit.onClick(); assert.equal(taps, 1, 'retired physical action cannot invoke the old manga callback');
    checks++;
  }
}
// Reproduce the integration defect by removing the actual semantic Prop.
// An outer native accessibility modifier cannot populate the child's eligibility.
const removed = source.replace("accessibilityLabel: label, onTap: action", 'onTap: action');
assert.notEqual(removed, source);
const negative = iconButtonControls(); let taps = 0;
const owner = negative.consumer(removed, ['iconAction']); owner.iconAction('manga-icon', '返回', () => taps++);
const child = negative.walk(owner).find(actor => actor instanceof negative.icon.Component), hit = negative.nodes(child).find(node => node.onClick);
assert.equal(hit.enabled, false); hit.onClick(); assert.equal(taps, 0, 'missing real accessible-name Prop reproduces disabled manga controls');
const chrome = iconButtonControls();
let switches = 0, current = true;
const toolbar = chrome.consumer(source, ['topControls', 'mangaTopBarBack', 'mangaTopBarActions', 'chromeScheme',
  'readerPanelForeground', 'openSourceSwitch'], {
  ButtonType: { Normal: 'ButtonType.Normal' }, TOK_BORDER_W: 1,
});
Object.assign(toolbar, {
  mounted: true, exiting: false, appForeground: true, windowChromeActive: true, windowChromeOverlayActive: false,
  isReaderIdentityCurrent: () => current, onSwitchSource: () => switches++, iconAction() {},
  performPanelAction: async action => { await action(); return true; },
  inkColor: () => '#111111', mutedColor: () => '#666666', surfaceColor: () => '#F8F4EC', lineColor: () => '#DDD8D0',
  backgroundPreference: 'paper', bookTitle: '漫画', title: '本话', offlineProbeStatus: '',
  recovering: false, loginRequiredForControls: false,
});
toolbar.topControls();
const frame = chrome.nodes(toolbar).find(node => node.type === 'Row' && node.height === 52 && node.clip === true);
assert.deepEqual([frame.width, frame.borderRadius, frame.backgroundColor, frame.border.color],
  ['100%', 18, '#FFFCF8', '#E7E0D5'], 'shared frame paints the original manga toolbar geometry and material');
const sourceSwitch = chrome.nodes(toolbar).find(node => node.type === 'Button' && node.accessibilityText === '换源');
assert.deepEqual([sourceSwitch.width, sourceSwitch.height, sourceSwitch.enabled], [44, 44, true]);
sourceSwitch.onClick();
toolbar.windowChromeOverlayActive = true; sourceSwitch.onClick();
toolbar.windowChromeOverlayActive = false; current = false; sourceSwitch.onClick();
assert.equal(switches, 1, 'covered and retired manga surfaces cannot dispatch the captured switch action');
console.log(`PASS approved manga/floating icon SDK: ${checks} day/night real manga Builder→shared icon actions, finite retained dimensions/radii, names/eligibility, retired callbacks and missing-Prop negative. Native focus/layout/device remain separate.`);

}
