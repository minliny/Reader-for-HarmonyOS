import { approvedTypographyContract, approvedTypographyFile } from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { auditTypographyConsumers, typographyExpressionContext, isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';
import { registeredProducerTypographySlots } from './lib/architecture-shared-producer-contract.mjs';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const producerContract = JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json', import.meta.url), 'utf8'));

// Migration is complete: a private parameter cannot regain admission through
// an obsolete debt entry. Retain only actual public roles/specs and the exact
// finite producer slots already verified by the shared contract.
function verifySource(source, file) {
  const expressionContext = typographyExpressionContext(source, 'entry/src/main/ets/features/' + file);
  const producerSlots = registeredProducerTypographySlots(source, 'entry/src/main/ets/features/' + file, producerContract);
  const approved = approvedTypographyContract(source, file);
  let consumers = 0, sharedArguments = 0, sharedProducerArguments = 0, approvedArguments = 0;
  for (const node of auditTypographyConsumers(source, file)) {
    consumers++;
    for (const [property, modifier] of Object.entries(node.modifiers)) {
      if (isSharedTypographyExpression(modifier.expression, expressionContext, node.owner)) { sharedArguments++; continue; }
      if (producerSlots.has(node.method, property, modifier.expression)) { sharedProducerArguments++; continue; }
      if (approved.has(node)) { approvedArguments++; continue; }
      assert.fail(`${file}:${node.line}/${property}: private style must consume the public role/spec or exact finite producer (${modifier.expression})`);
    }
  }
  return { consumers, sharedArguments, sharedProducerArguments, approvedArguments };
}

let files = 0, consumers = 0, sharedArguments = 0, sharedProducerArguments = 0, approvedArguments = 0;
for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith('.ets') && !file.startsWith('reading/'))) {
  files++;
  const result = verifySource(readFileSync(new URL(file, root), 'utf8'), file);
  consumers += result.consumers;
  sharedArguments += result.sharedArguments;
  sharedProducerArguments += result.sharedProducerArguments;
  approvedArguments += result.approvedArguments;
}

// Exercise actual current consumers in memory. Neither negative control edits
// production files or creates a second rendering implementation.
const menuFile = 'common/ReaderActionMenuSurface.ets';
const menu = readFileSync(new URL(menuFile, root), 'utf8');
const action = auditTypographyConsumers(menu, menuFile).find(node => node.method === 'actionRow' && node.modifiers.fontWeight);
assert.ok(action, 'actual shared menu action-row typography carrier');
assert.equal(action.modifiers.fontWeight.expression, 'this.spec().actionFontWeight');
const weight = action.modifiers.fontWeight;
assert.throws(() => verifySource(menu.slice(0, weight.start) + 'FontWeight.Medium' + menu.slice(weight.end), menuFile),
  /private style.*FontWeight\.Medium/, 'retired menu weight must not regain admission');

const selectFile = 'settings/SettingsSelectOverlay.ets';
const select = readFileSync(new URL(selectFile, root), 'utf8');
const phoneMethod = 'private phoneOption(option: string, index: number) {';
assert.equal(select.split(phoneMethod).length, 2, 'actual phone selection consumer method');
const selectedWeight = 'this.isSelected(option) ? FontWeight.Bold : TYPE_SETTINGS_SELECT_PHONE_OPTION.fontWeight';
const legacySelectedRow = select.replace(phoneMethod, phoneMethod + '\n    Text(option).fontWeight(' + selectedWeight + ');');
assert.throws(() => verifySource(legacySelectedRow, selectFile),
  /private style.*FontWeight\.Bold/, 'retired selected-weight row must not regain admission');

console.log(`PASS conventional Typography coverage: ${files} files, ${consumers} real modifier carriers, ${sharedArguments} public role/spec arguments + ${sharedProducerArguments} exact finite producer arguments; ${approvedArguments} exact approved manga arguments, no unregistered private arguments or retired debt; 2 actual-source regression controls rejected`);

// Approval is finite: retain the whole real carrier, including AUTO omissions.
const approvedFile='manga/MangaDownloadOperationsPanel.ets';
const approvedSource=readFileSync(new URL(approvedFile,root),'utf8');
assert.throws(()=>verifySource(approvedSource.replace('.fontSize(13)', '.fontSize(99)'),approvedFile), /exact approved typography carrier\/tuple changed/);
assert.throws(()=>verifySource(approvedSource.replace('.fontSize(13)', '.fontSize(13).letterSpacing(99)'),approvedFile), /exact approved typography carrier\/tuple changed/);
assert.throws(()=>verifySource(approvedSource.replace('Column({ space: 8 }) {', "Column({ space: 8 }) { Text('未经批准').fontSize(13);"),approvedFile), /exact approved typography carrier\/tuple changed/);

assert.equal(isSharedTypographyExpression("TYPE_DOWNLOAD_CONTROL.fontSizeFp.toString() + 'vp'"), true);
assert.equal(isSharedTypographyExpression("DOWNLOAD_VISUAL.controlFontSize.toString() + 'vp'"), false);
assert.equal(isSharedTypographyExpression("(TYPE_DOWNLOAD_CONTROL.fontSizeFp + 1).toString() + 'vp'"), false);
