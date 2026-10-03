import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';
const root = mkdtempSync(join(tmpdir(), 'reader-private-font-budget-'));
try {
  mkdirSync(join(root, 'tools'));
  mkdirSync(join(root, 'entry/src/main/ets/features/probe'), { recursive: true });
  const file = 'entry/src/main/ets/features/probe/Probe.ets';
  writeFileSync(join(root, 'tools/architecture-consumer-baseline.json'), JSON.stringify({ rows: [{ file, counts: { fontSize: 0, backgroundColor: 0 } }] }));
  const run = expression => {
    writeFileSync(join(root, file), `@Component struct Probe { build() { Column() { Text('probe').fontSize(${expression}); } } }`);
    return spawnSync(process.execPath, [new URL('./test-architecture-consumer-baseline.mjs', import.meta.url).pathname], { cwd: root, encoding: 'utf8' });
  };
  assert.equal(run('TYPE_FORM_ACTION.fontSizeFp').status, 0, 'real public consumer does not raise the old private budget');
  assert.notEqual(run('13').status, 0, 'direct private size rejected at unchanged zero budget');
  assert.notEqual(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : 13').status, 0, 'a TYPE substring cannot hide a private branch');
  assert.notEqual(run('TYPE_FORM_ACTION.fontSizeFp + 2').status, 0, 'private numeric role override rejected');
  assert.notEqual(run("'TYPE_FORM_ACTION.fontSizeFp'").status, 0, 'a string/comment is not a public role expression');
  assert.equal(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : TYPE_FORM_LABEL_ACTION.fontSizeFp').status, 0, 'bounded public variants accepted');
  assert.equal(isSharedTypographyExpression('TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96'), true);
  writeFileSync(join(root,file), "// Text('comment').fontSize(13);\n@Component struct Probe { build() { Column() {} } }");
  const comment = spawnSync(process.execPath,[new URL('./test-architecture-consumer-baseline.mjs',import.meta.url).pathname],{cwd:root,encoding:'utf8'});
  assert.equal(comment.status,0,'ETS comments do not become production consumers');
  console.log('PASS private Typography budget: real public variants admitted; literals/mixed branches/string tricks/numeric overrides rejected; geometry/comments precise');
} finally { rmSync(root,{recursive:true,force:true}); }
