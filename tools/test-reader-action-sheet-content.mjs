import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/common/ReaderActionSheetContent.ets');
const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
const actions = [
  new sdk.deps.ReaderActionSheetAction('source', '更换书源', '阅读', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('refresh', '重新打开本话', '阅读'),
  new sdk.deps.ReaderActionSheetAction('detail', '漫画详情', '阅读', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('download', '下载本话', '下载'),
  new sdk.deps.ReaderActionSheetAction('manager', '下载管理', '下载', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('remove', '移出书架', '书架', '退出阅读，前往详情确认', '', true, undefined, 'danger'),
];

for (const variant of ['grouped', 'quick']) {
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const calls = [];
  const owner = sdk.consumer(source, boundedMembers(source), {}, { variant, actions,
    onAction: id => calls.push(id) });
  owner.initialRender();
  const renderer = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderActionMenuSurface);
  assert.ok(renderer, `${variant}: compatibility facade constructs the existing action renderer`);
  const nodes = sdk.walk(owner).flatMap(child => [...child.nodes.values()]);
  const text = nodes.filter(node => node.type === 'Text').map(node => node.create);
  for (const label of ['更换书源', '重新打开本话', '漫画详情', '下载本话', '下载管理', '移出书架']) {
    assert.ok(text.includes(label), `${variant}: renders ${label}`);
  }
  assert.equal(nodes.filter(node => node.onClick).length, actions.length, `${variant}: one touch target per action`);
  assert.ok(nodes.some(node => node.type === 'Text' && node.create === '移出书架' &&
    node.fontColor === sdk.deps.readerAppColor('TOK_DOWNLOAD_DANGER', 'day')), `${variant}: actual danger label uses the theme role`);
  assert.equal(nodes.filter(node => node.type === 'Image' && String(node.create).includes('reader_chevron_right')).length,
    variant === 'quick' ? 1 : 3, `${variant}: navigation arrows appear on list entries`);
  assert.ok(nodes.filter(node => node.type === 'Text').every(node =>
    node.fontFamily === (node.fontWeight === 700 ? 'ReaderNotoSansSCUIBold' : 'ReaderNotoSansSCUIRegular')),
    `${variant}: every actual Text owns the matching static face`);
  const buttons = nodes.filter(node => node.onClick);
  buttons[variant === 'quick' ? buttons.length - 1 : 0].onClick();
  assert.equal(calls.length, 1);
  const oldRefresh = buttons.find(node => node.accessibilityText === '重新打开本话');
  assert.ok(oldRefresh);
  const oldClick = oldRefresh.onClick;
  owner.updateStateVars({ variant, scheme: 'auto', actions: actions.map(item => item.id === 'refresh' ?
    new sdk.deps.ReaderActionSheetAction('refresh', '重新打开本卷', '阅读', '离线时不可用', '', false) : item) });
  sdk.properties.flush();
  assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === '重新打开本卷'),
    `${variant}: retained ID renders the live label`);
  assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === '离线时不可用'),
    `${variant}: a new state explanation renders on a retained ID`);
  assert.equal(oldRefresh.enabled, false, `${variant}: retained touch target consumes live admission`);
  oldClick(); assert.equal(calls.length, 1, `${variant}: old enabled callback cannot bypass current admission`);
  owner.updateStateVars({ variant, scheme: 'auto', actions: actions.filter(item => item.id !== 'refresh') });
  // The SDK closure probe deliberately does not model native subtree removal.
  // Check dispatch against current data without claiming removed-node layout.
  oldClick();
  assert.equal(calls.length, 1, `${variant}: removed action cannot dispatch through its retained callback`);
  renderer.aboutToDisappear(); buttons[0].onClick();
  assert.equal(calls.length, 1, `${variant}: retired component refuses action dispatch`);
}

assert.doesNotMatch(source, /private (row|quickAction|action|commit)\s*\(/, 'facade owns no second renderer or admission implementation');
assert.equal(new sdk.deps.ReaderActionSheetAction('compat', '兼容动作') instanceof sdk.deps.ReaderMenuActionView, true, 'compatibility DTO belongs to the existing action family');

console.log('PASS actual SDK shared action-sheet content: grouped section headings, quick top-row grouping, state detail, chevron slots, danger treatment, and one callback per action');
