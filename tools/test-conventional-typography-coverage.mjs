import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { auditTypographyConsumers, typographyExpressionContext, isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';
import { registeredProducerTypographySlots } from './lib/architecture-shared-producer-contract.mjs';
import { verifyMangaTypographyContracts } from './lib/manga-typography-contract.mjs';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const producerContract=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url),'utf8'));
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
for (const [method, role] of [['phoneOption', 'TYPE_SETTINGS_SELECT_PHONE_OPTION'], ['tabletOption', 'TYPE_SETTINGS_SELECT_TABLET_OPTION']])
  allow('settings/SettingsSelectOverlay.ets', method, 'fontWeight', `this.isSelected(option) ? FontWeight.Bold : ${role}.fontWeight`, 1, 'integrator owns the shared choice-row selected-weight migration');
allow('common/ReaderActionMenuSurface.ets', 'actionRow', 'fontWeight', 'FontWeight.Medium', 1, 'integrator moved the actual shared action row; weight getter remains pending');
let files = 0, consumers = 0, sharedArguments = 0, sharedProducerArguments = 0, privateArguments = 0;
assert.equal(verifyMangaTypographyContracts(), 71, 'new manga roles retain imported physical tuples');
for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith('.ets') && !file.startsWith('reading/'))) {
  files++;
  const source=readFileSync(new URL(file, root), 'utf8');
  const expressionContext=typographyExpressionContext(source,'entry/src/main/ets/features/'+file);
  const producerSlots=registeredProducerTypographySlots(source,'entry/src/main/ets/features/'+file,producerContract);
  for (const node of auditTypographyConsumers(source, file)) {
    consumers++;
    for (const [property, modifier] of Object.entries(node.modifiers)) {
      if (isSharedTypographyExpression(modifier.expression,expressionContext,node.owner)) { sharedArguments++; continue; }
      if (producerSlots.has(node.method,property,modifier.expression)) { sharedProducerArguments++; continue; }
      const receipt = debt.get(JSON.stringify([file, node.method, property, modifier.expression]));
      assert.ok(receipt, `${file}:${node.line}/${property}: new private style must consume the public role/spec (${modifier.expression})`);
      assert.ok(++receipt.count <= receipt.maximum, `${file}/${node.method}: no duplicated private migration debt`); privateArguments++;
    }
  }
}
console.log(`PASS conventional Typography coverage: ${files} files, ${consumers} real modifier carriers, ${sharedArguments} public role/spec arguments + ${sharedProducerArguments} exact finite producer arguments; ${privateArguments} explicitly OPEN migration-debt arguments`);
