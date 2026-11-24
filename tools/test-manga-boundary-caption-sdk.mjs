import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

for (const id of selectContractCases({
  'boundary-caption': {
    description: 'Actual SDK manga boundary vector, live caption, reveal, and reduced motion',
    resources: [],
  },
})) {
  await verifyBoundaryCaption();
  recordContractCasePass(id);
}

async function verifyBoundaryCaption() {
  const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
  const {default: assert} = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');

  const source = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaBoundaryTurnFeedback.ets', import.meta.url), 'utf8');
  const require = createRequire(import.meta.url);
  const sdk = resolveEtsLoaderRoot();
  const ts = require(`${sdk}/node_modules/typescript`);
  const tree = ts.createSourceFile(virtualFilePath('MangaBoundaryFeedback.ets'), source, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
  assert.equal(tree.parseDiagnostics.length, 0);
  const actor = tree.statements.find(node => node.name?.getText(tree) === 'MangaBoundaryTurnFeedback');
  assert.ok(actor);
  const names = actor.members.map(node => node.name?.getText(tree)).filter(Boolean);
  const captionRole = readerTypographyRoles.MESSAGE_META;

  for (const scheme of ['day', 'night']) {
    const properties = createArkUIPropertyRuntimeProbe();
    const { owner } = createReaderBuilderProbe(source, names,
      { ...properties.sdk, ...productionReaderMotionSdk() }, properties.hooks);
    Object.assign(owner, {scheme, caption:'继续上拉进入下一话：帝都夜谈', distance:60});
    owner.initialRender();
    const nodes = [...owner.nodes.values()], row = nodes.find(node => node.type === 'Row');
    const text = nodes.find(node => node.type === 'Text'), arrow = nodes.find(node => node.type === 'Image');
    assert.deepEqual(nodes.map(node => node.type), ['Row', 'Image', 'Text']);
    assert.equal(arrow.create, scheme === 'night' ? 'app.media.reader_chevron_down_primary_theme_night' : 'app.media.reader_chevron_down_primary');
    assert.equal(arrow.rotate.angle, 180);
    assert.equal(arrow.animation.duration, 160);
    assert.deepEqual(arrow.animation.curve, [.2,0,0,1]);
    assert.equal(text.fontFamily, captionRole.fontFamily);
    assert.equal(text.fontColor, readerAppColor('TOK_PRIMARY_TEXT', scheme));
    assert.equal(text.onClick, undefined);
    assert.equal(row.width,'100%');
    assert.equal(row.backgroundColor, readerAppColor('TOK_SURFACE_ELEVATED', scheme));
    assert.equal(row.hitTestBehavior, 'HitTestMode.None');
    assert.ok(row.opacity > 0 && row.opacity < 1);
    const identities = nodes.map(node => node.id);
    Object.assign(owner,{armed:true,caption:'松手进入下一话：帝都夜谈'});properties.flush();
    assert.equal(arrow.rotate.angle,0);
    assert.equal(text.create,'松手进入下一话：帝都夜谈');
    assert.equal(row.opacity,1);
    owner.reduceMotion=true;properties.flush();
    assert.equal(arrow.rotate.angle,180);
    assert.equal(arrow.animation.duration,0);
    assert.equal(row.animation.duration,120);
    Object.assign(owner,{armed:false,distance:0});properties.flush();
    assert.equal(row.opacity,0);
    assert.deepEqual([...owner.nodes.values()].map(node=>node.id),identities);
  }
}
