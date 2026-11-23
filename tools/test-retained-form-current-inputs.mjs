import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--evidence-path='))?.slice('--evidence-path='.length);
if (output) assert.ok(output.startsWith('.reader-artifacts/') && !output.includes('..'));
const selected = selectContractCases({
  'sync-fields': 'Actual retained WebDAV fields consume current snapshots and drafts, clear acknowledged credentials, preserve masking and update theme icons.',
  'rss-fields': 'Actual retained RSS editor fields consume current snapshots and accepted local edits across all fourteen text fields.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { switchControls } = await import('./lib/reader-switch-control-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { isReaderProductSurfaceEnabled, READER_PRODUCT_PROFILE } = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
  const root = new URL('../', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const syncPath = 'entry/src/main/ets/features/sync/ui/SyncPage.ets';
  const rssPath = 'entry/src/main/ets/features/rss/ui/RssSubscriptionEditorPage.ets';
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(walk)];
  const fieldActors = (owner, controls) => walk(owner).filter(actor => actor instanceof controls.dependencies.ReaderFormField);
  const native = actor => [...actor.nodes.values()].findLast(node => node.type === 'TextInput');
  const results = {};

  function syncScenario(source = read(syncPath)) {
    const controls = foundationControls();
    const defaults = selectedProductionValues(new URL('entry/src/main/ets/features/sync/application/SyncGateway.ts', root),
      ['DEFAULT_WEBDAV_DIRECTORY', 'DEFAULT_SYNC_SNAPSHOT']);
    const members = ['snapshot', 'appThemeScheme', 'webdavUrl', 'webdavUser', 'webdavPath', 'webdavPass', 'backupPass',
      'webdavUrlEdited', 'webdavUserEdited', 'webdavPathEdited', 'appliedSnapshotIdentity', 'acknowledgedSaveGeneration',
      'webdavSection', 'webdavInputRow', 'configActions', 'sectionHeadingDark', 'canEdit', 'canMutate',
      'effectiveWebdavUrl', 'effectiveWebdavUser', 'effectiveWebdavPath', 'onSnapshotChanged', 'syncSnapshotInputs'];
    const probe = createReaderBuilderProbe(source, members, { ...controls.dependencies, ...defaults }, controls.hooks);
    const owner = probe.owner;
    owner.contentFrame = () => ({ width: 320 });
    owner.onSaveConfig = () => {};
    owner.onTestConnection = () => {};
    owner.syncSnapshotInputs(); owner.webdavSection();
    const fields = fieldActors(owner, controls);
    assert.equal(fields.length, 5);
    const publish = patch => {
      owner.updateStateVars({ snapshot: { ...owner.snapshot, ...patch } });
      controls.properties.flush();
    };
    publish({ webdavUrl: 'https://dav.test/new', webdavUser: 'new-user', webdavPath: '/new-path' });
    assert.deepEqual(fields.map(field => field.text), ['https://dav.test/new', 'new-user', '', '', '/new-path'],
      'retained WebDAV fields consume the current loaded snapshot');
    native(fields[0]).onChange('https://dav.test/local');
    native(fields[2]).onChange('ephemeral-test-pass');
    native(fields[3]).onChange('ephemeral-backup-pass');
    controls.properties.flush();
    assert.equal(fields[0].text, 'https://dav.test/local', 'accepted draft reaches retained field');
    assert.equal(fields[2].text, 'ephemeral-test-pass');
    assert.equal(fields[3].text, 'ephemeral-backup-pass');
    assert.equal(native(fields[2]).nativeInputType, 'InputType.Password');
    assert.equal(native(fields[3]).nativeInputType, 'InputType.Password');
    publish({ facts: { busy: false, canMutate: true, operation: { action: 'saveConfig', writeGeneration: 1,
      projection: { receipt: { confirmation: 'confirmed' } } } } });
    assert.deepEqual(fields.slice(2, 4).map(field => field.text), ['', ''], 'confirmed save clears both actual visible credentials');
    publish({ webdavUrl: 'https://dav.test/other', facts: { busy: true, canMutate: false } });
    assert.equal(fields[0].text, 'https://dav.test/local', 'a newer snapshot preserves the locally edited URL');
    assert.ok(fields.every(field => native(field).enabled === false), 'busy facts update actual edit admission');
    const before = owner.webdavUrl;
    native(fields[0]).onChange('disabled callback');
    assert.equal(owner.webdavUrl, before, 'disabled shared field rejects input');
    owner.appThemeScheme = 'night'; controls.properties.flush();
    const image = controls.nodes(owner).find(node => node.type === 'Image');
    assert.match(JSON.stringify(image.create), /sync_server_theme_night/, 'retained icon consumes current app theme');
    assert.equal(fieldActors(owner, controls).length, 5, 'current fields stay retained');
    return { fields: 5, credentialClear: true, localDraftRetained: true, currentTheme: true };
  }

  function rssScenario(source = read(rssPath)) {
    const controls = foundationControls(), toggles = switchControls({ properties: controls.properties });
    const defaults = selectedProductionValues(new URL('entry/src/main/ets/features/rss/application/RssSubscriptionEditorOrchestrator.ets', root),
      ['EMPTY_RSS_EDITOR_SNAPSHOT'], { projectOperationFacts });
    const hooks = { ...controls.hooks, ...toggles.hooks,
      childSources: { ...controls.hooks.childSources, ...toggles.hooks.childSources } };
    const probe = createReaderBuilderProbe(source, ['snapshot', 'presentationIdentity', 'pageContent', 'editorField', 'sectionTitle', 'saveAction'],
      { ...controls.dependencies, ...toggles.dependencies, ...defaults }, hooks);
    const owner = probe.owner;
    owner.operationRecovery = () => {};
    const fieldsBySnapshot = ['title', 'feedUrl', 'sourceGroup', 'customOrder', 'updateIntervalMinutes', 'header',
      'ruleArticles', 'ruleTitle', 'ruleLink', 'rulePubDate', 'ruleDescription', 'ruleImage', 'ruleContent', 'ruleNextPage'];
    const publish = patch => {
      owner.updateStateVars({ snapshot: { ...owner.snapshot, ...patch } });
      controls.properties.flush();
    };
    owner.onTitleChanged = value => publish({ title: value });
    owner.onFeedUrlChanged = value => publish({ feedUrl: value });
    owner.onSourceFieldChanged = (field, value) => publish({ [field]: value });
    owner.onEnabledChanged = () => {};
    owner.onEnabledCookieJarChanged = () => {};
    owner.onSave = () => {};
    owner.pageContent();
    const fields = fieldActors(owner, controls);
    assert.equal(fields.length, 14);
    const changed = Object.fromEntries(fieldsBySnapshot.map((field, index) => [field, `loaded-${index}`]));
    publish(changed);
    assert.deepEqual(fields.map(field => field.text), fieldsBySnapshot.map(field => changed[field]),
      'all retained RSS fields consume the current snapshot');
    for (const [index, field] of fields.entries()) {
      native(field).onChange(`draft-${index}`); controls.properties.flush();
      assert.equal(owner.snapshot[fieldsBySnapshot[index]], `draft-${index}`);
      assert.equal(field.text, `draft-${index}`, 'accepted RSS draft reaches the retained field');
    }
    publish({ busy: true, canSave: false });
    native(fields[0]).onChange('draft while pending'); controls.properties.flush();
    assert.equal(fields[0].text, 'draft while pending', 'local draft remains editable during the original save');
    assert.equal(fieldActors(owner, controls).length, 14);
    return { fields: 14, acceptedCurrentDrafts: 15, sameActors: true };
  }

  if (selected.includes('sync-fields')) {
    results['sync-fields'] = syncScenario();
    const source = read(syncPath);
    const captured = source.replace('value: () => string,', 'value: string,')
      .replace("specId: 'sync-credential', text: value(),", "specId: 'sync-credential', text: value,")
      .replace(/\(\): string => (this\.(?:effectiveWebdav\w+\(\)|webdavPass|backupPass)),/g, '$1,');
    assert.notEqual(captured, source);
    assert.throws(() => syncScenario(captured), /retained WebDAV fields consume the current loaded snapshot/);
    results['sync-fields'].primitiveCaptureNegativeRejected = true;
    recordContractCasePass('sync-fields');
  }
  if (selected.includes('rss-fields')) {
    results['rss-fields'] = rssScenario();
    const source = read(rssPath);
    const captured = source.replace('value: () => string,', 'value: string,')
      .replace("specId: 'form-body', text: value(),", "specId: 'form-body', text: value,")
      .replace(/\(\): string => (this\.snapshot\.\w+),/g, '$1,');
    assert.notEqual(captured, source);
    assert.throws(() => rssScenario(captured), /all retained RSS fields consume the current snapshot/);
    results['rss-fields'].primitiveCaptureNegativeRejected = true;
    recordContractCasePass('rss-fields');
  }
  assert.equal(READER_PRODUCT_PROFILE, 'l0');
  assert.equal(isReaderProductSurfaceEnabled('sync'), false);
  assert.equal(isReaderProductSurfaceEnabled('rss'), false);
  const paths = [syncPath, rssPath, 'tools/test-retained-form-current-inputs.mjs',
    'entry/src/main/ets/ui/controls/ReaderFormField.ets', 'entry/src/main/ets/ui/surfaces/ReaderCard.ets',
    'entry/src/main/ets/app/ReaderProductScope.ts'];
  const report = { status: 'PASS', cases: selected, results,
    inputs: paths.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'Actual production field Builders and current property delivery through installed SDK/shared native fields. Finite snapshots/font/frame/operation ports. Current l0 keeps Sync and RSS closed. Native focus, layout and network/persistence remain separate.' };
  if (output) writeFileSync(new URL(output, root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
