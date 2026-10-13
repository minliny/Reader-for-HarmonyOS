import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { auditTypographyConsumers } from './reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';

export const typographyLayoutSuccessorPath = 'tools/fixtures/design/ui-framework-typography-layout-successor-20261014.json';
export const typographyLayoutSuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/ui-framework-typography-layout-successor-20261014.json', import.meta.url), 'utf8'));
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const require = createRequire(import.meta.url), sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(sdk + '/node_modules/typescript'), options = require(sdk + '/lib/ets_checker.js').compilerOptions;
function component(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, [], file + ': layout successor requires actual SDK AST');
  const owner = tree.statements.find(node => node.members?.some(member => member.name?.text === 'build') &&
    node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  assert.ok(owner, file + ': exact exported production typography owner');
  return { tree, owner };
}
function methodOf(source, file, name) {
  const { tree, owner } = component(source, file), method = owner.members.find(member => member.name?.text === name);
  assert.ok(method, file + ': actual layout successor method ' + name);
  return { tree, owner, method };
}
function calls(method, tree, name) {
  const result = [];
  function visit(node) {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression.getText(tree) === name) result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(method); return result;
}
function prop(call, name) { return call.arguments?.[0]?.properties?.find(property => property.name?.text === name)?.initializer; }
export function proveTypographyLayoutBinding(source, file, binding) {
  const { tree, method } = methodOf(source, file, binding.method);
  const actual = calls(method, tree, binding.component).filter(call => {
    const variant = prop(call, 'variant');
    return variant && (ts.isStringLiteral(variant) ? variant.text : variant.getText(tree)) === binding.variant;
  });
  assert.equal(actual.length, 1, file + ': one exact finite public typography host');
  const slot = prop(actual[0], binding.slot);
  assert.ok(slot && ts.isArrowFunction(slot), file + ': actual public typography slot closure');
  assert.equal(calls(slot, tree, 'this.' + binding.builder).length, 1, file + ': actual public slot calls the typography builder');
  for (const [origin, target] of binding.edges) {
    const parent = methodOf(source, file, origin);
    assert.equal(calls(parent.method, parent.tree, 'this.' + target).length, 1, file + ': actual typography builder edge ' + origin + ' -> ' + target);
  }
}
export function validateTypographyLayoutSuccessor(value = typographyLayoutSuccessor, readSource = read) {
  assert.equal(value.schema, 1);
  assert.deepEqual(value.previousFixtures.map(entry => entry.path), [
    'tools/fixtures/design/approved-manga-typography-carriers-20261005.json',
    'tools/fixtures/design/manga-directory-typography-successor-20261006.json',
    'tools/fixtures/design/conventional-typography-baseline.json',
    'tools/fixtures/design/typography-carrier-successors.json',
  ], 'layout successor binds only the exact historical typography witnesses');
  for (const witness of value.previousFixtures) assert.equal(digest(readSource(witness.path)), witness.sha256, 'layout successor keeps historical typography witness byte immutable');
  assert.deepEqual(value.approvedRelocations.map(entry => entry.path), [
    'entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets',
    'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets',
    'entry/src/main/ets/features/search/SearchPage.ets',
  ], 'only the three exact same-file approved layout relocations');
  let styles = 0, native = 0;
  for (const entry of value.approvedRelocations) {
    const previous = JSON.parse(readSource(entry.previousFixture)).files.find(file => file.path === entry.path);
    assert.ok(previous); assert.equal(digest(previous), entry.previousEntrySha256, 'layout successor retains exact previous consumer approval');
    assert.equal(entry.carrierCount, previous.carriers.length); assert.equal(entry.nativeCount, previous.nativeDefaults.length);
    const used = new Set();
    for (const relocation of entry.relocations) {
      assert.ok(['carriers', 'nativeDefaults'].includes(relocation.field));
      const key = relocation.field + ':' + relocation.index;
      assert.ok(!used.has(key), 'one historical typography occurrence has one layout successor'); used.add(key);
      const original = previous[relocation.field][relocation.index];
      assert.ok(original); assert.equal(digest(original), relocation.previousCarrierSha256, 'layout successor cannot rewrite a physical typography occurrence');
      assert.equal(original.method, relocation.previousMethod);
      assert.ok(typeof relocation.currentMethod === 'string' && relocation.currentMethod !== relocation.previousMethod);
      if (relocation.field === 'carriers') styles++; else native++;
    }
  }
  assert.deepEqual([styles, native], [11, 4], 'exact retained same-file style and AUTO occurrence counts');
  assert.deepEqual(value.baselineOwners.map(entry => [entry.path, entry.previousMethod, entry.currentMethod]), [
    ['entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets', 'build', 'pageContent'],
    ['entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets', 'build', 'pageContent'],
  ], 'only the two finite standard-page baseline owners relocate');
  const rail = value.sharedRail;
  assert.equal(rail.path, 'entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
  assert.equal(rail.previousFixture, value.previousFixtures[0].path);
  const previous = JSON.parse(readSource(rail.previousFixture)).files.find(file => file.path === rail.path);
  assert.equal(digest(previous), rail.previousEntrySha256, 'shared rail retains its exact previous consumer approval');
  assert.deepEqual([rail.carrierIndex, rail.carrierCount, rail.nativeCount], [17, 18, 0], 'one exact original bookshelf rail label, no lost logical occurrence');
  assert.equal(digest(previous.carriers[rail.carrierIndex]), rail.previousCarrierSha256, 'shared rail preserves original label witness');
  assert.deepEqual([rail.ownerPath, rail.shellPath, rail.producerPath, rail.producerOwner, rail.producerMethod, rail.producerText, rail.variant], [
    'entry/src/main/ets/features/bookshelf/BookshelfShell.ets', 'entry/src/main/ets/features/shell/MainTabShell.ets',
    'entry/src/main/ets/features/shell/MainTabBar.ets', 'MainTabBar', 'railTabItem', 'tab.label', 'bookshelf',
  ], 'only the exact bookshelf shared rail producer');
  assert.deepEqual(rail.fontTuple, { fontFamily: 'ReaderNotoSansSCUIBold', fontWeight: 700, fontSize: 11, lineHeight: 18 });
  return value;
}
validateTypographyLayoutSuccessor();

export function typographyLayoutMethod(file, name, source) {
  const entry = typographyLayoutSuccessor.baselineOwners.find(value => value.path === file && value.previousMethod === name);
  if (!entry) return name;
  proveTypographyLayoutBinding(source, file, entry.binding); return entry.currentMethod;
}
export function proveBookshelfTypographyRail(pageSource, previous, readSource = read) {
  const rail = typographyLayoutSuccessor.sharedRail;
  assert.equal(previous.path, rail.path);
  assert.doesNotMatch(pageSource, /private\s+tabletNavigationItem\s*\(/, 'shared rail has no private copied label producer');
  const ownerSource = readSource(rail.ownerPath), owner = methodOf(ownerSource, rail.ownerPath, 'build');
  const hosts = calls(owner.method, owner.tree, 'MainTabShell');
  assert.equal(hosts.length, 1, 'one actual bookshelf main shell delegate');
  for (const [key, value] of [['activeTab', "'bookshelf'"], ['showTabletRail', '!this.showBottomNav()'], ['railVariant', "'bookshelf'"]])
    assert.equal(prop(hosts[0], key)?.getText(owner.tree), value, 'exact bookshelf wide rail binding ' + key);
  const shellSource = readSource(rail.shellPath);
  proveTypographyLayoutBinding(shellSource, rail.shellPath, { method: 'build', component: 'ReaderPageScaffold', variant: 'mainTab', slot: 'overlay', builder: 'mainOverlays', edges: [] });
  const shell = methodOf(shellSource, rail.shellPath, 'mainOverlays'), bars = calls(shell.method, shell.tree, 'MainTabBar');
  assert.equal(bars.length, 1, 'one exact shared vertical rail actor');
  assert.equal(prop(bars[0], 'vertical')?.getText(shell.tree), 'true', 'actual bookshelf delegate is vertical');
  assert.equal(prop(bars[0], 'railVariant')?.getText(shell.tree), 'this.railVariant', 'actual shared rail variant is delivered');
  const producerSource = readSource(rail.producerPath), build = methodOf(producerSource, rail.producerPath, 'build');
  assert.equal(calls(build.method, build.tree, 'this.verticalRail').length, 1, 'actual bar builds vertical rail');
  const branch = build.method.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(build.tree) === 'this.vertical');
  assert.ok(branch && calls(branch.thenStatement, build.tree, 'this.verticalRail').length === 1, 'the actual vertical state admits the registered rail builder');
  const producer = methodOf(producerSource, rail.producerPath, 'verticalRail');
  assert.equal(calls(producer.method, producer.tree, 'this.railTabItem').length, 1, 'actual rail mounts its registered typography producer');
  const nodes = auditTypographyConsumers(producerSource, rail.producerPath).filter(node => node.owner === rail.producerOwner && node.method === rail.producerMethod);
  assert.equal(nodes.length, 1, 'shared rail has exactly one native label declaration');
  const node = nodes[0], original = previous.carriers[rail.carrierIndex];
  assert.equal(node.kind, original.kind); assert.equal(node.text, rail.producerText);
  const modifiers = Object.fromEntries(Object.entries(node.modifiers).map(([key, value]) => [key, { expression: value.expression, extra: value.extra }]));
  assert.deepEqual(modifiers, original.modifiers, 'shared rail retains every authored physical role and AUTO omission');
  const role = readerTypographyRoles.TYPE_MAIN_TAB_LABEL;
  assert.deepEqual({ fontFamily: role.fontFamily, fontWeight: role.fontWeight, fontSize: role.fontSizeFp, lineHeight: role.lineHeightFp }, rail.fontTuple, 'shared rail retains original exact physical font tuple');
  return { ...original, modifiers };
}
/** Normalize only proved layout-owner metadata. Every physical tuple, role,
 * native attribute, label and occurrence remains checked against old bytes. */
export function normalizeApprovedTypographyLayout(source, previous, field, actual, readSource = read) {
  const entry = typographyLayoutSuccessor.approvedRelocations.find(value => value.path === previous.path);
  const facts = actual.map(value => structuredClone(value));
  if (entry) {
    assert.equal(facts.length, field === 'carriers' ? entry.carrierCount : entry.nativeCount, 'exact approved typography carrier/tuple changed: layout relocation keeps every historical occurrence');
    for (const relocation of entry.relocations.filter(value => value.field === field)) {
      proveTypographyLayoutBinding(source, entry.path, relocation.binding);
      const node = facts[relocation.index];
      assert.equal(node.method, relocation.currentMethod, 'actual typography remains in its one registered layout owner');
      node.method = relocation.previousMethod;
    }
  }
  if (previous.path === typographyLayoutSuccessor.sharedRail.path && field === 'carriers') {
    assert.equal(facts.length, 17, 'only the original rail label leaves the private bookshelf owner');
    facts.push(proveBookshelfTypographyRail(source, previous, readSource));
  }
  return facts;
}
