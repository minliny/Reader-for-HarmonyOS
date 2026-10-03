import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { auditTypographyConsumers } from './lib/reader-typography-consumer-audit.mjs';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
// This is explicit migration debt, not a permanent rendering exception. Missing
// rows are allowed as concurrent finite-spec migrations remove the old calls;
// a new private argument or duplicate consumer is rejected across all folders.
const debt = new Map();
const allow = (file, method, property, expression, maximum, reason) => debt.set(JSON.stringify([file, method, property, expression]), { maximum, count: 0, reason });
for (const method of ['backBar', 'sourceDocumentAction', 'actionTarget']) {
  for (const [property, expression] of Object.entries({ fontFamily: "'ReaderNotoSansSC'", fontWeight: 'FontWeight.Bold', fontSize: '11' }))
    allow('rss/RssSubscriptionManagementPage.ets', method, property, expression, 1, 'RSS owner operation slice is being integrated before the Typography consumer handoff');
}
for (const [method, tuple] of [
  ['stats', { fontFamily: "'ReaderNotoSansSC'", fontWeight: 'FontWeight.Regular', fontSize: '10', lineHeight: '12.5' }],
  ['subscriptionItem', { fontFamily: "'ReaderNotoSansSC'", fontWeight: 'FontWeight.Bold', fontSize: '13', lineHeight: '15.34' }],
  ['subscriptionItem', { fontFamily: "'ReaderNotoSansSC'", fontWeight: 'FontWeight.Regular', fontSize: '10', lineHeight: '12.5' }],
]) for (const [property, expression] of Object.entries(tuple)) {
  const key = JSON.stringify(['rss/RssSubscriptionManagementPage.ets', method, property, expression]);
  if (debt.has(key)) debt.get(key).maximum++;
  else allow('rss/RssSubscriptionManagementPage.ets', method, property, expression, 1, 'RSS management baseline migration debt');
}
for (const [property, expression] of Object.entries({
  fontFamily: "opt === this.renderedValue() ? 'ReaderNotoSansSCUIBold' : 'ReaderNotoSansSCUIRegular'",
  fontWeight: 'opt === this.renderedValue() ? FontWeight.Bold : FontWeight.Regular', fontSize: '11', lineHeight: '13',
})) allow('common/ReaderSelectPanel.ets', 'appearanceLibraryOption', property, expression, 1, 'integrator owns the concurrent real shared choice-row migration');
allow('common/ReaderDialogSurface.ets', 'header', 'fontWeight', 'FontWeight.Bold', 2, 'public Dialog spec has family/size/line box but still lacks its fontWeight getter');
allow('bookshelf/BookshelfBookActionSheet.ets', 'build', 'fontWeight', 'FontWeight.Bold', 1, 'public Sheet spec needs a title weight getter');
allow('bookshelf/BookshelfBookActionSheet.ets', 'actionSlot', 'fontWeight', 'FontWeight.Bold', 1, 'public Sheet spec needs an action weight getter');
allow('bookshelf/BookshelfMoreMenu.ets', 'action', 'fontWeight', 'FontWeight.Medium', 1, 'integrator owns the shared action-menu/spec migration');
let files = 0, consumers = 0, sharedArguments = 0, privateArguments = 0;
for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith('.ets') && !file.startsWith('reading/'))) {
  files++;
  for (const node of auditTypographyConsumers(readFileSync(new URL(file, root), 'utf8'), file)) {
    consumers++;
    for (const [property, modifier] of Object.entries(node.modifiers)) {
      if (/TYPE_|this\.(?:textStyle|optionTextStyle|surfaceSpec|spec)\(\)/.test(modifier.expression)) { sharedArguments++; continue; }
      const receipt = debt.get(JSON.stringify([file, node.method, property, modifier.expression]));
      assert.ok(receipt, `${file}:${node.line}/${property}: new private style must consume the public role/spec (${modifier.expression})`);
      assert.ok(++receipt.count <= receipt.maximum, `${file}/${node.method}: no duplicated private migration debt`); privateArguments++;
    }
  }
}
console.log(`PASS conventional Typography coverage: ${files} files, ${consumers} real modifier carriers, ${sharedArguments} shared arguments; ${privateArguments} explicitly OPEN migration-debt arguments`);
