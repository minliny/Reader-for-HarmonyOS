import { approvedTypographyContract, approvedTypographyFile } from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { auditTypographyConsumers, typographyExpressionContext, isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';
import { registeredProducerTypographySlots } from './lib/architecture-shared-producer-contract.mjs';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const producerContract = JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json', import.meta.url), 'utf8'));

// The user-enabled layout inspector is a runtime diagnostic, like the exact
// native diagnostic page policies in architecture-consumer-baseline.json.
// Scope its physical telemetry label to one actual owner/method/tuple. It is
// neither a shared typography producer nor a common-directory exemption.
const diagnosticTypography = new Map([
  ['common/ReaderLayoutDebugOverlay.ets', {
    owner: 'ReaderLayoutDebugOverlay', method: 'build', kind: 'Text',
    modifiers: { fontSize: { expression: '10', extra: [] } },
  }],
]);
function diagnosticTypographyNodes(source, file) {
  const contract = diagnosticTypography.get(file);
  if (!contract) return new Set();
  const nodes = auditTypographyConsumers(source, file);
  assert.equal(nodes.length, 1, file + ': exact single diagnostic telemetry carrier');
  const node = nodes[0];
  assert.deepEqual({ owner: node.owner, method: node.method, kind: node.kind,
    modifiers: Object.fromEntries(Object.entries(node.modifiers).map(([property, modifier]) =>
      [property, { expression: modifier.expression, extra: modifier.extra }])) }, contract,
  file + ': exact diagnostic typography owner/tuple changed');
  assert.ok(node.text.startsWith('`开发者模式 status '), file + ': telemetry label remains diagnostic');
  return new Set(nodes.map(node => node.carrierStart));
}

// Migration is complete: a private parameter cannot regain admission through
// an obsolete debt entry. Retain only actual public roles/specs and the exact
// finite producer slots already verified by the shared contract.
function verifySource(source, file) {
  const expressionContext = typographyExpressionContext(source, 'entry/src/main/ets/features/' + file);
  const producerSlots = registeredProducerTypographySlots(source, 'entry/src/main/ets/features/' + file, producerContract);
  const approved = approvedTypographyContract(source, file);
  const diagnosticNodes = diagnosticTypographyNodes(source, file);
  let consumers = 0, sharedArguments = 0, sharedProducerArguments = 0, approvedArguments = 0, diagnosticArguments = 0;
  for (const node of auditTypographyConsumers(source, file)) {
    consumers++;
    for (const [property, modifier] of Object.entries(node.modifiers)) {
      if (isSharedTypographyExpression(modifier.expression, expressionContext, node.owner)) { sharedArguments++; continue; }
      if (producerSlots.has(node.method, property, modifier.expression)) { sharedProducerArguments++; continue; }
      if (approved.has(node)) { approvedArguments++; continue; }
      if (diagnosticNodes.has(node.carrierStart)) { diagnosticArguments++; continue; }
      assert.fail(`${file}:${node.line}/${property}: private style must consume the public role/spec or exact finite producer (${modifier.expression})`);
    }
  }
  return { consumers, sharedArguments, sharedProducerArguments, approvedArguments, diagnosticArguments };
}

let files = 0, consumers = 0, sharedArguments = 0, sharedProducerArguments = 0, approvedArguments = 0, diagnosticArguments = 0;
for (const file of readdirSync(root, { recursive: true }).filter(file => file.endsWith('.ets') && !file.startsWith('reading/'))) {
  files++;
  const result = verifySource(readFileSync(new URL(file, root), 'utf8'), file);
  consumers += result.consumers;
  sharedArguments += result.sharedArguments;
  sharedProducerArguments += result.sharedProducerArguments;
  approvedArguments += result.approvedArguments;
  diagnosticArguments += result.diagnosticArguments;
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
  /private style.*FontWeight\.Medium|finite shared physical inputs\/role bindings changed/, 'retired menu weight must not regain admission');

const selectFile = 'settings/SettingsSelectOverlay.ets';
const select = readFileSync(new URL(selectFile, root), 'utf8');
const phoneMethod = 'private phoneOption(option: string, index: number) {';
assert.equal(select.split(phoneMethod).length, 2, 'actual phone selection consumer method');
const selectedWeight = 'this.isSelected(option) ? FontWeight.Bold : TYPE_SETTINGS_SELECT_PHONE_OPTION.fontWeight';
const legacySelectedRow = select.replace(phoneMethod, phoneMethod + '\n    Text(option).fontWeight(' + selectedWeight + ');');
assert.throws(() => verifySource(legacySelectedRow, selectFile),
  /private style.*FontWeight\.Bold/, 'retired selected-weight row must not regain admission');

const diagnosticFile = 'common/ReaderLayoutDebugOverlay.ets';
const diagnosticSource = readFileSync(new URL(diagnosticFile, root), 'utf8');
assert.equal(diagnosticArguments, 1, 'one exact user-requested diagnostic typography argument');
assert.throws(() => verifySource(diagnosticSource.replace('.fontSize(10)', '.fontSize(99)'), diagnosticFile),
  /exact diagnostic typography/, 'diagnostic label cannot acquire an arbitrary private size');
assert.throws(() => verifySource(diagnosticSource.replace('.fontSize(10)', '.fontSize(10).lineHeight(99)'), diagnosticFile),
  /exact diagnostic typography/, 'diagnostic tuple cannot admit another physical style');
assert.throws(() => verifySource(diagnosticSource.replace('Canvas(this.drawingContext)', "Text('copied').fontSize(10); Canvas(this.drawingContext)"), diagnosticFile),
  /exact single diagnostic telemetry carrier/, 'diagnostic admission cannot hide a copied label');
assert.throws(() => verifySource(diagnosticSource, 'common/ReaderLayoutDebugOverlayCopy.ets'),
  /private style/, 'diagnostic admission cannot be copied to another common path');

console.log(`PASS conventional Typography coverage: ${files} files, ${consumers} real modifier carriers, ${sharedArguments} public role/spec arguments + ${sharedProducerArguments} exact finite producer arguments; ${approvedArguments} exact approved manga arguments + ${diagnosticArguments} exact diagnostic telemetry argument, no unregistered private arguments or retired debt; 6 actual-source regression controls rejected`);

// Approval is finite: retain the whole real carrier, including AUTO omissions.
const approvedFile='manga/MangaDownloadOperationsPanel.ets';
const approvedSource=readFileSync(new URL(approvedFile,root),'utf8');
assert.throws(()=>verifySource(approvedSource.replace('.fontSize(13)', '.fontSize(99)'),approvedFile), /exact approved typography carrier\/tuple changed/);
assert.throws(()=>verifySource(approvedSource.replace('.fontSize(13)', '.fontSize(13).letterSpacing(99)'),approvedFile), /exact approved typography carrier\/tuple changed/);
assert.throws(()=>verifySource(approvedSource.replace('Column({ space: 8 }) {', "Column({ space: 8 }) { Text('未经批准').fontSize(13);"),approvedFile), /exact approved typography carrier\/tuple changed/);

assert.equal(isSharedTypographyExpression("TYPE_DOWNLOAD_CONTROL.fontSizeFp.toString() + 'vp'"), true);
assert.equal(isSharedTypographyExpression("DOWNLOAD_VISUAL.controlFontSize.toString() + 'vp'"), false);
assert.equal(isSharedTypographyExpression("(TYPE_DOWNLOAD_CONTROL.fontSizeFp + 1).toString() + 'vp'"), false);
