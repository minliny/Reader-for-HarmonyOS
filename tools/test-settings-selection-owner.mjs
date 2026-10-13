import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { choiceRowProbe } from './lib/reader-choice-row-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerFoundationTokens } from './lib/reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('../entry/src/main/ets/features/settings/SettingsPage.ets', import.meta.url), 'utf8');
const overlaySource = readFileSync(new URL('../entry/src/main/ets/features/settings/SettingsSelectOverlay.ets', import.meta.url), 'utf8');
const overlayMembers = ['isTablet', 'field', 'selectionId', 'value', 'options', 'anchorRight', 'anchorBottom',
  'onSelect', 'onDismiss', 'appThemeScheme', 'mounted', 'closed', 'aboutToAppear', 'aboutToDisappear',
  'onFieldChanged', 'ownsOpening', 'dismiss', 'choose', 'build', 'phoneSheet', 'phoneOption',
  'tabletPanel', 'tabletOption', 'tabletSpec', 'isSelected', 'title'];
const pageMembers = ['nativeAlertOwner', 'onTemporaryBackBridge', 'temporaryBackIdentity', 'themeOwner',
  'mounted', 'resetRevision', 'isTablet', 'openSelect', 'selectionId', 'selectionField', 'selectAnchors',
  'languageValue', 'startupValue', 'animationValue', 'anchorRight', 'anchorBottom', 'originX', 'originY',
  'buildOverlay', 'currentValue', 'selectOptions', 'setSelectValue', 'toggleSelection', 'retireSelection',
  'ownsSelection', 'commitSelection', 'dismissSelection', 'aboutToDisappear'];
function fixture(tablet, overlay = overlaySource) {
  const choice = choiceRowProbe();
  const platform = { ...choice.properties.sdk, ...choice.dependencies,
    registerReaderFonts: () => {}, PHONE_HORIZONTAL_INSET: 14, PHONE_BOTTOM_INSET: 20,
    PHONE_OPTION_HEIGHT: 52, PHONE_CANCEL_GAP: 10, PHONE_RADIUS: 12,
    resolvePopupSpec: () => ({ width: 160, surfaceBackgroundRole: 'surface', surfaceBorderRole: 'border',
      borderWidth: 1, borderRadius: 12, shadowRadius: 30, surfaceShadowRole: 'shadow', shadowOffsetY: 8, anchorOverlap: 6 }) };
  const actualOverlay = createReaderBuilderProbe(overlay, overlayMembers, platform,
    { ...choice.hooks, ...choice.properties.hooks });
  const hooks = { ...choice.hooks, ...choice.properties.hooks,
    childSources: { ...choice.hooks.childSources, SettingsSelectOverlay: overlay } };
  const { owner } = createReaderBuilderProbe(source, pageMembers,
    { ...platform, ReaderNativeAlertOwner, SettingsSelectOverlay: actualOverlay.Component, settingsSelectionGeneration: 0 }, hooks);
  Object.assign(owner, { mounted: true, isTablet: tablet, anchorRight: 200, anchorBottom: 180 });
  owner.toggleSelection('language'); owner.buildOverlay(); choice.properties.flush();
  const child = [...owner.children.values()][0];
  assert.equal(child.constructor, actualOverlay.Component, 'actual Page creates the complete SDK overlay');
  const sync = () => choice.properties.flush();
  const open = field => { owner.toggleSelection(field); sync(); return child.selectionId; };
  const currentBackdrop = () => [...child.nodes.values()].filter(n => n.type === 'Row' && n.width === '100%' && n.height === '100%' && n.onClick).at(-1).onClick;
  const cancel = () => [...child.nodes.values()].filter(n => n.type === 'Stack' && n.height === 52 && n.onClick).at(-1)?.onClick;
  const row = value => [...child.children.values()].filter(c => c.constructor === choice.Component && c.label === value).at(-1);
  const click = value => { const actual = row(value); assert.ok(actual, 'actual shared row: ' + value);
    return [...actual.nodes.values()].find(n => n.onClick).onClick; };
  const projection = () => ({ selectionId: child.selectionId, onSelect: child.onSelect, onDismiss: child.onDismiss });
  return { owner, child, choice, sync, open, currentBackdrop, cancel, click, projection };
}
let cases = 0;
for (const tablet of [false, true]) {
  const f = fixture(tablet), a = f.projection(), oldBackdrop = f.currentBackdrop(), oldCancel = f.cancel(), oldChoice = f.click('English');
  assert.ok(a.selectionId.startsWith('language:'));
  const originalParent = f.owner;
  const bId = f.open('startup'), b = f.projection(); assert.notEqual(a.selectionId, bId);
  a.onSelect('English', a.selectionId); a.onDismiss(a.selectionId);
  oldBackdrop(); oldCancel?.(); oldChoice();
  assert.equal(f.owner.openSelect, 'startup'); assert.equal(f.owner.languageValue, '简体中文');
  assert.equal(f.owner.startupValue, '书架'); assert.equal(f.child.closed, false);
  assert.equal(f.child, [...f.owner.children.values()][0], 'field switch retains the actual overlay');
  assert.equal(f.owner, originalParent, 'SettingsPage is never remounted'); cases++;

  f.click('RSS')(); f.sync(); assert.equal(f.owner.startupValue, 'RSS'); assert.equal(f.owner.openSelect, ''); cases++;
  const cId = f.open('startup'); assert.notEqual(cId, bId); b.onDismiss(b.selectionId);
  assert.equal(f.owner.openSelect, 'startup'); f.child.choose('not an option', cId);
  assert.equal(f.owner.openSelect, 'startup'); assert.equal(f.child.closed, false);
  f.currentBackdrop()(); f.sync(); assert.equal(f.owner.openSelect, ''); cases++;

  const dId = f.open('language'); assert.notEqual(dId, a.selectionId);
  oldBackdrop(); oldCancel?.(); oldChoice(); f.sync();
  assert.equal(f.owner.openSelect, 'language'); assert.equal(f.owner.languageValue, '简体中文'); assert.equal(f.child.closed, false);
  const current = f.click('English'); current(); current(); f.sync();
  assert.equal(f.owner.languageValue, 'English'); assert.equal(f.owner.openSelect, ''); cases++;

  const eId = f.open('language'), e = f.projection(), eBackdrop = f.currentBackdrop(), eCancel = f.cancel(), eChoice = f.click('日本語');
  if (eCancel) { eCancel(); eCancel(); f.sync(); assert.equal(f.owner.openSelect, ''); f.open('language'); }
  f.owner.aboutToDisappear(); e.onSelect('日本語', e.selectionId); e.onDismiss(e.selectionId);
  eBackdrop(); eCancel?.(); eChoice(); f.sync(); assert.equal(f.owner.languageValue, 'English');
  assert.equal(f.owner.selectionId, '');
  f.child.aboutToDisappear(); f.owner.mounted = true; const next = f.open('language'); assert.notEqual(next, eId);
  f.child.aboutToAppear(); eBackdrop(); eCancel?.(); eChoice(); f.sync();
  assert.equal(f.owner.openSelect, 'language'); assert.equal(f.owner.languageValue, 'English'); cases++;
}
// Revive the previous dynamic-ID implementation in the actual production class.
// No fake child/callback algorithm is substituted for the failed journey.
const unguardedDismiss = overlaySource.replace('if (!this.ownsOpening(identity)) return;', 'if (!this.mounted || this.closed) return;')
  .replace('this.onDismiss(identity);', 'this.onDismiss(this.selectionId);');
assert.notEqual(unguardedDismiss, overlaySource);
{ const f = fixture(false, unguardedDismiss), old = f.currentBackdrop(); f.open('startup'); old(); f.sync();
  assert.equal(f.owner.openSelect, '', 'negative control reproduces an old backdrop closing the new field'); cases++; }
const unguardedChoose = overlaySource.replace('if (!this.ownsOpening(identity) || this.options.indexOf(option) < 0) return;',
  'if (!this.mounted || this.closed || this.options.indexOf(option) < 0) return;')
  .replace('this.onSelect(option, identity);', 'this.onSelect(option, this.selectionId);');
assert.notEqual(unguardedChoose, overlaySource);
{ const f = fixture(false, unguardedChoose), old = f.click('English'); f.open('startup'); f.open('language'); old(); f.sync();
  assert.equal(f.owner.languageValue, 'English', 'negative control reproduces an old choice committing to the new opening'); cases++; }

// Replay the real trigger's native Area wrapper, including unit-bearing vp
// coordinates, before passing its anchor to the retained actual overlay.
const selectSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSelect.ets', import.meta.url), 'utf8');
const actualConstants = text => stripTypeScriptTypes(text.slice(0, text.indexOf('@Component')))
  .replace(/^import[\s\S]*?;\s*/gm, '').replace(/^export /gm, '');
const selectConstants = new Function('TOK_SPACE_CONTROL_INLINE', actualConstants(selectSource) +
  ';return {TRIGGER_H,SELECT_PAD,CHEVRON_GAP,CHEVRON_W,CHEVRON_H,SELECT_CHROME};')(readerFoundationTokens.TOK_SPACE_CONTROL_INLINE);
const pageConstants = new Function(actualConstants(source) + ';return {SELECT_ROW_H,SELECT_TRIGGER_H,SELECT_TRIGGER_OFFSET};')();
function triggerAnchor(pageSource = source) {
  const choice = choiceRowProbe(), uiContext = { getFont: () => ({}), px2vp: value => value,
    getMeasureUtils: () => ({ measureText: ({ textContent }) => String(textContent).length * 12 }) };
  const platform = { ...choice.properties.sdk, ...choice.dependencies, ...readerFoundationTokens,
    ...readerTypographyRoles, ...selectConstants, ...pageConstants, Curve:{Linear:'Curve.Linear'}, registerReaderFonts() {}, uiContext };
  const select = createReaderBuilderProbe(selectSource, boundedMembers(selectSource), platform, choice.properties.hooks);
  const hooks = { ...choice.properties.hooks, ...choice.hooks,
    childSources: { ...choice.hooks.childSources, ReaderSelect: selectSource } };
  const page = createReaderBuilderProbe(pageSource, [...pageMembers, 'selectRow', 'labelColumn', 'iconBox'],
    { ...platform, ReaderNativeAlertOwner, ReaderSelect: select.Component, settingsSelectionGeneration: 0 }, hooks).owner;
  Object.assign(page, { mounted:true, isTablet:true, selectAnchors:{}, openSelect:'', languageValue:'简体中文',
    startupValue:'书架', animationValue:'平移', reduceMotionValue:true, appThemeScheme:'day' });
  page.selectRow('语言', () => 'app.media.settings_gen_language', 'language', ['简体中文','English']);
  const trigger = [...page.children.values()].find(child => child instanceof select.Component);
  assert.ok(trigger, 'actual SDK SettingsPage mounts the real ReaderSelect');
  const area = [...page.nodes.values()].find(node => node.type === '__Common__' && node.onAreaChange && page.children.get(node.id + 1) === trigger);
  assert.ok(area, 'native measurement wrapper belongs to the actual trigger');
  return { page, trigger, area, sync: () => choice.properties.flush() };
}
{
  const f = triggerAnchor(), actor = f.trigger;
  for (const area of [
    {width:80,height:34,globalPosition:{x:230,y:170}},
    {width:'80vp',height:'34vp',globalPosition:{x:'230vp',y:'170vp'}},
  ]) {
    f.area.onAreaChange({}, area); assert.deepEqual(f.page.selectAnchors.language, {right:310,bottom:204});
  }
  const button = [...actor.nodes.values()].find(node => node.onClick); assert.ok(button);
  button.onClick(); f.sync(); assert.equal(f.page.openSelect,'language');
  assert.deepEqual([f.page.anchorRight,f.page.anchorBottom],[310,204]);
  assert.equal([...f.page.children.values()].find(child => child instanceof actor.constructor), actor,
    'unit conversion and selection retain the actual trigger actor'); cases++;
}
{
  const broken = source.replaceAll('readerPageAreaLength(newValue.', 'Number(newValue.');
  assert.notEqual(broken,source); const f=triggerAnchor(broken);
  f.area.onAreaChange({}, {width:'80vp',height:'34vp',globalPosition:{x:'230vp',y:'170vp'}});
  assert.ok(Number.isNaN(f.page.selectAnchors.language.right) && Number.isNaN(f.page.selectAnchors.language.bottom),
    'Number mutation reproduces invalid vp anchor in the actual SDK callback'); cases++;
}
{
  const shellSource=readFileSync(new URL('../entry/src/main/ets/features/shell/SettingsShell.ets',import.meta.url),'utf8');
  const shell=createReaderBuilderProbe(shellSource,['reportOverlayOrigin']).owner;
  const points=[]; shell.onOverlayOriginChange=(x,y)=>points.push([x,y]);
  shell.reportOverlayOrigin({globalPosition:{x:10,y:39}});
  shell.reportOverlayOrigin({globalPosition:{x:'10vp',y:'39vp'}});
  assert.deepEqual(points,[[10,39],[10,39]],'actual SettingsShell uses the same local vp origin as trigger anchors'); cases++;
}
console.log(`Settings actual Page→complete SDK Overlay→shared Choice→native physical selection: PASS (${cases} groups; phone/tablet/current/stale backdrop/cancel/commit/field switch/reopen/unmount + two original-policy negatives).`);
